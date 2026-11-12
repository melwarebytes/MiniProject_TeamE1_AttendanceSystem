// Records the Sprint 1 / Sprint 2 demo walkthroughs against the live Docker stack (real API, no mocks)
// and builds the final MP4 with ffmpeg.
//   node e2e/sprint-demo.mjs 1|2 <outDir> [--no-reset] [--no-build]
// Optional env: SAMS_DEMO_DUMP (pg_dump -Fc baseline to restore first), SAMS_DEMO_COMPOSE_OVERRIDE (extra compose file),
//               SAMS_DEMO_MP4 (output path, default ../9_Demo/Sprint<N>_Demo.mp4), SAMS_URL (default http://localhost:5173)
import { chromium, request as pwRequest } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const sprint = process.argv[2];
const outDir = resolve(process.argv[3] || '../release-results/sprint-demo');
const flags = process.argv.slice(4);
if (!['1', '2'].includes(sprint)) throw new Error('usage: node e2e/sprint-demo.mjs 1|2 <outDir>');
const BASE = process.env.SAMS_URL || 'http://localhost:5173';
const PW = 'Password123!';
const W = 1280, H = 720;
const REPO = resolve('..');
const finalMp4 = process.env.SAMS_DEMO_MP4 || join(REPO, '9_Demo', `Sprint${sprint}_Demo.mp4`);
const rawDir = join(outDir, `sprint${sprint}-raw`);
rmSync(rawDir, { recursive: true, force: true });
mkdirSync(rawDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const todayIst = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const nowIstHM = () =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());

// ---------- environment reset ----------
function compose(args, input) {
  const files = ['-f', 'docker-compose.yml'];
  if (process.env.SAMS_DEMO_COMPOSE_OVERRIDE) files.push('-f', process.env.SAMS_DEMO_COMPOSE_OVERRIDE);
  const r = spawnSync('docker', ['compose', ...files, ...args], { cwd: REPO, input, encoding: input ? null : 'utf8' });
  return r;
}
function resetBaseline() {
  if (flags.includes('--no-reset')) return;
  if (!process.env.SAMS_DEMO_DUMP) { console.warn('SAMS_DEMO_DUMP not set: using the current database state'); return; }
  const r = compose(['exec', '-T', 'postgres', 'pg_restore', '-U', 'sams', '-d', 'sams', '--clean', '--if-exists'], readFileSync(process.env.SAMS_DEMO_DUMP));
  if (r.status !== 0) throw new Error('pg_restore failed: ' + r.stderr);
  compose(['exec', '-T', 'redis', 'redis-cli', 'FLUSHALL']);
  console.log('database reset to baseline');
}

// ---------- API helper (setup only; never replaces on-screen actions) ----------
async function apiAs(email) {
  const rc = await pwRequest.newContext({ baseURL: BASE });
  const login = await rc.post('/api/v1/auth/login', { data: { email, password: PW } });
  if (!login.ok()) throw new Error(`api login ${email}: ${login.status()}`);
  const headers = { Authorization: `Bearer ${(await login.json()).accessToken}` };
  const call = async (method, path, data) => {
    const res = await rc.fetch('/api/v1' + path, { method, headers, data });
    const body = await res.json().catch(() => ({}));
    if (!res.ok()) throw new Error(`${method} ${path} -> ${res.status()} ${JSON.stringify(body)}`);
    return body;
  };
  return { get: (p) => call('GET', p), post: (p, d) => call('POST', p, d), dispose: () => rc.dispose() };
}

// ---------- recording helpers ----------
const INIT = () => {
  const css = `#__cap{position:fixed;left:0;right:0;bottom:0;z-index:2147483647;padding:14px 28px;font:600 ${innerWidth < 900 ? 17 : 23}px/1.3 system-ui,'Segoe UI',sans-serif;color:#fff;background:rgba(15,23,42,.9);text-align:center;pointer-events:none;border-top:3px solid #6366f1}
#__cur{position:fixed;z-index:2147483646;width:22px;height:22px;margin:-4px 0 0 -4px;border-radius:50%;background:rgba(239,68,68,.55);border:2px solid #b91c1c;pointer-events:none;transition:transform .08s}
body{padding-bottom:84px !important}`;
  const ensure = () => {
    if (!document.body) return;
    if (!document.getElementById('__capcss')) {
      const s = document.createElement('style'); s.id = '__capcss'; s.textContent = css; document.head.appendChild(s);
    }
    let d = document.getElementById('__cap');
    if (!d) { d = document.createElement('div'); d.id = '__cap'; document.body.appendChild(d); }
    let t = ''; try { t = sessionStorage.getItem('__cap') || ''; } catch (e) { /* ignore */ }
    if (d.textContent !== t) d.textContent = t;
    d.style.display = t ? 'block' : 'none';
    if (!document.getElementById('__cur')) { const c = document.createElement('div'); c.id = '__cur'; c.style.display = 'none'; document.body.appendChild(c); }
  };
  window.__ensureCap = ensure;
  document.addEventListener('DOMContentLoaded', ensure);
  setInterval(ensure, 250);
  document.addEventListener('mousemove', (e) => {
    const c = document.getElementById('__cur');
    if (c) { c.style.display = 'block'; c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }
  }, true);
  document.addEventListener('mousedown', () => { const c = document.getElementById('__cur'); if (c) c.style.transform = 'scale(.6)'; }, true);
  document.addEventListener('mouseup', () => { const c = document.getElementById('__cur'); if (c) c.style.transform = ''; }, true);
};

async function newCtx(browser, name, { w = W, h = H, email } = {}) {
  // refresh tokens rotate, so every recorded context gets its own freshly logged-in state
  const state = email ? await stateFor(browser, email) : undefined;
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    timezoneId: 'Asia/Kolkata',
    locale: 'en-IN',
    acceptDownloads: true,
    storageState: state,
    recordVideo: { dir: join(rawDir, name), size: { width: w, height: h } },
  });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('response', (r) => { if (r.status() >= 500) errs.push(`${r.status()} ${r.url()}`); });
  page.__errs = errs;
  return { ctx, page, name, dir: join(rawDir, name) };
}
async function closeCtx(c) {
  await c.ctx.close();
  const f = readdirSync(c.dir).find((x) => x.endsWith('.webm'));
  if (c.page.__errs.length) console.warn(`[${c.name}] errors:`, c.page.__errs);
  return join(c.dir, f);
}
const cap = (page, text) =>
  page.evaluate((t) => { try { sessionStorage.setItem('__cap', t); } catch (e) { /* ignore */ } window.__ensureCap?.(); }, text);

async function glide(page, loc) {
  const b = await loc.boundingBox();
  if (b) await page.mouse.move(b.x + b.width / 2, b.y + Math.min(b.height / 2, 20), { steps: 16 });
}
async function reveal(loc) {
  await loc.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  await sleep(550);
}
async function click(page, loc) {
  await reveal(loc);
  await glide(page, loc);
  await sleep(150);
  await loc.click();
}
async function type(page, loc, text, delay = 35) {
  await click(page, loc);
  await loc.pressSequentially(text, { delay });
}
async function fillDate(page, loc, value) {
  await click(page, loc);
  await loc.fill(value);
}
async function settle(page, ms = 500) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await sleep(ms);
}
const navTo = async (page, name) => {
  await click(page, page.locator('nav').getByRole('link', { name, exact: true }));
  await settle(page);
};
async function login(page, email) {
  await page.goto(BASE + '/login');
  await page.getByLabel('Email', { exact: true }).waitFor();
  await type(page, page.getByLabel('Email', { exact: true }), email);
  await type(page, page.getByLabel('Password', { exact: true }), PW, 25);
  await click(page, page.getByRole('button', { name: 'Log in', exact: true }));
  await page.locator('nav').waitFor();
  await settle(page, 700);
}
async function logout(page) {
  await cap(page, 'Log out — the session ends and the login screen returns');
  await click(page, page.getByRole('button', { name: 'Log out' }));
  await page.getByLabel('Email', { exact: true }).waitFor();
  await sleep(500);
}
async function stateFor(browser, email) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, timezoneId: 'Asia/Kolkata' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PW);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.locator('nav').waitFor();
  const st = await ctx.storageState();
  await ctx.close();
  return st;
}
async function scrollBy(page, y, ms = 900) {
  await page.evaluate((dy) => window.scrollBy({ top: dy, behavior: 'smooth' }), y);
  await sleep(ms);
}
const scrollTop = (page) => page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })).then(() => sleep(500));

// ---------- title / end cards (rendered with setContent and recorded) ----------
const CARD_CSS = `*{box-sizing:border-box}body{margin:0;height:100vh;background:linear-gradient(135deg,#1e1b4b,#312e81 55%,#4338ca);color:#fff;font-family:system-ui,'Segoe UI',sans-serif;display:flex;flex-direction:column;justify-content:center;padding:0 90px}
h1{font-size:54px;margin:0 0 8px}h2{font-size:26px;font-weight:500;margin:0 0 6px;color:#c7d2fe}p.team{font-size:22px;color:#e0e7ff;margin:4px 0 26px}
ul{margin:0;padding:0;list-style:none;columns:2;column-gap:50px;font-size:21px;line-height:1.55}li{break-inside:avoid;padding-left:0}li b{color:#a5b4fc;display:inline-block;min-width:82px}
.bar{position:absolute;left:0;bottom:0;height:6px;background:#818cf8;animation:g var(--d) linear forwards}@keyframes g{from{width:0}to{width:100%}}
.bug{font-size:21px;line-height:1.4;margin:0 0 12px;padding:10px 16px;background:rgba(255,255,255,.1);border-left:5px solid #34d399;border-radius:6px}
.ci{margin-top:14px;font-size:21px;color:#a7f3d0}.sm{font-size:18px;color:#c7d2fe;margin:6px 0}`;
async function card(browser, name, html, seconds) {
  const c = await newCtx(browser, name);
  await c.page.setContent(`<style>${CARD_CSS}</style>${html}<div class="bar" style="--d:${seconds}s"></div>`);
  await sleep(seconds * 1000);
  return closeCtx(c);
}
function titleCard(items, dates) {
  return `<h2>Software Engineering Mini-Project · Student Attendance Management System</h2><h1>SAMS — Sprint ${sprint} Demo${sprint === '2' ? ' · Merull Shah' : ''}</h1>
<h2>${dates}</h2><p class="team">MiniProject Team E1 · PES University</p>
<p class="sm">Backlog items covered</p><ul>${items.map(([id, t]) => `<li><b>${id}</b>${t}</li>`).join('')}</ul>`;
}
const endCard = (heading, bugs, extra) =>
  `<h1 style="font-size:44px">${heading}</h1>${bugs.map((b) => `<div class="bug">${b}</div>`).join('')}${extra
    .map((e) => `<div class="${e.startsWith('CI') ? 'ci' : 'sm'}">${e}</div>`).join('')}`;

// ---------- build ----------
function ffmpegBuild(segments, out) {
  const args = ['-y', '-loglevel', 'error'];
  const filters = [];
  const labels = [];
  let idx = 0;
  segments.forEach((s, i) => {
    const inputs = Array.isArray(s.file) ? s.file : [s.file];
    inputs.forEach((f) => args.push('-i', f));
    const sp = s.speed || 1;
    const trim = `trim=start=${s.trim ?? 0.45},setpts=PTS-STARTPTS`;
    if (inputs.length === 1) {
      filters.push(`[${idx}:v]${trim},scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x0f172a,setpts=PTS/${sp},fps=25,format=yuv420p[v${i}]`);
    } else {
      const hw = W / 2;
      filters.push(`[${idx}:v]${trim},scale=${hw}:${H}:force_original_aspect_ratio=decrease,pad=${hw}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x0f172a,fps=25[l${i}]`);
      filters.push(`[${idx + 1}:v]${trim},scale=${hw}:${H}:force_original_aspect_ratio=decrease,pad=${hw}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x0f172a,fps=25[r${i}]`);
      filters.push(`[l${i}][r${i}]hstack=inputs=2,drawbox=x=${hw - 2}:y=0:w=4:h=${H}:color=0x6366f1:t=fill,setpts=PTS/${sp},fps=25,format=yuv420p[v${i}]`);
    }
    idx += inputs.length;
    labels.push(`[v${i}]`);
  });
  filters.push(`${labels.join('')}concat=n=${segments.length}:v=1:a=0[outv]`);
  args.push('-filter_complex', filters.join(';'), '-map', '[outv]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p', '-r', '25', '-movflags', '+faststart', '-an', out);
  mkdirSync(resolve(out, '..'), { recursive: true });
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + r.stderr);
  const p = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size', '-of', 'default=nw=1', out], { encoding: 'utf8' });
  console.log(`built ${out}\n${p.stdout}`);
}

// ======================= Sprint 1 =======================
async function sprint1(browser) {
  const segs = [];
  segs.push({ card: true, file: await card(browser, 'title', titleCard([
    ['SETUP-01', 'Repository, CI and Docker Compose stack'], ['SETUP-02', 'PostgreSQL schema and seed data'], ['SETUP-03', 'React web app + Express API skeleton'],
    ['FR-01', 'Login and role-based access'], ['FR-02', 'Password reset by email'], ['FR-03', 'User management and CSV import'],
    ['FR-04', 'Courses, sections and enrolments'], ['FR-05', 'Session scheduling and timetable'], ['FR-06', 'Manual attendance marking'],
    ['FR-09', 'Student attendance dashboard'],
  ], 'Sprint 1 · 19–23 Oct 2026'), 5), trim: 0.5 });

  const csvPath = join(outDir, 'demo-users.csv');
  writeFileSync(csvPath, 'name,email,role,srn,department\nAnanya Rao,ananya.rao@pes.edu,STUDENT,PES1UG24CS301,CSE\nRohit Menon,rohit.menon@pes.edu,STUDENT,PES1UG24CS302,CSE\n');

  const s = await newCtx(browser, 'walk');
  const p = s.page;
  await p.goto(BASE + '/login');
  await p.getByLabel('Email', { exact: true }).waitFor();
  await cap(p, 'SETUP-01/02/03 · SAMS runs as a Docker Compose stack (web, API, PostgreSQL, Redis) — this is the live login screen');
  await sleep(2200);
  await cap(p, 'FR-01 · Role-based login: the Administrator signs in with an institutional email');
  await login(p, 'admin@pes.edu');

  await cap(p, 'FR-03 · User management: create, edit, deactivate and search accounts');
  await navTo(p, 'Users');
  await sleep(1800);
  await cap(p, 'FR-03 · Bulk CSV import: 2 new student accounts created from one file');
  await p.locator('input[type=file]').setInputFiles(csvPath);
  await sleep(500);
  await click(p, p.getByRole('button', { name: 'Import CSV' }));
  await p.getByRole('status').filter({ hasText: 'Imported' }).waitFor();
  await sleep(2300);

  await cap(p, 'FR-04 · Courses, sections and enrolments: assign faculty and enrol students');
  await navTo(p, 'Courses & Enrolments');
  await sleep(1000);
  await p.locator('select').last().selectOption({ index: 1 }).catch(() => {});
  await sleep(900);
  await scrollBy(p, 520);
  await sleep(2200);
  await scrollTop(p);
  await logout(p);

  await cap(p, 'FR-01 · The Faculty member signs in — the menu changes with the role');
  await login(p, 'faculty@pes.edu');
  await cap(p, 'FR-05 · Sessions & Timetable: weekly template for the section (MON/WED/FRI, IST)');
  await navTo(p, 'Sessions & Timetable');
  await sleep(2400);
  await cap(p, 'FR-05 · Schedule an extra class for today');
  await click(p, p.getByRole('button', { name: '+ Add Extra Session' }));
  const now = nowIstHM();
  const start = now < '00:10' ? '00:00' : (() => { const d = new Date(Date.now() - 10 * 60000); return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(d); })();
  const endH = Math.min(23, Number(start.slice(0, 2)) + 1);
  const end = endH === Number(start.slice(0, 2)) ? '23:59' : `${String(endH).padStart(2, '0')}:${start.slice(3)}`;
  await fillDate(p, p.locator('#SessionScheduler-field-1'), todayIst());
  await p.locator('#SessionScheduler-field-2').fill(start);
  await p.locator('#SessionScheduler-field-3').fill(end);
  await sleep(900);
  await click(p, p.getByRole('button', { name: 'Add Session' }));
  await p.getByRole('status').filter({ hasText: 'Extra session added' }).waitFor();
  await scrollTop(p);
  await sleep(2200);

  await cap(p, 'FR-06 · Mark Attendance now opens today\'s class by default; every student starts as PRESENT');
  await navTo(p, 'Mark Attendance');
  await p.getByText('Merull Shah').waitFor();
  await sleep(2600);
  await cap(p, 'FR-06 · Faculty adjusts exceptions: Merull Shah arrived late → LATE');
  await click(p, p.getByRole('group', { name: 'Attendance for Merull Shah' }).getByRole('button', { name: 'Late' }));
  await sleep(1200);
  await cap(p, 'FR-06 · Roster submitted in one action');
  await click(p, p.getByRole('button', { name: 'Save & Submit Attendance' }));
  await p.getByRole('status').filter({ hasText: 'successfully submitted' }).waitFor();
  await scrollTop(p);
  await sleep(2800);
  await logout(p);

  await cap(p, 'FR-01 · The Student (N Bhuvan Teja) signs in and lands on the dashboard');
  await login(p, 'bhuvan@pes.edu');
  await p.getByText('Session History').waitFor();
  await cap(p, 'FR-09 · Student dashboard: overall % per course and how many classes can still be missed');
  await sleep(3000);
  await cap(p, 'FR-09 · Session history: past classes are HELD, with the real IST time each mark was recorded');
  await scrollBy(p, 400);
  await sleep(3200);
  await logout(p);

  await cap(p, 'FR-02 · Forgot password: reset link by email, valid for 15 minutes');
  await click(p, p.getByRole('link', { name: 'Forgot password?' }));
  await type(p, p.getByLabel('Email', { exact: true }), 'bhuvan@pes.edu', 30);
  await click(p, p.getByRole('button', { name: 'Send reset link' }));
  await p.getByText('a reset link is on its way').waitFor().catch(() => {});
  await sleep(2200);
  segs.push({ file: await closeCtx(s), speed: 1.4 });

  segs.push({ card: true, file: await card(browser, 'end', endCard('Sprint 1 — bugs fixed', [
    'Mark Attendance opened the <b>oldest</b> session of the semester → now opens <b>today\'s</b> (or the latest) class',
    'Student history showed past classes as “SCHEDULED” → now <b>HELD</b>',
    'Seeded marks showed 05:30 (midnight UTC) as the marked time → now the <b>real IST time</b>',
  ], ['CI: lint + tests green on every PR (GitHub Actions)', 'MiniProject Team E1 · PES University']), 9), trim: 0.5 });
  return segs;
}

// ======================= Sprint 2 =======================
async function sprint2(browser) {
  const segs = [];
  segs.push({ card: true, file: await card(browser, 'title', titleCard([
    ['FR-07', '#12 QR-code self check-in with rotating tokens'], ['FR-13', '#17 Audit log viewer (read-only)'],
    ['NFR-03', '#20 Deployment, health checks and backup/restore'],
  ], 'Sprint 2 · 26–30 Oct 2026'), 5), trim: 0.5 });

  // ---- setup (not recorded): sessions for "today", states, API handles ----
  const admin = await apiAs('admin@pes.edu');
  const fac = await apiAs('faculty@pes.edu');
  const sections = (await admin.get('/sections?size=100')).data;
  const section = sections[0];
  const now = nowIstHM();
  const startH = now < '00:10' ? '00:00' : new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(Date.now() - 10 * 60000));
  await fac.post('/sessions/extra', { sectionId: section.id, date: todayIst(), startTime: startH, endTime: '23:59' });
  const todays = (await fac.get('/qr/today')).sessions;
  const qrSession = todays[0];
  console.log('QR session', qrSession.id, startH);


  // ---- FR-07 split screen: faculty (left) + student phone (right) recorded at the same time ----
  const fc = await newCtx(browser, 'qr-faculty', { w: 800, h: 900, email: 'faculty@pes.edu' });
  const st = await newCtx(browser, 'qr-student', { w: 640, h: 720, email: 'bhuvan@pes.edu' });
  const f = fc.page, s = st.page;
  await Promise.all([f.goto(BASE + '/qr'), s.goto(BASE + '/check-in')]);
  await Promise.all([settle(f, 300), settle(s, 300)]);
  await cap(f, 'FR-07 · Faculty: today\'s class is listed (IST-day fix)');
  await cap(s, 'FR-07 · Student phone: Check In page');
  await sleep(2600);
  await click(f, f.getByRole('button', { name: new RegExp(qrSession.course) }));
  await sleep(700);
  await cap(f, 'FR-07 · Faculty opens a check-in window (5 min)');
  await click(f, f.getByRole('button', { name: 'Start check-in' }));
  await f.getByRole('img', { name: /Check-in QR code/ }).waitFor();
  await cap(f, 'FR-07 · Rotating QR code on the classroom screen (changes every 25 s)');
  await sleep(2500);
  await cap(s, 'FR-07 · No camera? "Enter the code instead" with the current token');
  await click(s, s.getByRole('button', { name: /Enter the code instead/ }));
  const tok = (await fac.get(`/sessions/${qrSession.id}/qr/token`)).token;
  await type(s, s.getByLabel('Check-in code'), tok, 4);
  await sleep(400);
  await click(s, s.getByRole('button', { name: 'Check in', exact: true }));
  await s.getByText("You're checked in").waitFor();
  await cap(s, 'FR-07 · Student checked in → marked PRESENT');
  await cap(f, 'FR-07 · Faculty screen: live check-in count updates');
  await f.evaluate(() => window.scrollTo({ top: 0 }));
  await f.getByText('1', { exact: true }).first().waitFor({ timeout: 9000 }).catch(() => {});
  await sleep(4200);
  // ---- replays: duplicate and garbled codes are rejected (SR-05) ----
  await cap(f, 'SR-05 · Tokens are HMAC-SHA256 signed, expire after 30 s, one check-in per student per session');
  await s.goto(BASE + '/check-in'); await settle(s, 300);
  await cap(s, 'SR-05 · The same student submits a code again …');
  await click(s, s.getByRole('button', { name: /Enter the code instead/ }));
  const tok2 = (await fac.get(`/sessions/${qrSession.id}/qr/token`)).token;
  await type(s, s.getByLabel('Check-in code'), tok2, 3);
  await click(s, s.getByRole('button', { name: 'Check in', exact: true }));
  await s.getByRole('alert').waitFor();
  await cap(s, 'SR-05 · … rejected: DUPLICATE_CHECKIN (one check-in per session)');
  await sleep(3200);
  const tok3 = (await fac.get(`/sessions/${qrSession.id}/qr/token`)).token;
  const bad = tok3.slice(0, -8) + (tok3.endsWith('AAAAAAAA') ? 'BBBBBBBB' : 'AAAAAAAA');
  await s.getByLabel('Check-in code').fill('');
  await cap(s, 'SR-05 · A tampered code fails the HMAC check …');
  await type(s, s.getByLabel('Check-in code'), bad, 3);
  await sleep(1500);
  await click(s, s.getByRole('button', { name: 'Check in', exact: true }));
  await s.getByText("isn't a valid SAMS check-in code").waitFor();
  await cap(s, 'SR-05 · … rejected: INVALID_TOKEN');
  await sleep(3200);
  const qrPair = [await closeCtx(fc), await closeCtx(st)];
  segs.push({ file: qrPair, speed: 1.2 });

  // ---- FR-13 audit log ----
  let c = await newCtx(browser, 'audit', { email: 'admin@pes.edu' });
  const ap = c.page;
  await ap.goto(BASE + '/audit'); await settle(ap);
  await cap(ap, 'FR-13 · Admin Audit Log: every login, attendance change and QR check-in, with actor, IP and time');
  await sleep(2200);
  const firstIs = (a) => ap.locator('tbody tr').first().getByText(a, { exact: true }).waitFor();
  await click(ap, ap.locator('#f-action'));
  await ap.locator('#f-action').selectOption('QR_CHECKIN');
  await click(ap, ap.getByRole('button', { name: 'Search', exact: true }));
  await firstIs('QR_CHECKIN'); await settle(ap, 300);
  await cap(ap, "FR-13 · Filter by action QR_CHECKIN — the student's check-in from this demo");
  await sleep(2600);
  await fillDate(ap, ap.locator('#f-from'), todayIst());
  await ap.locator('#f-to').fill(todayIst());
  await sleep(600);
  await click(ap, ap.getByRole('button', { name: 'Search', exact: true }));
  await firstIs('QR_CHECKIN'); await settle(ap, 300);
  await cap(ap, 'FR-13 · From = To = today (IST): after-midnight entries appear — date filters cover the whole IST day (fixed this sprint)');
  await sleep(3200);
  await click(ap, ap.getByRole('button', { name: 'Show' }).first());
  await cap(ap, 'FR-13 · Details: before / after values of the entry. Read-only — PATCH/DELETE return 405 and the DB role cannot UPDATE');
  await sleep(3800);
  if ((await ap.locator('#f-action option').allTextContents()).includes('QR_CHECKIN_REJECTED')) {
    await ap.locator('#f-action').selectOption('QR_CHECKIN_REJECTED');
    await click(ap, ap.getByRole('button', { name: 'Search', exact: true }));
    await firstIs('QR_CHECKIN_REJECTED'); await settle(ap, 300);
    await cap(ap, 'FR-13 · Rejected replays (duplicate / invalid token) are audited too');
    await sleep(3000);
  }
  segs.push({ file: await closeCtx(c), speed: 1.15 });

  // ---- NFR-03 health + backup/restore drill ----
  c = await newCtx(browser, 'health');
  await c.page.goto(BASE + '/api/v1/health'); await settle(c.page, 300);
  await c.page.evaluate(() => { document.querySelectorAll('body > *:not(#__cap):not(#__cur):not(#__capcss)').forEach((e) => { e.style.zoom = 2.6; }); });
  await cap(c.page, 'NFR-03 · /api/v1/health through the web proxy: database ok, redis ok (also used by Docker health checks)');
  await sleep(4500);
  segs.push({ file: await closeCtx(c) });

  const term = `<style>body{background:#0b1020;color:#d1fae5;font:20px/1.7 Consolas,'Courier New',monospace;padding:70px 80px;margin:0;height:100vh;box-sizing:border-box}
.l{opacity:0;animation:i .01s forwards;white-space:pre}.c{color:#e5e7eb}.m{color:#94a3b8}.ok{color:#34d399}
@keyframes i{to{opacity:1}}#cap{position:fixed;left:0;right:0;bottom:0;padding:16px 28px;font:600 23px system-ui,sans-serif;color:#fff;background:rgba(15,23,42,.9);text-align:center;border-top:3px solid #6366f1}</style>
<div class="l c" style="animation-delay:.3s">$ ./ops/backup.sh</div>
<div class="l" style="animation-delay:1.3s">backup written: backups/sams_20261112_014938.sql.gz (12K)</div>
<div class="l c" style="animation-delay:2.8s">$ psql: update users set name='DRILL SENTINEL' …   <span class="m"># simulate damage</span></div>
<div class="l c" style="animation-delay:4.5s">$ ./ops/restore.sh backups/sams_20261112_014938.sql.gz</div>
<div class="l" style="animation-delay:5.5s">Type RESTORE to continue: RESTORE</div>
<div class="l" style="animation-delay:6.8s">Restored … Waiting for the API health check...</div>
<div class="l ok" style="animation-delay:8.3s">API and web proxy healthy; retention worker restarted.   (18 s)</div>
<div class="l ok" style="animation-delay:9.8s">counts users/records/audit = 4/5/7 · sentinel reverted ✔</div>
<div id="cap">NFR-03/04 · nightly backup + tested restore; containers restart: unless-stopped; Docker health checks</div>`;
  c = await newCtx(browser, 'terminal');
  await c.page.setContent(term);
  await sleep(14000);
  segs.push({ file: await closeCtx(c), trim: 0.5 });

  segs.push({ card: true, file: await card(browser, 'end', endCard('Sprint 2 — bugs fixed (Merull)', [
    "QR check-in used the server's UTC date. From 00:00–05:30 IST it listed yesterday's classes and refused today's → now uses the <b>IST day</b> (regression test)",
    'Audit-log date filters used UTC days and missed after-midnight IST entries → bare dates now cover the <b>whole IST day</b> (regression test)',
    'restore.sh probed host port 3000, so with a remapped port it left the retention worker stopped → now probes <b>inside the API container</b>',
    'The NFR-01 load test created sessions on the UTC day and failed CI between 00:00 and 05:30 IST → now uses the <b>IST day</b>',
  ], ['CI: lint + tests + load + browser + deployment checks green on every PR (GitHub Actions)']), 16), trim: 0.5 });
  admin.dispose(); fac.dispose();
  return segs;
}

// ======================= main =======================
resetBaseline();
const browser = await chromium.launch({ slowMo: 40 });
let segs;
try {
  segs = sprint === '1' ? await sprint1(browser) : await sprint2(browser);
} finally {
  await browser.close();
}
writeFileSync(join(rawDir, 'segments.json'), JSON.stringify(segs, null, 1));
if (!flags.includes('--no-build')) {
  const speed = Number(process.env.SAMS_DEMO_SPEED || (sprint === '2' ? 1.15 : 1));
  ffmpegBuild(segs.map((x) => ({ ...x, speed: x.speed || (x.card ? 1 : speed) })), finalMp4);
}
