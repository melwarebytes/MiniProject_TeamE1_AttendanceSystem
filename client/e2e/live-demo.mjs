// Real Docker API/database smoke demo. No API interception or production accounts.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const dir='../release-results/demo';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch();
const results=[];
try {
  for(const [role,email,pages] of [
    ['admin','admin@pes.edu',['/users','/courses','/policies','/reports','/audit']],
    ['faculty','faculty@pes.edu',['/sessions','/mark','/corrections','/defaulters']],
    ['student','bhuvan@pes.edu',['/dashboard','/leave','/check-in']],
  ]) {
    const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir,size:{width:1440,height:1000}}});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://localhost:5173/login');
    await page.getByLabel('Email',{exact:true}).fill(email);
    await page.getByLabel('Password',{exact:true}).fill('Password123!');
    await page.getByRole('button',{name:'Log in',exact:true}).click();
    await expect(page).not.toHaveURL(/\/login$/);
    for(const path of pages) {
      await page.goto('http://localhost:5173'+path);
      await expect(page.locator('h1')).toBeVisible();
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('alert')).toHaveCount(0);
      if(path==='/reports') {
        await page.getByRole('button',{name:'Generate report',exact:true}).click();
        await expect(page.getByRole('button',{name:'Export CSV'})).toBeVisible();
        for(const format of ['CSV','PDF']) {
          const downloadPromise=page.waitForEvent('download');
          await page.getByRole('button',{name:`Export ${format}`}).click();
          const download=await downloadPromise;
          await download.saveAs(`${dir}/report.${format.toLowerCase()}`);
        }
      }
      if(path==='/dashboard') await expect(page.getByText('Software Engineering',{exact:false}).first()).toBeVisible();
      await page.screenshot({path:`${dir}/${role}-${path.slice(1)}.png`,fullPage:true});
      results.push({role,path,passed:true});
    }
    if(errors.length)throw new Error(errors.join('\n'));
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(`${dir}/checks.json`,JSON.stringify(results,null,2));
}
