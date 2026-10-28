// Real HTTP/DB/Redis benchmark with disposable, uniquely named data. Never run
// against production: the explicit test-mode opt-in is required before seeding.
require('dotenv').config();
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const jwt = require('jsonwebtoken');
const prisma = require('../src/utils/prisma');
const { performance } = require('perf_hooks');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const base = 'http://127.0.0.1:3107/api/v1';
let child;
async function http(endpoint, token, body) {
  const start = performance.now();
  const response = await fetch(base + endpoint, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type':'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
  const data = await response.json();
  return { ms: performance.now() - start, status: response.status, data };
}
function summary(samples) {
  const times = samples.map(s => s.ms).sort((a,b) => a-b);
  const p = n => Number(times[Math.min(times.length-1,Math.ceil(times.length*n)-1)].toFixed(2));
  return { requests:samples.length, errors:samples.filter(s=>s.status>=400).length, p95Ms:p(.95),p99Ms:p(.99),maxMs:p(1) };
}
async function main() {
  if (process.env.NODE_ENV !== 'test' || process.env.LOAD_TEST_ALLOW_SEED !== '1') throw new Error('Use a disposable database with NODE_ENV=test and LOAD_TEST_ALLOW_SEED=1.');
  const tag = `load-${crypto.randomUUID()}`;
  const faculty = await prisma.user.create({data:{name:tag,email:`${tag}@pes.edu`,passwordHash:'disabled-load-account',role:'FACULTY'}});
  const students=Array.from({length:500},(_,i)=>({id:crypto.randomUUID(),name:`${tag}-${i}`,email:`${tag}-${i}@pes.edu`,passwordHash:'disabled-load-account',role:'STUDENT'}));
  await prisma.user.createMany({data:students});
  const today=new Date();today.setUTCHours(0,0,0,0);
  const course=await prisma.course.create({data:{code:tag,name:'Load fixture'}});
  const section=await prisma.section.create({data:{courseId:course.id,name:'Load',semesterStart:new Date(today.getTime()-90*86400000),semesterEnd:new Date(today.getTime()+90*86400000),faculty:{create:{userId:faculty.id}}}});
  const enrollments=students.map(s=>({id:crypto.randomUUID(),sectionId:section.id,userId:s.id}));
  await prisma.enrollment.createMany({data:enrollments});
  const sessions=Array.from({length:30},(_,i)=>({id:crypto.randomUUID(),sectionId:section.id,date:new Date(today.getTime()-(i+1)*86400000),startTime:'09:00',endTime:'10:00'}));
  await prisma.session.createMany({data:sessions});
  for(const session of sessions) await prisma.attendanceRecord.createMany({data:enrollments.map((e,i)=>({enrollmentId:e.id,sessionId:session.id,status:i%5?'PRESENT':'ABSENT'}))});
  const qrSession=await prisma.session.create({data:{sectionId:section.id,date:today,startTime:'00:00',endTime:'23:59'}});
  const sign=user=>jwt.sign({id:user.id,role:user.role},process.env.JWT_SECRET,{expiresIn:'15m'});
  const facultyToken=sign(faculty),tokens=students.map(sign);
  child=spawn(process.execPath,['src/index.js'],{env:{...process.env,PORT:'3107',DATABASE_URL:process.env.TEST_APP_DATABASE_URL || process.env.DATABASE_URL,DISABLE_RATE_LIMIT:'true'},stdio:['ignore','ignore','inherit']});
  for(let i=0;i<100;i++){try {if((await fetch(base+'/health')).ok)break;}catch {} await sleep(100);}
  // Warm caches and connection pools before measuring 500 independent users.
  await Promise.all(tokens.slice(0,20).map(t=>http('/dashboard/student',t)));
  const samples=[];
  await Promise.all(tokens.map(async(token,i)=>{for(let n=0;n<10;n++){samples.push(await http((n+i)%2?'/dashboard/student':'/auth/me',token));await sleep(20);}}));
  const api=summary(samples);
  const opened=await http(`/sessions/${qrSession.id}/qr`,facultyToken,{minutes:2});
  if(opened.status!==201)throw new Error('Could not open QR window: '+JSON.stringify(opened));
  const burst=[];const burstStart=performance.now();
  // 5 new, independently authenticated students/second for 60 s; token rotated
  // every 10 s so the workload exercises normal expiry and nonce verification.
  let qrToken;
  for(let second=0;second<60;second++){
    if(second%10===0){const issued=await http(`/sessions/${qrSession.id}/qr/token`,facultyToken);if(issued.status!==200)throw new Error('QR token issuance failed');qrToken=issued.data.token;}
    for(let j=0;j<5;j++)burst.push(http('/checkins',tokens[second*5+j],{token:qrToken}));
    await sleep(Math.max(0,burstStart+(second+1)*1000-performance.now()));
  }
  const qr=summary(await Promise.all(burst));
  qr.durationSeconds=Number(((performance.now()-burstStart)/1000).toFixed(2));
  qr.errorRate=qr.errors/qr.requests;
  const rosterSession=await prisma.session.create({data:{sectionId:section.id,date:today,startTime:'00:00',endTime:'23:59'}});
  const roster=await http(`/attendance/roster/${rosterSession.id}`,facultyToken,{records:enrollments.slice(0,200).map(e=>({enrollmentId:e.id,status:'PRESENT'}))});
  const result={generatedAt:new Date().toISOString(),environment:{platform:os.platform(),arch:os.arch(),cpus:os.cpus().length,memoryGB:Number((os.totalmem()/2**30).toFixed(1)),node:process.version,ci:!!process.env.CI,commit:process.env.GITHUB_SHA || 'local',rateLimiting:'disabled for shared load-generator IP; production defaults unchanged'},fixture:{concurrentUsers:500,requestsPerUser:10,students:500,pastSessions:30,attendanceRows:15000},api,qr,roster:{students:200,ms:roster.ms,status:roster.status},passed:api.errors===0&&api.p95Ms<=2000&&api.p99Ms<=4000&&qr.errorRate<.005&&roster.status===200&&roster.ms<=3000};
  fs.mkdirSync(path.join(__dirname,'../performance/results'),{recursive:true});
  fs.writeFileSync(path.join(__dirname,'../performance/results/latest.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
  if(!result.passed)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(child)child.kill('SIGTERM');await prisma.$disconnect();await require('../src/utils/redis').quit();});
