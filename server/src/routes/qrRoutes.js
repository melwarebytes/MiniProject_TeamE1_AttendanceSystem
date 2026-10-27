const express = require('express');
const { body, param } = require('express-validator');
const qrService = require('../services/qrService');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const sessionId = param('id').isUUID().withMessage('Invalid session id');

// GET /api/v1/qr/today — today's classes the caller can run check-in for
router.get('/qr/today', authenticate, authorize('FACULTY', 'ADMIN'),
  wrap(async (req, res) => res.json({ sessions: await qrService.todaysSessions(req.user) })));

// POST /api/v1/sessions/:id/qr — open a check-in window (FR-07)
router.post(
  '/sessions/:id/qr',
  authenticate,
  authorize('FACULTY', 'ADMIN'),
  sessionId,
  body('minutes').isInt({ min: 1, max: 10 }).withMessage('minutes must be between 1 and 10'),
  validate,
  wrap(async (req, res) => res.status(201).json(await qrService.openWindow(req.params.id, Number(req.body.minutes), req.user, req.ip)))
);

// GET /api/v1/sessions/:id/qr — window status and check-in count
router.get('/sessions/:id/qr', authenticate, authorize('FACULTY', 'ADMIN'), sessionId, validate,
  wrap(async (req, res) => res.json(await qrService.status(req.params.id, req.user))));

// GET /api/v1/sessions/:id/qr/token — current rotating token for the classroom screen
router.get('/sessions/:id/qr/token', authenticate, authorize('FACULTY', 'ADMIN'), sessionId, validate,
  wrap(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await qrService.issueToken(req.params.id, req.user));
  }));

// DELETE /api/v1/sessions/:id/qr — close the window early
router.delete('/sessions/:id/qr', authenticate, authorize('FACULTY', 'ADMIN'), sessionId, validate,
  wrap(async (req, res) => {
    await qrService.closeWindow(req.params.id, req.user, req.ip);
    res.status(204).end();
  }));

// POST /api/v1/checkins — student checks in with a scanned token (FR-07, SR-05)
router.post(
  '/checkins',
  authenticate,
  authorize('STUDENT'),
  body('token').isString().isLength({ min: 20, max: 1000 }).withMessage('Scan the QR code shown in class'),
  validate,
  wrap(async (req, res) => res.status(201).json(await qrService.checkIn(req.body.token, req.user, req.ip)))
);

module.exports = router;
