const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const { recordAuditLog } = require('../services/auditService');

const JWT_SECRET = process.env.JWT_SECRET || 'sams_super_secret_jwt_key_pes_e1_2026';

/**
 * Authenticate incoming request via Bearer token (SR-07).
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        code: 'UNAUTHENTICATED',
        error: 'Authentication required. Missing or malformed token.',
      });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      const expired = err.name === 'TokenExpiredError';
      return res.status(401).json({
        code: expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
        error: expired ? 'Your session has expired.' : 'Invalid token.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, role: true, active: true, srn: true, department: true },
    });

    if (!user || !user.active) {
      return res.status(401).json({ code: 'INVALID_TOKEN', error: 'User account is inactive or not found.' });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Authorize roles (ADMIN, FACULTY, STUDENT). Denials are audit-logged (SR-02).
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ code: 'UNAUTHENTICATED', error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      recordAuditLog({
        actorId: req.user.id,
        action: 'ACCESS_DENIED',
        entity: 'route',
        entityId: `${req.method} ${req.originalUrl}`,
        ip: req.ip,
      }).catch(() => {});
      return res.status(403).json({
        code: 'FORBIDDEN',
        error: `Forbidden. Role '${req.user.role}' does not have permission to access this resource.`,
      });
    }
    next();
  };
}

module.exports = {
  authenticate,
  authorize,
};
