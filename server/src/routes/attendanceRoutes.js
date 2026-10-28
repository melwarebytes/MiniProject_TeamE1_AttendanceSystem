const express = require('express');
const router = express.Router();
const attendanceService = require('../services/attendanceService');
const alertService = require('../services/alertService');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/v1/attendance/roster/:sessionId — Get roster with default PRESENT status (FR-06)
router.get(
  '/roster/:sessionId',
  authenticate,
  authorize('ADMIN', 'FACULTY'),
  async (req, res, next) => {
    try {
      const data = await attendanceService.getSessionRoster(req.params.sessionId, req.user);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/attendance/roster/:sessionId — Submit whole roster in one transaction (FR-06)
router.post(
  '/roster/:sessionId',
  authenticate,
  authorize('ADMIN', 'FACULTY'),
  async (req, res, next) => {
    try {
      const { records, bypassTimeWindow } = req.body;
      if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ error: 'records array is required and must not be empty' });
      }

      const result = await attendanceService.submitAttendanceRoster({
        sessionId: req.params.sessionId,
        records,
        user: req.user,
        bypassTimeWindow: req.user.role === 'ADMIN' && !!bypassTimeWindow,
      });

      // Asynchronously trigger check for low attendance alerts (FR-11)
      const session = await require('../utils/prisma').session.findUnique({
        where: { id: req.params.sessionId },
        select: { sectionId: true },
      });
      if (session) {
        alertService.checkAndTriggerAlertsForSection(session.sectionId).catch(() => {});
      }

      res.status(200).json({
        message: 'Attendance successfully submitted',
        summary: result.statusCounts,
        recordsCount: result.savedRecords.length,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
