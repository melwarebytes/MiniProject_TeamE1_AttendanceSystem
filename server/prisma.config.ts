import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7 reads the connection string and seed command from here instead of schema.prisma.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.js',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
