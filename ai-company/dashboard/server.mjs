// AI회사 상황실 — 로컬 대시보드 서버 (의존성 없음, Node 18+)
// 실행: node dashboard/server.mjs        (실제 상황실 폴더)
//       node dashboard/server.mjs --demo (샘플 데이터, 원본은 건드리지 않음)
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COMPANY = path.resolve(HERE, '..'); // ai-company 폴더 (직원 정의·설정 위치)
const DEMO = process.argv.includes('--demo');
const PORT = Number(process.env.PORT || 4747);

let DATA = COMPANY; // 상황실/프로젝트 폴더가 있는 곳
if (DEMO) {
  DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-company-demo-'));
  fs.cpSync(path.join(HERE, 'demo'), DATA, { recursive: true });
}
const ROOM = path.join(DATA, '상황실');
const DIR = {
  pending: path.join(ROOM, '결재함'),
  archive: path.join(ROOM, '완료보관함'),
  brief: path.join(ROOM, '브리핑'),
};

// ───────── 날짜 ─────────
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// 데모는 샘플 데이터 날짜(2026-11-19)에 맞춰 보여 준다
const FIXED_TODAY = process.env.TODAY || (DEMO ? '2026-11-19' : '');
const today = () => (FIXED_TODAY ? new Date(FIXED_TODAY + 'T00:00:00') : new Date());
function dateFromName(name) {
  const m = name.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// ───────── 파일 유틸 ─────────
async function readText(p) {
  try { return await fsp.readFile(p, 'utf8'); } catch { return ''; }
}
async function listMd(dir) {
  try {
    return (await fsp.readdir(dir)).filter((f) => f.endsWith('.md')).sort();
  } catch { return []; }
}

// ───────── 결재 문서 ─────────
// "- 키: 값" 줄을 필드로 읽는다. 값이 비어 있으면 다음 들여쓴/목록 줄을 이어 붙인다.
function parseApproval(text, file, folder) {
  const lines = text.split(/\r?\n/);
  const title = (lines.find((l) => l.startsWith('# ')) || `# ${file}`).slice(2).trim();
  const stageM = title.match(/\[결재\s*([①②12])/);
  const stage = stageM ? (/[②2]/.test(stageM[1]) ? 2 : 1) : 0;
  const fields = {};
  let cur = null;
  for (const raw of lines) {
    const m = raw.match(/^\s*-\s*([^:：]{1,20})[:：]\s*(.*)$/);
    if (m && !raw.startsWith('  ')) {
      cur = m[1].trim();
      fields[cur] = m[2].trim();
    } else if (cur && /^\s+\S/.test(raw)) {
      fields[cur] = (fields[cur] ? fields[cur] + '\n' : '') + raw.trim().replace(/^-\s*/, '');
    } else if (raw.trim() === '' || raw.startsWith('#')) {
      cur = null;
    }
  }
  const project = (fields['프로젝트 폴더'] || '').replace(/[`/]+$/g, '').replace(/^`/, '');
  const projectName = project.split('/').filter(Boolean).pop() || '(프로젝트 미지정)';
  const team = (fields['팀/담당'] || '').split(/[/·,]/)[0].trim();
  const files = (fields['파일'] || '').split(/\n|,\s*/).map((s) => s.replace(/`/g, '').trim()).filter(Boolean);
  return {
    file, folder, title: title.replace(/^\[[^\]]*\]\s*/, ''), stage,
    team, owner: fields['팀/담당'] || '', project, projectName,
    summary: fields['요약 (3줄 이내)'] || fields['요약'] || '',
    ask: fields['대표님이 정할 것'] || '',
    files,
    result: (fields['결과'] || '대기').split(/\s/)[0],
    decidedAt: fields['결정일'] || '',
    memo: fields['대표님 메모'] || '',
    handled: fields['본부장 처리'] || '',
    date: fields['결정일'] || dateFromName(file) || '',
    submitted: dateFromName(file) || '',
  };
}
async function loadApprovals(folder) {
  const dir = DIR[folder];
  const out = [];
  for (const f of await listMd(dir)) out.push(parseApproval(await readText(path.join(dir, f)), f, folder));
  return out;
}

// ───────── 브리핑 ─────────
// 브리핑/YYYY-MM-DD.md 안의 "## 제목" 하나가 브리핑 글 하나.
async function loadBriefings() {
  const days = [];
  for (const f of (await listMd(DIR.brief)).reverse()) {
    const date = f.replace(/\.md$/, '');
    const text = await readText(path.join(DIR.brief, f));
    const entries = [];
    let curE = null;
    for (const line of text.split(/\r?\n/)) {
      if (line.startsWith('## ')) {
        curE = { title: line.slice(3).trim(), body: [] };
        entries.push(curE);
      } else if (curE) curE.body.push(line);
    }
    if (!entries.length && text.trim()) entries.push({ title: date, body: text.split(/\r?\n/) });
    days.push({ date, entries: entries.reverse().map((e) => ({ title: e.title, md: e.body.join('\n').trim() })) });
  }
  return days;
}

// ───────── 요청 (본부장 → 대표님) ─────────
// 상황실/요청.md: "- [ ] 내용 (11/20까지)" 형식
async function loadRequests() {
  const text = await readText(path.join(ROOM, '요청.md'));
  const out = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const m = line.match(/^\s*-\s*\[( |x|X)\]\s*(.+)$/);
    if (!m) return;
    const due = m[2].match(/\(([^)]*까지)\)\s*$/);
    out.push({ line: i, done: m[1] !== ' ', text: m[2].replace(/\([^)]*까지\)\s*$/, '').trim(), due: due ? due[1] : '' });
  });
  return out;
}

// ───────── 캘린더 ─────────
function parseCalendar(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 2 || /^-+$/.test(cells[0].replace(/[:\s]/g, '')) || cells[0] === '날짜') continue;
    rows.push({ when: cells[0], title: cells[1], owner: cells[2] || '', status: cells[3] || '' });
  }
  return rows;
}
// 이벤트가 [from, to] 사이에 해당하는 날짜들
function occurrences(when, from, to) {
  const out = [];
  const push = (d) => { if (d >= from && d <= to) out.push(ymd(d)); };
  const exact = [...when.matchAll(/(\d{4})-(\d{1,2})-(\d{1,2})/g)];
  if (exact.length) { exact.forEach((m) => push(new Date(+m[1], +m[2] - 1, +m[3]))); return out; }
  const monthly = when.match(/매월\s*(\d{1,2})\s*일/);
  for (let y = from.getFullYear(); y <= to.getFullYear(); y++) {
    for (let mo = 0; mo < 12; mo++) {
      if (monthly) push(new Date(y, mo, +monthly[1]));
    }
    if (!monthly) for (const m of when.matchAll(/(\d{1,2})\/(\d{1,2})/g)) push(new Date(y, +m[1] - 1, +m[2]));
  }
  return out.sort();
}

// ───────── 직원 ─────────
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: m[2] };
}
async function loadAgents() {
  const dir = path.join(COMPANY, '.claude', 'agents');
  const agents = [];
  for (const f of await listMd(dir)) {
    const { meta, body } = parseFrontmatter(await readText(path.join(dir, f)));
    const h = body.match(/^#\s+(.+?)\s*\(([^)]+)\)\s*$/m);
    const team = h ? h[2] : '기타';
    const desc = meta.description || '';
    agents.push({
      id: meta.name || f.replace(/\.md$/, ''),
      name: h ? h[1] : meta.name,
      team,
      model: meta.model || 'inherit',
      effort: meta.effort || '',
      tools: (meta.tools || '').split(',').map((s) => s.trim()).filter(Boolean),
      description: desc,
      role: team === '공용지원' ? '공용지원' : /책임자/.test(desc) ? '책임자' : '팀원',
    });
  }
  // 팀 순서: CLAUDE.md 조직도 표에 나온 순서
  const claudeMd = await readText(path.join(COMPANY, 'CLAUDE.md'));
  const order = [];
  for (const m of claudeMd.matchAll(/^\|\s*([^|\s][^|]*?)\s*\|\s*[^|]*`([\w-]+)`/gm)) if (!order.includes(m[1])) order.push(m[1]);
  const teams = [...new Set(agents.map((a) => a.team))].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const settings = JSON.parse((await readText(path.join(COMPANY, '.claude', 'settings.json'))) || '{}');
  return { agents, teams, chief: { model: settings.model || 'default', effort: settings.effortLevel || '' } };
}

// ───────── 사용량 (Claude Code 대화 기록) ─────────
function projectsDir() {
  const base = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  return path.join(base, 'projects');
}
function findProjectLogDir() {
  const root = projectsDir();
  const enc = COMPANY.replace(/[^a-zA-Z0-9]/g, '-');
  if (fs.existsSync(path.join(root, enc))) return path.join(root, enc);
  try {
    const tail = path.basename(COMPANY).replace(/[^a-zA-Z0-9]/g, '-');
    const hit = fs.readdirSync(root).find((d) => d.toLowerCase().endsWith(tail.toLowerCase()));
    return hit ? path.join(root, hit) : null;
  } catch { return null; }
}
const usageCache = new Map(); // file -> { mtime, msgs }
function readUsageFile(file) {
  let st;
  try { st = fs.statSync(file); } catch { return { msgs: [], mtime: 0 }; }
  const c = usageCache.get(file);
  if (c && c.mtime === st.mtimeMs) return c;
  const seen = new Set();
  const msgs = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.includes('"usage"')) continue;
    let d;
    try { d = JSON.parse(line); } catch { continue; }
    const m = d.message;
    if (d.type !== 'assistant' || !m || !m.usage || seen.has(m.id)) continue;
    seen.add(m.id);
    const u = m.usage;
    msgs.push({
      t: d.timestamp, model: m.model || '',
      input: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0),
      cacheRead: u.cache_read_input_tokens || 0,
      output: u.output_tokens || 0,
    });
  }
  const r = { mtime: st.mtimeMs, msgs };
  usageCache.set(file, r);
  return r;
}
function loadUsage() {
  if (DEMO) {
    const p = path.join(DATA, 'usage.json');
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  const dir = findProjectLogDir();
  const runs = []; // { who, model, start, end, msgs, finished }
  if (!dir) return { runs, logDir: null };
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isFile() && ent.name.endsWith('.jsonl')) {
      const r = readUsageFile(path.join(dir, ent.name));
      if (r.msgs.length) runs.push({ who: 'main-session', msgs: r.msgs, finished: true, mtime: r.mtime });
    } else if (ent.isDirectory()) {
      const sub = path.join(dir, ent.name, 'subagents');
      if (!fs.existsSync(sub)) continue;
      for (const f of fs.readdirSync(sub)) {
        if (!f.endsWith('.jsonl')) continue;
        const metaP = path.join(sub, f.replace(/\.jsonl$/, '.meta.json'));
        let meta = {};
        try { meta = JSON.parse(fs.readFileSync(metaP, 'utf8')); } catch {}
        const r = readUsageFile(path.join(sub, f));
        runs.push({ who: meta.agentType || 'unknown', task: meta.description || '', msgs: r.msgs, finished: meta.finished !== false, mtime: r.mtime });
      }
    }
  }
  return { runs, logDir: dir };
}
function summarizeUsage(raw) {
  const now = today();
  const dow = (now.getDay() + 6) % 7; // 월요일 시작
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periods = { week: weekStart.toISOString(), month: monthStart.toISOString(), all: '0' };
  const out = {};
  for (const [key, since] of Object.entries(periods)) {
    const byWho = {}, byModel = {};
    for (const run of raw.runs) {
      const msgs = run.msgs.filter((m) => m.t >= since);
      if (!msgs.length) continue;
      const w = (byWho[run.who] ||= { runs: 0, msgs: 0, input: 0, cacheRead: 0, output: 0, last: '', models: {} });
      w.runs += 1;
      for (const m of msgs) {
        w.msgs += 1; w.input += m.input; w.cacheRead += m.cacheRead; w.output += m.output;
        if (m.t > w.last) w.last = m.t;
        const fam = /opus/.test(m.model) ? 'opus' : /sonnet/.test(m.model) ? 'sonnet' : /haiku/.test(m.model) ? 'haiku' : (m.model || '기타');
        w.models[fam] = (w.models[fam] || 0) + m.output;
        const b = (byModel[fam] ||= { msgs: 0, input: 0, cacheRead: 0, output: 0 });
        b.msgs += 1; b.input += m.input; b.cacheRead += m.cacheRead; b.output += m.output;
      }
    }
    out[key] = { byWho, byModel };
  }
  const recent = Date.now() - 10 * 60 * 1000;
  const working = raw.runs.filter((r) => r.who !== 'main-session' && !r.finished && r.mtime > recent).map((r) => ({ who: r.who, task: r.task }));
  return { periods: out, working, logDir: raw.logDir || null };
}

// ───────── 상태 전체 ─────────
async function state() {
  const [pending, archive, briefings, requests, calText, hrText, org] = await Promise.all([
    loadApprovals('pending'), loadApprovals('archive'), loadBriefings(), loadRequests(),
    readText(path.join(ROOM, '캘린더.md')), readText(path.join(ROOM, '인사·사용량.md')), loadAgents(),
  ]);
  const now = today();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear() + 1, now.getMonth(), 0);
  const calendar = parseCalendar(calText).map((e) => ({ ...e, dates: occurrences(e.when, from, to) }));
  return {
    today: ymd(now), demo: DEMO, company: COMPANY,
    pending, archive, briefings, requests, calendar, hrMd: hrText,
    ...org, usage: summarizeUsage(loadUsage()),
  };
}

// ───────── 결재 처리 ─────────
async function decide({ file, result, memo }) {
  if (!['승인', '수정지시', '반려'].includes(result)) throw new Error('결과는 승인/수정지시/반려 중 하나');
  if (!file || path.basename(file) !== file || !file.endsWith('.md')) throw new Error('잘못된 파일');
  if (result !== '승인' && !String(memo || '').trim()) throw new Error('수정지시·반려는 메모가 필요합니다');
  const src = path.join(DIR.pending, file);
  let text = await fsp.readFile(src, 'utf8');
  const stamp = ymd(today());
  const extra = [`- 결정일: ${stamp}`];
  if (memo && memo.trim()) extra.push(`- 대표님 메모: ${memo.trim().replace(/\r?\n/g, ' ')}`);
  extra.push(`- 본부장 처리: ${result === '승인' && /\[결재\s*[②2]/.test(text) ? '완료' : '미반영'}`);
  if (/^-\s*결과\s*[:：].*$/m.test(text)) {
    text = text.replace(/^-\s*결과\s*[:：].*$/m, `- 결과: ${result}\n${extra.join('\n')}`);
  } else {
    text = text.trimEnd() + `\n- 결과: ${result}\n${extra.join('\n')}\n`;
  }
  await fsp.mkdir(DIR.archive, { recursive: true });
  let dest = path.join(DIR.archive, file);
  for (let i = 2; fs.existsSync(dest); i++) dest = path.join(DIR.archive, file.replace(/\.md$/, `_${i}.md`));
  await fsp.writeFile(dest, text, 'utf8');
  await fsp.unlink(src);
  return { ok: true, moved: path.basename(dest) };
}
async function toggleRequest({ line }) {
  const p = path.join(ROOM, '요청.md');
  const lines = (await fsp.readFile(p, 'utf8')).split('\n');
  const l = lines[line];
  if (l === undefined || !/^\s*-\s*\[( |x|X)\]/.test(l)) throw new Error('요청을 찾을 수 없습니다');
  lines[line] = /\[ \]/.test(l) ? l.replace('[ ]', '[x]') : l.replace(/\[[xX]\]/, '[ ]');
  await fsp.writeFile(p, lines.join('\n'), 'utf8');
  return { ok: true };
}
// 결재 문서에 적힌 결과 파일 미리보기 (회사 폴더 안의 텍스트 파일만)
async function readProjectFile(rel) {
  const abs = path.resolve(DATA, rel);
  if (!abs.startsWith(DATA + path.sep)) throw new Error('회사 폴더 밖의 파일');
  if (!/\.(md|txt|csv|json)$/i.test(abs)) return { path: rel, text: null };
  const st = await fsp.stat(abs);
  if (st.size > 512 * 1024) return { path: rel, text: null, tooLarge: true };
  return { path: rel, text: await fsp.readFile(abs, 'utf8'), ext: path.extname(abs).slice(1).toLowerCase() };
}

// ───────── HTTP ─────────
const STATIC = { '/': 'index.html', '/app.js': 'app.js', '/style.css': 'style.css' };
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8' };
function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
async function body(req) {
  let s = '';
  for await (const c of req) { s += c; if (s.length > 1e5) throw new Error('too large'); }
  return JSON.parse(s || '{}');
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  // localhost로 온 요청만 받는다 (다른 도메인 이름으로 우회하는 접근 차단)
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '')) return send(res, 403, { error: 'forbidden' });
  try {
    if (req.method === 'GET' && STATIC[url.pathname]) {
      const f = STATIC[url.pathname];
      return send(res, 200, await fsp.readFile(path.join(HERE, f), 'utf8'), TYPES[f.split('.').pop()]);
    }
    if (req.method === 'GET' && url.pathname === '/api/state') return send(res, 200, await state());
    if (req.method === 'GET' && url.pathname === '/api/file') return send(res, 200, await readProjectFile(url.searchParams.get('path') || ''));
    if (req.method === 'POST') {
      // 다른 사이트가 이 로컬 서버로 요청을 보내지 못하게 막는다
      const origin = req.headers.origin;
      if (origin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return send(res, 403, { error: 'forbidden' });
      if (url.pathname === '/api/decide') return send(res, 200, await decide(await body(req)));
      if (url.pathname === '/api/request') return send(res, 200, await toggleRequest(await body(req)));
    }
    send(res, 404, { error: 'not found' });
  } catch (e) {
    send(res, 400, { error: e.message });
  }
});
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`포트 ${PORT}을(를) 이미 쓰고 있습니다. 상황실이 이미 켜져 있다면 http://localhost:${PORT} 을 여세요.`);
    if (process.argv.includes('--open')) openBrowser(`http://localhost:${PORT}`);
    return;
  }
  throw e;
});
// 기본 브라우저로 주소를 연다. 실패해도 서버는 계속 돌고, 주소를 직접 열라고 안내한다.
function openBrowser(url) {
  const [bin, args] = process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  import('node:child_process').then(({ spawn }) => {
    try {
      const p = spawn(bin, args, { stdio: 'ignore', detached: true });
      p.on('error', () => console.log(`브라우저를 자동으로 못 열었습니다. 주소창에 ${url} 을 직접 입력하세요.`));
      p.unref();
    } catch {
      console.log(`브라우저를 자동으로 못 열었습니다. 주소창에 ${url} 을 직접 입력하세요.`);
    }
  });
}
server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`AI회사 상황실: ${url}${DEMO ? '  (데모 데이터)' : ''}`);
  console.log(`데이터 폴더: ${DATA}`);
  console.log('끄려면 이 창에서 Ctrl+C');
  if (process.argv.includes('--open')) openBrowser(url);
});
