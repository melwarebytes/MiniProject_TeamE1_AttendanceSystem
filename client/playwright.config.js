import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', timeout: 60000, fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  webServer: { command:'npm run dev -- --host 127.0.0.1', url:'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
  projects: ['chromium','firefox','webkit'].flatMap(browserName => [360,1920].map(width => ({name:`${browserName}-${width}`,use:{browserName,viewport:{width,height:900}}}))),
});
