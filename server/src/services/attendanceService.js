const prisma = require('../utils/prisma');
const { eligibleForSession, sessionInstant } = require('./membershipService');
const { badRequest } = require('../utils/errors');
const { recordAuditLog } = require('./auditService');

/**
 * Helper to check if faculty is assigned to section
 */
async function isFacultyAssigned(userId, sectionId) {
  const assignment = await prisma.sectionFaculty.findUnique({
    where: {
      sectionId_userId: {
        sectionId,
        userId,
      },
    },
  });
  return !!assignment;
}

/**
 * FR-06: Get roster for a session, defaulting to PRESENT for unmarked students
 */
async function getSessionRoster(sessionId, user) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      section: {
        include: {
          course: true,
          faculty: true,
        },
      },
      attendanceRecords: {
        include: {
          enrollment: {
            include: {
              user: {
                select: { id: true, name: true, srn: true, email: true },
              },
            },
          },
        },
      },
    },
  });

  if (!session) {
    const err = new Error('Session not found');
    err.status = 404;
    throw err;
  }

  // Permission check: Admin or assigned Faculty
  if (user.role === 'FACULTY') {
    const assigned = await isFacultyAssigned(user.id, session.sectionId);
    if (!assigned) {
      const err = new Error('Forbidden: You are not assigned to this section');
      err.status = 403;
      throw err;
    }
  } else if (user.role !== 'ADMIN') {
    const err = new Error('Forbidden: Insufficient privileges');
    err.status = 403;
    throw err;
  }

  // Fetch all enrollments for section
  const enrollments = await prisma.enrollment.findMany({
    where: { sectionId: session.sectionId },
    include: {
      periods: true,
      user: {
        select: { id: true, name: true, srn: true, email: true },
      },
    },
    orderBy: {
      user: {
        srn: 'asc',
      },
    },
  });

  const existingRecordsMap = new Map();
  session.attendanceRecords.forEach((rec) => {
    existingRecordsMap.set(rec.enrollmentId, rec);
  });

  // Construct roster with default PRESENT
  const roster = enrollments.filter(e => eligibleForSession(e, session)).map((enr) => {
    const existing = existingRecordsMap.get(enr.id);
    return {
      enrollmentId: enr.id,
      studentId: enr.user.id,
      studentName: enr.user.name,
      srn: enr.user.srn,
      email: enr.user.email,
      status: existing ? existing.status : 'PRESENT',
      recordId: existing ? existing.id : null,
      version: existing ? existing.version : 0,
      markedAt: existing ? existing.markedAt : null,
    };
  });

  return {
    session: {
      id: session.id,
      sectionId: session.sectionId,
      courseCode: session.section.course.code,
      courseName: session.section.course.name,
      sectionName: session.section.name,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
    },
    roster,
  };
}

/**
 * Validate that the current time is between session start and 23:59 the same day
 */
function validateMarkingWindow(sessionDate, startTime, overrideTime = null) {
  const now = overrideTime ? new Date(overrideTime) : new Date();

  // Session times are institutional IST regardless of the server timezone.
  const sessionStart = sessionInstant({ date: sessionDate, startTime });
  const sessionDayEnd = new Date(+sessionInstant({ date: sessionDate, startTime: '23:59' }) + 59999);

  if (now < sessionStart) {
    const err = new Error('Attendance marking is only allowed from session start time onward');
    err.status = 400;
    throw err;
  }

  if (now > sessionDayEnd) {
    const err = new Error(
      'Attendance marking window closed (marking is only allowed until 23:59 the same day). Please submit a correction request.'
    );
    err.status = 400;
    throw err;
  }
}

/**
 * FR-06: Submit whole attendance roster in one transaction
 */
async function submitAttendanceRoster({ sessionId, records, user, bypassTimeWindow = false }) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { section: true },
  });

  if (!session) {
    const err = new Error('Session not found');
    err.status = 404;
    throw err;
  }

  if (session.status === 'CANCELLED') {
    const err = new Error('Cannot mark attendance for a cancelled session');
    err.status = 400;
    throw err;
  }

  // Permission check: assigned faculty or Admin
  if (user.role === 'FACULTY') {
    const assigned = await isFacultyAssigned(user.id, session.sectionId);
    if (!assigned) {
      const err = new Error('Forbidden: You are not assigned to this section');
      err.status = 403;
      throw err;
    }
  } else if (user.role !== 'ADMIN') {
    const err = new Error('Forbidden: Insufficient privileges');
    err.status = 403;
    throw err;
  }

  // Check marking time window unless bypassed by test or admin
  if (!bypassTimeWindow && user.role !== 'ADMIN') {
    validateMarkingWindow(session.date, session.startTime);
  }

  const enrolled = await prisma.enrollment.findMany({ where: { sectionId: session.sectionId }, include: { periods: true } });
  const eligible = new Set(enrolled.filter(e => eligibleForSession(e, session)).map(e => e.id));
  if (records.length > 300 || new Set(records.map(r => r?.enrollmentId)).size !== records.length || records.some(r => !r || !eligible.has(r.enrollmentId) || !['PRESENT', 'LATE', 'ABSENT'].includes(r.status))) {
    throw badRequest('Records must contain unique eligible enrolments and PRESENT, LATE or ABSENT statuses.');
  }

  // Atomic transaction to save all records + audit log
  const result = await prisma.$transaction(async (tx) => {
    const savedRecords = [];
    const statusCounts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };

    for (const item of records) {
      const validStatuses = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
      const status = validStatuses.includes(item.status) ? item.status : 'PRESENT';

      statusCounts[status] = (statusCounts[status] || 0) + 1;

      // Upsert record
      const saved = await tx.attendanceRecord.upsert({
        where: {
          enrollmentId_sessionId: {
            enrollmentId: item.enrollmentId,
            sessionId,
          },
        },
        create: {
          enrollmentId: item.enrollmentId,
          sessionId,
          status,
          markedById: user.id,
          markedAt: new Date(),
          version: 1,
        },
        update: {
          status,
          markedById: user.id,
          markedAt: new Date(),
          version: { increment: 1 },
        },
      });

      savedRecords.push(saved);
    }

    // Single audit log per submission
    await recordAuditLog({
      actorId: user.id,
      action: 'ATTENDANCE_MARKED',
      entity: 'attendance_records',
      entityId: sessionId,
      newValue: {
        sessionId,
        sectionId: session.sectionId,
        totalMarked: records.length,
        breakdown: statusCounts,
      },
      tx,
    });

    return { savedRecords, statusCounts };
  });

  return result;
}

module.exports = {
  getSessionRoster,
  submitAttendanceRoster,
  isFacultyAssigned,
};
