const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const prisma = require('../utils/prisma');
const redis = require('../utils/redis');
const { dateOnly } = require('../utils/input');
const { badRequest, forbidden, notFound } = require('../utils/errors');
const { eligibleForSession, sessionInstant } = require('./membershipService');
const TYPES = ['section', 'course', 'student', 'department'];
const columns = ['Group', 'Held', 'Present', 'Late', 'Excused', 'Absent', 'Attended', 'Percentage'];
const values = (row) => [
  row.label,
  row.held,
  row.present,
  row.late,
  row.excused,
  row.absent,
  row.attended,
  row.percentage.toFixed(1),
];
async function generateReport(query, user) {
  const type = query.type || 'section';
  if (!TYPES.includes(type)) throw badRequest('Invalid report type.');
  const from = dateOnly(query.from),
    to = dateOnly(query.to);
  if (from > to || to - from > 366 * 86400000)
    throw badRequest('Choose an ordered date range of at most 366 days.');
  const section = {};
  if (user.role === 'FACULTY') section.faculty = { some: { userId: user.id } };
  if (query.sectionId) {
    if (typeof query.sectionId !== 'string') throw badRequest('Invalid section ID.');
    if (
      user.role === 'FACULTY' &&
      !(await prisma.sectionFaculty.findUnique({
        where: { sectionId_userId: { sectionId: query.sectionId, userId: user.id } },
      }))
    )
      throw forbidden('You are not assigned to this section.');
  }
  if (query.courseId) section.courseId = String(query.courseId);
  const where = { section };
  if (query.sectionId) where.sectionId = query.sectionId;
  if (query.studentId) where.userId = String(query.studentId);
  if (query.department) where.user = { department: String(query.department) };
  const enrollments = await prisma.enrollment.findMany({
    where,
    include: {
      periods: true,
      user: { select: { id: true, name: true, srn: true, department: true } },
      section: {
        include: {
          course: true,
          sessions: { where: { date: { gte: from, lte: to }, status: { not: 'CANCELLED' } } },
        },
      },
      attendanceRecords: { where: { session: { date: { gte: from, lte: to } } } },
    },
  });
  const groups = new Map(),
    now = new Date();
  for (const e of enrollments) {
    const key =
      type === 'section'
        ? e.sectionId
        : type === 'course'
          ? e.section.courseId
          : type === 'student'
            ? e.userId
            : e.user.department || 'Unassigned';
    const label =
      type === 'section'
        ? `${e.section.course.code} / ${e.section.name}`
        : type === 'course'
          ? `${e.section.course.code} · ${e.section.course.name}`
          : type === 'student'
            ? `${e.user.srn || ''} · ${e.user.name}`
            : key;
    const row = groups.get(key) || { id: key, label, held: 0, present: 0, late: 0, excused: 0, absent: 0 };
    const marks = new Map(e.attendanceRecords.map((r) => [r.sessionId, r.status]));
    for (const s of e.section.sessions) {
      if (!eligibleForSession(e, s) || (sessionInstant(s) > now && !marks.has(s.id))) continue;
      row.held++;
      row[(marks.get(s.id) || 'ABSENT').toLowerCase()]++;
    }
    groups.set(key, row);
  }
  const rows = [...groups.values()]
    .map((row) => {
      const attended = row.present + row.late + row.excused;
      return {
        ...row,
        attended,
        percentage: row.held ? Number(((100 * attended) / row.held).toFixed(1)) : 100,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
  const report = { type, from: query.from, to: query.to, generatedAt: now.toISOString(), rows };
  const snapshot = crypto.randomUUID();
  // Exports use this immutable, user-bound snapshot, even if marks change later.
  await redis.set(`report:${snapshot}`, JSON.stringify({ userId: user.id, report, sectionIds: [...new Set(enrollments.map(e => e.sectionId))] }), 'EX', 900);
  return { ...report, snapshot };
}
async function getSnapshot(id, user) {
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id))
    throw badRequest('Generate a report before exporting.');
  const raw = await redis.get(`report:${id}`);
  if (!raw) throw notFound('Report expired. Generate it again.');
  const snapshot = JSON.parse(raw);
  if (snapshot.userId !== user.id) throw forbidden();
  // Assignment removal also revokes access to existing snapshots.
  if (user.role === 'FACULTY') {
    const assignments = await prisma.sectionFaculty.findMany({
      where: { userId: user.id },
      select: { sectionId: true },
    });
    const current = new Set(assignments.map(a => a.sectionId));
    if (!snapshot.sectionIds || snapshot.sectionIds.some(id => !current.has(id)))
      throw forbidden('Section assignments changed; generate a new report.');
  }
  return snapshot.report;
}
function csv(report) {
  // Spreadsheet formula injection protection; RFC 4180 quotes and CRLF.
  const escape = (v) =>
    `"${String(typeof v === 'string' && /^[=+@\-\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
  return (
    '\uFEFF' +
    [columns, ...report.rows.map(values)].map((row) => row.map(escape).join(',')).join('\r\n') +
    '\r\n'
  );
}
function pdf(report, res) {
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  doc.pipe(res);
  doc.fontSize(18).text('SAMS Attendance Report');
  doc.fontSize(10).text(`${report.type} | ${report.from} to ${report.to} | ${report.generatedAt}`);
  const widths = [260, 65, 65, 65, 65, 65, 65, 65];
  const draw = (cells, header = false) => {
    doc.font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
    const height =
      Math.max(...cells.map((v, i) => doc.heightOfString(String(v), { width: widths[i] - 10 }))) + 14;
    if (doc.y + height > 540) {
      doc.addPage();
      draw(columns, true);
    }
    const y = doc.y;
    let x = 40;
    cells.forEach((v, i) => {
      doc.text(String(v), x, y, { width: widths[i] - 10 });
      x += widths[i];
    });
    doc.y = y + height;
  };
  doc.moveDown();
  draw(columns, true);
  report.rows.forEach((row) => draw(values(row)));
  if (!report.rows.length) doc.text('No records match the selected filters.');
  doc.end();
}
module.exports = { createReport: generateReport, getSnapshot, csv, pdf };
