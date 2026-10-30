require('dotenv').config();
const { spawnSync } = require('child_process');
// Bootstrap is explicit: runtime and maintenance roles are separate from owner.
for (const [command, args] of [
  ['npx', ['prisma', 'migrate', 'deploy']],
  ['node', ['scripts/provision-roles.js']],
]) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.MIGRATION_DATABASE_URL },
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
