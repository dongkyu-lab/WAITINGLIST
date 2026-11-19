// AI회사 상황실 — 화면
const TEAM_META = {
  '세금계산서팀': { color: '#2f73da', flow: '결재② 발행표·검수본' },
  '체험단팀': { color: '#8a52d6', flow: '결재① 캠페인 개요 → 결재② 공고·가이드' },
  '보고서팀': { color: '#12936f', flow: '결재① 목차·핵심 메시지 → 결재② 보고서' },
  '견적서팀': { color: '#c98a0b', flow: '결재① 견적 구성 → 결재② 발송본' },
  'SNS컨텐츠팀': { color: '#d63f8c', flow: '결재① 아이디어·캘린더 → 결재② 캡션·문구' },
  '리뷰관리팀': { color: '#e0612f', flow: '결재② 답글·대응안 (부정 리뷰는 결재①부터)' },
  '인사팀': { color: '#0f8fa8', flow: '결재① 초안 → 결재② 최종 서류' },
  '세무팀': { color: '#5b6577', flow: '결재① 판단·검토 → 결재② 신고 준비 자료' },
  '공용지원': { color: '#7d838e', flow: '팀이 필요할 때만 부릅니다' },
};
const TABS = [
  ['brief', '브리핑'], ['pending', '결재함'], ['archive', '완료 보관함'], ['org', '조직도'],
  ['staff', '직원소개'], ['usage', '인사·사용량'], ['calendar', '캘린더'],
];
const RESULT_BADGE = { '승인': 'b-green', '수정지시': 'b-purple', '반려': 'b-red', '대기': 'b-amber' };
const MODEL_COLOR = { opus: '#6b3fd0', sonnet: '#3d6fd6', haiku: '#138a6c' };

let S = null;
const ui = {
  tab: (location.hash.slice(1) || 'brief'),
  briefKey: null, archiveMonth: true, archiveQuery: '', open: new Set(),
  staffTeam: '전체', usagePeriod: 'week', calMonth: null,
};

// ───────── 유틸 ─────────
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'K' : String(n));
const md = (d) => { const [, m, dd] = d.split('-'); return `${+m}/${+dd}`; };
const WD = ['일', '월', '화', '수', '목', '금', '토'];
function koDate(d) { const x = new Date(d + 'T00:00:00'); return `${x.getMonth() + 1}월 ${x.getDate()}일 (${WD[x.getDay()]})`; }
function daysBetween(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5); }
function teamColor(t) { return (TEAM_META[t] || {}).color || '#7d838e'; }
function initials(name) { return (name || '?').replace(/담당|책임|팀장/g, '').slice(0, 2) || name.slice(0, 2); }
function modelBadge(m) { const k = (m || '').toLowerCase(); return `<span class="model m-${esc(k)}">${esc(k)}</span>`; }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => (t.hidden = true), 2400); }
function agentById(id) { return S.agents.find((a) => a.id === id); }

// 간단한 마크다운 → HTML (제목, 목록, 체크, 표, 코드, 인용, 굵게, 링크)
function renderMd(src) {
  const lines = String(src || '').replace(/\r/g, '').split('\n');
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  let out = '', i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) {
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; out += `<pre><code>${esc(buf.join('\n'))}</code></pre>`; continue;
    }
    const h = l.match(/^(#{1,4})\s+(.*)$/);
    if (h) { const n = Math.min(h[1].length, 3); out += `<h${n}>${inline(h[2])}</h${n}>`; i++; continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { out += '<hr>'; i++; continue; }
    if (/^\s*\|/.test(l)) {
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const hasHead = rows[1] && /^[\s|:-]+$/.test(rows[1]);
      const head = hasHead ? `<thead><tr>${cells(rows[0]).map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>` : '';
      const body = (hasHead ? rows.slice(2) : rows).map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('');
      out += `<table>${head}<tbody>${body}</tbody></table>`; continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l);
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, ''));
      const li = items.map((t) => {
        const c = t.match(/^\[( |x|X)\]\s*(.*)$/);
        return c ? `<li style="list-style:none;margin-left:-1.2em">${c[1] === ' ' ? '☐' : '☑'} ${inline(c[2])}</li>` : `<li>${inline(t)}</li>`;
      }).join('');
      out += ordered ? `<ol>${li}</ol>` : `<ul>${li}</ul>`; continue;
    }
    if (/^>\s?/.test(l)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out += `<blockquote>${inline(buf.join(' '))}</blockquote>`; continue;
    }
    if (!l.trim()) { i++; continue; }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\s*\||\s*([-*]|\d+\.)\s+|>)/.test(lines[i])) buf.push(lines[i++]);
    out += `<p>${inline(buf.join(' '))}</p>`;
  }
  return out;
}

// ───────── 데이터 ─────────
async function load() {
  const r = await fetch('/api/state');
  S = await r.json();
  render();
}
async function post(url, data) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || '실패');
  return j;
}

// ───────── 헤더 ─────────
function renderHeader() {
  $('#today').textContent = `${koDate(S.today)} · 대표님 전용`;
  const wk = S.usage.periods.week;
  const out = Object.values(wk.byModel).reduce((a, b) => a + b.output, 0);
  const opusOut = (wk.byModel.opus || {}).output || 0;
  const opusShare = out ? Math.round((opusOut / out) * 100) : 0;
  $('#chips').innerHTML = `
    <span class="chip ${S.pending.length ? 'amber' : ''}">결재 대기<b>${S.pending.length}</b></span>
    <span class="chip">이번 주 출력<b>${fmt(out)}</b></span>
    <span class="chip">opus 비중<b>${opusShare}%</b></span>
    <span class="chip ${S.usage.working.length ? 'green' : ''}">작업 중<b>${S.usage.working.length}</b></span>`;
  $('#tabs').innerHTML = TABS.map(([k, label]) => `
    <button class="tab" role="tab" data-tab="${k}" aria-selected="${ui.tab === k}">${label}${k === 'pending' && S.pending.length ? `<span class="count">${S.pending.length}</span>` : ''}</button>`).join('');
}

// ───────── 브리핑 ─────────
function viewBrief() {
  const todos = [];
  for (const a of S.pending) todos.push(`<div class="todo-row click" data-go="pending"><span class="badge b-amber">결재${a.stage === 2 ? '②' : a.stage === 1 ? '①' : ''}</span><span class="t">${esc(a.title)}</span><span class="r">${esc(a.projectName.replace(/^\d{8}_/, '').replace(/_/g, ' '))}</span></div>`);
  S.requests.forEach((q) => todos.push(`<div class="todo-row ${q.done ? 'done' : ''}"><span class="badge b-blue">요청</span><span class="t">${esc(q.text)}</span>${q.due ? `<span class="r">${esc(q.due)}</span>` : ''}<button class="btn" data-req="${q.line}">${q.done ? '되돌리기' : '완료'}</button></div>`));
  const upcoming = [];
  for (const e of S.calendar) for (const d of e.dates) { const dd = daysBetween(S.today, d); if (dd >= 0 && dd <= 14) upcoming.push({ ...e, d, dd }); }
  upcoming.sort((a, b) => a.d.localeCompare(b.d)).forEach((e) => todos.push(`<div class="todo-row"><span class="badge b-green">일정</span><span class="t">${esc(e.title)}</span><span class="r">${md(e.d)} · ${e.dd === 0 ? '오늘' : 'D-' + e.dd}</span></div>`));
  const open = S.requests.filter((q) => !q.done).length + S.pending.length + upcoming.length;

  const entries = [];
  for (const day of S.briefings) day.entries.forEach((e, i) => entries.push({ key: `${day.date}#${i}`, date: day.date, ...e }));
  if (!ui.briefKey || !entries.find((e) => e.key === ui.briefKey)) ui.briefKey = entries[0] && entries[0].key;
  const cur = entries.find((e) => e.key === ui.briefKey);
  const list = S.briefings.map((day) => `
    <div class="day-head ${day.date === S.today ? 'today' : ''}">${day.date === S.today ? '오늘 · ' : ''}${koDate(day.date)}</div>
    ${day.entries.map((e, i) => `<button class="entry-btn" data-brief="${day.date}#${i}" aria-current="${ui.briefKey === `${day.date}#${i}`}">${esc(e.title)}</button>`).join('')}`).join('');
  return `
    <section class="card pad">
      <p class="section-label">대표님 할 일 ${open}건</p>
      <div class="todo">${todos.join('') || '<div class="empty">지금 대표님이 하실 일은 없습니다.</div>'}</div>
    </section>
    <div class="brief-grid">
      <aside class="card day-list"><p class="section-label" style="padding:0 10px">일별 브리핑</p>${list || '<div class="empty">브리핑이 아직 없습니다.</div>'}</aside>
      <article class="card post">${cur ? `
        <div class="author"><div class="av s" style="--tc:var(--brand)">본부</div><div><div class="who">본부장 → 대표님</div><div class="when">${esc(cur.date)}</div></div></div>
        <div class="md"><h1>${esc(cur.title)}</h1>${renderMd(cur.md)}</div>` : '<div class="empty">왼쪽에서 브리핑을 고르세요.</div>'}
      </article>
    </div>`;
}

// ───────── 결재함 ─────────
function fileLinks(files) {
  return files.map((f) => `<div><button class="file-link" data-file="${esc(f)}">${esc(f)}</button></div>`).join('');
}
function viewPending() {
  const cards = S.pending.map((a) => `
    <article class="card appr" style="border-left-color:${teamColor(a.team)}">
      <div class="appr-top">
        <span class="badge b-amber">결재${a.stage === 2 ? '② 완성본' : a.stage === 1 ? '① 기획안' : ''}</span>
        <span class="mono">${esc(a.owner)}</span>
        <span class="mono" style="margin-left:auto">${a.submitted ? md(a.submitted) + ' 상신' : ''}</span>
      </div>
      <h2>${esc(a.title)}</h2>
      <dl class="kv">
        <dt>프로젝트</dt><dd class="mono">${esc(a.project || '-')}</dd>
        ${a.summary ? `<dt>요약</dt><dd>${esc(a.summary)}</dd>` : ''}
        ${a.ask ? `<dt>정하실 것</dt><dd class="ask">${esc(a.ask)}</dd>` : ''}
        ${a.files.length ? `<dt>파일</dt><dd>${fileLinks(a.files)}</dd>` : ''}
      </dl>
      <form class="decide" data-decide="${esc(a.file)}">
        <textarea name="memo" rows="1" placeholder="메모 (수정지시·반려 때는 꼭 적어 주세요)"></textarea>
        <div class="btns">
          <button class="btn primary" value="승인">승인</button>
          <button class="btn warn" value="수정지시">수정지시</button>
          <button class="btn danger" value="반려">반려</button>
        </div>
      </form>
    </article>`).join('');
  return `
    <div class="page-title"><h1>결재함</h1><span class="sub">대기 ${S.pending.length}건 · 결정하면 완료 보관함으로 옮겨지고, 본부장이 다음 대화에서 반영합니다</span></div>
    <div class="appr-list">${cards || '<div class="card empty">결재할 문서가 없습니다.</div>'}</div>`;
}

// ───────── 완료 보관함 ─────────
function stageBar(items, stage) {
  const xs = items.filter((x) => x.stage === stage);
  if (!xs.length) return 'var(--line)';
  const last = xs.sort((a, b) => (a.date || '').localeCompare(b.date || '')).at(-1);
  return { '승인': 'var(--green)', '수정지시': 'var(--purple)', '반려': 'var(--red)', '대기': 'var(--amber)' }[last.result] || 'var(--line)';
}
function viewArchive() {
  const month = S.today.slice(0, 7);
  const all = [...S.pending, ...S.archive];
  const groups = new Map();
  for (const a of all) {
    const k = a.project || a.projectName;
    if (!groups.has(k)) groups.set(k, { key: k, name: a.projectName, team: a.team, items: [] });
    groups.get(k).items.push(a);
  }
  let rows = [...groups.values()].map((g) => {
    const dates = g.items.map((x) => x.date || x.submitted).filter(Boolean).sort();
    const waiting = g.items.filter((x) => x.result === '대기').length;
    const done = g.items.some((x) => x.stage === 2 && x.result === '승인');
    const latest = [...g.items].sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.file.localeCompare(b.file)).at(-1);
    const status = waiting ? ['b-amber', `결재대기 ${waiting}건`] : done ? ['b-green', '완료']
      : latest.result === '반려' ? ['b-red', '반려'] : latest.result === '수정지시' ? ['b-purple', '수정중'] : ['b-gray', '진행중'];
    return { ...g, first: dates[0] || '', last: dates.at(-1) || '', waiting, status };
  });
  if (ui.archiveMonth) rows = rows.filter((g) => g.last.startsWith(month) || g.waiting);
  const q = ui.archiveQuery.trim().toLowerCase();
  if (q) rows = rows.filter((g) => (g.name + ' ' + g.team + ' ' + g.items.map((x) => x.title + ' ' + x.files.join(' ')).join(' ')).toLowerCase().includes(q));
  rows.sort((a, b) => (b.waiting - a.waiting) || b.last.localeCompare(a.last));
  const totalProjects = groups.size;
  const html = rows.map((g) => {
    const open = ui.open.has(g.key);
    const items = [...g.items].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return `
    <div class="card proj" style="border-left-color:${teamColor(g.team)}" ${open ? 'open-row' : ''}>
      <button class="proj-row" data-proj="${esc(g.key)}" aria-expanded="${open}">
        <span class="proj-name"><span class="caret">▸</span>${esc(g.name.replace(/^\d{8}_/, '').replace(/_/g, ' '))}<span class="team">${esc(g.team)}</span></span>
        <span class="stages">
          <span><div class="bar" style="background:${stageBar(g.items, 1)}"></div>① 기획안</span>
          <span><div class="bar" style="background:${stageBar(g.items, 2)}"></div>② 완성본</span>
        </span>
        <span><span class="badge pill ${g.status[0]}">${g.status[1]}</span></span>
        <span class="num">${g.items.length}건</span>
        <span class="num">${g.first ? (g.first === g.last ? md(g.first) : `${md(g.first)}–${md(g.last)}`) : ''}</span>
      </button>
      ${open ? `<div class="proj-items">${items.map((x) => `
        <div class="item">
          <span class="d">${x.date ? md(x.date) : ''}</span>
          <div><div class="k">결재${x.stage === 2 ? '② 완성본' : x.stage === 1 ? '① 기획안' : ''} · ${esc(x.owner)}</div>
            <div class="tt">${esc(x.title)}</div>
            ${x.memo ? `<div class="memo">대표님 메모: ${esc(x.memo)}</div>` : ''}
            ${fileLinks(x.files)}</div>
          <span class="badge pill ${RESULT_BADGE[x.result] || 'b-gray'}">${esc(x.result)}</span>
        </div>`).join('')}</div>` : ''}
    </div>`;
  }).join('');
  return `
    <div class="page-title"><h1>완료 보관함</h1><span class="sub">${totalProjects}개 프로젝트 · 결재 ${all.length}건</span></div>
    <div class="toolbar">
      <button class="seg" data-amonth="1" aria-pressed="${ui.archiveMonth}">${+month.slice(5)}월</button>
      <button class="seg" data-amonth="0" aria-pressed="${!ui.archiveMonth}">전체 기간</button>
      <input class="search" id="aq" placeholder="프로젝트·제목·파일 검색" value="${esc(ui.archiveQuery)}">
    </div>
    <p class="hint">프로젝트별로 한 줄씩 보여 줍니다. 줄을 누르면 결재 기록과 파일 위치가 펼쳐집니다.</p>
    <div class="proj-head"><span>프로젝트</span><span>단계별 진행</span><span>결과</span><span style="text-align:right">결재</span><span style="text-align:right">기간</span></div>
    ${html || '<div class="card empty">해당하는 프로젝트가 없습니다.</div>'}`;
}

// ───────── 조직도 ─────────
function isWorking(id) { return S.usage.working.some((w) => w.who === id); }
function viewOrg() {
  const teams = S.teams.map((t) => {
    const ms = S.agents.filter((a) => a.team === t).sort((a, b) => (a.role === '책임자' ? -1 : 0) - (b.role === '책임자' ? -1 : 0));
    const meta = TEAM_META[t] || {};
    return `
      <section class="card team-card" style="--tc:${teamColor(t)}">
        <h3>${esc(t)}<span>${ms.length}명</span></h3>
        <div class="flow">${esc(meta.flow || '')}</div>
        ${ms.map((a) => `
          <div class="member">
            <div class="av s" style="--tc:${teamColor(t)}">${esc(initials(a.name))}</div>
            <span class="nm">${esc(a.name)}</span>
            ${a.role === '책임자' ? `<span class="badge pill" style="background:${teamColor(t)};color:#fff">책임</span>` : ''}
            ${modelBadge(a.model)}
            <span class="dot ${isWorking(a.id) ? 'on' : ''}" title="${isWorking(a.id) ? '작업 중' : '대기'}"></span>
          </div>`).join('')}
      </section>`;
  }).join('');
  return `
    <div class="page-title"><h1>조직도</h1><span class="sub">${S.teams.filter((t) => t !== '공용지원').length}개 팀 · 직원 ${S.agents.length}명</span></div>
    <div class="org">
      <div class="card org-node"><div class="av m" style="--tc:#2b3445">대표</div><div><div class="t">대표</div><div class="s">최종 결재권자 · 본부장하고만 대화</div></div></div>
      <div class="vline"></div>
      <div class="card org-node chief"><div class="av m" style="--tc:var(--brand)">본부</div><div><div class="t">본부장 ${modelBadge(S.chief.model)}</div><div class="s">업무 배정 · 검토 · 결재 상신 · 인사·사용량 관리${S.chief.effort ? ` · effort ${esc(S.chief.effort)}` : ''}</div></div></div>
      <div class="team-grid">${teams}</div>
    </div>`;
}

// ───────── 직원소개 ─────────
function viewStaff() {
  const chiefCard = `
    <article class="card staff chief">
      <div class="staff-top"><div class="av l" style="--tc:var(--brand)">본부</div>
        <div class="meta"><span class="badge b-green">본부장</span><div class="nm">본부장</div><div class="mono">main-session</div></div></div>
      <div class="desc">대표님 지시를 받아 팀에 배정하고, 결과를 검토해 결재를 올립니다. AI 직원 인사와 토큰 사용량을 관리합니다.</div>
      <div class="tags"><span class="tag">업무배정</span><span class="tag">검토</span><span class="tag">결재상신</span><span class="tag">인사·사용량</span></div>
      <div class="staff-foot">대표님 지시 대기 <span style="margin-left:auto">${modelBadge(S.chief.model)} ${S.chief.effort ? `<span class="tag">effort ${esc(S.chief.effort)}</span>` : ''}</span></div>
    </article>`;
  const rank = (a) => S.teams.indexOf(a.team) * 10 + (a.role === '책임자' ? 0 : 1);
  const list = S.agents.filter((a) => ui.staffTeam === '전체' || a.team === ui.staffTeam).sort((a, b) => rank(a) - rank(b));
  const all = S.usage.periods.all.byWho;
  const cards = list.map((a) => {
    const u = all[a.id];
    const roleBadge = a.role === '책임자' ? `<span class="badge pill" style="background:${teamColor(a.team)};color:#fff">책임자</span>` : a.role === '공용지원' ? '<span class="badge b-gray">공용지원</span>' : '<span class="badge b-blue">팀원</span>';
    return `
    <article class="card staff">
      <div class="staff-top"><div class="av l" style="--tc:${teamColor(a.team)}">${esc(initials(a.name))}</div>
        <div class="meta">${roleBadge} <span class="mono">${esc(a.team)}</span><div class="nm">${esc(a.name)}</div><div class="mono">${esc(a.id)}</div></div></div>
      <div class="desc">${esc(a.description)}</div>
      <div class="tags">${a.tools.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      <div class="staff-foot"><span class="dot ${isWorking(a.id) ? 'on' : ''}"></span>${isWorking(a.id) ? '작업 중' : '대기'}${u ? ` · 누적 ${u.runs}회` : ''}
        <span style="margin-left:auto">${modelBadge(a.model)} ${a.effort ? `<span class="tag">effort ${esc(a.effort)}</span>` : ''}</span></div>
    </article>`;
  }).join('');
  const filters = ['전체', ...S.teams].map((t) => `<button class="seg" data-steam="${esc(t)}" aria-pressed="${ui.staffTeam === t}">${esc(t)}</button>`).join('');
  return `
    <div class="page-title" style="align-items:center"><h1>직원소개</h1><span class="sub">${S.agents.length + 1}명</span><div class="filters">${filters}</div></div>
    <div class="staff-grid">${ui.staffTeam === '전체' ? chiefCard : ''}${cards}</div>`;
}

// ───────── 인사·사용량 ─────────
function viewUsage() {
  const P = S.usage.periods[ui.usagePeriod];
  const models = Object.entries(P.byModel).sort((a, b) => b[1].output - a[1].output);
  const tot = models.reduce((s, [, v]) => ({ msgs: s.msgs + v.msgs, input: s.input + v.input, cacheRead: s.cacheRead + v.cacheRead, output: s.output + v.output }), { msgs: 0, input: 0, cacheRead: 0, output: 0 });
  const totalIn = tot.input + tot.cacheRead;
  const cacheHit = totalIn ? Math.round((tot.cacheRead / totalIn) * 100) : 0;
  const share = (k) => (tot.output ? Math.round(((P.byModel[k] || {}).output || 0) / tot.output * 100) : 0);
  const people = Object.entries(P.byWho).map(([id, u]) => {
    const a = id === 'main-session' ? { name: '본부장', team: '본부', model: S.chief.model } : agentById(id) || { name: id, team: '-', model: '' };
    return { id, a, u };
  }).sort((x, y) => (y.u.output + y.u.input) - (x.u.output + x.u.input));

  // 모델 배치 조정 제안
  const tips = [];
  for (const { id, a, u } of people) {
    if (id === 'main-session') {
      if (tot.output && u.output / tot.output > 0.5 && people.length > 1) tips.push(['b-amber', '본부장', `출력의 ${Math.round(u.output / tot.output * 100)}%를 본부장이 쓰고 있습니다. 실무를 직원에게 더 넘기면 opus 사용이 줄어듭니다.`]);
      continue;
    }
    const perRun = u.runs ? u.output / u.runs : 0;
    if (a.model === 'opus' && u.runs >= 3 && perRun < 1500) tips.push(['b-purple', a.name, `opus인데 호출당 출력이 평균 ${fmt(Math.round(perRun))} 토큰으로 짧습니다. 단순 작업이 많으면 sonnet으로 내려도 됩니다.`]);
    if (a.model === 'sonnet' && u.runs >= 5 && perRun < 600 && !/책임|팀장/.test(a.name)) tips.push(['b-green', a.name, `sonnet인데 호출당 출력이 평균 ${fmt(Math.round(perRun))} 토큰입니다. 반복 작업이라면 haiku로 충분할 수 있습니다.`]);
  }
  if (totalIn > 200000 && cacheHit < 50) tips.push(['b-blue', '캐시', `캐시 재사용률이 ${cacheHit}%입니다. 같은 직원에게 일을 이어서 맡기면(SendMessage) 입력 토큰이 줄어듭니다.`]);
  const legend = models.map(([k]) => `<span><i style="background:${MODEL_COLOR[k] || '#999'}"></i>${esc(k)} ${share(k)}%</span>`).join('');
  const seg = (k, l) => `<button class="seg" data-uperiod="${k}" aria-pressed="${ui.usagePeriod === k}">${l}</button>`;
  return `
    <div class="page-title" style="align-items:center"><h1>인사·사용량</h1><span class="sub">Claude Code 대화 기록 기준${S.usage.logDir ? '' : ' · 아직 기록 없음'}</span>
      <div class="filters">${seg('week', '이번 주')}${seg('month', '이번 달')}${seg('all', '전체')}</div></div>
    <div class="tiles">
      <div class="card tile"><div class="l">출력 토큰</div><div class="v">${fmt(tot.output)}</div><div class="h">모델이 써낸 양 (가장 비쌈)</div></div>
      <div class="card tile"><div class="l">입력 토큰</div><div class="v">${fmt(tot.input)}</div><div class="h">새로 읽은 양 · 캐시 읽기 ${fmt(tot.cacheRead)}</div></div>
      <div class="card tile"><div class="l">opus 비중 (출력)</div><div class="v">${share('opus')}%</div><div class="h">낮을수록 저렴</div></div>
      <div class="card tile"><div class="l">캐시 재사용률</div><div class="v">${cacheHit}%</div><div class="h">높을수록 저렴</div></div>
    </div>
    <section class="card pad">
      <p class="section-label">모델별 출력 비중</p>
      <div class="stack">${models.map(([k, v]) => `<span style="width:${tot.output ? (v.output / tot.output) * 100 : 0}%;background:${MODEL_COLOR[k] || '#999'}" title="${esc(k)} ${fmt(v.output)}"></span>`).join('')}</div>
      <div class="legend">${legend || '<span>기록 없음</span>'}</div>
    </section>
    <section class="card pad" style="margin-top:16px">
      <p class="section-label">직원별 사용량</p>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>직원</th><th>팀</th><th>모델</th><th class="n">호출</th><th class="n">입력</th><th class="n">캐시 읽기</th><th class="n">출력</th><th class="n">마지막 작업</th></tr></thead>
        <tbody>${people.map(({ a, u }) => `<tr><td><strong>${esc(a.name)}</strong></td><td>${esc(a.team)}</td><td>${Object.keys(u.models).filter((k) => u.models[k] > 0).map(modelBadge).join(' ') || modelBadge(a.model)}</td><td class="n">${u.runs}</td><td class="n">${fmt(u.input)}</td><td class="n">${fmt(u.cacheRead)}</td><td class="n">${fmt(u.output)}</td><td class="n">${u.last ? md(u.last.slice(0, 10)) + ' ' + new Date(u.last).toTimeString().slice(0, 5) : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">이 기간 기록이 없습니다.</td></tr>'}</tbody>
      </table></div>
    </section>
    <div class="two">
      <section class="card pad"><p class="section-label">배치 조정 제안</p><div class="tips">${tips.map(([c, who, t]) => `<div class="tip"><span class="badge ${c}">${esc(who)}</span><span>${esc(t)}</span></div>`).join('') || '<div class="empty">지금 배치로 괜찮습니다.</div>'}</div></section>
      <section class="card pad md">${renderMd(S.hrMd.replace(/^# .*\n/, ''))}</section>
    </div>`;
}

// ───────── 캘린더 ─────────
function viewCalendar() {
  if (!ui.calMonth) ui.calMonth = S.today.slice(0, 7);
  const [y, m] = ui.calMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const start = new Date(y, m - 1, 1 - first.getDay());
  const byDate = {};
  for (const e of S.calendar) for (const d of e.dates) (byDate[d] ||= []).push(`<span class="ev" title="${esc(e.title)} · ${esc(e.owner)}">${esc(e.title)}</span>`);
  for (const a of S.pending) if (a.submitted) (byDate[a.submitted] ||= []).push(`<span class="ev ev-appr" title="결재 상신">결재 · ${esc(a.title)}</span>`);
  let cells = WD.map((w) => `<div class="dow">${w}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (i >= 35 && d.getMonth() !== m - 1) break;
    cells += `<div class="${d.getMonth() !== m - 1 ? 'other' : ''} ${k === S.today ? 'is-today' : ''}"><span class="dn">${d.getDate()}</span>${(byDate[k] || []).join('')}</div>`;
  }
  const rows = S.calendar.map((e) => `<tr><td>${esc(e.when)}</td><td><strong>${esc(e.title)}</strong></td><td>${esc(e.owner)}</td><td>${esc(e.status)}</td><td class="n">${(() => { const n = e.dates.find((d) => d >= S.today); return n ? `${md(n)} · D-${daysBetween(S.today, n)}` : ''; })()}</td></tr>`).join('');
  return `
    <div class="page-title"><h1>캘린더</h1><span class="sub">상황실/캘린더.md · 반복 일정과 결재 상신일</span></div>
    <section class="card pad">
      <div class="cal-head"><button class="btn" data-cal="-1" aria-label="이전 달">‹</button><strong>${y}년 ${m}월</strong><button class="btn" data-cal="1" aria-label="다음 달">›</button><button class="btn" data-cal="0">오늘</button></div>
      <div class="cal">${cells}</div>
    </section>
    <section class="card pad" style="margin-top:16px">
      <p class="section-label">등록된 일정</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>날짜</th><th>일정</th><th>담당</th><th>상태</th><th class="n">다음</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="empty">일정이 없습니다.</td></tr>'}</tbody></table></div>
    </section>`;
}

// ───────── 렌더/이벤트 ─────────
const VIEWS = { brief: viewBrief, pending: viewPending, archive: viewArchive, org: viewOrg, staff: viewStaff, usage: viewUsage, calendar: viewCalendar };
function render() {
  if (!S) return;
  if (!VIEWS[ui.tab]) ui.tab = 'brief';
  renderHeader();
  const focused = document.activeElement && document.activeElement.id;
  $('#view').innerHTML = (S.demo ? '<div class="demo-note card" style="margin-bottom:16px">데모 데이터입니다. 결재 버튼을 눌러도 실제 상황실 폴더는 바뀌지 않습니다.</div>' : '') + VIEWS[ui.tab]();
  if (focused === 'aq') { const el = $('#aq'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
}
async function openFile(p) {
  $('#modal-title').textContent = p;
  $('#modal-body').innerHTML = '<div class="empty">불러오는 중…</div>';
  $('#modal').hidden = false;
  try {
    const r = await fetch('/api/file?path=' + encodeURIComponent(p));
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    $('#modal-body').innerHTML = j.text == null
      ? `<div class="empty">${j.tooLarge ? '파일이 커서 미리보기를 생략합니다.' : '미리보기를 지원하지 않는 형식입니다.'}<br>폴더에서 직접 여세요: <span class="mono">${esc(p)}</span></div>`
      : j.ext === 'md' ? `<div class="md">${renderMd(j.text)}</div>`
      : j.ext === 'csv' ? `<div class="md">${renderMd(j.text.trim().split(/\r?\n/).map((l, i) => '| ' + l.split(',').join(' | ') + ' |' + (i === 0 ? '\n|' + l.split(',').map(() => '---').join('|') + '|' : '')).join('\n'))}</div>`
      : `<pre class="md"><code>${esc(j.text)}</code></pre>`;
  } catch (e) {
    $('#modal-body').innerHTML = `<div class="empty">파일을 열 수 없습니다 (${esc(e.message.includes('ENOENT') ? '아직 없는 파일' : e.message)}).</div>`;
  }
}
document.addEventListener('click', async (ev) => {
  const t = ev.target.closest('button, [data-go]');
  if (!t) { if (ev.target.id === 'modal') $('#modal').hidden = true; return; }
  const d = t.dataset;
  if (d.tab || d.go) { ui.tab = d.tab || d.go; location.hash = ui.tab; render(); window.scrollTo(0, 0); return; }
  if (d.brief) { ui.briefKey = d.brief; render(); return; }
  if (d.req !== undefined) { try { await post('/api/request', { line: +d.req }); await load(); } catch (e) { toast(e.message); } return; }
  if (d.proj) { ui.open.has(d.proj) ? ui.open.delete(d.proj) : ui.open.add(d.proj); render(); return; }
  if (d.amonth) { ui.archiveMonth = d.amonth === '1'; render(); return; }
  if (d.steam) { ui.staffTeam = d.steam; render(); return; }
  if (d.uperiod) { ui.usagePeriod = d.uperiod; render(); return; }
  if (d.file) { openFile(d.file); return; }
  if (d.cal) {
    if (d.cal === '0') ui.calMonth = S.today.slice(0, 7);
    else { const [y, m] = ui.calMonth.split('-').map(Number); const n = new Date(y, m - 1 + Number(d.cal), 1); ui.calMonth = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; }
    render(); return;
  }
  if (t.id === 'modal-close') { $('#modal').hidden = true; return; }
});
document.addEventListener('submit', async (ev) => {
  const form = ev.target.closest('[data-decide]');
  if (!form) return;
  ev.preventDefault();
  const result = ev.submitter && ev.submitter.value;
  const memo = form.memo.value;
  if (result !== '승인' && !memo.trim()) { form.memo.focus(); toast(`${result} 사유를 메모에 적어 주세요`); return; }
  form.querySelectorAll('button').forEach((b) => (b.disabled = true));
  try {
    await post('/api/decide', { file: form.dataset.decide, result, memo });
    toast(`${result} 처리했습니다`);
    await load();
  } catch (e) {
    toast(e.message);
    form.querySelectorAll('button').forEach((b) => (b.disabled = false));
  }
});
document.addEventListener('input', (ev) => { if (ev.target.id === 'aq') { ui.archiveQuery = ev.target.value; render(); } });
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') $('#modal').hidden = true; });
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h && h !== ui.tab) { ui.tab = h; render(); } });
// 결재 메모를 쓰는 중에는 자동 새로고침으로 지우지 않는다
setInterval(() => {
  if (document.hidden) return;
  const a = document.activeElement;
  if (a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT') && a.value) return;
  load().catch(() => {});
}, 15000);
load().catch((e) => { $('#view').innerHTML = `<div class="card empty">상황실 서버에 연결할 수 없습니다: ${esc(e.message)}</div>`; });
