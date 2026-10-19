import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addDays, daysLeft, statusFor, dueSlot, koreaClock } from '../server/dates.js';
import { openStore } from '../server/store.js';
import { createScheduler, notificationTargets } from '../server/scheduler.js';

test('30 calendar days across month, year and leap-day boundaries',()=>{
  assert.equal(addDays('2026-01-20',30),'2026-02-19');
  assert.equal(addDays('2024-02-01',30),'2024-03-02');
  assert.equal(addDays('2026-12-15',30),'2027-01-14');
  assert.throws(()=>addDays('2026-02-30',30));
});
test('all status boundaries include the end date and expire the following day',()=>{
  for(const [days,status] of [[8,'active'],[7,'upcoming'],[6,'upcoming'],[5,'soon'],[4,'soon'],[3,'urgent'],[1,'urgent'],[0,'urgent'],[-1,'ended']]){
    const end=addDays('2026-10-19',days);
    assert.equal(daysLeft(end,'2026-10-19'),days);
    assert.equal(statusFor(end,'2026-10-19'),status);
  }
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
  const input=[{id:'due',name:'테스트 업체',endDate:'2026-10-19'},{id:'seven',name:'7일 업체',endDate:'2026-10-26'},{id:'expired',name:'종료 업체',endDate:'2026-10-18'},{id:'eight',name:'8일 업체',endDate:'2026-10-27'}];
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
  const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'3197',DATABASE_PATH:join(dir,'test.sqlite'),APP_PASSWORD:password,NODE_ENV:'production'},stdio:['ignore','pipe','pipe']});
  t.after(()=>{child.kill();rmSync(dir,{recursive:true,force:true});});
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
  const created=await request('/companies','POST',{name:'통합 테스트',startDate:'2026-10-19',notes:'직접 쓴 메모'});
  assert.equal(created.status,201);
  let c=(await request('/companies')).body.companies[0];
  assert.equal(c.endDate,'2026-11-18');assert.equal(c.notes,'직접 쓴 메모');
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
