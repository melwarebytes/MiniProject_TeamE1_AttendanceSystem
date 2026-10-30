const prisma = require('../utils/prisma');
const { recordAuditLog } = require('./auditService');
const { sendEmail } = require('../utils/mailer');
const logger = require('../utils/logger');
const { isFacultyAssigned } = require('./attendanceService');
const { dateOnly, text } = require('../utils/input');
const { forbidden, conflict } = require('../utils/errors');

/**
 * FR-10: Submit a leave / excused absence request
 */
async function submitLeaveRequest({ studentUser, sectionId, startDate, endDate, reason, file }) {
  if (!startDate || !endDate || !reason) {
    const err = new Error('Start date, end date, and reason are required');
    err.status = 400;
    throw err;
  }

  const start = dateOnly(startDate);
  const end = dateOnly(endDate);
  reason = text(reason, 'Reason', 2000);

  if (start > end) {
    const err = new Error('Leave start date must be before or equal to end date');
    err.status = 400;
    throw err;
  }

  // Acceptance criteria: Date range at most 30 days in the past
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  if (start < thirtyDaysAgo) {
    const err = new Error('Leave request start date cannot be more than 30 days in the past');
    err.status = 400;
    throw err;
  }

  // Check enrollment
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      sectionId_userId: {
        sectionId,
        userId: studentUser.id,
      },
    },
  });

  if (!enrollment) {
    const err = new Error('Student is not enrolled in the specified section');
    err.status = 400;
    throw err;
  }

  const leave = await prisma.$transaction(async (tx) => {
    const created = await tx.leaveRequest.create({
      data: {
        userId: studentUser.id,
        sectionId,
        startDate: start,
        endDate: end,
        reason,
        documentPath: file ? file.path : null,
        documentMime: file ? file.mimetype : null,
        status: 'PENDING',
      },
    });

    await recordAuditLog({
      actorId: studentUser.id,
      action: 'LEAVE_REQUEST_SUBMITTED',
      entity: 'leave_requests',
      entityId: created.id,
      newValue: {
        sectionId,
        startDate: start,
        endDate: end,
        hasDocument: !!file,
      },
      tx,
    });

    return created;
  });

  return leave;
}

/**
 * FR-10: List leave requests
 */
async function listLeaveRequests({ user, sectionId, status }) {
  const where = {};
  if (status) where.status = status;
  if (sectionId) where.sectionId = sectionId;

  // Student can only see their own requests
  if (user.role === 'STUDENT') {
    where.userId = user.id;
  } else if (user.role === 'FACULTY') {
    const assignments = await prisma.sectionFaculty.findMany({
      where: { userId: user.id },
      select: { sectionId: true },
    });
    if (sectionId && !assignments.some((a) => a.sectionId === sectionId)) throw forbidden();
    where.sectionId = sectionId || { in: assignments.map((a) => a.sectionId) };
  }

  return prisma.leaveRequest.findMany({
    where,
    include: {
      user: {
        select: { id: true, name: true, srn: true, email: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * FR-10: Review leave request (Approve/Reject)
 * On approval: ABSENT records in date range become EXCUSED
 * Student notified by email & in-app within 5 minutes
 */
async function reviewLeaveRequest({ leaveId, action, reviewNote, reviewerUser }) {
  if (reviewerUser.role !== 'ADMIN' && reviewerUser.role !== 'FACULTY') {
    const err = new Error('Forbidden: Only faculty or admin can review leave requests');
    err.status = 403;
    throw err;
  }

  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    include: {
      user: true,
    },
  });

  if (!leave) {
    const err = new Error('Leave request not found');
    err.status = 404;
    throw err;
  }

  if (reviewerUser.role === 'FACULTY' && !(await isFacultyAssigned(reviewerUser.id, leave.sectionId)))
    throw forbidden();

  if (leave.status !== 'PENDING') {
    const err = new Error(`Leave request has already been ${leave.status.toLowerCase()}`);
    err.status = 400;
    throw err;
  }

  const isApproved = action === 'APPROVE';
  const newStatus = isApproved ? 'APPROVED' : 'REJECTED';

  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.leaveRequest.updateMany({
      where: { id: leaveId, status: 'PENDING' },
      data: { status: newStatus },
    });
    if (!claimed.count) throw conflict('ALREADY_REVIEWED', 'This request has already been reviewed.');
    let convertedCount = 0;

    if (isApproved) {
      // Find all enrollments for this student in this section
      const enrollment = await tx.enrollment.findUnique({
        where: {
          sectionId_userId: {
            sectionId: leave.sectionId,
            userId: leave.userId,
          },
        },
      });

      if (enrollment) {
        // Find ABSENT records in the leave date range
        const absentRecords = await tx.attendanceRecord.findMany({
          where: {
            enrollmentId: enrollment.id,
            status: 'ABSENT',
            session: {
              date: {
                gte: leave.startDate,
                lte: leave.endDate,
              },
              status: { not: 'CANCELLED' },
            },
          },
        });

        // Convert ABSENT to EXCUSED
        for (const record of absentRecords) {
          await tx.attendanceRecord.update({
            where: { id: record.id },
            data: {
              status: 'EXCUSED',
              source: 'LEAVE',
              version: { increment: 1 },
            },
          });
        }

        convertedCount = absentRecords.length;
      }
    }

    const reviewed = await tx.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: newStatus,
        reviewedAt: new Date(),
        reviewNote: reviewNote || null,
      },
    });

    await recordAuditLog({
      actorId: reviewerUser.id,
      action: isApproved ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
      entity: 'leave_requests',
      entityId: leaveId,
      oldValue: { status: 'PENDING' },
      newValue: {
        status: newStatus,
        convertedAbsentToExcused: convertedCount,
        reviewNote,
        reviewerId: reviewerUser.id,
      },
      tx,
    });

    return { reviewed, convertedCount };
  });

  // Notify student via email and in-app alert asynchronously
  try {
    const student = leave.user;
    const subject = `Leave Request ${newStatus}: SAMS Attendance`;
    const message = `Hello ${student.name},\n\nYour leave request from ${leave.startDate.toDateString()} to ${leave.endDate.toDateString()} has been ${newStatus}.\n${
      reviewNote ? `Reviewer Note: ${reviewNote}\n` : ''
    }${isApproved ? `Note: ${updated.convertedCount} past absent records were converted to EXCUSED.` : ''}`;

    await sendEmail({
      to: student.email,
      subject,
      text: message,
    });
  } catch (err) {
    logger.error('Failed to dispatch leave review notification:', err);
  }

  return updated;
}

module.exports = {
  submitLeaveRequest,
  listLeaveRequests,
  reviewLeaveRequest,
};
