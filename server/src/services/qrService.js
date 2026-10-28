/**
 * FR-07 / SR-05: QR-code self check-in with rotating, signed tokens (SADS §6.4).
 *
 * Token = base64url(sessionId.windowId.nonce.exp) + "." + HMAC-SHA256(secret, payload)
 *
 * verify():
 *   1. constant-time HMAC check           -> 401 INVALID_TOKEN
 *   2. not expired and window still open  -> 410 QR_EXPIRED
 *   3. nonce was issued by this server    -> 401 INVALID_TOKEN
 *   4. student enrolled in the section    -> 403 NOT_ENROLLED
 *   5. first check-in for this session    -> 409 DUPLICATE_CHECKIN
 */
const crypto = require('crypto');
const { eligibleForSession } = require('./membershipService');
const prisma = require('../utils/prisma');
const redis = require('../utils/redis');
const { recordAuditLog } = require('./auditService');
const { isFacultyAssigned } = require('./attendanceService');
const { AppError, badRequest, forbidden, notFound } = require('../utils/errors');

const TOKEN_TTL_S = 30; // tokens live 30 s; the classroom screen replaces them every 25 s
const MIN_WINDOW_MIN = 1;
const MAX_WINDOW_MIN = 10;

const secret = () => process.env.QR_HMAC_SECRET || 'dev-only-qr-secret';
const b64 = (s) => Buffer.from(s).toString('base64url');
const sign = (payload) => crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
const windowKey = (sessionId) => `qr:window:${sessionId}`;
const nonceKey = (nonce) => `qr:nonce:${nonce}`;
const checkinKey = (sessionId, studentId) => `qr:checkin:${sessionId}:${studentId}`;

async function connected() {
  try {
    await redis.ping();
  } catch (e) {
    throw new AppError(503, 'SERVICE_UNAVAILABLE', 'QR check-in is temporarily unavailable. Ask your teacher to mark you manually.');
  }
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

async function loadSessionFor(sessionId, user) {
  const session = await prisma.session.findUnique({ where: { id: sessionId }, include: { section: { include: { course: true } } } });
  if (!session) throw notFound('Session not found.');
  if (user.role === 'FACULTY' && !(await isFacultyAssigned(user.id, session.sectionId))) {
    throw forbidden('You are not assigned to this section.');
  }
  return session;
}

async function getWindow(sessionId) {
  const raw = await redis.get(windowKey(sessionId));
  return raw ? JSON.parse(raw) : null;
}

/** Faculty opens a check-in window of 1–10 minutes for today's session. */
async function openWindow(sessionId, minutes, user, ip) {
  await connected();
  const session = await loadSessionFor(sessionId, user);
  const mins = Number(minutes ?? session.section.qrWindowMinutes);
  if (!Number.isInteger(mins) || mins < MIN_WINDOW_MIN || mins > MAX_WINDOW_MIN) {
    throw badRequest(`Window length must be between ${MIN_WINDOW_MIN} and ${MAX_WINDOW_MIN} minutes.`);
  }
  if (session.status === 'CANCELLED') throw new AppError(409, 'SESSION_CANCELLED', 'This session was cancelled.');
  if (!isSameDay(new Date(session.date), new Date())) {
    throw new AppError(409, 'SESSION_NOT_TODAY', 'QR check-in can only be opened on the day of the class.');
  }

  const expiresAt = Date.now() + mins * 60 * 1000;
  const win = { windowId: crypto.randomUUID(), openedBy: user.id, expiresAt };
  await redis.set(windowKey(sessionId), JSON.stringify(win), 'PX', mins * 60 * 1000);
  await recordAuditLog({ actorId: user.id, action: 'QR_WINDOW_OPENED', entity: 'sessions', entityId: sessionId, newValue: { minutes: mins }, ip });
  return { sessionId, windowId: win.windowId, expiresAt: new Date(expiresAt).toISOString() };
}

async function closeWindow(sessionId, user, ip) {
  await connected();
  await loadSessionFor(sessionId, user);
  await redis.del(windowKey(sessionId));
  await recordAuditLog({ actorId: user.id, action: 'QR_WINDOW_CLOSED', entity: 'sessions', entityId: sessionId, ip });
}

/** A fresh token for the classroom screen. Called every 25 s while the window is open. */
async function issueToken(sessionId, user) {
  await connected();
  await loadSessionFor(sessionId, user);
  const win = await getWindow(sessionId);
  if (!win) throw new AppError(410, 'QR_WINDOW_CLOSED', 'The check-in window is closed.');

  const nonce = crypto.randomBytes(16).toString('base64url');
  const exp = Math.min(Date.now() + TOKEN_TTL_S * 1000, win.expiresAt);
  const payload = b64([sessionId, win.windowId, nonce, exp].join('.'));
  await redis.set(nonceKey(nonce), sessionId, 'PX', Math.max(exp - Date.now(), 1000));
  return { token: `${payload}.${sign(payload)}`, expiresAt: new Date(exp).toISOString(), windowExpiresAt: new Date(win.expiresAt).toISOString() };
}

async function status(sessionId, user) {
  await connected();
  const session = await loadSessionFor(sessionId, user);
  const win = await getWindow(sessionId);
  const checkedIn = await prisma.attendanceRecord.count({ where: { sessionId, source: 'QR' } });
  const enrolled = await prisma.enrollment.count({ where: { sectionId: session.sectionId } });
  return { open: !!win, windowExpiresAt: win ? new Date(win.expiresAt).toISOString() : null, checkedIn, enrolled };
}

function reject(status, code, message) {
  return new AppError(status, code, message);
}

/** Student scans the code. Records PRESENT with source QR. */
async function checkIn(token, student, ip) {
  await connected();
  const fail = async (err, sessionId = null) => {
    await recordAuditLog({ actorId: student.id, action: 'QR_CHECKIN_REJECTED', entity: 'sessions', entityId: sessionId || 'unknown', newValue: { reason: err.code }, ip });
    return err;
  };

  // 1. signature
  const [payload, sig] = String(token || '').split('.');
  const expected = payload ? sign(payload) : '';
  const valid =
    payload && sig && sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!valid) throw await fail(reject(401, 'INVALID_TOKEN', 'This QR code is not valid.'));

  const [sessionId, windowId, nonce, expStr] = Buffer.from(payload, 'base64url').toString().split('.');
  const exp = Number(expStr);

  // 2. expiry and open window
  const win = await getWindow(sessionId);
  if (!exp || Date.now() > exp || !win || win.windowId !== windowId) {
    throw await fail(reject(410, 'QR_EXPIRED', 'This QR code has expired. Scan the code currently on screen.'), sessionId);
  }

  // 3. nonce issued by this server
  if (!(await redis.exists(nonceKey(nonce)))) {
    throw await fail(reject(401, 'INVALID_TOKEN', 'This QR code is not valid.'), sessionId);
  }

  // 4. enrolment
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  const enrollment = session
    ? await prisma.enrollment.findUnique({ where: { sectionId_userId: { sectionId: session.sectionId, userId: student.id } }, include: { periods: true } })
    : null;
  if (!enrollment || !eligibleForSession(enrollment, session) || session.status === 'CANCELLED') throw await fail(reject(403, 'NOT_ENROLLED', 'You are not enrolled in this class.'), sessionId);

  // 5. one check-in per student per session (atomic)
  const first = await redis.set(checkinKey(sessionId, student.id), '1', 'EX', 24 * 60 * 60, 'NX');
  const existingQr = await prisma.attendanceRecord.findFirst({ where: { sessionId, enrollmentId: enrollment.id, source: 'QR' } });
  if (!first || existingQr) {
    throw await fail(reject(409, 'DUPLICATE_CHECKIN', 'You have already checked in for this class.'), sessionId);
  }

  const now = new Date();
  const record = await prisma.$transaction(async (tx) => {
    const rec = await tx.attendanceRecord.upsert({
      where: { enrollmentId_sessionId: { enrollmentId: enrollment.id, sessionId } },
      update: { status: 'PRESENT', source: 'QR', markedAt: now, markedById: null, version: { increment: 1 } },
      create: { enrollmentId: enrollment.id, sessionId, status: 'PRESENT', source: 'QR', markedAt: now },
    });
    await recordAuditLog({ actorId: student.id, action: 'QR_CHECKIN', entity: 'attendance_records', entityId: rec.id, newValue: { sessionId, status: 'PRESENT' }, ip, tx });
    return rec;
  });

  const info = await prisma.section.findUnique({ where: { id: session.sectionId }, include: { course: true } });
  return {
    sessionId,
    status: record.status,
    checkedInAt: now.toISOString(),
    course: `${info.course.code}-${info.name} · ${info.course.name}`,
    time: `${session.startTime}–${session.endTime}`,
  };
}

/** Today's classes for the signed-in faculty member (all classes for admins). */
async function todaysSessions(user) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  const where = { date: { gte: start, lte: end }, status: { not: 'CANCELLED' } };
  if (user.role === 'FACULTY') where.section = { faculty: { some: { userId: user.id } } };
  const sessions = await prisma.session.findMany({
    where,
    orderBy: { startTime: 'asc' },
    include: { section: { include: { course: true, _count: { select: { enrollments: true } } } } },
  });
  return Promise.all(
    sessions.map(async (s) => ({
      id: s.id,
      course: `${s.section.course.code}-${s.section.name}`,
      courseName: s.section.course.name,
      qrWindowMinutes: s.section.qrWindowMinutes,
      startTime: s.startTime,
      endTime: s.endTime,
      enrolled: s.section._count.enrollments,
      windowOpen: !!(await getWindow(s.id).catch(() => null)),
    }))
  );
}

module.exports = { openWindow, closeWindow, issueToken, status, checkIn, todaysSessions, TOKEN_TTL_S };
