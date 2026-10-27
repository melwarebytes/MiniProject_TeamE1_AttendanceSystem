const cron = require('node-cron');
const prisma = require('../utils/prisma');
const { checkAndTriggerAlertsForSection } = require('../services/alertService');
const logger = require('../utils/logger');

/**
 * FR-11: Daily / regular background job to evaluate low attendance thresholds
 */
function initAttendanceAlertJob() {
  // Run every day at 18:00 IST (after daily classes)
  cron.schedule('0 18 * * 1-6', async () => {
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
    }
  });
}

module.exports = {
  initAttendanceAlertJob,
};
