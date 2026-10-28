require('dotenv').config();
const { initRetentionJob } = require('../src/jobs/retentionJob');
const worker = initRetentionJob();
console.log('Retention scheduled daily at 02:30 Asia/Kolkata');
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    worker.task.stop();
    await worker.db.$disconnect();
    process.exit(0);
  });
