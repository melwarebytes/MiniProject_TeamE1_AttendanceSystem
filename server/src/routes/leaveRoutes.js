const express = require('express');
const router = express.Router();
const leaveService = require('../services/leaveService');
const upload = require('../middleware/upload');
const { authenticate, authorize } = require('../middleware/auth');

// POST /api/v1/leave — Student submits leave request with optional file (FR-10)
router.post(
  '/',
  authenticate,
  authorize('STUDENT'),
  upload.single('document'),
  async (req, res, next) => {
    try {
      const { sectionId, startDate, endDate, reason } = req.body;
      const leave = await leaveService.submitLeaveRequest({
        studentUser: req.user,
        sectionId,
        startDate,
        endDate,
        reason,
        file: req.file,
      });
      res.status(201).json({ message: 'Leave request submitted successfully', leave });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/leave — List leave requests (FR-10)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, sectionId } = req.query;
    const leaves = await leaveService.listLeaveRequests({
      user: req.user,
      sectionId,
      status,
    });
    res.json({ count: leaves.length, leaves });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/leave/:id/review — Faculty/Admin approves or rejects leave request (FR-10)
router.patch(
  '/:id/review',
  authenticate,
  authorize('ADMIN', 'FACULTY'),
  async (req, res, next) => {
    try {
      const { action, reviewNote } = req.body;
      if (!action || !['APPROVE', 'REJECT'].includes(action)) {
        return res.status(400).json({ error: 'Valid action (APPROVE or REJECT) is required' });
      }
      const result = await leaveService.reviewLeaveRequest({
        leaveId: req.params.id,
        action,
        reviewNote,
        reviewerUser: req.user,
      });
      res.json({
        message: `Leave request ${action.toLowerCase()}d successfully`,
        result,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
