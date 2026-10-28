import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const user = role => ({id:'user-1',name:'Test User',email:'test@pes.edu',role});
const course = {id:'course-1',code:'CS101',name:'Software Engineering'};
const section = {id:'section-1',name:'A',course,semesterStart:'2026-01-01',semesterEnd:'2026-12-31',faculty:[],enrollments:[]};
const session = {id:'session-1',sectionId:section.id,section,date:'2026-10-28',startTime:'09:00',endTime:'10:00',status:'SCHEDULED'};
async function mock(page, role) {
  let submitted;
  await page.route('**/api/v1/**', async route => {
    const url=new URL(route.request().url()),p=url.pathname.replace('/api/v1','');
    let data={};
    if(p.startsWith('/auth/')) { if(!role)return route.fulfill({status:401,json:{error:'Sign in'}}); data={user:user(role),accessToken:'test-token'}; }
    else if(p==='/users') data={data:[{...user('STUDENT'),active:true,srn:'PES101'}],total:1};
    else if(p==='/courses') data={data:[course],total:1};
    else if(p==='/sections') data={data:[section],total:1};
    else if(p==='/policies') data={attendanceThreshold:75,editWindowHours:48,qrWindowMinutes:5,holidays:[]};
    else if(p==='/reports') data={type:'section',from:'2026-10-01',to:'2026-10-28',snapshot:'snapshot',rows:[{id:'1',label:'CS101 / A',held:4,present:2,late:1,excused:0,absent:1,attended:3,percentage:75}]};
    else if(p==='/sessions') data={sessions:[session]};
    else if(p.startsWith('/attendance/roster/')) {
      if(route.request().method()==='POST') {submitted=route.request().postDataJSON();data={summary:{PRESENT:0,LATE:1,ABSENT:0}};}
      else data={session,roster:[{enrollmentId:'e1',studentId:'s1',studentName:'Test Student',srn:'PES101',status:submitted?.records[0].status || 'PRESENT'}]};
    }
    else if(p==='/qr/today') data={sessions:[]};
    else if(p==='/audit-logs') data={data:[],actions:[],total:0};
    else if(p==='/corrections') data={requests:[]};
    else if(p==='/leave') data={leaves:[]};
    else if(p==='/alerts/my') data={alerts:[]};
    else if(p==='/dashboard/student') data={student:user('STUDENT'),overall:{totalHeld:0,totalAttended:0,overallPercentage:100},courses:[]};
    await route.fulfill({json:data});
  });
  return () => submitted;
}
async function scan(page) {
  await expect(page.locator('h1')).toBeVisible();
  const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  expect(results.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.html)}))).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}
for(const [role,paths] of [[null,['/login','/forgot-password']],['ADMIN',['/users','/courses','/reports','/policies','/audit','/sessions']],['FACULTY',['/mark','/qr','/corrections','/defaulters']],['STUDENT',['/dashboard','/leave','/check-in']]]) {
  for(const path of paths) test(`${role || 'PUBLIC'} ${path} accessibility and responsive layout`,async({page})=>{
    await mock(page,role);await page.goto(path);
    if(path==='/reports') {await page.getByRole('button',{name:'Generate report'}).click();await expect(page.getByRole('button',{name:'Export CSV'})).toBeVisible();}
    await scan(page);
  });
}
test('faculty completes marking using only the keyboard',async({page})=>{
  const submitted=await mock(page,'FACULTY');await page.goto('/mark');await expect(page.getByRole('button',{name:'Late',exact:true})).toBeVisible();
  // Start at document focus and tab through real controls; no mouse or focus API.
  for(let i=0;i<60;i++) {await page.keyboard.press('Tab');if(await page.getByRole('button',{name:'Late',exact:true}).evaluate(e=>e===document.activeElement))break;}
  await expect(page.getByRole('button',{name:'Late',exact:true})).toBeFocused();await page.keyboard.press('Space');
  await expect(page.getByRole('button',{name:'Late',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('Tab');await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Save & Submit Attendance'})).toBeFocused();await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('successfully submitted');expect(submitted().records).toEqual([{enrollmentId:'e1',status:'LATE'}]);
});
