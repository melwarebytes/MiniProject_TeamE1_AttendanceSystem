const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const correctionRoutes = require('./routes/correctionRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const alertRoutes = require('./routes/alertRoutes');
const qrRoutes = require('./routes/qrRoutes');
const auditRoutes = require('./routes/auditRoutes');
const prisma = require('./utils/prisma');
const redis = require('./utils/redis');
const logger = require('./utils/logger');
const { apiLimiter } = require('./middleware/rateLimit');

const app = express();

// Behind Nginx in Docker, so req.ip is the client address, not the proxy's.
app.set('trust proxy', 1);

// Security and utility middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use('/api/', apiLimiter);

// Static uploads directory
app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR || 'uploads')));

// Health check endpoint (NFR-03): 200 when the database and Redis respond, 503 otherwise.
// Docker's health check and the uptime monitor both call this.
app.get('/api/v1/health', async (req, res) => {
  const check = async (fn) => {
    try {
      await Promise.race([fn(), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))]);
      return 'ok';
    } catch (e) {
      return 'down';
    }
  };
  const [database, cache] = await Promise.all([check(() => prisma.$queryRaw`SELECT 1`), check(() => redis.ping())]);
  const healthy = database === 'ok' && cache === 'ok';
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    checks: { database, redis: cache },
    timestamp: new Date().toISOString(),
    service: 'SAMS API',
    uptime: process.uptime(),
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/sessions', sessionRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/corrections', correctionRoutes);
app.use('/api/v1/leave', leaveRoutes);
app.use('/api/v1/alerts', alertRoutes);
app.use('/api/v1', qrRoutes);
app.use('/api/v1/audit-logs', auditRoutes);

app.use('/api/v1', require('./routes/adminRoutes'));
app.use('/api/v1/reports', require('./routes/reportRoutes'));

// 404 Not Found handler
app.use((req, res) => {
  res.status(404).json({ code: 'NOT_FOUND', status: 404, error: `Not Found: ${req.method} ${req.originalUrl}` });
});

// Global error handler: one JSON envelope for every error (SADS §11.1).
// Stack traces and SQL never reach the client; they are logged with a trace ID instead.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = err.status || err.statusCode || 500;
  let code = err.code;
  let message = err.message;

  if (err.name === 'MulterError') {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    code = err.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'UPLOAD_FAILED';
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 5 MB.' : message;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    code = 'VALIDATION_FAILED';
    message = 'Request body is not valid JSON.';
  } else if (typeof code === 'string' && code.startsWith('P')) {
    // Prisma errors: never leak query details
    code = code === 'P2002' ? 'CONFLICT' : code === 'P2025' ? 'NOT_FOUND' : 'DATABASE_ERROR';
    status = code === 'CONFLICT' ? 409 : code === 'NOT_FOUND' ? 404 : 500;
    message = code === 'CONFLICT' ? 'A record with these details already exists.' : code === 'NOT_FOUND' ? 'Record not found.' : 'Internal Server Error';
  }

  const traceId = require('crypto').randomUUID();
  if (status >= 500) {
    logger.error(`[${traceId}] Unhandled server error: ${err.stack || err}`);
    message = 'Something went wrong on our side. Please try again.';
    code = code && !String(code).startsWith('P') ? code : 'INTERNAL_ERROR';
  }

  res.status(status).json({
    type: `https://sams.pes.edu/errors/${code || 'ERROR'}`,
    code: code || undefined,
    status,
    error: message || 'Internal Server Error',
    errors: err.errors,
    lockedUntil: err.lockedUntil,
    traceId: status >= 500 ? traceId : undefined,
  });
});

module.exports = app;
