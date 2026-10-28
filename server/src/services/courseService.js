const prisma = require('../utils/prisma');
const { badRequest, notFound, conflict } = require('../utils/errors');
const { text, dateOnly, ids } = require('../utils/input');
const { recordAuditLog } = require('./auditService');
const { getPolicy } = require('./policyService');

async function createCourse(input, actor, ip) {
  const data = { code: text(input.code, 'Course code', 30), name: text(input.name, 'Course name'), description: input.description ? text(input.description, 'Description', 2000) : null };
  return prisma.$transaction(async tx => {
    const course = await tx.course.create({ data });
    await recordAuditLog({ actorId: actor.id, action: 'COURSE_CREATED', entity: 'courses', entityId: course.id, newValue: data, ip, tx });
    return course;
  });
}
async function createSection(input, actor, ip) {
  const semesterStart = dateOnly(input.semesterStart), semesterEnd = dateOnly(input.semesterEnd);
  if (semesterEnd <= semesterStart) throw badRequest('Semester end must follow semester start.');
  const name = text(input.name, 'Section name', 50), courseId = text(input.courseId, 'Course ID', 100);
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(14001)`;
    const policy = await getPolicy(tx);
    if (!await tx.course.findUnique({ where: { id: courseId } })) throw notFound('Course not found.');
    const section = await tx.section.create({ data: { name, courseId, semesterStart, semesterEnd,
      attendanceThreshold: policy.attendanceThreshold, editWindowHours: policy.editWindowHours, qrWindowMinutes: policy.qrWindowMinutes } });
    await recordAuditLog({ actorId: actor.id, action: 'SECTION_CREATED', entity: 'sections', entityId: section.id, newValue: section, ip, tx });
    return section;
  });
}
async function setFaculty(sectionId, userIds, actor, ip) {
  ids(userIds);
  return prisma.$transaction(async tx => {
    if (!await tx.section.findUnique({ where: { id: sectionId } })) throw notFound('Section not found.');
    const valid = await tx.user.count({ where: { id: { in: userIds }, role: 'FACULTY', active: true } });
    if (valid !== userIds.length) throw badRequest('All selected users must be active faculty.');
    await tx.$queryRaw`SELECT id FROM sections WHERE id = ${sectionId} FOR UPDATE`;
    const old = await tx.sectionFaculty.findMany({ where: { sectionId } });
    await tx.sectionFaculty.deleteMany({ where: { sectionId } });
    await tx.sectionFaculty.createMany({ data: userIds.map(userId => ({ sectionId, userId })) });
    await recordAuditLog({ actorId: actor.id, action: 'FACULTY_ASSIGNED', entity: 'sections', entityId: sectionId, oldValue: old.map(a => a.userId), newValue: userIds, ip, tx });
    return { userIds };
  });
}
async function replaceRoster(sectionId, userIds, actor, ip) {
  ids(userIds);
  return prisma.$transaction(async tx => {
    const section = await tx.section.findUnique({ where: { id: sectionId } });
    if (!section) throw notFound('Section not found.');
    // Course lock makes simultaneous replacements in different sections safe.
    await tx.$queryRaw`SELECT id FROM courses WHERE id = ${section.courseId} FOR UPDATE`;
    const now = new Date();
    const valid = await tx.user.count({ where: { id: { in: userIds }, role: 'STUDENT', active: true } });
    if (valid !== userIds.length) throw badRequest('All selected users must be active students.');
    const overlaps = await tx.enrollment.findMany({ where: { userId: { in: userIds }, sectionId: { not: sectionId }, section: {
      courseId: section.courseId, semesterStart: { lte: section.semesterEnd }, semesterEnd: { gte: section.semesterStart }
    } }, include: { periods: true } });
    if (overlaps.some(e => !e.periods.length || e.periods.some(p => !p.endsAt))) throw conflict('DUPLICATE_ENROLMENT', 'A student is already enrolled in this course in an overlapping semester. Remove them from the other section first.');
    const current = await tx.enrollment.findMany({ where: { sectionId }, include: { periods: true } });
    const oldValue = current.filter(e => !e.periods.length || e.periods.some(p => !p.endsAt)).map(e => e.userId);
    for (const e of current) {
      if (!userIds.includes(e.userId)) {
        if (!e.periods.length) await tx.enrollmentPeriod.create({ data: { enrollmentId: e.id, startsAt: section.semesterStart, endsAt: now } });
        else await tx.enrollmentPeriod.updateMany({ where: { enrollmentId: e.id, endsAt: null }, data: { endsAt: now } });
      }
    }
    for (const userId of userIds) {
      let enrollment = current.find(e => e.userId === userId);
      if (!enrollment) {
        enrollment = await tx.enrollment.create({ data: { userId, sectionId } });
        await tx.enrollmentPeriod.create({ data: { enrollmentId: enrollment.id, startsAt: now } });
      } else if (enrollment.periods.length && !enrollment.periods.some(p => !p.endsAt)) {
        await tx.enrollmentPeriod.create({ data: { enrollmentId: enrollment.id, startsAt: now } });
      }
    }
    await recordAuditLog({ actorId: actor.id, action: 'ROSTER_REPLACED', entity: 'sections', entityId: sectionId, oldValue, newValue: { userIds, effectiveAt: now }, ip, tx });
    return { userIds, effectiveAt: now };
  }, { timeout: 30000 });
}
module.exports = { createCourse, createSection, setFaculty, replaceRoster };
