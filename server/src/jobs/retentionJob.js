const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { recordAuditLog } = require('../services/auditService');
const logger = require('../utils/logger');

function yearsAgo(now, years) {
  const d = new Date(now);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d;
}
async function runRetention(db, now = new Date()) {
  const cutoff = yearsAgo(now, 2),
    auditCutoff = yearsAgo(now, 3);
  return db.$transaction(
    async (tx) => {
      const lock = await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(22009) AS locked`;
      if (!lock[0].locked) return { skipped: true };
      // Never infer graduation from inactivity: use the latest semester end, and
      // skip accounts with no enrolment evidence or any current/future enrolment.
      const candidates = await tx.user.findMany({
        where: {
          role: 'STUDENT',
          anonymizedAt: null,
          enrollments: { some: {}, every: { section: { semesterEnd: { lt: cutoff } } } },
        },
        select: { id: true },
      });
      for (const user of candidates) {
        const leaves = await tx.leaveRequest.findMany({
          where: { userId: user.id },
          select: { documentPath: true },
        });
        for (const leave of leaves) {
          if (!leave.documentPath) continue;
          const root = path.resolve(process.env.UPLOAD_DIR || 'uploads');
          const file = path.resolve(leave.documentPath);
          if (!file.startsWith(root + path.sep))
            throw new Error('Retention attachment path is outside UPLOAD_DIR');
          // Delete files first: a failed delete leaves the account eligible for retry.
          await fs.unlink(file).catch((e) => {
            if (e.code !== 'ENOENT') throw e;
          });
        }
        await tx.refreshToken.deleteMany({ where: { userId: user.id } });
        await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
        await tx.attendanceAlert.deleteMany({ where: { userId: user.id } });
        await tx.leaveRequest.deleteMany({ where: { userId: user.id } });
        await tx.correctionRequest.updateMany({
          where: { attendanceRecord: { enrollment: { userId: user.id } } },
          data: { reason: '[retained attendance decision]', reviewNote: null },
        });
        await tx.user.update({
          where: { id: user.id },
          data: {
            name: 'Former student',
            email: `${crypto.randomUUID()}@anonymized.invalid`,
            srn: null,
            department: null,
            passwordHash: 'disabled',
            active: false,
            anonymizedAt: now,
            failedLoginCount: 0,
            lockedUntil: null,
          },
        });
        await recordAuditLog({
          action: 'STUDENT_ANONYMIZED',
          entity: 'users',
          entityId: user.id,
          newValue: { retentionYears: 2 },
          tx,
        });
      }
      const deleted = await tx.auditLog.deleteMany({ where: { createdAt: { lt: auditCutoff } } });
      await recordAuditLog({
        action: 'RETENTION_COMPLETED',
        entity: 'retention',
        entityId: now.toISOString(),
        newValue: { anonymized: candidates.length, auditDeleted: deleted.count },
        tx,
      });
      return { anonymized: candidates.length, auditDeleted: deleted.count };
    },
    { timeout: 120000 },
  );
}
function initRetentionJob() {
  if (!process.env.RETENTION_DATABASE_URL)
    throw new Error('RETENTION_DATABASE_URL is required for the retention worker.');
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.RETENTION_DATABASE_URL }),
  });
  const run = () =>
    runRetention(db)
      .then((result) => logger.info('Retention completed', result))
      .catch((error) => logger.error('Retention failed', { message: error.message }));
  const task = cron.schedule('30 2 * * *', run, { timezone: 'Asia/Kolkata' });
  return { task, db, run };
}
module.exports = { runRetention, initRetentionJob, yearsAgo };
