const { app, prisma, request, asUser, createUser, uid } = require('./helpers');
const { runRetention } = require('../jobs/retentionJob');
const { eligibleForSession } = require('../services/membershipService');
const { Client } = require('pg');
let admin, student, faculty, otherFaculty, course, section, otherSection;
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const api = (method, path, token = admin.token) =>
  request(app)[method]('/api/v1' + path)
    .set(auth(token));
const profile = () => ({
  name: 'Imported student',
  email: `import.${uid()}@pes.edu`,
  srn: `SRN-${uid()}`,
  role: 'STUDENT',
  password: 'Correct-Horse-42',
});
beforeAll(async () => {
  admin = await asUser('ADMIN');
  student = await asUser();
  faculty = await asUser('FACULTY');
  otherFaculty = await asUser('FACULTY');
  course = await prisma.course.create({ data: { code: uid(), name: 'Testing' } });
  section = await prisma.section.create({
    data: {
      courseId: course.id,
      name: 'A',
      semesterStart: new Date('2026-01-01'),
      semesterEnd: new Date('2026-12-31'),
      faculty: { create: { userId: faculty.user.id } },
    },
  });
  otherSection = await prisma.section.create({
    data: {
      courseId: course.id,
      name: 'B',
      semesterStart: new Date('2026-01-01'),
      semesterEnd: new Date('2026-12-31'),
    },
  });
});
afterAll(() => prisma.$disconnect());

test('admin endpoints reject students and faculty; output omits credentials', async () => {
  expect((await api('get', '/users', student.token)).status).toBe(403);
  expect((await api('post', '/courses', faculty.token).send({ code: 'x', name: 'x' })).status).toBe(403);
  const r = await api('get', '/users');
  expect(r.status).toBe(200);
  expect(r.body.data[0]).not.toHaveProperty('passwordHash');
});
test('creates, updates, deactivates and reactivates a user without losing history', async () => {
  const data = profile();
  const created = await api('post', '/users').send(data);
  expect(created.status).toBe(201);
  const id = created.body.id;
  const enrollment = await prisma.enrollment.create({ data: { sectionId: section.id, userId: id } });
  expect((await api('patch', `/users/${id}`).send({ active: false })).status).toBe(200);
  expect(
    (await request(app).post('/api/v1/auth/login').send({ email: data.email, password: data.password }))
      .status,
  ).toBe(401);
  expect(await prisma.enrollment.findUnique({ where: { id: enrollment.id } })).not.toBeNull();
  expect((await api('patch', `/users/${id}`).send({ active: true, name: 'Updated' })).status).toBe(200);
  expect(
    (await request(app).post('/api/v1/auth/login').send({ email: data.email, password: data.password }))
      .status,
  ).toBe(200);
});
test('CSV accepts quoted fields and rejects individual invalid rows with physical line numbers', async () => {
  const valid = profile();
  const csv = `name,email,role,srn,password\r\n"Student, One",${valid.email},STUDENT,${valid.srn},Correct-Horse-42\r\nBad,no-email,STUDENT,x,Correct-Horse-42\r\nShort,row\r\n`;
  const r = await api('post', '/users/import').attach('file', Buffer.from(csv), 'users.csv');
  expect(r.status).toBe(200);
  expect(r.body.imported).toBe(1);
  expect(r.body.rejected).toBe(2);
  expect(r.body.errors.map((e) => e.row)).toEqual([3, 4]);
  expect((await prisma.user.findUnique({ where: { email: valid.email } })).name).toBe('Student, One');
});
test('CSV rejects 5001 rows and accepts exactly 5000 row-level errors', async () => {
  const header = 'name,email,role,srn\n',
    row = 'Invalid,bad,STUDENT,x\n';
  expect(
    (await api('post', '/users/import').attach('file', Buffer.from(header + row.repeat(5001)), 'large.csv'))
      .status,
  ).toBe(400);
  const r = await api('post', '/users/import').attach(
    'file',
    Buffer.from(header + row.repeat(5000)),
    'limit.csv',
  );
  expect(r.status).toBe(200);
  expect(r.body.rejected).toBe(5000);
}, 30000);
test('invalid role, domain, password and duplicate SRN are rejected', async () => {
  for (const data of [
    { ...profile(), role: 'ADMIN' },
    { ...profile(), email: 'x@example.com' },
    { ...profile(), password: 'password123' },
  ])
    expect((await api('post', '/users').send(data)).status).toBe(400);
  const data = profile();
  expect((await api('post', '/users').send(data)).status).toBe(201);
  expect((await api('post', '/users').send({ ...data, email: `other.${uid()}@pes.edu` })).status).toBe(409);
});
test('roster edits preserve past membership; same course/semester duplicates are rejected', async () => {
  const s = await createUser();
  const enroll = await prisma.enrollment.create({ data: { sectionId: section.id, userId: s.id } });
  expect((await api('put', `/sections/${otherSection.id}/enrolments`).send({ userIds: [s.id] })).status).toBe(
    409,
  );
  expect((await api('put', `/sections/${section.id}/enrolments`).send({ userIds: [] })).status).toBe(200);
  const old = await prisma.enrollment.findUnique({ where: { id: enroll.id }, include: { periods: true } });
  expect(eligibleForSession(old, { date: '2026-01-10', startTime: '09:00' })).toBe(true);
  expect(eligibleForSession(old, { date: '2099-01-10', startTime: '09:00' })).toBe(false);
  expect((await api('put', `/sections/${otherSection.id}/enrolments`).send({ userIds: [s.id] })).status).toBe(
    200,
  );
  expect(
    (await api('put', `/sections/${section.id}/enrolments`).send({ userIds: [s.id, s.id] })).status,
  ).toBe(400);
});
test('concurrent cross-section enrolment yields exactly one winner', async () => {
  const s = await createUser();
  const results = await Promise.all(
    [section, otherSection].map((sec) =>
      api('put', `/sections/${sec.id}/enrolments`).send({ userIds: [s.id] }),
    ),
  );
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
});
test('faculty assignment requires active faculty', async () => {
  expect(
    (await api('put', `/sections/${section.id}/faculty`).send({ userIds: [student.user.id] })).status,
  ).toBe(400);
  expect(
    (await api('put', `/sections/${section.id}/faculty`).send({ userIds: [faculty.user.id] })).status,
  ).toBe(200);
});
test('policy bounds, zero-hour edit window, holidays and audit entries', async () => {
  const valid = {
    attendanceThreshold: 80,
    editWindowHours: 0,
    qrWindowMinutes: 3,
    holidays: [{ date: '2026-12-25', reason: 'Holiday' }],
  };
  for (const override of [
    { attendanceThreshold: 49 },
    { attendanceThreshold: 101 },
    { editWindowHours: -1 },
    { editWindowHours: 169 },
    { qrWindowMinutes: 11 },
    { holidays: [{ date: '2026-02-30' }] },
  ])
    expect((await api('put', '/policies').send({ ...valid, ...override })).status).toBe(400);
  const r = await api('put', '/policies').send(valid);
  expect(r.status).toBe(200);
  expect(r.body.editWindowHours).toBe(0);
  expect((await prisma.section.findUnique({ where: { id: section.id } })).editWindowHours).toBe(0);
  expect(await prisma.auditLog.count({ where: { action: 'POLICY_UPDATED', actorId: admin.user.id } })).toBe(
    1,
  );
  const next = await api('post', '/sections').send({
    courseId: course.id,
    name: 'Next',
    semesterStart: '2027-01-01',
    semesterEnd: '2027-05-30',
  });
  expect(next.status).toBe(201);
  expect(next.body.attendanceThreshold).toBe(80);
});
test('reports scope faculty and snapshots keep CSV/PDF figures identical after marks change', async () => {
  const s = await createUser();
  const e = await prisma.enrollment.create({ data: { sectionId: section.id, userId: s.id } });
  const sessions = await Promise.all(
    ['PRESENT', 'LATE', 'EXCUSED', 'ABSENT'].map((status, i) =>
      prisma.session.create({
        data: {
          sectionId: section.id,
          date: new Date(`2026-01-${10 + i}`),
          startTime: '09:00',
          endTime: '10:00',
          attendanceRecords: { create: { enrollmentId: e.id, status } },
        },
      }),
    ),
  );
  const url = `/reports?type=student&from=2026-01-01&to=2026-01-31&studentId=${s.id}&sectionId=${section.id}`;
  expect((await api('get', url, otherFaculty.token)).status).toBe(403);
  const report = await api('get', url, faculty.token);
  expect(report.status).toBe(200);
  expect(report.body.rows[0]).toMatchObject({ held: 4, attended: 3, percentage: 75 });
  await prisma.attendanceRecord.updateMany({
    where: { sessionId: sessions[0].id },
    data: { status: 'ABSENT' },
  });
  const csv = await api('get', `/reports?format=csv&snapshot=${report.body.snapshot}`, faculty.token);
  expect(csv.status).toBe(200);
  expect(csv.text).toContain('"75.0"');
  const pdf = await api('get', `/reports?format=pdf&snapshot=${report.body.snapshot}`, faculty.token);
  expect(pdf.status).toBe(200);
  expect(pdf.headers['content-type']).toContain('application/pdf');
  expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF');
  expect((await api('get', `/reports?format=csv&snapshot=${report.body.snapshot}`, admin.token)).status).toBe(
    403,
  );
  const view = await prisma.$queryRaw`SELECT * FROM attendance_percentages WHERE "enrollmentId"=${e.id}`;
  expect(view[0].percentage.toString()).toBe('50');
});
test('retention anonymises after last enrolment + 2 years and preserves 3-year audit boundary', async () => {
  const now = new Date();
  const oldEnd = new Date(now);
  oldEnd.setUTCFullYear(oldEnd.getUTCFullYear() - 3);
  const oldStart = new Date(oldEnd);
  oldStart.setUTCMonth(oldStart.getUTCMonth() - 5);
  const oldSection = await prisma.section.create({
    data: { courseId: course.id, name: uid(), semesterStart: oldStart, semesterEnd: oldEnd },
  });
  const expired = await createUser(),
    retained = await createUser();
  await prisma.enrollment.createMany({
    data: [
      { sectionId: oldSection.id, userId: expired.id },
      { sectionId: oldSection.id, userId: retained.id },
      { sectionId: section.id, userId: retained.id },
    ],
  });
  const oldDate = new Date(now);
  oldDate.setUTCFullYear(oldDate.getUTCFullYear() - 4);
  const old = await prisma.auditLog.create({
    data: { action: 'TEST', entity: 'test', entityId: uid(), createdAt: oldDate },
  });
  const recent = await prisma.auditLog.create({ data: { action: 'TEST', entity: 'test', entityId: uid() } });
  await runRetention(prisma, now);
  expect((await prisma.user.findUnique({ where: { id: expired.id } })).name).toBe('Former student');
  expect((await prisma.user.findUnique({ where: { id: retained.id } })).anonymizedAt).toBeNull();
  expect(await prisma.auditLog.findUnique({ where: { id: old.id } })).toBeNull();
  expect(await prisma.auditLog.findUnique({ where: { id: recent.id } })).not.toBeNull();
  expect((await runRetention(prisma, now)).anonymized).toBe(0);
});
test('runtime role can append/read audit but cannot update, delete or truncate it', async () => {
  if (!process.env.TEST_APP_DATABASE_URL)
    throw new Error('Set TEST_APP_DATABASE_URL after provisioning database roles.');
  const db = new Client({ connectionString: process.env.TEST_APP_DATABASE_URL });
  await db.connect();
  try {
    await db.query('INSERT INTO audit_logs (id, action, entity, "entityId") VALUES ($1,$2,$3,$4)', [
      uid(),
      'PERMISSION_TEST',
      'test',
      uid(),
    ]);
    for (const sql of [
      'UPDATE audit_logs SET action=action',
      'DELETE FROM audit_logs',
      'TRUNCATE audit_logs',
    ])
      await expect(db.query(sql)).rejects.toThrow(/permission denied/);
  } finally {
    await db.end();
  }
});

test('CSV rejects an oversized field individually without dropping valid rows', async () => {
  const good = profile();
  const csv = `name,email,role,srn\n${'x'.repeat(4200)},invalid@pes.edu,STUDENT,invalid\nGood,${good.email},STUDENT,${good.srn}\n`;
  const result = await api('post', '/users/import').attach('file', Buffer.from(csv), 'users.csv');
  expect(result.status).toBe(200);
  expect(result.body).toMatchObject({ imported: 1, rejected: 1 });
  expect(result.body.errors[0].row).toBe(2);
});

test('removing a faculty assignment revokes existing export snapshots', async () => {
  const f = await asUser('FACULTY');
  await prisma.sectionFaculty.create({ data: { sectionId: section.id, userId: f.user.id } });
  const report = await api('get', `/reports?type=section&from=2026-01-01&to=2026-12-31&sectionId=${section.id}`, f.token);
  expect(report.status).toBe(200);
  await prisma.sectionFaculty.delete({ where: { sectionId_userId: { sectionId: section.id, userId: f.user.id } } });
  expect((await api('get', `/reports?format=csv&snapshot=${report.body.snapshot}`, f.token)).status).toBe(403);
});

test('retention login cannot delete audit entries inside the three-year window', async () => {
  const url = new URL(process.env.TEST_APP_DATABASE_URL);
  url.username = 'sams_retention'; url.password = process.env.RETENTION_DB_PASSWORD;
  const db = new Client({ connectionString: url.toString() }); await db.connect();
  try {
    const id = uid();
    await db.query('INSERT INTO audit_logs (id, action, entity, "entityId") VALUES ($1,$2,$3,$4)', [id, 'RETENTION_PERMISSION_TEST', 'test', id]);
    await expect(db.query('DELETE FROM audit_logs WHERE id=$1', [id])).rejects.toThrow(/three years/);
  } finally { await db.end(); }
});

test('imports a full batch of 5000 valid passwordless accounts', async () => {
  const tag = uid();
  const lines = ['name,email,role,srn'];
  for (let i = 0; i < 5000; i++) lines.push(`Batch ${i},batch-${tag}-${i}@pes.edu,STUDENT,B-${tag}-${i}`);
  const result = await api('post', '/users/import').attach('file', Buffer.from(lines.join('\n')), 'batch.csv');
  expect(result.status).toBe(200);
  expect(result.body).toMatchObject({ imported: 5000, rejected: 0 });
  expect(await prisma.user.count({ where: { email: { startsWith: `batch-${tag}-` } } })).toBe(5000);
}, 120000);

test('configured QR duration is used when no per-session override is supplied', async () => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const s = await prisma.session.create({ data: { sectionId: section.id, date: today, startTime: '00:00', endTime: '23:59' } });
  const response = await api('post', `/sessions/${s.id}/qr`, faculty.token).send({});
  expect(response.status).toBe(201);
  const audit = await prisma.auditLog.findFirst({ where: { entityId: s.id, action: 'QR_WINDOW_OPENED' } });
  expect(audit.newValue.minutes).toBe(3);
});

test('inactive existing students can be retained or removed but cannot be newly enrolled', async () => {
  const s = await createUser('STUDENT', { active: false });
  const enrollment = await prisma.enrollment.create({ data: { sectionId: section.id, userId: s.id } });
  expect((await api('put', `/sections/${section.id}/enrolments`).send({ userIds: [s.id] })).status).toBe(200);
  expect((await api('put', `/sections/${section.id}/enrolments`).send({ userIds: [] })).status).toBe(200);
  expect((await api('put', `/sections/${section.id}/enrolments`).send({ userIds: [s.id] })).status).toBe(400);
  expect(await prisma.enrollment.findUnique({ where: { id: enrollment.id } })).not.toBeNull();
});
