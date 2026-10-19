import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from '../server/store.js';
import {cleanCompany,insertCompany} from '../server/company-data.js';
import {applySheetRows,createAutoSheetReader,rememberSheetDeletion} from '../server/auto-sheet.js';

const header=['플레이스 등 진행','연락처','시작날짜','종료날짜','마케팅 진행 상품','메인키워드','특이사항'];
const row=(name='자동 업체',start='26.10.19')=>[name,'010',start,'26.11.17','원본 상품','원본 키워드','가져오면 안 되는 특이사항'];

test('automatic startup reads the sheet without an import action and excludes source notes',async()=>{
  const db=openStore(':memory:');let calls=0;
  const reader=createAutoSheetReader(db,{fetchRows:async()=>{calls++;return [header,row()];}});
  reader.start();await reader.read();
  const c=db.prepare('SELECT * FROM companies').get();
  assert.equal(calls,1);assert.equal(c.name,'자동 업체');assert.equal(c.notes,'');assert.equal(c.category,'원본 상품');assert.equal(c.mainKeyword,'원본 키워드');assert.equal(c.endDate,'2026-11-18');
  assert.equal(reader.status().status,'success');assert.equal(reader.status().result.added,1);
  reader.stop();db.close();
});

test('repeat reads and restart preserve renamed companies, edited dates, product, keyword and memo',()=>{
  const db=openStore(':memory:');applySheetRows(db,[header,row()]);
  const original=db.prepare('SELECT * FROM companies').get();
  db.prepare('UPDATE companies SET name=?,startDate=?,endDate=?,category=?,mainKeyword=?,notes=? WHERE id=?').run('앱에서 바꾼 이름','2026-11-01','2026-12-01','수정 상품','수정 키워드','직접 작성한 메모',original.id);
  assert.deepEqual(applySheetRows(db,[header,row()]),{added:0,skipped:1,total:1});
  // A later source start-date change still refers to the same uniquely named source company.
  assert.equal(applySheetRows(db,[header,row('자동 업체','26.10.20')]).added,0);
  const c=db.prepare('SELECT * FROM companies').get();
  assert.equal(c.id,original.id);assert.equal(c.name,'앱에서 바꾼 이름');assert.equal(c.startDate,'2026-11-01');assert.equal(c.endDate,'2026-12-01');assert.equal(c.category,'수정 상품');assert.equal(c.mainKeyword,'수정 키워드');assert.equal(c.notes,'직접 작성한 메모');
  const restarted=createAutoSheetReader(db,{fetchRows:async()=>[header,row()]});assert.ok(restarted.status().lastSuccess);restarted.stop();db.close();
});

test('new source companies append while removed source rows and locally deleted companies stay unchanged',()=>{
  const db=openStore(':memory:');applySheetRows(db,[header,row('기존 업체'),row('삭제할 업체')]);
  const deleted=db.prepare('SELECT * FROM companies WHERE name=?').get('삭제할 업체');
  rememberSheetDeletion(db,deleted);db.prepare('DELETE FROM companies WHERE id=?').run(deleted.id);
  const result=applySheetRows(db,[header,row('삭제할 업체'),row('새 업체')]);
  assert.deepEqual(result,{added:1,skipped:1,total:2});
  assert.deepEqual(db.prepare('SELECT name FROM companies ORDER BY name').all().map(c=>c.name),['기존 업체','새 업체']);
  assert.equal(applySheetRows(db,[header,row('삭제할 업체','26.10.20')]).added,0);
  db.close();
});

test('legacy imported companies with locally changed start dates are linked without duplication',()=>{
  const db=openStore(':memory:');
  const id=insertCompany(db,cleanCompany({name:'기존 업체',startDate:'2026-11-01',notes:'보존할 메모'}));
  assert.equal(applySheetRows(db,[header,row('기존 업체')]).added,0);
  assert.equal(db.prepare('SELECT id,notes FROM companies').get().id,id);
  assert.equal(db.prepare('SELECT notes FROM companies').get().notes,'보존할 메모');db.close();
});

test('failed or malformed reads retain local data and periodic retry recovers',async()=>{
  const db=openStore(':memory:');insertCompany(db,cleanCompany({name:'로컬 업체',notes:'안전한 메모'}));
  assert.throws(()=>applySheetRows(db,[header,row('정상 행'),row('오류 행','26.2.30')]));
  assert.equal(db.prepare('SELECT count(*) n FROM companies').get().n,1);
  let calls=0,resolveSecond;const reached=new Promise(resolve=>resolveSecond=resolve);
  const reader=createAutoSheetReader(db,{intervalMs:20,fetchRows:()=>{calls++;if(calls===1)throw Error('offline');resolveSecond();return [header,row()];}});
  reader.start();await reader.read();assert.equal(reader.status().status,'error');
  assert.equal(db.prepare('SELECT notes FROM companies').get().notes,'안전한 메모');
  let timeout;await Promise.race([reached,new Promise((_,reject)=>timeout=setTimeout(()=>reject(Error('Retry did not run')),1000))]);clearTimeout(timeout);
  await reader.read();assert.equal(reader.status().status,'success');assert.equal(db.prepare('SELECT count(*) n FROM companies').get().n,2);
  reader.stop();db.close();
});

test('concurrent reads share one fetch and shutdown prevents late writes to a closed database',async()=>{
  const db=openStore(':memory:');let finish,calls=0;
  const reader=createAutoSheetReader(db,{fetchRows:()=>{calls++;return new Promise(resolve=>finish=resolve);}});
  const first=reader.read(),second=reader.read();await Promise.resolve();assert.equal(calls,1);
  reader.stop();db.close();finish([header,row()]);await Promise.all([first,second]);
});
