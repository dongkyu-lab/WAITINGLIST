import express from 'express';
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { existsSync,readFileSync } from 'node:fs';
import { openStore } from './store.js';
import { koreaClock } from './dates.js';
import { createScheduler } from './scheduler.js';
import {cleanCompany,insertCompany as insertIntoDB} from './company-data.js';
import {createAutoSheetReader,fetchSheetRows,rememberSheetDeletion} from './auto-sheet.js';
import {createCloudAPI} from './cloud-api.js';
import {cloudError} from './firebase-workspace.js';
import {createSheetReviewStore,localSheetCompanies,planSheetUpdates,sheetFields,applyLocalSheetUpdates} from './sheet-review.js';
import {inferSheetMapping,companiesFromRows} from './sheet-data.js';

const app=express(), production=process.env.NODE_ENV==='production';
const desktop=process.env.WAITINGLIST_DESKTOP==='1';
const cloudRequired=process.env.WAITINGLIST_REQUIRE_GOOGLE==='1';
const desktopToken=process.env.WAITINGLIST_TOKEN;
if(desktop && !/^[a-f0-9]{64}$/.test(desktopToken||'')) throw new Error('데스크톱 연결 키가 필요합니다.');
const password=process.env.APP_PASSWORD;
if(production && !desktop && (!password || password.length<12)) throw new Error('배포하려면 12자 이상의 APP_PASSWORD를 설정하세요.');
const db=openStore(process.env.DATABASE_PATH||'data/flow.sqlite');
const scheduler=createScheduler(db);
const cloud=cloudRequired?createCloudAPI({legacyPath:process.env.DATABASE_PATH||'data/flow.sqlite',legacyStore:db}):null;
const autoSheet=createAutoSheetReader(db,{
  enabled:!cloudRequired&&process.env.WAITINGLIST_AUTO_SHEET!=='0',
  ...(process.env.WAITINGLIST_SMOKE_DATA&&process.env.WAITINGLIST_SHEET_FIXTURE?{fetchRows:async()=>JSON.parse(readFileSync(process.env.WAITINGLIST_SHEET_FIXTURE,'utf8'))}:{})
});
const sheetReviews=createSheetReviewStore();
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
if(cloud)app.use('/api',cloud.router);
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
const insertCompany=c=>insertIntoDB(db,c);
app.get('/api/companies',(_,res)=>res.json({companies:db.prepare('SELECT * FROM companies ORDER BY endDate,name').all(),today:koreaClock().today,sheetAuto:autoSheet.status()}));
app.post('/api/companies',(req,res)=>{const c=cleanCompany(req.body); const id=insertCompany(c);res.status(201).json({id});});
app.put('/api/companies/:id',(req,res)=>{
  const old=db.prepare('SELECT * FROM companies WHERE id=?').get(req.params.id);
  if(!old) return res.status(404).json({error:'업체를 찾을 수 없습니다.'});
  if(req.body.updatedAt!==old.updatedAt) return res.status(409).json({error:'다른 사용자가 수정했습니다. 창을 닫고 새로고침한 뒤 다시 수정해 주세요.'});
  const c=cleanCompany(req.body);
  db.prepare('UPDATE companies SET name=?,category=?,mainKeyword=?,manager=?,contact=?,startDate=?,endDate=?,notes=?,updatedAt=? WHERE id=?').run(c.name,c.category,c.mainKeyword,c.manager,c.contact,c.startDate,c.endDate,c.notes,new Date().toISOString(),old.id);
  res.json({ok:true});
});
app.delete('/api/companies/:id',(req,res)=>{const c=db.prepare('SELECT * FROM companies WHERE id=?').get(req.params.id);if(c)rememberSheetDeletion(db,c);db.prepare('DELETE FROM companies WHERE id=?').run(req.params.id);res.json({ok:true});});
app.get('/api/notifications',(_,res)=>res.json(db.prepare('SELECT * FROM notifications ORDER BY createdAt DESC LIMIT 90').all().map(n=>({...n,companies:JSON.parse(n.payload),payload:undefined}))));
app.post('/api/notifications/read',(_,res)=>{db.prepare('UPDATE notifications SET readAt=? WHERE readAt IS NULL').run(new Date().toISOString());res.json({ok:true});});
app.get('/api/settings',(_,res)=>res.json({timezone:'Asia/Seoul',hours:[9,12,15],channel:'in-app',lastImport:db.prepare("SELECT value FROM settings WHERE key='lastImport'").get()?.value||null,protected:Boolean(password),desktop,sheetAuto:autoSheet.status()}));
app.get('/api/sheet/preview',async(_,res)=>{
  try {res.json({rows:await fetchSheetRows(),source:'현재진행업체NEW!A1:G50'});}
  catch {res.status(502).json({error:'Google Sheets 연결에 실패했습니다. 저장된 데이터는 유지됩니다.'});}
});
app.post('/api/sheet/read',async(_,res)=>{
  const state=await autoSheet.read();
  if(state.status==='error'){res.status(502).json(state);return;}
  const rows=autoSheet.rows();
  if(rows){const mapping=inferSheetMapping(rows);state.review=sheetReviews.create(planSheetUpdates(companiesFromRows(rows,mapping),localSheetCompanies(db),sheetFields(mapping)));}
  res.json(state);
});
app.post('/api/sheet/apply',(req,res)=>{const result=applyLocalSheetUpdates(db,sheetReviews.select(req.body.reviewId,req.body.selected));sheetReviews.clear();res.json(result);});
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
app.use((err,req,res,next)=>{res.status(err.status||400).json({error:err.message||'요청을 처리하지 못했습니다.'});});
const timer=cloud?null:setInterval(()=>scheduler.tick().catch(()=>console.error('알림 스케줄러 오류')),15000);
if(!cloud)scheduler.tick().catch(()=>console.error('알림 스케줄러 오류'));
const server=app.listen(Number(process.env.PORT||3000),desktop?'127.0.0.1':'0.0.0.0',()=>{
  const port=server.address().port;
  console.log(`Flow server listening on ${port}`);
  autoSheet.start();
  if(desktop && process.send)process.send({type:'ready',port});
});
if(desktop && process.send)process.on('message',async message=>{
  if(message.type==='shutdown'){shutdown();return;}
  if(message.type?.startsWith('cloud-')&&typeof message.id==='string'){
    try{
      if(!cloud)throw Error('Google 로그인 모드가 아닙니다.');
      const value=message.type==='cloud-configure'?await cloud.configure(message.config):message.type==='cloud-login'?await cloud.login(message.accessToken):message.type==='cloud-logout'?await cloud.logout():null;
      if(!value)throw Error('지원하지 않는 요청입니다.');
      process.send({type:'cloud-result',id:message.id,ok:true,value});
    }catch(error){const e=cloudError(error);process.send({type:'cloud-result',id:message.id,ok:false,error:e.message,status:e.status,code:e.code});}
    return;
  }
  if(message.type!=='backup'||typeof message.path!=='string'||typeof message.id!=='string')return;
  try {if(cloud)cloud.backup(message.path);else db.prepare('VACUUM INTO ?').run(message.path);process.send({type:'backup-result',id:message.id,ok:true});}
  catch {process.send({type:'backup-result',id:message.id,ok:false,error:'백업 파일을 만들지 못했습니다. 다른 이름과 위치로 다시 시도해 주세요.'});}
});
if(desktop)process.on('disconnect',shutdown);
let shuttingDown=false;
async function shutdown(){if(shuttingDown)return;shuttingDown=true;autoSheet.stop();clearInterval(timer);await cloud?.close();server.close(()=>{db.close();process.exit(0);});}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
