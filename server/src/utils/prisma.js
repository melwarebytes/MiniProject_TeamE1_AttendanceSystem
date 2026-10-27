const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

// Prisma 7 talks to PostgreSQL through the pg driver adapter (no native query engine needed).
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const prisma = new PrismaClient({
  adapter,
  log: process.env.PRISMA_LOG_QUERIES === 'true' ? ['query', 'error', 'warn'] : ['error'],
});

module.exports = prisma;
