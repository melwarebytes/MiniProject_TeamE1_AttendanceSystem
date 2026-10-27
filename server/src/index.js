require('dotenv').config();
const app = require('./app');
const logger = require('./utils/logger');
const { initAttendanceAlertJob } = require('./jobs/attendanceAlertJob');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`SAMS API server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  initAttendanceAlertJob();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

module.exports = server;
