const prisma = require('../utils/prisma');
const { recordAuditLog } = require('./auditService');
const { isFacultyAssigned } = require('./attendanceService');

/**
 * Check if the session is still within the direct edit window
 */
function isWithinEditWindow(sessionDate, endTime, editWindowHours = 48) {
  const [endHour, endMin] = endTime.split(':').map(Number);
  const sessionEnd = new Date(sessionDate);
  sessionEnd.setHours(endHour, endMin, 0, 0);

  const now = new Date();
  const diffMs = now - sessionEnd;
  const maxDiffMs = editWindowHours * 60 * 60 * 1000;

  return diffMs <= maxDiffMs;
}

/**
 * FR-08: Direct correction by faculty (within edit window) or Admin
 */
async function correctAttendanceDirectly({ attendanceRecordId, newStatus, reason, user }) {
  const record = await prisma.attendanceRecord.findUnique({
    where: { id: attendanceRecordId },
    include: {
      session: {
        include: { section: true },
      },
    },
  });

  if (!record) {
    const err = new Error('Attendance record not found');
    err.status = 404;
    throw err;
  }

  // Permission check
  if (user.role === 'FACULTY') {
    const assigned = await isFacultyAssigned(user.id, record.session.sectionId);
    if (!assigned) {
      const err = new Error('Forbidden: You are not assigned to this section');
      err.status = 403;
      throw err;
    }

    // Check edit window
    const windowHours = record.session.section.editWindowHours ?? 48;
    const allowed = isWithinEditWindow(record.session.date, record.session.endTime, windowHours);
    if (!allowed) {
      const err = new Error(
        `Direct edit window of ${windowHours} hours has expired. Please submit an attendance correction request for Admin approval.`
      );
      err.status = 400;
      err.code = 'EDIT_WINDOW_EXPIRED';
      throw err;
    }
  } else if (user.role !== 'ADMIN') {
    const err = new Error('Forbidden: Insufficient privileges');
    err.status = 403;
    throw err;
  }

  const oldStatus = record.status;

  const updatedRecord = await prisma.$transaction(async (tx) => {
    const updated = await tx.attendanceRecord.update({
      where: { id: attendanceRecordId },
      data: {
        status: newStatus,
        version: { increment: 1 },
      },
    });

    await recordAuditLog({
      actorId: user.id,
      action: 'ATTENDANCE_CORRECTED_DIRECT',
      entity: 'attendance_records',
      entityId: attendanceRecordId,
      oldValue: { status: oldStatus },
      newValue: { status: newStatus, reason },
      tx,
    });

    return updated;
  });

  return updatedRecord;
}

/**
 * FR-08: Submit a formal correction request (used after edit window has passed)
 */
async function submitCorrectionRequest({ attendanceRecordId, newStatus, reason, user }) {
  if (!reason || reason.trim().length === 0) {
    const err = new Error('A valid reason is required for correction requests');
    err.status = 400;
    throw err;
  }

  const record = await prisma.attendanceRecord.findUnique({
    where: { id: attendanceRecordId },
    include: {
      session: {
        include: { section: true },
      },
      enrollment: {
        include: { user: true },
      },
    },
  });

  if (!record) {
    const err = new Error('Attendance record not found');
    err.status = 404;
    throw err;
  }

  // Permission check
  if (user.role === 'FACULTY') {
    const assigned = await isFacultyAssigned(user.id, record.session.sectionId);
    if (!assigned) {
      const err = new Error('Forbidden: You are not assigned to this section');
      err.status = 403;
      throw err;
    }
  } else if (user.role !== 'ADMIN') {
    const err = new Error('Forbidden: Only faculty or admin can request corrections');
    err.status = 403;
    throw err;
  }

  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.correctionRequest.create({
      data: {
        attendanceRecordId,
        requestedById: user.id,
        oldStatus: record.status,
        newStatus,
        reason,
        status: 'PENDING',
      },
      include: {
        attendanceRecord: {
          include: {
            session: true,
            enrollment: { include: { user: true } },
          },
        },
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await recordAuditLog({
      actorId: user.id,
      action: 'CORRECTION_REQUESTED',
      entity: 'correction_requests',
      entityId: created.id,
      newValue: {
        attendanceRecordId,
        oldStatus: record.status,
        newStatus,
        reason,
      },
      tx,
    });

    return created;
  });

  return request;
}

/**
 * FR-08: List correction requests (filterable by status and section)
 */
async function listCorrectionRequests({ status, sectionId, userId, role }) {
  const where = {};
  if (status) where.status = status;
  if (role === 'FACULTY') {
    where.requestedById = userId;
  }
  if (sectionId) {
    where.attendanceRecord = {
      session: { sectionId },
    };
  }

  return prisma.correctionRequest.findMany({
    where,
    include: {
      attendanceRecord: {
        include: {
          session: {
            include: {
              section: {
                include: { course: true },
              },
            },
          },
          enrollment: {
            include: {
              user: {
                select: { id: true, name: true, srn: true, email: true },
              },
            },
          },
        },
      },
      requestedBy: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * FR-08: Review (Approve/Reject) correction request by Admin
 */
async function reviewCorrectionRequest({ requestId, action, reviewNote, adminUser }) {
  if (adminUser.role !== 'ADMIN') {
    const err = new Error('Forbidden: Only administrators can approve or reject correction requests');
    err.status = 403;
    throw err;
  }

  const request = await prisma.correctionRequest.findUnique({
    where: { id: requestId },
    include: {
      attendanceRecord: true,
    },
  });

  if (!request) {
    const err = new Error('Correction request not found');
    err.status = 404;
    throw err;
  }

  if (request.status !== 'PENDING') {
    const err = new Error(`Request has already been ${request.status.toLowerCase()}`);
    err.status = 400;
    throw err;
  }

  const isApproved = action === 'APPROVE';
  const newStatus = isApproved ? 'APPROVED' : 'REJECTED';

  const updated = await prisma.$transaction(async (tx) => {
    // If approved, update attendance record
    if (isApproved) {
      await tx.attendanceRecord.update({
        where: { id: request.attendanceRecordId },
        data: {
          status: request.newStatus,
          version: { increment: 1 },
        },
      });
    }

    const reviewed = await tx.correctionRequest.update({
      where: { id: requestId },
      data: {
        status: newStatus,
        reviewedAt: new Date(),
        reviewNote: reviewNote || null,
      },
      include: {
        attendanceRecord: true,
        requestedBy: true,
      },
    });

    await recordAuditLog({
      actorId: adminUser.id,
      action: isApproved ? 'CORRECTION_APPROVED' : 'CORRECTION_REJECTED',
      entity: 'correction_requests',
      entityId: requestId,
      oldValue: {
        status: 'PENDING',
        attendanceStatus: request.oldStatus,
      },
      newValue: {
        status: newStatus,
        attendanceStatus: isApproved ? request.newStatus : request.oldStatus,
        reviewNote,
        reviewerId: adminUser.id,
      },
      tx,
    });

    return reviewed;
  });

  return updated;
}

module.exports = {
  isWithinEditWindow,
  correctAttendanceDirectly,
  submitCorrectionRequest,
  listCorrectionRequests,
  reviewCorrectionRequest,
};
