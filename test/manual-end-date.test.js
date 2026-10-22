import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {cleanCompany,changedCompany,insertCompany} from '../server/company-data.js';
import {openStore} from '../server/store.js';
import {statusFor} from '../server/dates.js';
import {notificationTargets} from '../server/scheduler.js';
test('manual end dates drive status and notifications; unrelated edits preserve them and start edits reset to +30',()=>{
  const manual=cleanCompany({name:'직접 지정 업체',startDate:'2026-10-01',endDate:'2026-10-25'});
  assert.equal(statusFor(manual.endDate,'2026-10-22'),'urgent');assert.equal(notificationTargets([manual],'2026-10-22').length,1);
  assert.equal(changedCompany(manual,{notes:'메모 수정'}).endDate,'2026-10-25');
  assert.equal(changedCompany(manual,{...manual,startDate:'2026-10-02'}).endDate,'2026-11-01');
  assert.equal(changedCompany(manual,{...manual,startDate:'2026-10-02',endDateEdited:true}).endDate,'2026-10-25');
  assert.equal(cleanCompany({...manual,endDate:''}).endDate,'');assert.equal(notificationTargets([{...manual,endDate:''}],'2026-10-22').length,0);
  assert.throws(()=>cleanCompany({...manual,endDate:'2026-02-30'}),/종료일/);
});
test('manual dates and notes survive SQLite restart without being recalculated by the old migration',()=>{
  const directory=mkdtempSync(join(tmpdir(),'waitinglist-manual-end-')),path=join(directory,'test.sqlite');let db;
  try{db=openStore(path);const id=insertCompany(db,cleanCompany({name:'수동 종료일',startDate:'2026-10-01',endDate:'2026-10-24',notes:'보존 메모'}));db.close();db=openStore(path);const c=db.prepare('SELECT * FROM companies WHERE id=?').get(id);assert.equal(c.endDate,'2026-10-24');assert.equal(c.notes,'보존 메모');}
  finally{db?.close();rmSync(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
