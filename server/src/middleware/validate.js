const { validationResult } = require('express-validator');

/**
 * Runs after express-validator chains. Rejects the request with 400 VALIDATION_FAILED
 * and a per-field error list (SR-08: validate every input on the server).
 */
function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array().map((e) => ({ field: e.path, message: e.msg }));
  return res.status(400).json({
    type: 'https://sams.pes.edu/errors/VALIDATION_FAILED',
    code: 'VALIDATION_FAILED',
    title: 'Request validation failed',
    status: 400,
    error: errors[0].message,
    detail: errors.map((e) => `${e.field}: ${e.message}`).join('; '),
    errors,
  });
}

module.exports = validate;
