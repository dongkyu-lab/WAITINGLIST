import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from '../server/store.js';
import {applySheetRows,fetchSheetRows} from '../server/auto-sheet.js';
import {localSheetCompanies,planSheetUpdates,sheetFields,createSheetReviewStore,applyLocalSheetUpdates} from '../server/sheet-review.js';
import {companiesFromRows,inferSheetMapping} from '../server/sheet-data.js';
const header=['플레이스 등 진행','연락처','시작날짜','종료날짜','마케팅 진행 상품','메인키워드','특이사항'];
const rows=(start='26.10.01',product='기존 상품',name='시트 업체')=>[header,[name,'010-1234-5678',start,'26.10.31',product,'키워드','원본 메모 제외']];
function plan(db,source){const mapping=inferSheetMapping(source);return planSheetUpdates(companiesFromRows(source,mapping),localSheetCompanies(db),sheetFields(mapping));}

test('refresh previews and applies existing date/product changes while preserving memos and unmapped managers',()=>{
  const db=openStore(':memory:');applySheetRows(db,rows());
  db.prepare("UPDATE companies SET notes='직접 쓴 메모',manager='앱 담당자'").run();
  const plans=plan(db,rows('26.10.05','바뀐 상품'));
  assert.deepEqual(plans[0].changes.map(c=>c.field).sort(),['category','startDate']);
  assert.equal(db.prepare('SELECT startDate FROM companies').get().startDate,'2026-10-01');
  const reviews=createSheetReviewStore(),preview=reviews.create(plans);
  assert.equal(JSON.stringify(preview).includes('직접 쓴 메모'),false);
  assert.throws(()=>reviews.select('expired',preview.changes.map(c=>c.id)),e=>e.status===409);
  assert.deepEqual(applyLocalSheetUpdates(db,reviews.select(preview.id,preview.changes.map(c=>c.id))),{updated:1});
  const c=db.prepare('SELECT * FROM companies').get();
  assert.equal(c.category,'바뀐 상품');assert.equal(c.endDate,'2026-11-04');assert.equal(c.notes,'직접 쓴 메모');assert.equal(c.manager,'앱 담당자');
  assert.deepEqual(plan(db,rows('26.10.05','바뀐 상품')),[]);db.close();
});
test('stale or deleted review items abort the complete update batch rather than overwriting a concurrent edit',()=>{
  const db=openStore(':memory:');const source=rows();source.push(['두 번째 업체','','26.10.01','','상품','키워드','']);applySheetRows(db,source);
  const changed=rows('26.10.02');changed.push(['두 번째 업체','','26.10.02','','상품','키워드','']);
  const plans=plan(db,changed);assert.equal(plans.length,2);
  db.prepare('UPDATE companies SET updatedAt=? WHERE id=?').run('new-version',plans[1].id);
  assert.throws(()=>applyLocalSheetUpdates(db,plans),e=>e.status===409);
  assert.equal(db.prepare('SELECT startDate FROM companies WHERE id=?').get(plans[0].id).startDate,'2026-10-01');
  db.prepare('DELETE FROM companies WHERE id=?').run(plans[0].id);
  assert.throws(()=>applyLocalSheetUpdates(db,plans),e=>e.status===409);db.close();
});
test('unique contacts identify renamed source companies; duplicate contacts never merge different companies',()=>{
  const db=openStore(':memory:');applySheetRows(db,rows());
  applySheetRows(db,rows('26.10.01','기존 상품','새 업체명'));
  assert.equal(db.prepare('SELECT count(*) n FROM companies').get().n,1);
  const plans=plan(db,rows('26.10.01','기존 상품','새 업체명'));assert.equal(plans[0].changes[0].field,'name');
  const duplicate=rows();duplicate.push(['다른 업체','010-1234-5678','26.10.01','','상품','키워드','']);applySheetRows(db,duplicate);
  assert.deepEqual(plan(db,rows('26.10.01','상품','확인 불가 이름')),[]);db.close();
});
test('each sheet request bypasses cached CSV while keeping the exact tab/range and excluding original notes',async t=>{
  const calls=[];t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push({url:new URL(url),options});return {ok:true,text:async()=>header.join(',')+'\n업체,,26.10.01,,상품,키워드,제외할 메모'};});
  const a=await fetchSheetRows();await fetchSheetRows();
  assert.notEqual(calls[0].url.href,calls[1].url.href);
  for(const {url,options} of calls){assert.equal(url.searchParams.get('sheet'),'현재진행업체NEW');assert.equal(url.searchParams.get('range'),'A1:G50');assert.equal(options.cache,'no-store');}
  assert.equal(a[1][6],'');
});
