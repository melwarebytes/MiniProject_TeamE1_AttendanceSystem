const jwt = require('jsonwebtoken');
const { app, prisma, request, PASSWORD, createUser, refreshCookie } = require('./helpers');
const authService = require('../services/authService');

afterAll(async () => {
  await prisma.$disconnect();
  await require('../utils/redis').quit();
});

describe('[FR-01] Authentication', () => {
  test('TC-01: valid credentials return a 15-minute token carrying the role, and are audit-logged', async () => {
    const faculty = await createUser('FACULTY');
    const res = await request(app).post('/api/v1/auth/login').send({ email: faculty.email, password: PASSWORD });

    expect(res.status).toBe(200);
    const claims = jwt.decode(res.body.accessToken);
    expect(claims.role).toBe('FACULTY');
    expect(claims.exp - claims.iat).toBe(15 * 60);
    expect(res.body.user).toMatchObject({ email: faculty.email, role: 'FACULTY' });
    expect(res.body.user.passwordHash).toBeUndefined();

    const audit = await prisma.auditLog.findFirst({ where: { actorId: faculty.id, action: 'LOGIN_SUCCESS' } });
    expect(audit).not.toBeNull();
  });

  test('wrong password and unknown email give the same generic 401', async () => {
    const user = await createUser('STUDENT');
    const wrong = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: 'nope-nope-nope' });
    const unknown = await request(app).post('/api/v1/auth/login').send({ email: 'ghost@test.pes.edu', password: 'x' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toBe(unknown.body.error);
    expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
  });

  test('TC-02: five failures lock the account; the correct password is then refused with 423', async () => {
    const user = await createUser('STUDENT');
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: 'Wrong#123' });
      expect(res.status).toBe(401);
    }
    const locked = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD });
    expect(locked.status).toBe(423);
    expect(locked.body.code).toBe('ACCOUNT_LOCKED');

    const failures = await prisma.auditLog.count({
      where: { actorId: user.id, action: { in: ['LOGIN_FAILED', 'ACCOUNT_LOCKED'] } },
    });
    expect(failures).toBe(5);

    // after the 15-minute lock passes, login works again
    await prisma.user.update({ where: { id: user.id }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    const after = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD });
    expect(after.status).toBe(200);
  });

  test('validation: malformed email is rejected with 400 VALIDATION_FAILED', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'not-an-email', password: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });
});

describe('[SR-07] Sessions and token expiry (TC-16)', () => {
  test('refresh cookie is HttpOnly, Secure and SameSite=Strict', async () => {
    const user = await createUser('STUDENT');
    const res = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD });
    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('sams_rt='));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Strict/);
  });

  test('an expired access token is rejected with TOKEN_EXPIRED', async () => {
    const user = await createUser('STUDENT');
    const expired = jwt.sign({ id: user.id, role: 'STUDENT', iat: Math.floor(Date.now() / 1000) - 16 * 60 },
      process.env.JWT_SECRET || 'sams_super_secret_jwt_key_pes_e1_2026', { expiresIn: '15m' });
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });

  test('refresh rotates the token, and logout revokes it', async () => {
    const user = await createUser('STUDENT');
    const login = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD });
    const first = refreshCookie(login);

    const refreshed = await request(app).post('/api/v1/auth/refresh').set('Cookie', first);
    expect(refreshed.status).toBe(200);
    const second = refreshCookie(refreshed);
    expect(second).not.toBe(first);

    // the old token cannot be reused after rotation
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', first)).status).toBe(401);

    expect((await request(app).post('/api/v1/auth/logout').set('Cookie', second)).status).toBe(204);
    const afterLogout = await request(app).post('/api/v1/auth/refresh').set('Cookie', second);
    expect(afterLogout.status).toBe(401);
    expect(afterLogout.body.code).toBe('INVALID_TOKEN');
  });
});

describe('[FR-02] Password reset', () => {
  test('same response whether or not the email exists', async () => {
    const user = await createUser('STUDENT');
    const known = await request(app).post('/api/v1/auth/password-reset/request').send({ email: user.email });
    const unknown = await request(app).post('/api/v1/auth/password-reset/request').send({ email: 'nobody@test.pes.edu' });
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(known.body).toEqual(unknown.body);
  });

  test('a valid link resets the password once, revokes sessions, and cannot be reused', async () => {
    const user = await createUser('STUDENT');
    const login = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD });
    const session = refreshCookie(login);

    // Create a reset token the way the service does and read the raw value back
    const raw = 'test-reset-token-' + user.id;
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: authService.sha256(raw), expiresAt: new Date(Date.now() + 60000) },
    });

    const weak = await request(app).post('/api/v1/auth/password-reset/confirm').send({ token: raw, password: 'password123' });
    expect(weak.status).toBe(400);

    const ok = await request(app).post('/api/v1/auth/password-reset/confirm').send({ token: raw, password: 'A-much-better-pass-9' });
    expect(ok.status).toBe(204);

    const reuse = await request(app).post('/api/v1/auth/password-reset/confirm').send({ token: raw, password: 'Another-good-pass-1' });
    expect(reuse.status).toBe(400);
    expect(reuse.body.code).toBe('RESET_LINK_INVALID');

    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', session)).status).toBe(401);
    const relogin = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: 'A-much-better-pass-9' });
    expect(relogin.status).toBe(200);
  });

  test('an expired link is rejected', async () => {
    const user = await createUser('STUDENT');
    const raw = 'expired-token-' + user.id;
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: authService.sha256(raw), expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await request(app).post('/api/v1/auth/password-reset/confirm').send({ token: raw, password: 'A-much-better-pass-9' });
    expect(res.status).toBe(400);
  });
});

describe('[SETUP-01] Health check', () => {
  test('GET /api/v1/health returns 200', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
