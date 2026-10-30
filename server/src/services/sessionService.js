const prisma = require('../utils/prisma');
const { recordAuditLog } = require('./auditService');

const { badRequest, forbidden, notFound, conflict } = require('../utils/errors');
const { dateOnly, text } = require('../utils/input');
const { isFacultyAssigned } = require('./attendanceService');

async function requireSection(sectionId, user) {
  const section = await prisma.section.findUnique({ where: { id: sectionId } });
  if (!section) throw notFound('Section not found.');
  if (user.role !== 'ADMIN' && !(user.role === 'FACULTY' && (await isFacultyAssigned(user.id, sectionId))))
    throw forbidden();
  return section;
}
function validateTimes(start, end) {
  const valid = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  if (!valid(start) || !valid(end) || start >= end) throw badRequest('Use HH:mm times with end after start.');
}

const DAY_MAP = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/**
 * Format Date to YYYY-MM-DD string in local/UTC date
 */
function toDateString(d) {
  const date = new Date(d);
  return date.toISOString().split('T')[0];
}

/**
 * FR-05: Generate sessions between semester start and end from timetable, skipping holidays
 */
async function generateSessionsFromTimetable({ sectionId, actorId, user }) {
  await requireSection(sectionId, user);
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: {
      timetable: true,
      holidays: true,
    },
  });

  if (!section) {
    throw notFound('Section not found.');
  }

  // Fetch institution-wide holidays as well
  const institutionHolidays = await prisma.holiday.findMany({
    where: { sectionId: null },
  });

  const allHolidays = [...section.holidays, ...institutionHolidays];
  const holidayDateSet = new Set(allHolidays.map((h) => toDateString(h.date)));

  const startDate = new Date(section.semesterStart);
  const endDate = new Date(section.semesterEnd);

  if (startDate > endDate) {
    throw new Error('Semester start date must be before semester end date');
  }

  // Map slots by day of week
  const slotsByDay = {};
  section.timetable.forEach((slot) => {
    if (!slotsByDay[slot.dayOfWeek]) {
      slotsByDay[slot.dayOfWeek] = [];
    }
    slotsByDay[slot.dayOfWeek].push(slot);
  });

  const sessionsToCreate = [];
  const curr = new Date(startDate);

  // Normalize time
  curr.setUTCHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setUTCHours(23, 59, 59, 999);

  while (curr <= end) {
    const dateStr = toDateString(curr);
    const dayOfWeek = DAY_MAP[curr.getUTCDay()];

    // Skip holidays
    if (!holidayDateSet.has(dateStr)) {
      const matchingSlots = slotsByDay[dayOfWeek] || [];
      for (const slot of matchingSlots) {
        sessionsToCreate.push({
          sectionId,
          date: new Date(curr),
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: 'SCHEDULED',
        });
      }
    }

    // Advance 1 day
    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  // Add missing sessions; never delete attendance when regenerating.
  const createdSessions = await prisma.$transaction(async (tx) => {
    // Serialize generation and extra sessions for the section; reruns preserve marks.
    await tx.$queryRaw`SELECT id FROM sections WHERE id=${sectionId} FOR UPDATE`;
    const existing = await tx.session.findMany({ where: { sectionId } });
    const keys = new Set(existing.map((s) => `${toDateString(s.date)}|${s.startTime}|${s.endTime}`));
    const created = [];
    for (const s of sessionsToCreate) {
      const key = `${toDateString(s.date)}|${s.startTime}|${s.endTime}`;
      if (keys.has(key)) continue;
      keys.add(key);
      const sess = await tx.session.create({
        data: s,
      });
      created.push(sess);
    }

    await recordAuditLog({
      actorId,
      action: 'SESSIONS_GENERATED',
      entity: 'sessions',
      entityId: sectionId,
      newValue: { count: created.length, sectionId },
      tx,
    });

    return created;
  });

  return createdSessions;
}

/**
 * FR-05: Add an extra class session
 */
async function addExtraSession({ sectionId, date, startTime, endTime, actorId, user }) {
  const section = await requireSection(sectionId, user);
  date = dateOnly(date);
  validateTimes(startTime, endTime);
  if (date < section.semesterStart || date > section.semesterEnd)
    throw badRequest('Date must be inside the semester.');
  const session = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM sections WHERE id=${sectionId} FOR UPDATE`;
    if (await tx.session.findFirst({ where: { sectionId, date, startTime, endTime } }))
      throw conflict('DUPLICATE_SESSION', 'This session already exists.');
    const created = await tx.session.create({
      data: {
        sectionId,
        date: new Date(date),
        startTime,
        endTime,
        status: 'EXTRA',
      },
    });

    await recordAuditLog({
      actorId,
      action: 'EXTRA_SESSION_ADDED',
      entity: 'sessions',
      entityId: created.id,
      newValue: created,
      tx,
    });

    return created;
  });

  return session;
}

/**
 * FR-05: Cancel a session with a reason
 */
async function cancelSession({ sessionId, reason, actorId, user }) {
  reason = text(reason, 'Cancellation reason', 2000);
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw notFound('Session not found.');
  }

  await requireSection(session.sectionId, user);

  if (session.status === 'CANCELLED') {
    throw conflict('ALREADY_CANCELLED', 'Session is already cancelled.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.session.update({
      where: { id: sessionId },
      data: {
        status: 'CANCELLED',
        cancelReason: reason || 'Cancelled by faculty/admin',
        version: { increment: 1 },
      },
    });

    await recordAuditLog({
      actorId,
      action: 'SESSION_CANCELLED',
      entity: 'sessions',
      entityId: sessionId,
      oldValue: { status: session.status },
      newValue: { status: 'CANCELLED', cancelReason: reason },
      tx,
    });

    return result;
  });

  return updated;
}

/**
 * List sessions with optional filters
 */
async function getSessions({ sectionId, startDate, endDate, status, user }) {
  const where = {};
  if (user.role === 'FACULTY') where.section = { faculty: { some: { userId: user.id } } };
  if (user.role === 'STUDENT') where.section = { enrollments: { some: { userId: user.id } } };
  if (status && !['SCHEDULED', 'EXTRA', 'CANCELLED'].includes(status))
    throw badRequest('Invalid session status.');
  if (sectionId) where.sectionId = sectionId;
  if (status) where.status = status;
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = dateOnly(startDate);
    if (endDate) where.date.lte = dateOnly(endDate);
  }

  return prisma.session.findMany({
    where,
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    include: {
      section: {
        include: {
          course: true,
        },
      },
    },
  });
}

async function saveTimetable({ sectionId, slots, user }) {
  await requireSection(sectionId, user);
  if (!Array.isArray(slots) || slots.length > 30) throw badRequest('Provide at most 30 weekly slots.');
  slots = slots.map((s) => {
    if (!s || !DAY_MAP.includes(s.dayOfWeek)) throw badRequest('Invalid day of week.');
    validateTimes(s.startTime, s.endTime);
    return { sectionId, dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime };
  });
  for (let i = 0; i < slots.length; i++)
    for (let j = 0; j < i; j++) {
      const a = slots[i],
        b = slots[j];
      if (a.dayOfWeek === b.dayOfWeek && a.startTime < b.endTime && b.startTime < a.endTime)
        throw badRequest('Weekly slots cannot overlap.');
    }
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM sections WHERE id=${sectionId} FOR UPDATE`;
    await tx.timetableSlot.deleteMany({ where: { sectionId } });
    await tx.timetableSlot.createMany({ data: slots });
    await recordAuditLog({
      actorId: user.id,
      action: 'TIMETABLE_UPDATED',
      entity: 'sections',
      entityId: sectionId,
      newValue: { slots },
      tx,
    });
    return slots;
  });
}

module.exports = {
  saveTimetable,
  generateSessionsFromTimetable,
  addExtraSession,
  cancelSession,
  getSessions,
};
