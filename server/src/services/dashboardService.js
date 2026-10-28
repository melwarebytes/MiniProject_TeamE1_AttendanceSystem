const prisma = require('../utils/prisma');
const { eligibleForSession, sessionInstant } = require('./membershipService');

/**
 * FR-09: Calculate attendance stats for a student in an enrolled section
 */
function calculateMetrics({ attended, held, threshold = 75.0 }) {
  const percentage = held > 0 ? Number(((attended / held) * 100).toFixed(1)) : 100.0;

  const thresholdFraction = threshold / 100.0;
  // canStillMiss = floor(attended / threshold - held), minimum 0
  let canStillMiss = 0;
  if (thresholdFraction > 0) {
    const rawMiss = Math.floor(attended / thresholdFraction - held);
    canStillMiss = Math.max(0, rawMiss);
  }

  // Classes needed to recover to threshold if below
  let classesToRecover = 0;
  if (percentage < threshold && thresholdFraction < 1.0) {
    // (attended + x) / (held + x) >= thresholdFraction
    // attended + x >= thresholdFraction * held + thresholdFraction * x
    // x * (1 - thresholdFraction) >= thresholdFraction * held - attended
    const needed = Math.ceil((thresholdFraction * held - attended) / (1 - thresholdFraction));
    classesToRecover = Math.max(0, needed);
  }

  return {
    percentage,
    canStillMiss,
    classesToRecover,
    isLowAttendance: percentage < threshold,
  };
}

/**
 * FR-09: Get student attendance dashboard for all enrolled courses
 */
async function getStudentDashboard(targetUserId, requestingUser) {
  // Access control: Students can only view their own dashboard
  if (requestingUser.role === 'STUDENT' && requestingUser.id !== targetUserId) {
    const err = new Error('Forbidden: Students can only view their own attendance dashboard');
    err.status = 403;
    throw err;
  }

  const student = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, name: true, srn: true, email: true, role: true },
  });

  if (!student) {
    const err = new Error('Student not found');
    err.status = 404;
    throw err;
  }

  // Find all enrollments for this student
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: targetUserId },
    include: {
      periods: true,
      section: {
        include: {
          course: true,
          sessions: {
            where: {
              status: { not: 'CANCELLED' },
            },
            orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
          },
        },
      },
      attendanceRecords: {
        include: {
          session: true,
        },
      },
    },
  });

  const now = new Date();

  const coursesSummary = enrollments.map((enr) => {
    const section = enr.section;
    const course = section.course;
    const threshold = section.attendanceThreshold || 75.0;

    // Filter held sessions: not cancelled and (date <= now or attendance recorded)
    const recordsMap = new Map();
    enr.attendanceRecords.forEach((r) => {
      recordsMap.set(r.sessionId, r);
    });

    const sessionHistory = [];
    let presentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;
    let absentCount = 0;
    let heldSessionsCount = 0;

    section.sessions.forEach((sess) => {
      if (!eligibleForSession(enr, sess)) return;
      const record = recordsMap.get(sess.id);
      const isPastOrMarked = sessionInstant(sess) <= now || !!record;

      if (isPastOrMarked) {
        heldSessionsCount += 1;
        const status = record ? record.status : 'ABSENT'; // Unmarked past session is considered absent

        if (status === 'PRESENT') presentCount += 1;
        else if (status === 'LATE') lateCount += 1;
        else if (status === 'EXCUSED') excusedCount += 1;
        else if (status === 'ABSENT') absentCount += 1;

        sessionHistory.push({
          sessionId: sess.id,
          date: sess.date,
          startTime: sess.startTime,
          endTime: sess.endTime,
          sessionStatus: sess.status,
          attendanceStatus: status,
          markedAt: record ? record.markedAt : null,
        });
      }
    });

    // Attended includes PRESENT, LATE, and EXCUSED
    const attendedCount = presentCount + lateCount + excusedCount;
    const metrics = calculateMetrics({
      attended: attendedCount,
      held: heldSessionsCount,
      threshold,
    });

    return {
      enrollmentId: enr.id,
      sectionId: section.id,
      sectionName: section.name,
      courseId: course.id,
      courseCode: course.code,
      courseName: course.name,
      threshold,
      stats: {
        totalHeld: heldSessionsCount,
        attended: attendedCount,
        present: presentCount,
        late: lateCount,
        excused: excusedCount,
        absent: absentCount,
        ...metrics,
      },
      sessionHistory,
    };
  });

  // Calculate overall metrics across all enrolled courses
  const totalHeldAll = coursesSummary.reduce((acc, c) => acc + c.stats.totalHeld, 0);
  const totalAttendedAll = coursesSummary.reduce((acc, c) => acc + c.stats.attended, 0);
  const overallPercentage = totalHeldAll > 0 ? Number(((totalAttendedAll / totalHeldAll) * 100).toFixed(1)) : 100.0;

  return {
    student,
    overall: {
      totalHeld: totalHeldAll,
      totalAttended: totalAttendedAll,
      overallPercentage,
    },
    courses: coursesSummary,
  };
}

module.exports = {
  calculateMetrics,
  getStudentDashboard,
};
