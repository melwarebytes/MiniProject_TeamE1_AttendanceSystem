const express = require('express');
const router = express.Router();
const alertService = require('../services/alertService');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/v1/alerts/defaulters/:sectionId — Faculty/Admin lists students below threshold (FR-11)
router.get(
  '/defaulters/:sectionId',
  authenticate,
  authorize('ADMIN', 'FACULTY'),
  async (req, res, next) => {
    try {
      const data = await alertService.listStudentsBelowThreshold(req.params.sectionId, req.user);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/alerts/my — Student views their in-app alerts (FR-11)
router.get('/my', authenticate, authorize('STUDENT'), async (req, res, next) => {
  try {
    const alerts = await alertService.getStudentAlerts(req.user.id);
    res.json({ count: alerts.length, alerts });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/alerts/:id/read — Student marks alert as read
router.patch('/:id/read', authenticate, authorize('STUDENT'), async (req, res, next) => {
  try {
    await alertService.markAlertAsRead(req.params.id, req.user.id);
    res.json({ message: 'Alert marked as read' });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/alerts/trigger/:sectionId — Trigger check manually (Admin/Faculty)
router.post(
  '/trigger/:sectionId',
  authenticate,
  authorize('ADMIN', 'FACULTY'),
  async (req, res, next) => {
    try {
      await alertService.listStudentsBelowThreshold(req.params.sectionId, req.user);
      const alerts = await alertService.checkAndTriggerAlertsForSection(req.params.sectionId);
      res.json({ message: `Triggered alert checks. ${alerts.length} new alerts sent.`, alerts });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
