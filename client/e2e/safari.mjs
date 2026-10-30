// Actual Apple Safari via its native WebDriver, not Playwright's WebKit build.
import { Builder, By, Key, until } from 'selenium-webdriver';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = path.resolve('dist');
const axe = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8');
let submitted;
const course = { id:'c1',code:'CS101',name:'Software Engineering' };
const section = { id:'sec1',course,name:'A',semesterStart:'2026-01-01',semesterEnd:'2026-12-31',faculty:[],enrollments:[] };
const session = { id:'s1',sectionId:'sec1',section,date:'2026-10-30',startTime:'09:00',endTime:'10:00',status:'SCHEDULED' };
const user = role => ({ id:'u1',name:'Test User',email:'test@pes.edu',role });
const server = createServer(async (req,res) => {
  try {
    const url = new URL(req.url,'http://localhost');
    if (url.pathname === '/__harness') {
      const role=url.searchParams.get('role') || '', width=Number(url.searchParams.get('width'));
      const page=url.searchParams.get('page');
      if (![360,1920].includes(width) || !/^\/[a-z-]+$/.test(page)) throw new Error('Invalid fixture');
      res.writeHead(200,{'Content-Type':'text/html','Set-Cookie':`fixture_role=${role}; Path=/; SameSite=Strict`});
      // Safari's desktop window has a minimum width. A same-origin frame gives
      // the page a real 360/1920 CSS-pixel viewport without changing app styles.
      return res.end(`<html><body style="margin:0"><iframe id="app" title="SAMS" style="border:0;width:${width}px;height:900px" src="${page}"></iframe></body></html>`);
    }
    if (url.pathname.startsWith('/api/v1')) {
      const role=(req.headers.cookie || '').match(/fixture_role=([^;]*)/)?.[1];
      const p=url.pathname.replace('/api/v1','');let data={};let status=200;
      if(p.startsWith('/auth/')) { if(!role){status=401;data={error:'Sign in'};}else data={user:user(role),accessToken:'fixture'}; }
      else if(p==='/users')data={data:[{...user('STUDENT'),active:true,srn:'PES101'}],total:1};
      else if(p==='/courses')data={data:[course],total:1};
      else if(p==='/sections')data={data:[section],total:1};
      else if(p==='/policies')data={attendanceThreshold:75,editWindowHours:48,qrWindowMinutes:5,holidays:[]};
      else if(p==='/sessions')data={sessions:[session]};
      else if(p.startsWith('/attendance/roster/')) {
        if(req.method==='POST'){let body='';for await(const chunk of req)body+=chunk;submitted=JSON.parse(body);data={summary:{PRESENT:0,LATE:1,ABSENT:0}};}
        else data={session,roster:[{enrollmentId:'e1',studentName:'Test Student',srn:'PES101',status:submitted?.records[0].status || 'PRESENT'}]};
      }
      else if(p==='/reports')data={type:'section',from:'2026-10-01',to:'2026-10-30',snapshot:'fixture',rows:[{id:'r1',label:'CS101 / A',held:4,present:2,late:1,excused:0,absent:1,attended:3,percentage:75}]};
      else if(p==='/qr/today')data={sessions:[]};
      else if(p==='/audit-logs')data={data:[],actions:[],total:0};
      else if(p==='/corrections')data={requests:[]};
      else if(p==='/leave')data={leaves:[]};
      else if(p==='/alerts/my')data={alerts:[]};
      else if(p==='/dashboard/student')data={student:user('STUDENT'),overall:{totalHeld:0,totalAttended:0,overallPercentage:100},courses:[]};
      res.writeHead(status,{'Content-Type':'application/json'});return res.end(JSON.stringify(data));
    }
    const file = url.pathname.startsWith('/assets/') ? path.join(root,url.pathname) : path.join(root,'index.html');
    if (!file.startsWith(root+path.sep)) throw new Error('Invalid path');
    const type=file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html';
    res.writeHead(200,{'Content-Type':type});res.end(await readFile(file));
  } catch(error) {res.statusCode=500;res.end(error.message);}
});
await new Promise(resolve=>server.listen(5174,'127.0.0.1',resolve));
let driver;
const results={generatedAt:new Date().toISOString(),checks:[],passed:false};
await mkdir('safari-results',{recursive:true});
try {
  driver=await new Builder().forBrowser('safari').build();
  const capabilities=await driver.getCapabilities();
  results.browser=capabilities.get('browserName');results.version=capabilities.get('browserVersion');
  await driver.manage().setTimeouts({script:60000});
  for(const width of [360,1920]) {
    for(const [role,pages] of [['',['/login','/forgot-password']],['ADMIN',['/users','/courses','/policies','/reports','/audit','/sessions']],['FACULTY',['/mark','/qr','/corrections','/defaulters']],['STUDENT',['/dashboard','/leave','/check-in']]]) {
      for(const page of pages) {
        submitted=null;
        await driver.get(`http://127.0.0.1:5174/__harness?${new URLSearchParams({role,page,width})}`);
        await driver.switchTo().frame(await driver.findElement(By.id('app')));
        await driver.wait(until.elementLocated(By.css('h1')),15000);
        if(page==='/reports') {await driver.findElement(By.xpath('//button[text()="Generate report"]')).click();await driver.wait(until.elementLocated(By.xpath('//button[text()="Export CSV"]')),10000);}
        await driver.executeScript(axe);
        const audit=await driver.executeAsyncScript(`const done=arguments[arguments.length-1];axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}).then(r=>done({violations:r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.html)}))})).catch(e=>done({error:e.message}));`);
        const layout=await driver.executeScript('return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth}');
        const check={role,page,width,...layout,...audit};results.checks.push(check);
        if(audit.error || audit.violations.length || layout.width!==width || layout.scrollWidth>width)throw new Error(JSON.stringify(check));
        if(page==='/mark') {
          let reached=false;
          for(let n=0;n<60;n++){await driver.actions().sendKeys(Key.TAB).perform();if(await driver.executeScript("return document.activeElement.textContent==='Late'")){reached=true;break;}}
          if(!reached)throw new Error('Cannot reach Late with Tab in Safari');
          await driver.actions().sendKeys(Key.SPACE,Key.TAB,Key.TAB,Key.ENTER).perform();
          await driver.wait(until.elementLocated(By.css('[role="status"]')),10000);
          if(submitted?.records[0].status!=='LATE')throw new Error('Safari keyboard submission failed');
          results.checks.push({page,width,keyboardSubmission:'passed'});
        }
        if(['/users','/mark','/reports'].includes(page))await writeFile(`safari-results/${page.slice(1)}-${width}.png`,await driver.takeScreenshot(),'base64');
        console.log(`Safari ${width}: ${page} passed`);
      }
    }
  }
  results.passed=true;
} catch(error) {results.error=error.stack;process.exitCode=1;console.error(error);}
finally {await writeFile('safari-results/results.json',JSON.stringify(results,null,2));if(driver)await driver.quit();server.close();}
