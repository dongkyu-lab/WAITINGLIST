import express from 'express';
import { randomBytes, randomUUID, timingSafeEqual, createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import Papa from 'papaparse';
import { openStore } from './store.js';
import { validDate, addDays, koreaClock } from './dates.js';
import { createScheduler } from './scheduler.js';
import { sanitizeSheetRows } from './sheet-data.js';

const app=express(), production=process.env.NODE_ENV==='production';
const desktop=process.env.WAITINGLIST_DESKTOP==='1';
const desktopToken=process.env.WAITINGLIST_TOKEN;
if(desktop && !/^[a-f0-9]{64}$/.test(desktopToken||'')) throw new Error('데스크톱 연결 키가 필요합니다.');
const password=process.env.APP_PASSWORD;
if(production && !desktop && (!password || password.length<12)) throw new Error('배포하려면 12자 이상의 APP_PASSWORD를 설정하세요.');
const db=openStore(process.env.DATABASE_PATH||'data/flow.sqlite');
const scheduler=createScheduler(db);
app.disable('x-powered-by');
app.set('trust proxy', desktop?false:1);
app.use((req,res,next)=>{
  if(desktop && req.get('authorization')!==`Bearer ${desktopToken}`) return res.status(401).json({error:'프로그램에서만 접근할 수 있습니다.'});
  res.set({'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin'});
  if(req.path.startsWith('/api')) res.set('Cache-Control','no-store');
  const allowedOrigins=new Set([`${req.protocol}://${req.get('host')}`]);
  // Vite proxies API requests from these local development origins.
  // Never allow the extra origins in production.
  if(!production) {
    allowedOrigins.add('http://localhost:5173');
    allowedOrigins.add('http://127.0.0.1:5173');
  }
  if(req.method!=='GET' && req.headers.origin && !allowedOrigins.has(req.headers.origin)) return res.status(403).json({error:'허용되지 않은 요청입니다.'});
  next();
});
app.use(express.json({limit:'1mb'}));
app.get('/api/health',(_,res)=>res.json({ok:true}));
const tokenOf=req=>(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('flow_session='))?.slice(13);
function loggedIn(req) {
  if(!password) return true;
  const token=tokenOf(req);
  return Boolean(token && db.prepare('SELECT token FROM sessions WHERE token=? AND expires>?').get(createHash('sha256').update(token).digest('hex'),Date.now()));
}
app.get('/api/auth', (req,res)=>res.json({authenticated:loggedIn(req),protected:Boolean(password)}));
const attempts=new Map();
app.post('/api/login',(req,res)=>{
  const now=Date.now(), ip=req.ip, recent=(attempts.get(ip)||[]).filter(t=>now-t<900000);
  if(recent.length>=10) return res.status(429).json({error:'잠시 후 다시 로그인해 주세요.'});
  attempts.set(ip,[...recent,now]);
  if(attempts.size>1000) for(const [key,value] of attempts) if(value.every(t=>now-t>=900000)) attempts.delete(key);
  const supplied=createHash('sha256').update(String(req.body.password||'')).digest(), expected=createHash('sha256').update(password||'').digest();
  if(password && !timingSafeEqual(supplied,expected)) return res.status(401).json({error:'비밀번호를 확인해 주세요.'});
  const token=randomBytes(32).toString('hex');
  db.prepare('DELETE FROM sessions WHERE expires<?').run(now);
  db.prepare('INSERT INTO sessions VALUES(?,?)').run(createHash('sha256').update(token).digest('hex'),now+7*86400000);
  res.setHeader('Set-Cookie',`flow_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${production?'; Secure':''}`);
  attempts.delete(ip); res.json({ok:true});
});
app.use('/api',(req,res,next)=>loggedIn(req)?next():res.status(401).json({error:'로그인이 필요합니다.'}));
app.post('/api/logout',(req,res)=>{
  const token=tokenOf(req);
  if(token) db.prepare('DELETE FROM sessions WHERE token=?').run(createHash('sha256').update(token).digest('hex'));
  res.setHeader('Set-Cookie','flow_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); res.json({ok:true});
});
function cleanCompany(input) {
  const name=String(input.name||'').trim();
  if(!name || name.length>150) throw new Error('업체명은 1~150자로 입력해 주세요.');
  const startDate=String(input.startDate||'').trim();
  if(startDate && !validDate(startDate)) throw new Error('시작일을 확인해 주세요.');
  // End dates are computed exclusively by the server, including same-start edits.
  const endDate=startDate?addDays(startDate,30):'';
  const fields=Object.fromEntries(['category','mainKeyword','manager','contact','notes','existingEndDate'].map(k=>[k,String(input[k]||'').trim()]));
  if(Object.values(fields).some(v=>v.length>5000)) throw new Error('입력값은 5,000자 이내로 작성해 주세요.');
  return {name,startDate,endDate,...fields};
}
function insertCompany(c) {
  const id=randomUUID(),now=new Date().toISOString();
  db.prepare('INSERT INTO companies(id,name,category,mainKeyword,manager,contact,startDate,endDate,notes,existingEndDate,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,c.name,c.category,c.mainKeyword,c.manager,c.contact,c.startDate,c.endDate,c.notes,c.existingEndDate,now,now);
  return id;
}
app.get('/api/companies',(_,res)=>res.json({companies:db.prepare('SELECT * FROM companies ORDER BY endDate,name').all(),today:koreaClock().today}));
app.post('/api/companies',(req,res)=>{const c=cleanCompany(req.body); const id=insertCompany(c);res.status(201).json({id});});
app.put('/api/companies/:id',(req,res)=>{
  const old=db.prepare('SELECT * FROM companies WHERE id=?').get(req.params.id);
  if(!old) return res.status(404).json({error:'업체를 찾을 수 없습니다.'});
  if(req.body.updatedAt!==old.updatedAt) return res.status(409).json({error:'다른 사용자가 수정했습니다. 창을 닫고 새로고침한 뒤 다시 수정해 주세요.'});
  const c=cleanCompany(req.body);
  db.prepare('UPDATE companies SET name=?,category=?,mainKeyword=?,manager=?,contact=?,startDate=?,endDate=?,notes=?,updatedAt=? WHERE id=?').run(c.name,c.category,c.mainKeyword,c.manager,c.contact,c.startDate,c.endDate,c.notes,new Date().toISOString(),old.id);
  res.json({ok:true});
});
app.delete('/api/companies/:id',(req,res)=>{db.prepare('DELETE FROM companies WHERE id=?').run(req.params.id);res.json({ok:true});});
app.get('/api/notifications',(_,res)=>res.json(db.prepare('SELECT * FROM notifications ORDER BY createdAt DESC LIMIT 90').all().map(n=>({...n,companies:JSON.parse(n.payload),payload:undefined}))));
app.post('/api/notifications/read',(_,res)=>{db.prepare('UPDATE notifications SET readAt=? WHERE readAt IS NULL').run(new Date().toISOString());res.json({ok:true});});
app.get('/api/settings',(_,res)=>res.json({timezone:'Asia/Seoul',hours:[9,12,15],channel:'in-app',lastImport:db.prepare("SELECT value FROM settings WHERE key='lastImport'").get()?.value||null,protected:Boolean(password),desktop}));
const SHEET_URL='https://docs.google.com/spreadsheets/d/1r_XoTBynA9_oWg9D3dzg18a5V3s1tej7R_7sapnGwII/gviz/tq?'+new URLSearchParams({tqx:'out:csv',sheet:'현재진행업체NEW',range:'A1:G50'});
app.get('/api/sheet/preview',async(_,res)=>{
  try {
    const response=await fetch(SHEET_URL,{signal:AbortSignal.timeout(15000),redirect:'error'});
    if(!response.ok) return res.status(502).json({error:'시트를 읽을 수 없습니다. 공유 권한 또는 네트워크 설정을 확인하거나 A1:G50 범위의 CSV를 업로드하세요.'});
    const csv=await response.text();
    if(csv.length>500000 || /^\s*</.test(csv)) throw new Error('invalid response');
    const parsed=Papa.parse(csv,{skipEmptyLines:false});
    if(parsed.errors.length) throw new Error('invalid csv');
    // Drop notes values server-side before any client preview.
    const rows=sanitizeSheetRows(parsed.data);
    res.json({rows,source:'현재진행업체NEW!A1:G50'});
  } catch { res.status(502).json({error:'Google Sheets 연결에 실패했습니다. A1:G50 범위의 CSV 파일로 가져올 수 있습니다.'}); }
});
app.post('/api/import',(req,res)=>{
  const rows=req.body.companies;
  if(!Array.isArray(rows)||!rows.length||rows.length>49) return res.status(400).json({error:'헤더를 제외한 최대 49개 업체만 가져올 수 있습니다.'});
  const valid=rows.map(c=>cleanCompany({...c,notes:''}));
  let added=0,skipped=0;
  db.exec('BEGIN');
  try {
    for(const c of valid) {
      if(db.prepare('SELECT id FROM companies WHERE name=? AND startDate=?').get(c.name,c.startDate)) {skipped++;continue;}
      insertCompany(c);added++;
    }
    db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES('lastImport',?)").run(new Date().toISOString());
    db.exec('COMMIT');
  } catch(e) {db.exec('ROLLBACK');throw e;}
  res.json({added,skipped});
});
app.use('/api',(_,res)=>res.status(404).json({error:'요청을 찾을 수 없습니다.'}));
const dist=resolve(process.env.WAITINGLIST_DIST||'dist');
if(existsSync(dist)) {app.use(express.static(dist));app.get('/{*path}',(_,res)=>res.sendFile(resolve(dist,'index.html')));}
app.use((err,req,res,next)=>{res.status(400).json({error:err.message||'요청을 처리하지 못했습니다.'});});
const timer=setInterval(()=>scheduler.tick().catch(()=>console.error('알림 스케줄러 오류')),15000);
scheduler.tick().catch(()=>console.error('알림 스케줄러 오류'));
const server=app.listen(Number(process.env.PORT||3000),desktop?'127.0.0.1':'0.0.0.0',()=>{
  const port=server.address().port;
  console.log(`Flow server listening on ${port}`);
  if(desktop && process.send)process.send({type:'ready',port});
});
if(desktop && process.send)process.on('message',message=>{
  if(message.type==='shutdown'){shutdown();return;}
  if(message.type!=='backup'||typeof message.path!=='string'||typeof message.id!=='string')return;
  try {db.prepare('VACUUM INTO ?').run(message.path);process.send({type:'backup-result',id:message.id,ok:true});}
  catch {process.send({type:'backup-result',id:message.id,ok:false,error:'백업 파일을 만들지 못했습니다. 다른 이름과 위치로 다시 시도해 주세요.'});}
});
if(desktop)process.on('disconnect',()=>{clearInterval(timer);server.close(()=>{db.close();process.exit(0);});});
function shutdown(){clearInterval(timer);server.close(()=>{db.close();process.exit(0);});}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
