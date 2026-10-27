const prisma = require('../utils/prisma');
const logger = require('../utils/logger');

/**
 * Log an action to the immutable audit log table
 */
async function recordAuditLog({ actorId, action, entity, entityId, oldValue = null, newValue = null, tx = prisma }) {
  try {
    const log = await tx.auditLog.create({
      data: {
        actorId,
        action,
        entity,
        entityId,
        oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
        newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
      },
    });
    return log;
  } catch (error) {
    logger.error('Failed to create audit log entry:', error);
    // Audit failures should not crash main transaction unless critical
    return null;
  }
}

module.exports = {
  recordAuditLog,
};
