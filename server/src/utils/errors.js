/**
 * Typed application errors (SADS §11.3). Business code throws these; the global
 * error handler in app.js turns them into the JSON error envelope (SADS §11.1).
 */
class AppError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    Object.assign(this, extra);
  }
}

const badRequest = (message, errors) => new AppError(400, 'VALIDATION_FAILED', message, { errors });
const unauthorized = (code, message) => new AppError(401, code, message);
const forbidden = (message = 'You do not have permission to do this.') => new AppError(403, 'FORBIDDEN', message);
const notFound = (message = 'Resource not found.') => new AppError(404, 'NOT_FOUND', message);
const conflict = (code, message) => new AppError(409, code, message);

module.exports = { AppError, badRequest, unauthorized, forbidden, notFound, conflict };
