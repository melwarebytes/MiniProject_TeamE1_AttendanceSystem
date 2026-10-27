const prisma = require('../utils/prisma');
const logger = require('../utils/logger');

/**
 * Write one entry to the append-only audit log (SR-06).
 * Pass `tx` to make the entry part of the caller's transaction.
 */
async function recordAuditLog({
  actorId,
  action,
  entity,
  entityId,
  oldValue = null,
  newValue = null,
  ip = null,
  tx = prisma,
}) {
  try {
    const log = await tx.auditLog.create({
      data: {
        actorId: actorId || null,
        action,
        entity,
        entityId: String(entityId),
        oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : undefined,
        newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : undefined,
        ip,
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
