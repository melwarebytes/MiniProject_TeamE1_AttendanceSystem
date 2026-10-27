const express = require('express');
const { body } = require('express-validator');
const authService = require('../services/authService');
const { authenticate } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');
const validate = require('../middleware/validate');

const router = express.Router();

const COOKIE = 'sams_rt';
const cookieOptions = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE !== 'false', // SR-07: Secure, HttpOnly, SameSite=Strict
  sameSite: 'strict',
  path: '/api/v1/auth',
  maxAge: authService.REFRESH_TTL_MS,
};

function sendSession(res, { accessToken, refreshToken, user }) {
  res.cookie(COOKIE, refreshToken, cookieOptions);
  res.json({
    message: 'Login successful',
    token: accessToken, // kept for the existing client code
    accessToken,
    expiresIn: 15 * 60,
    user,
  });
}

// POST /api/v1/auth/login — FR-01
router.post(
  '/login',
  loginLimiter,
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail({ gmail_remove_dots: false }),
  body('password').isString().notEmpty().withMessage('Password is required'),
  validate,
  async (req, res, next) => {
    try {
      sendSession(res, await authService.login({ email: req.body.email, password: req.body.password, ip: req.ip }));
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/refresh — SR-07 token rotation
router.post('/refresh', async (req, res, next) => {
  try {
    sendSession(res, await authService.refresh(req.cookies[COOKIE]));
  } catch (err) {
    res.clearCookie(COOKIE, { ...cookieOptions, maxAge: undefined });
    next(err);
  }
});

// POST /api/v1/auth/logout
router.post('/logout', async (req, res, next) => {
  try {
    let actorId = null;
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) {
      try {
        actorId = require('jsonwebtoken').decode(header.slice(7))?.id || null;
      } catch (e) {
        actorId = null;
      }
    }
    await authService.logout(req.cookies[COOKIE], actorId, req.ip);
    res.clearCookie(COOKIE, { ...cookieOptions, maxAge: undefined });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/me
router.get('/me', authenticate, (req, res) => res.json({ user: req.user }));

// POST /api/v1/auth/password-reset/request — FR-02 (same answer whether or not the email exists)
router.post(
  '/password-reset/request',
  loginLimiter,
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail({ gmail_remove_dots: false }),
  validate,
  async (req, res, next) => {
    try {
      await authService.requestPasswordReset(req.body.email, req.ip);
      res.status(202).json({ message: 'If that email is registered, a reset link has been sent.' });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/password-reset/confirm — FR-02
router.post(
  '/password-reset/confirm',
  loginLimiter,
  body('token').isString().notEmpty().withMessage('Reset token is required'),
  body('password').isString().withMessage('New password is required'),
  validate,
  async (req, res, next) => {
    try {
      await authService.confirmPasswordReset(req.body.token, req.body.password, req.ip);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
