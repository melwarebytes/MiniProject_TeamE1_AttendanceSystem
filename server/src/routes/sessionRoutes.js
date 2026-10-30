const express = require('express');
const router = express.Router();
const sessionService = require('../services/sessionService');
const { authenticate, authorize } = require('../middleware/auth');

// POST /api/v1/sessions/generate — Generate sessions from timetable (FR-05)
router.post('/generate', authenticate, authorize('ADMIN', 'FACULTY'), async (req, res, next) => {
  try {
    const { sectionId } = req.body;
    if (!sectionId) {
      return res.status(400).json({ error: 'sectionId is required' });
    }
    const sessions = await sessionService.generateSessionsFromTimetable({
      sectionId,
      actorId: req.user.id,
      user: req.user,
    });
    res.status(201).json({
      message: `Successfully generated ${sessions.length} sessions from timetable`,
      count: sessions.length,
      sessions,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/sessions/extra — Add extra session (FR-05)
router.post('/extra', authenticate, authorize('ADMIN', 'FACULTY'), async (req, res, next) => {
  try {
    const { sectionId, date, startTime, endTime } = req.body;
    if (!sectionId || !date || !startTime || !endTime) {
      return res.status(400).json({ error: 'sectionId, date, startTime, and endTime are required' });
    }
    const session = await sessionService.addExtraSession({
      sectionId,
      date,
      startTime,
      endTime,
      actorId: req.user.id,
      user: req.user,
    });
    res.status(201).json({ message: 'Extra session added successfully', session });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/sessions/:id/cancel — Cancel a session with reason (FR-05)
router.patch('/:id/cancel', authenticate, authorize('ADMIN', 'FACULTY'), async (req, res, next) => {
  try {
    const { reason } = req.body;
    const session = await sessionService.cancelSession({
      sessionId: req.params.id,
      reason,
      actorId: req.user.id,
      user: req.user,
    });
    res.json({ message: 'Session cancelled successfully', session });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/sessions — List sessions
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { sectionId, startDate, endDate, status } = req.query;
    const sessions = await sessionService.getSessions({
      sectionId,
      startDate,
      endDate,
      status,
      user: req.user,
    });
    res.json({ count: sessions.length, sessions });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
