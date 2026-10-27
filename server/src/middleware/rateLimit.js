const rateLimit = require('express-rate-limit');

// SR-04: 20 login attempts per minute and 300 API requests per minute per IP.
// Skipped under Jest so tests are not throttled.
const skip = () => process.env.NODE_ENV === 'test' || process.env.DISABLE_RATE_LIMIT === 'true';

const envelope = (req, res) =>
  res.status(429).json({
    code: 'RATE_LIMITED',
    status: 429,
    error: 'Too many requests. Please wait a moment and try again.',
  });

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.LOGIN_RATE_LIMIT || 20),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  handler: envelope,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT || 300),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  handler: envelope,
});

module.exports = { loginLimiter, apiLimiter };
