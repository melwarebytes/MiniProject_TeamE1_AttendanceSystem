const express = require('express');
const router = express.Router();
const correctionService = require('../services/correctionService');
const { authenticate, authorize } = require('../middleware/auth');

// PATCH /api/v1/corrections/direct/:recordId — Direct correction within edit window (FR-08)
router.patch(
  '/direct/:recordId',
  authenticate,
  authorize('ADMIN', 'FACULTY'),
  async (req, res, next) => {
    try {
      const { newStatus, reason } = req.body;
      if (!newStatus || !['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].includes(newStatus)) {
        return res.status(400).json({ error: 'Valid newStatus is required (PRESENT, ABSENT, LATE, EXCUSED)' });
      }
      const record = await correctionService.correctAttendanceDirectly({
        attendanceRecordId: req.params.recordId,
        newStatus,
        reason: reason || 'Direct correction by faculty',
        user: req.user,
      });
      res.json({ message: 'Attendance record updated directly', record });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/corrections/request — Submit correction request after window (FR-08)
router.post(
  '/request',
  authenticate,
  authorize('ADMIN', 'FACULTY'),
  async (req, res, next) => {
    try {
      const { attendanceRecordId, newStatus, reason } = req.body;
      if (!attendanceRecordId || !newStatus || !reason) {
        return res.status(400).json({ error: 'attendanceRecordId, newStatus, and reason are required' });
      }
      const request = await correctionService.submitCorrectionRequest({
        attendanceRecordId,
        newStatus,
        reason,
        user: req.user,
      });
      res.status(201).json({ message: 'Correction request submitted for Admin approval', request });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/corrections — List correction requests (FR-08)
router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'FACULTY'),
  async (req, res, next) => {
    try {
      const { status, sectionId } = req.query;
      const requests = await correctionService.listCorrectionRequests({
        status,
        sectionId,
        userId: req.user.id,
        role: req.user.role,
      });
      res.json({ count: requests.length, requests });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/corrections/:id/review — Admin reviews (Approve/Reject) (FR-08)
router.patch(
  '/:id/review',
  authenticate,
  authorize('ADMIN'),
  async (req, res, next) => {
    try {
      const { action, reviewNote } = req.body;
      if (!action || !['APPROVE', 'REJECT'].includes(action)) {
        return res.status(400).json({ error: 'Valid action (APPROVE or REJECT) is required' });
      }
      const result = await correctionService.reviewCorrectionRequest({
        requestId: req.params.id,
        action,
        reviewNote,
        adminUser: req.user,
      });
      res.json({ message: `Correction request ${action.toLowerCase()}d successfully`, result });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
