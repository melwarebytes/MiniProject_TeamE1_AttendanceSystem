require('dotenv').config();
const app = require('./app');
const logger = require('./utils/logger');
const { initAttendanceAlertJob } = require('./jobs/attendanceAlertJob');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`SAMS API server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  initAttendanceAlertJob();
});

// Graceful shutdown: stop taking requests, then close database and Redis connections
function shutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(async () => {
    await Promise.allSettled([require('./utils/prisma').$disconnect(), require('./utils/redis').quit()]);
    logger.info('Process terminated');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = server;
