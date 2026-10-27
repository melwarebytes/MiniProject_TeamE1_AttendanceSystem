const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const { recordAuditLog } = require('./auditService');
const { sendEmail } = require('../utils/mailer');
const { AppError, unauthorized, badRequest } = require('../utils/errors');
const { checkPasswordPolicy, hashPassword, verifyPassword } = require('../utils/password');

const JWT_SECRET = process.env.JWT_SECRET || 'sams_super_secret_jwt_key_pes_e1_2026';
const ACCESS_TTL = process.env.JWT_EXPIRES_IN || '15m'; // SR-07: 15-minute access tokens
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // SR-07: 7 days
const REFRESH_IDLE_MS = 30 * 60 * 1000; // SR-07: or 30 minutes of inactivity
const MAX_FAILED_LOGINS = 5; // SR-04
const LOCKOUT_MS = 15 * 60 * 1000; // SR-04: 15 minutes
const RESET_TTL_MS = 15 * 60 * 1000; // FR-02: reset links expire after 15 minutes

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const randomToken = (bytes = 48) => crypto.randomBytes(bytes).toString('base64url');

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    srn: user.srn,
    department: user.department,
  };
}

function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: ACCESS_TTL, jwtid: crypto.randomUUID() }
  );
}

async function issueRefreshToken(userId, tx = prisma) {
  const raw = randomToken();
  await tx.refreshToken.create({
    data: { userId, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
  });
  return raw;
}

/**
 * FR-01: authenticate by email + password.
 * Five consecutive failures lock the account for 15 minutes (SR-04).
 * Every attempt is written to the audit log (SR-06).
 */
async function login({ email, password, ip }) {
  const normalized = String(email || '').trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });

  if (!user || !user.active) {
    await recordAuditLog({ action: 'LOGIN_FAILED', entity: 'users', entityId: normalized, ip, newValue: { reason: 'unknown_or_inactive' } });
    throw unauthorized('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await recordAuditLog({ actorId: user.id, action: 'LOGIN_BLOCKED', entity: 'users', entityId: user.id, ip });
    throw new AppError(423, 'ACCOUNT_LOCKED', 'Account locked after repeated failed logins. Try again later.', {
      lockedUntil: user.lockedUntil,
    });
  }

  const ok = await verifyPassword(password || '', user.passwordHash);
  if (!ok) {
    const failed = user.failedLoginCount + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await prisma.user.update({
      where: { id: user.id },
      data: lock
        ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCKOUT_MS) }
        : { failedLoginCount: failed },
    });
    await recordAuditLog({
      actorId: user.id,
      action: lock ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
      entity: 'users',
      entityId: user.id,
      ip,
      newValue: { failedAttempts: failed },
    });
    throw unauthorized('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const refreshToken = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
    const raw = await issueRefreshToken(user.id, tx);
    await recordAuditLog({ actorId: user.id, action: 'LOGIN_SUCCESS', entity: 'users', entityId: user.id, ip, tx });
    return raw;
  });

  return { accessToken: signAccessToken(user), refreshToken, user: publicUser(user) };
}

/** SR-07: rotate the refresh token and issue a new access token. */
async function refresh(rawToken) {
  if (!rawToken) throw unauthorized('INVALID_TOKEN', 'Session expired. Please log in again.');
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(rawToken) },
    include: { user: true },
  });
  const now = new Date();
  const idleExpired = stored && now - stored.lastUsedAt > REFRESH_IDLE_MS;
  if (!stored || stored.revokedAt || stored.expiresAt < now || idleExpired || !stored.user.active) {
    if (stored && !stored.revokedAt) {
      await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: now } });
    }
    throw unauthorized('INVALID_TOKEN', 'Session expired. Please log in again.');
  }

  const newRaw = await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: now } });
    return issueRefreshToken(stored.userId, tx);
  });
  return { accessToken: signAccessToken(stored.user), refreshToken: newRaw, user: publicUser(stored.user) };
}

async function logout(rawToken, actorId, ip) {
  if (rawToken) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  if (actorId) await recordAuditLog({ actorId, action: 'LOGOUT', entity: 'users', entityId: actorId, ip });
}

/**
 * FR-02: email a single-use reset link. The response never reveals whether the
 * email exists, so callers always return the same message.
 */
async function requestPasswordReset(email, ip) {
  const normalized = String(email || '').trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user || !user.active) return;

  const raw = randomToken(32);
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
  });
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const link = `${appUrl}/reset-password?token=${raw}`;
  await sendEmail({
    to: user.email,
    subject: 'SAMS password reset',
    text: `Use this link within 15 minutes to reset your SAMS password: ${link}\nIf you did not ask for this, ignore this email.`,
  });
  await recordAuditLog({ actorId: user.id, action: 'PASSWORD_RESET_REQUESTED', entity: 'users', entityId: user.id, ip });
}

/** FR-02: set a new password and revoke every existing session. */
async function confirmPasswordReset(rawToken, newPassword, ip) {
  const policyError = checkPasswordPolicy(newPassword);
  if (policyError) throw badRequest(policyError, [{ field: 'password', message: policyError }]);

  const stored = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(rawToken || '') } });
  if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
    throw new AppError(400, 'RESET_LINK_INVALID', 'This reset link is invalid or has expired. Request a new one.');
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } });
    await tx.user.update({
      where: { id: stored.userId },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    });
    await tx.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await recordAuditLog({ actorId: stored.userId, action: 'PASSWORD_RESET', entity: 'users', entityId: stored.userId, ip, tx });
  });
}

module.exports = {
  login,
  refresh,
  logout,
  requestPasswordReset,
  confirmPasswordReset,
  publicUser,
  sha256,
  REFRESH_TTL_MS,
};
