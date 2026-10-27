const prisma = require('../utils/prisma');
const { calculateMetrics } = require('./dashboardService');
const { sendEmail } = require('../utils/mailer');
const { recordAuditLog } = require('./auditService');
const { isFacultyAssigned } = require('./attendanceService');

/**
 * FR-11: Check and trigger low attendance alerts for a section or specific student
 * Respects: at most one alert per course every 7 days
 */
async function checkAndTriggerAlertsForSection(sectionId, specificStudentId = null) {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: {
      course: true,
      sessions: {
        where: { status: { not: 'CANCELLED' } },
      },
    },
  });

  if (!section) return [];

  const threshold = section.attendanceThreshold || 75.0;
  const now = new Date();

  // Find enrolled students to check
  const enrollmentWhere = { sectionId };
  if (specificStudentId) {
    enrollmentWhere.userId = specificStudentId;
  }

  const enrollments = await prisma.enrollment.findMany({
    where: enrollmentWhere,
    include: {
      user: true,
      attendanceRecords: {
        where: {
          session: { status: { not: 'CANCELLED' } },
        },
      },
    },
  });

  const alertsTriggered = [];
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  for (const enr of enrollments) {
    const student = enr.user;

    // Filter held sessions
    const recordsMap = new Map();
    enr.attendanceRecords.forEach((r) => recordsMap.set(r.sessionId, r));

    let attended = 0;
    let held = 0;

    section.sessions.forEach((sess) => {
      const rec = recordsMap.get(sess.id);
      const isPastOrMarked = new Date(sess.date) <= now || !!rec;
      if (isPastOrMarked) {
        held += 1;
        if (rec && ['PRESENT', 'LATE', 'EXCUSED'].includes(rec.status)) {
          attended += 1;
        }
      }
    });

    if (held === 0) continue; // No sessions held yet

    const metrics = calculateMetrics({ attended, held, threshold });

    if (metrics.isLowAttendance) {
      // Check 7-day rate limit for this student & section
      const recentAlert = await prisma.attendanceAlert.findFirst({
        where: {
          userId: student.id,
          sectionId: section.id,
          sentAt: {
            gte: sevenDaysAgo,
          },
        },
      });

      if (!recentAlert) {
        // Create in-app alert record
        const newAlert = await prisma.attendanceAlert.create({
          data: {
            userId: student.id,
            sectionId: section.id,
            percentage: metrics.percentage,
            threshold,
            sentAt: new Date(),
          },
        });

        alertsTriggered.push(newAlert);

        // Send email alert
        const emailBody = `Dear ${student.name},\n\nWarning: Your attendance in ${section.course.code} - ${section.course.name} (Section ${section.name}) has dropped to ${metrics.percentage}%, which is below the mandatory minimum threshold of ${threshold}%.\n\nYou need to attend at least ${metrics.classesToRecover} consecutive upcoming classes to recover.\n\nPlease contact your faculty immediately.\n\nSAMS Attendance System`;

        await sendEmail({
          to: student.email,
          subject: `Low Attendance Warning: ${section.course.code} (${metrics.percentage}%)`,
          text: emailBody,
        });

        await recordAuditLog({
          actorId: null, // System event
          action: 'LOW_ATTENDANCE_ALERT_TRIGGERED',
          entity: 'attendance_alerts',
          entityId: newAlert.id,
          newValue: {
            userId: student.id,
            sectionId: section.id,
            percentage: metrics.percentage,
            threshold,
          },
        });
      }
    }
  }

  return alertsTriggered;
}

/**
 * FR-11: Faculty can list students below threshold for their sections
 */
async function listStudentsBelowThreshold(sectionId, user) {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: {
      course: true,
      sessions: {
        where: { status: { not: 'CANCELLED' } },
      },
    },
  });

  if (!section) {
    const err = new Error('Section not found');
    err.status = 404;
    throw err;
  }

  // Permission check: assigned faculty or admin
  if (user.role === 'FACULTY') {
    const assigned = await isFacultyAssigned(user.id, sectionId);
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

  const threshold = section.attendanceThreshold || 75.0;
  const now = new Date();

  const enrollments = await prisma.enrollment.findMany({
    where: { sectionId },
    include: {
      user: {
        select: { id: true, name: true, srn: true, email: true },
      },
      attendanceRecords: {
        where: {
          session: { status: { not: 'CANCELLED' } },
        },
      },
    },
    orderBy: { user: { srn: 'asc' } },
  });

  const belowThresholdStudents = [];

  for (const enr of enrollments) {
    const student = enr.user;
    const recordsMap = new Map();
    enr.attendanceRecords.forEach((r) => recordsMap.set(r.sessionId, r));

    let attended = 0;
    let held = 0;

    section.sessions.forEach((sess) => {
      const rec = recordsMap.get(sess.id);
      const isPastOrMarked = new Date(sess.date) <= now || !!rec;
      if (isPastOrMarked) {
        held += 1;
        if (rec && ['PRESENT', 'LATE', 'EXCUSED'].includes(rec.status)) {
          attended += 1;
        }
      }
    });

    const metrics = calculateMetrics({ attended, held, threshold });

    if (held > 0 && metrics.isLowAttendance) {
      belowThresholdStudents.push({
        studentId: student.id,
        name: student.name,
        srn: student.srn,
        email: student.email,
        held,
        attended,
        percentage: metrics.percentage,
        threshold,
        classesToRecover: metrics.classesToRecover,
      });
    }
  }

  return {
    sectionId: section.id,
    courseCode: section.course.code,
    courseName: section.course.name,
    sectionName: section.name,
    threshold,
    totalDefaulters: belowThresholdStudents.length,
    students: belowThresholdStudents,
  };
}

/**
 * Get in-app alerts for student
 */
async function getStudentAlerts(studentUserId) {
  return prisma.attendanceAlert.findMany({
    where: { userId: studentUserId },
    orderBy: { sentAt: 'desc' },
  });
}

/**
 * Mark in-app alert as read
 */
async function markAlertAsRead(alertId, studentUserId) {
  return prisma.attendanceAlert.updateMany({
    where: {
      id: alertId,
      userId: studentUserId,
    },
    data: {
      readAt: new Date(),
    },
  });
}

module.exports = {
  checkAndTriggerAlertsForSection,
  listStudentsBelowThreshold,
  getStudentAlerts,
  markAlertAsRead,
};
