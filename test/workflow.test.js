import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, fork } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import {randomBytes} from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addDays, daysLeft, statusFor, dueSlot, koreaClock } from '../server/dates.js';
import { openStore } from '../server/store.js';
import { createScheduler, notificationTargets } from '../server/scheduler.js';
import { sanitizeSheetRows, inferSheetMapping, companiesFromRows, parseSheetDate } from '../server/sheet-data.js';
import { DatabaseSync } from 'node:sqlite';

async function stopProcess(child) {
  if(child.exitCode!==null)return;
  const exited=new Promise(resolve=>child.once('exit',resolve));
  child.kill();await exited;
}

test('30 calendar days across month, year and leap-day boundaries',()=>{
  assert.equal(addDays('2026-01-20',30),'2026-02-19');
  assert.equal(addDays('2024-02-01',30),'2024-03-02');
  assert.equal(addDays('2026-12-15',30),'2027-01-14');
  assert.throws(()=>addDays('2026-02-30',30));
});
test('all status boundaries include the end date and expire the following day',()=>{
  assert.equal(daysLeft('','2026-10-19'),null);
  assert.equal(statusFor('','2026-10-19'),'unset');
  for(const [days,status] of [[8,'active'],[7,'upcoming'],[6,'upcoming'],[5,'soon'],[4,'soon'],[3,'urgent'],[1,'urgent'],[0,'urgent'],[-1,'ended']]){
    const end=addDays('2026-10-19',days);
    assert.equal(daysLeft(end,'2026-10-19'),days);
    assert.equal(statusFor(end,'2026-10-19'),status);
  }
});
test('actual sheet headers and short dates import products and keywords, preserve old end date, exclude notes and limit range',()=>{
  const rows=[['플레이스 등 진행','연락처 ','시작날짜 ','종료날짜 ','마케팅 진행 상품 ','메인키워드 ','특이사항 '],['테스트 업체','010','26.9.26','26. 10. 25','플레이스 + 큐레이션','제주 맛집\n제주 카페','가져오면 안 되는 값','H열 제외'],['날짜 미정','','','','블로그','키워드','원본 메모']];
  const clean=sanitizeSheetRows(rows),mapping=inferSheetMapping(clean);
  assert.equal(clean[1][6],'');assert.equal(clean[1].length,7);
  const companies=companiesFromRows(clean,mapping);
  assert.equal(companies[0].startDate,'2026-09-26');
  assert.equal(companies[0].endDate,'2026-10-26');
  assert.equal(companies[0].existingEndDate,'26. 10. 25');
  assert.equal(companies[0].category,'플레이스 + 큐레이션');
  assert.equal(companies[0].mainKeyword,'제주 맛집\n제주 카페');
  assert.equal(companies[0].notes,'');assert.equal(companies[1].startDate,'');assert.equal(companies[1].endDate,'');
  assert.equal(parseSheetDate('26.10.2'),'2026-10-02');
  assert.throws(()=>parseSheetDate('26.2.30'));
  assert.throws(()=>companiesFromRows(rows,{...mapping,mainKeyword:'6'}));
  const many=[rows[0],...Array.from({length:60},(_,i)=>[String(i),'','26.10.19','','상품','키워드','원본'])];
  assert.equal(companiesFromRows(many,inferSheetMapping(many)).length,49);
});
test('old databases migrate without losing notes or old end dates and migration repeats safely',()=>{
  const dir=mkdtempSync(join(tmpdir(),'flow-migration-')),path=join(dir,'old.sqlite');
  const legacy=new DatabaseSync(path);
  legacy.exec("CREATE TABLE companies (id TEXT PRIMARY KEY,name TEXT,category TEXT,manager TEXT,contact TEXT,startDate TEXT,endDate TEXT,notes TEXT,createdAt TEXT,updatedAt TEXT)");
  legacy.prepare('INSERT INTO companies VALUES(?,?,?,?,?,?,?,?,?,?)').run('legacy','기존 업체','상품','팀','','2026-10-01','2026-12-31','기존 작성 메모','now','old');
  legacy.close();
  let db=openStore(path),c=db.prepare('SELECT * FROM companies').get();
  assert.equal(c.endDate,'2026-10-31');assert.equal(c.existingEndDate,'2026-12-31');assert.equal(c.notes,'기존 작성 메모');assert.equal(c.mainKeyword,'');
  db.close();db=openStore(path);c=db.prepare('SELECT * FROM companies').get();
  assert.equal(c.existingEndDate,'2026-12-31');db.close();rmSync(dir,{recursive:true,force:true});
});
test('schedule uses Seoul time, three hours only, including UTC date rollover',()=>{
  assert.deepEqual(koreaClock(new Date('2026-10-18T15:01:00Z')),{today:'2026-10-19',hour:0,minute:1});
  assert.equal(dueSlot(new Date('2026-10-19T00:00:00Z')),'2026-10-19/9');
  assert.equal(dueSlot(new Date('2026-10-19T03:00:00Z')),'2026-10-19/12');
  assert.equal(dueSlot(new Date('2026-10-19T06:00:00Z')),'2026-10-19/15');
  assert.equal(dueSlot(new Date('2026-10-19T07:00:00Z')),null);
});
test('persistent notification slots prevent duplicates across restarts; due includes zero and excludes expired',async()=>{
  const db=openStore(':memory:');
  const input=[{id:'due',name:'테스트 업체',endDate:'2026-10-19'},{id:'seven',name:'7일 업체',endDate:'2026-10-26'},{id:'expired',name:'종료 업체',endDate:'2026-10-18'},{id:'eight',name:'8일 업체',endDate:'2026-10-27'},{id:'unset',name:'날짜 없음',endDate:''}];
  assert.equal(notificationTargets(input,'2026-10-19').length,2);
  for(const c of input)db.prepare('INSERT INTO companies(id,name,startDate,endDate,createdAt,updatedAt) VALUES(?,?,?,?,?,?)').run(c.id,c.name,'2026-09-19',c.endDate,'now','now');
  await createScheduler(db).tick(new Date('2026-10-19T00:00:00Z'));
  await createScheduler(db).tick(new Date('2026-10-19T00:30:00Z'));
  assert.equal(db.prepare('SELECT count(*) n FROM notifications').get().n,1);
  await createScheduler(db).tick(new Date('2026-10-19T03:00:00Z'));
  await createScheduler(db).tick(new Date('2026-10-19T06:00:00Z'));
  const rows=db.prepare('SELECT * FROM notifications').all();
  assert.equal(rows.length,3);
  assert.equal(JSON.parse(rows[0].payload).length,2);
  assert.equal(JSON.parse(rows[0].payload)[0].days,0);
  db.close();
});
test('HTTP workflow: auth, CRUD, date recalculation, notes stripping, duplicates and persistence',async(t)=>{
  const dir=mkdtempSync(join(tmpdir(),'flow-test-'));
  const password='test-password-2026';
  const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,WAITINGLIST_AUTO_SHEET:'0',PORT:'3197',DATABASE_PATH:join(dir,'test.sqlite'),APP_PASSWORD:password,NODE_ENV:'production'},stdio:['ignore','pipe','pipe']});
  t.after(async()=>{await stopProcess(child);rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:50});});
  let cookie='';
  async function request(path,method='GET',data,origin){
    const r=await fetch('http://127.0.0.1:3197/api'+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(origin?{Origin:origin}:{})},...(data?{body:JSON.stringify(data)}:{})});
    if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];
    return {status:r.status,body:await r.json()};
  }
  await new Promise((resolve,reject)=>{child.stdout.on('data',d=>{if(String(d).includes('listening'))resolve();});child.on('exit',c=>reject(new Error(`server exit ${c}`)));setTimeout(()=>reject(new Error('startup timeout')),10000).unref();});
  assert.equal((await request('/companies')).status,401);
  assert.equal((await request('/login','POST',{password:'incorrect'})).status,401);
  assert.equal((await request('/login','POST',{password})).status,200);
  assert.equal((await request('/companies','POST',{name:'bad'},'https://evil.example')).status,403);
  const created=await request('/companies','POST',{name:'통합 테스트',startDate:'2026-10-19',category:'블로그',mainKeyword:'제주 맛집',notes:'직접 쓴 메모'});
  assert.equal(created.status,201);
  let c=(await request('/companies')).body.companies[0];
  assert.equal(c.endDate,'2026-11-18');assert.equal(c.notes,'직접 쓴 메모');
  assert.equal(c.mainKeyword,'제주 맛집');assert.equal(c.category,'블로그');
  assert.equal((await request('/companies/'+c.id,'PUT',{...c,endDate:'2099-12-31'})).status,200);
  c=(await request('/companies')).body.companies[0];assert.equal(c.endDate,'2099-12-31');
  assert.equal((await request('/companies/'+c.id,'PUT',{...c,startDate:'2026-11-01'})).status,200);
  c=(await request('/companies')).body.companies[0];assert.equal(c.endDate,'2026-12-01');
  assert.equal((await request('/companies/'+c.id,'PUT',{...c,startDate:'',endDate:'2099-12-31',mainKeyword:'수정된 키워드'})).status,200);
  c=(await request('/companies')).body.companies[0];assert.equal(c.endDate,'2099-12-31');assert.equal(c.mainKeyword,'수정된 키워드');
  assert.equal((await request('/companies/'+c.id,'PUT',{...c,startDate:'2026-11-01'})).status,200);
  c=(await request('/companies')).body.companies[0];assert.equal(c.endDate,'2026-12-01');
  assert.equal((await request('/companies/'+c.id,'PUT',{...c,updatedAt:'stale'})).status,409);
  assert.equal((await request('/companies','POST',{name:'invalid',startDate:'2026-02-30'})).status,400);
  const imported={companies:[{name:'시트 업체',startDate:'2026-10-20',notes:'절대 가져오면 안 되는 값'}]};
  assert.deepEqual((await request('/import','POST',imported)).body,{added:1,skipped:0});
  assert.deepEqual((await request('/import','POST',imported)).body,{added:0,skipped:1});
  const rows=(await request('/companies')).body.companies;
  assert.equal(rows.find(x=>x.name==='시트 업체').notes,'');
  assert.equal((await request('/settings')).body.channel,'in-app');
  const stored=openStore(join(dir,'test.sqlite'));assert.equal(stored.prepare('SELECT count(*) n FROM companies').get().n,2);stored.close();
  assert.equal((await request('/companies/'+c.id,'DELETE')).status,200);
  assert.equal((await request('/companies')).body.companies.length,1);
  await request('/logout','POST');assert.equal((await request('/companies')).status,401);
});

test('desktop API is private and online backup retains data without exposing its token',async(t)=>{
  const dir=mkdtempSync(join(tmpdir(),'flow-desktop-api-')),token=randomBytes(32).toString('hex');
  const child=fork('server/index.js',[],{env:{...process.env,WAITINGLIST_AUTO_SHEET:'0',WAITINGLIST_DESKTOP:'1',WAITINGLIST_TOKEN:token,PORT:'0',DATABASE_PATH:join(dir,'main.sqlite'),NODE_ENV:'production',APP_PASSWORD:''},stdio:['ignore','ignore','pipe','ipc']});
  t.after(async()=>{await stopProcess(child);rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:50});});
  const port=await new Promise((resolve,reject)=>{
    child.on('message',m=>{if(m.type==='ready')resolve(m.port);});
    child.on('exit',code=>reject(Error('Desktop API exited '+code)));
    setTimeout(()=>reject(Error('Desktop API startup timeout')),10000).unref();
  });
  const base=`http://127.0.0.1:${port}`,headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
  assert.equal((await fetch(base+'/api/companies')).status,401);
  const created=await fetch(base+'/api/companies',{method:'POST',headers,body:JSON.stringify({name:'로컬 프로그램 업체',startDate:'2026-10-19',notes:'백업할 메모'})});
  assert.equal(created.status,201);
  const state=await(await fetch(base+'/api/settings',{headers})).json();assert.equal(state.desktop,true);
  const backup=join(dir,'backup.sqlite');
  await new Promise((resolve,reject)=>{
    child.on('message',m=>{if(m.type==='backup-result'&&m.id==='test-backup')m.ok?resolve():reject(Error(m.error));});
    child.send({type:'backup',id:'test-backup',path:backup});
    setTimeout(()=>reject(Error('Backup timeout')),10000).unref();
  });
  assert.equal(readFileSync(backup).subarray(0,16).toString(),'SQLite format 3\0');
  const db=openStore(backup);assert.equal(db.prepare('SELECT notes FROM companies').get().notes,'백업할 메모');db.close();
  const exited=new Promise(resolve=>child.once('exit',resolve));child.send({type:'shutdown'});assert.equal(await exited,0);
});
