const express = require('express');
const router = express.Router();
const dashboardService = require('../services/dashboardService');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/v1/dashboard/student — Student views their own attendance dashboard (FR-09)
router.get('/student', authenticate, authorize('STUDENT'), async (req, res, next) => {
  try {
    const dashboard = await dashboardService.getStudentDashboard(req.user.id, req.user);
    res.json(dashboard);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/dashboard/student/:id — Faculty/Admin views a specific student's dashboard (FR-09)
router.get(
  '/student/:id',
  authenticate,
  authorize('ADMIN', 'FACULTY'),
  async (req, res, next) => {
    try {
      const dashboard = await dashboardService.getStudentDashboard(req.params.id, req.user);
      res.json(dashboard);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
