const cron = require('node-cron');
const prisma = require('../utils/prisma');
const { checkAndTriggerAlertsForSection } = require('../services/alertService');
const logger = require('../utils/logger');

/**
 * FR-11: Daily / regular background job to evaluate low attendance thresholds
 */
function initAttendanceAlertJob() {
  // Re-evaluate within five minutes of QR check-ins and corrections.
  let running = false;
  cron.schedule(
    '*/5 * * * *',
    async () => {
      if (running) return;
      running = true;
      logger.info('[Cron] Running scheduled low-attendance evaluation job...');
      try {
        const activeSections = await prisma.section.findMany({
          where: {
            semesterEnd: { gte: new Date() },
          },
          select: { id: true },
        });

        let totalAlerts = 0;
        for (const sec of activeSections) {
          const alerts = await checkAndTriggerAlertsForSection(sec.id);
          totalAlerts += alerts.length;
        }
        logger.info(`[Cron] Completed alert evaluation job. Sent ${totalAlerts} alerts.`);
      } catch (err) {
        logger.error('[Cron] Error running alert evaluation job:', err);
      } finally {
        running = false;
      }
    },
    { timezone: 'Asia/Kolkata' },
  );
}

module.exports = {
  initAttendanceAlertJob,
};
