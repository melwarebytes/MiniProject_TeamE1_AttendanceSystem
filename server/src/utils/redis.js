const Redis = require('ioredis');
const logger = require('./logger');

// Shared Redis connection for short-lived state: QR windows, nonces and check-in locks.
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  maxRetriesPerRequest: 2,
  enableOfflineQueue: true,
});

redis.on('error', (err) => logger.warn(`Redis error: ${err.message}`));

module.exports = redis;
