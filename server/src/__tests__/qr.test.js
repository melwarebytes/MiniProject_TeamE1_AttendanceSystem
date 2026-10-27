const crypto = require('crypto');
const { app, prisma, request, uid, asUser } = require('./helpers');
const redis = require('../utils/redis');

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

/** A section taught by `faculty` with one session today and one enrolled student. */
async function classToday(faculty, student) {
  const course = await prisma.course.create({ data: { code: `Q${uid().toUpperCase()}`, name: 'QR Test Course' } });
  const section = await prisma.section.create({
    data: { courseId: course.id, name: 'A', semesterStart: new Date('2026-08-01'), semesterEnd: new Date('2026-12-31') },
  });
  await prisma.sectionFaculty.create({ data: { sectionId: section.id, userId: faculty.id } });
  if (student) await prisma.enrollment.create({ data: { sectionId: section.id, userId: student.id } });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const session = await prisma.session.create({ data: { sectionId: section.id, date: today, startTime: '09:00', endTime: '10:00' } });
  return { section, session };
}

async function openAndGetToken(facultyToken, sessionId, minutes = 5) {
  const open = await request(app).post(`/api/v1/sessions/${sessionId}/qr`).set('Authorization', `Bearer ${facultyToken}`).send({ minutes });
  expect(open.status).toBe(201);
  const tok = await request(app).get(`/api/v1/sessions/${sessionId}/qr/token`).set('Authorization', `Bearer ${facultyToken}`);
  expect(tok.status).toBe(200);
  return tok.body.token;
}

const checkIn = (token, qr) => request(app).post('/api/v1/checkins').set('Authorization', `Bearer ${token}`).send({ token: qr });

describe('[FR-07] QR check-in', () => {
  test('TC-06: an enrolled student checks in and is marked PRESENT with source QR', async () => {
    const { user: faculty, token: facultyToken } = await asUser('FACULTY');
    const { user: student, token: studentToken } = await asUser('STUDENT');
    const { session } = await classToday(faculty, student);
    const qr = await openAndGetToken(facultyToken, session.id);

    const res = await checkIn(studentToken, qr);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PRESENT');

    const record = await prisma.attendanceRecord.findFirst({ where: { sessionId: session.id } });
    expect(record).toMatchObject({ status: 'PRESENT', source: 'QR' });

    const status = await request(app).get(`/api/v1/sessions/${session.id}/qr`).set('Authorization', `Bearer ${facultyToken}`);
    expect(status.body).toMatchObject({ open: true, checkedIn: 1, enrolled: 1 });
  });

  test('TC-07: expired, duplicate and tampered tokens are rejected and create no record', async () => {
    const { user: faculty, token: facultyToken } = await asUser('FACULTY');
    const { user: s1, token: s1Token } = await asUser('STUDENT');
    const { user: s2, token: s2Token } = await asUser('STUDENT');
    const { session, section } = await classToday(faculty, s1);
    await prisma.enrollment.create({ data: { sectionId: section.id, userId: s2.id } });
    const qr = await openAndGetToken(facultyToken, session.id);

    // 1. a token captured 45 s ago (re-signed with an old expiry) is refused
    const [payload] = qr.split('.');
    const [sid, wid, nonce] = Buffer.from(payload, 'base64url').toString().split('.');
    const oldPayload = Buffer.from([sid, wid, nonce, Date.now() - 15000].join('.')).toString('base64url');
    const oldSig = crypto.createHmac('sha256', process.env.QR_HMAC_SECRET || 'dev-only-qr-secret').update(oldPayload).digest('base64url');
    const expired = await checkIn(s2Token, `${oldPayload}.${oldSig}`);
    expect(expired.status).toBe(410);
    expect(expired.body.code).toBe('QR_EXPIRED');

    // 2. a second check-in by the same student is refused
    expect((await checkIn(s1Token, qr)).status).toBe(201);
    const dup = await checkIn(s1Token, qr);
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('DUPLICATE_CHECKIN');

    // 3. one character of the signature changed
    const tampered = qr.slice(0, -1) + (qr.endsWith('A') ? 'B' : 'A');
    const bad = await checkIn(s2Token, tampered);
    expect(bad.status).toBe(401);
    expect(bad.body.code).toBe('INVALID_TOKEN');

    // only s1's single check-in exists
    expect(await prisma.attendanceRecord.count({ where: { sessionId: session.id } })).toBe(1);
    const rejections = await prisma.auditLog.count({ where: { action: 'QR_CHECKIN_REJECTED', actorId: { in: [s1.id, s2.id] } } });
    expect(rejections).toBe(3);
  });

  test('a student from another section is rejected with NOT_ENROLLED', async () => {
    const { user: faculty, token: facultyToken } = await asUser('FACULTY');
    const { token: outsiderToken } = await asUser('STUDENT');
    const { session } = await classToday(faculty, null);
    const qr = await openAndGetToken(facultyToken, session.id);
    const res = await checkIn(outsiderToken, qr);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOT_ENROLLED');
  });

  test('closing the window makes the current code stop working', async () => {
    const { user: faculty, token: facultyToken } = await asUser('FACULTY');
    const { user: student, token: studentToken } = await asUser('STUDENT');
    const { session } = await classToday(faculty, student);
    const qr = await openAndGetToken(facultyToken, session.id);
    expect((await request(app).delete(`/api/v1/sessions/${session.id}/qr`).set('Authorization', `Bearer ${facultyToken}`)).status).toBe(204);
    expect((await checkIn(studentToken, qr)).status).toBe(410);
  });

  test('only assigned faculty can open a window, and only for 1–10 minutes', async () => {
    const { user: faculty, token: facultyToken } = await asUser('FACULTY');
    const { token: otherToken } = await asUser('FACULTY');
    const { session } = await classToday(faculty, null);
    const other = await request(app).post(`/api/v1/sessions/${session.id}/qr`).set('Authorization', `Bearer ${otherToken}`).send({ minutes: 5 });
    expect(other.status).toBe(403);
    const tooLong = await request(app).post(`/api/v1/sessions/${session.id}/qr`).set('Authorization', `Bearer ${facultyToken}`).send({ minutes: 30 });
    expect(tooLong.status).toBe(400);
  });

  test('a window cannot be opened for a class on another day', async () => {
    const { user: faculty, token: facultyToken } = await asUser('FACULTY');
    const { section } = await classToday(faculty, null);
    const past = await prisma.session.create({ data: { sectionId: section.id, date: new Date('2026-08-10'), startTime: '09:00', endTime: '10:00' } });
    const res = await request(app).post(`/api/v1/sessions/${past.id}/qr`).set('Authorization', `Bearer ${facultyToken}`).send({ minutes: 5 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SESSION_NOT_TODAY');
  });
});
