const { app, prisma, request, asUser, uid } = require('./helpers');
const fs = require('fs/promises');
const { checkAndTriggerAlertsForSection } = require('../services/alertService');
let admin, faculty, other, student, section, enrollment;
const api = (method, path, actor = faculty) =>
  request(app)[method]('/api/v1' + path)
    .set('Authorization', `Bearer ${actor.token}`);
const today = () => new Date().toISOString().slice(0, 10);
beforeAll(async () => {
  admin = await asUser('ADMIN');
  faculty = await asUser('FACULTY');
  other = await asUser('FACULTY');
  student = await asUser();
  const course = await prisma.course.create({ data: { code: uid(), name: 'Sprint integration' } });
  section = await prisma.section.create({
    data: {
      courseId: course.id,
      name: 'A',
      semesterStart: new Date('2026-01-01'),
      semesterEnd: new Date('2030-12-31'),
      faculty: { create: { userId: faculty.user.id } },
    },
  });
  enrollment = await prisma.enrollment.create({ data: { sectionId: section.id, userId: student.user.id } });
});
afterAll(() => prisma.$disconnect());

test('scheduling restricts faculty and validates dates, times, duplicate generation and cancellation', async () => {
  const extra = { sectionId: section.id, date: today(), startTime: '09:00', endTime: '10:00' };
  expect((await api('post', '/sessions/extra', other).send(extra)).status).toBe(403);
  for (const change of [{ date: '2026-02-30' }, { startTime: '25:00' }, { endTime: '08:00' }])
    expect((await api('post', '/sessions/extra').send({ ...extra, ...change })).status).toBe(400);
  const created = await api('post', '/sessions/extra').send(extra);
  expect(created.status).toBe(201);
  expect((await api('post', '/sessions/extra').send(extra)).status).toBe(409);
  const id = created.body.session.id;
  expect((await api('patch', `/sessions/${id}/cancel`, other).send({ reason: 'Holiday' })).status).toBe(403);
  expect((await api('patch', `/sessions/${id}/cancel`).send({ reason: ' ' })).status).toBe(400);
  expect((await api('patch', `/sessions/${id}/cancel`).send({ reason: 'Holiday' })).status).toBe(200);
  expect((await api('get', `/sessions?sectionId=${section.id}`, other)).body.sessions).toEqual([]);
  const slots = [{ dayOfWeek: 'MON', startTime: '11:00', endTime: '12:00' }];
  expect((await api('put', `/sections/${section.id}/timetable`, other).send({ slots })).status).toBe(403);
  expect(
    (await api('put', `/sections/${section.id}/timetable`).send({ slots: [...slots, ...slots] })).status,
  ).toBe(400);
  expect((await api('put', `/sections/${section.id}/timetable`).send({ slots })).status).toBe(200);
  // A one-week semester keeps this generation test small and deterministic.
  await prisma.section.update({
    where: { id: section.id },
    data: { semesterStart: new Date('2026-10-26'), semesterEnd: new Date('2026-11-01') },
  });
  const generated = await api('post', '/sessions/generate').send({ sectionId: section.id });
  expect(generated.status).toBe(201);
  expect(generated.body.count).toBe(1);
  expect((await api('post', '/sessions/generate').send({ sectionId: section.id })).body.count).toBe(0);
});

test('leave rejects spoofed/oversized attachments and keeps accepted documents private', async () => {
  const post = () =>
    api('post', '/leave', student)
      .field('sectionId', section.id)
      .field('startDate', today())
      .field('endDate', today())
      .field('reason', 'Medical leave');
  expect(
    (
      await post().attach('document', Buffer.from('not a PDF'), {
        filename: 'fake.pdf',
        contentType: 'application/pdf',
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await post().attach('document', Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: 'large.pdf',
        contentType: 'application/pdf',
      })
    ).status,
  ).toBe(400);
  const result = await post().attach('document', Buffer.from('%PDF-1.4\n%%EOF'), {
    filename: 'note.pdf',
    contentType: 'application/pdf',
  });
  expect(result.status).toBe(201);
  const leave = result.body.leave;
  try {
    expect((await api('get', `/leave/${leave.id}/document`, student)).status).toBe(200);
    expect((await api('get', `/leave/${leave.id}/document`)).status).toBe(200);
    expect((await api('get', `/leave/${leave.id}/document`, other)).status).toBe(403);
    expect((await api('get', '/leave', other)).body.leaves).toEqual([]);
    expect((await api('patch', `/leave/${leave.id}/review`, other).send({ action: 'APPROVE' })).status).toBe(
      403,
    );
    const session = await prisma.session.create({
      data: {
        sectionId: section.id,
        date: new Date(today()),
        startTime: '13:00',
        endTime: '14:00',
        attendanceRecords: { create: { enrollmentId: enrollment.id, status: 'ABSENT' } },
      },
    });
    expect((await api('patch', `/leave/${leave.id}/review`).send({ action: 'APPROVE' })).status).toBe(200);
    expect((await prisma.attendanceRecord.findFirst({ where: { sessionId: session.id } })).status).toBe(
      'EXCUSED',
    );
    expect((await api('patch', `/leave/${leave.id}/review`).send({ action: 'REJECT' })).status).toBe(400);
  } finally {
    await fs.unlink(leave.documentPath);
  }
});

test('corrections enforce the edit window and admin review, omit hashes, and audit the change', async () => {
  const old = new Date();
  old.setUTCDate(old.getUTCDate() - 10);
  const session = await prisma.session.create({
    data: { sectionId: section.id, date: old, startTime: '09:00', endTime: '10:00' },
  });
  const record = await prisma.attendanceRecord.create({
    data: { sessionId: session.id, enrollmentId: enrollment.id, status: 'ABSENT' },
  });
  const correction = { newStatus: 'PRESENT', reason: 'Verified attendance', attendanceRecordId: record.id };
  expect((await api('patch', `/corrections/direct/${record.id}`).send(correction)).status).toBe(400);
  expect((await api('post', '/corrections/request', other).send(correction)).status).toBe(403);
  expect(
    (await api('post', '/corrections/request').send({ ...correction, newStatus: 'INVALID' })).status,
  ).toBe(400);
  const submitted = await api('post', '/corrections/request').send(correction);
  expect(submitted.status).toBe(201);
  expect(JSON.stringify(submitted.body)).not.toContain('passwordHash');
  const id = submitted.body.request.id;
  expect((await api('patch', `/corrections/${id}/review`).send({ action: 'APPROVE' })).status).toBe(403);
  const result = await api('patch', `/corrections/${id}/review`, admin).send({ action: 'APPROVE' });
  expect(result.status).toBe(200);
  expect(JSON.stringify(result.body)).not.toContain('passwordHash');
  expect((await prisma.attendanceRecord.findUnique({ where: { id: record.id } })).status).toBe('PRESENT');
  expect(await prisma.auditLog.count({ where: { action: 'CORRECTION_APPROVED', entityId: id } })).toBe(1);
});

test('concurrent low-attendance checks send one alert and faculty cannot inspect other sections', async () => {
  const session = await prisma.session.create({
    data: { sectionId: section.id, date: new Date('2026-01-05'), startTime: '09:00', endTime: '10:00' },
  });
  await prisma.attendanceRecord.create({
    data: { sessionId: session.id, enrollmentId: enrollment.id, status: 'ABSENT' },
  });
  expect((await api('post', `/alerts/trigger/${section.id}`, other).send({})).status).toBe(403);
  expect((await api('get', `/dashboard/student/${student.user.id}`, other)).status).toBe(403);
  const results = await Promise.all([
    checkAndTriggerAlertsForSection(section.id),
    checkAndTriggerAlertsForSection(section.id),
  ]);
  expect(results.flat()).toHaveLength(1);
  expect(await checkAndTriggerAlertsForSection(section.id)).toEqual([]);
  expect((await api('get', '/alerts/my', student)).body.alerts).toHaveLength(1);
});

test('assigned faculty can mark attendance; other faculty and SQL-shaped credentials cannot', async () => {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const session = await prisma.session.create({ data: { sectionId: section.id, date: new Date(date), startTime: '00:00', endTime: '23:59' } });
  const records = [{ enrollmentId: enrollment.id, status: 'LATE' }];
  expect((await api('post', `/attendance/roster/${session.id}`, other).send({ records })).status).toBe(403);
  const saved = await api('post', `/attendance/roster/${session.id}`).send({ records });
  expect(saved.status).toBe(200);
  expect((await prisma.attendanceRecord.findFirst({ where: { sessionId: session.id, enrollmentId: enrollment.id } })).status).toBe('LATE');
  const login = await request(app).post('/api/v1/auth/login').send({ email: "' OR 1=1 --", password: 'Correct-Horse-42' });
  expect(login.status).toBe(400);
  expect(await prisma.user.findUnique({ where: { id: student.user.id } })).not.toBeNull();
});
