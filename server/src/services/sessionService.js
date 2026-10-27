const prisma = require('../utils/prisma');
const { recordAuditLog } = require('./auditService');

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
async function generateSessionsFromTimetable({ sectionId, actorId }) {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: {
      timetable: true,
      holidays: true,
    },
  });

  if (!section) {
    throw new Error('Section not found');
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
  curr.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (curr <= end) {
    const dateStr = toDateString(curr);
    const dayOfWeek = DAY_MAP[curr.getDay()];

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
    curr.setDate(curr.getDate() + 1);
  }

  // Delete existing scheduled sessions without attendance if regenerating, or simply create new
  const createdSessions = await prisma.$transaction(async (tx) => {
    // We create the sessions
    const created = [];
    for (const s of sessionsToCreate) {
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
async function addExtraSession({ sectionId, date, startTime, endTime, actorId }) {
  const session = await prisma.$transaction(async (tx) => {
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
async function cancelSession({ sessionId, reason, actorId }) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new Error('Session not found');
  }

  if (session.status === 'CANCELLED') {
    throw new Error('Session is already cancelled');
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
async function getSessions({ sectionId, startDate, endDate, status }) {
  const where = {};
  if (sectionId) where.sectionId = sectionId;
  if (status) where.status = status;
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
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

module.exports = {
  generateSessionsFromTimetable,
  addExtraSession,
  cancelSession,
  getSessions,
};
