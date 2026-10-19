import test from 'node:test';
import assert from 'node:assert/strict';
import {doc,setDoc,serverTimestamp,getDocFromServer,disableNetwork,enableNetwork} from 'firebase/firestore';
import {FirebaseWorkspace} from '../server/firebase-workspace.js';
const enabled=Boolean(process.env.WAITINGLIST_FIREBASE_EMULATOR_TEST);
const config={firebase:{projectId:'demo-waitinglist',apiKey:'fake-api-key-for-testing-only'},workspaceId:'waitinglist'};
const emulator={auth:'http://127.0.0.1:9099',firestore:'http://127.0.0.1:8085'};
function googleToken(email){const b=v=>Buffer.from(JSON.stringify(v)).toString('base64url');return b({alg:'none',typ:'JWT'})+'.'+b({sub:email,email,email_verified:true,name:email.split('@')[0],iss:'https://accounts.google.com',aud:'test',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})+'.';}
async function waitFor(check,message){for(let i=0;i<100;i++){if(await check())return;await new Promise(resolve=>setTimeout(resolve,50));}throw Error(message);}

test('real Firebase emulators: different Google accounts share data; rules, conflicts, deletions and read state are enforced',{skip:!enabled,timeout:60000},async t=>{
  await fetch('http://127.0.0.1:8085/emulator/v1/projects/demo-waitinglist/databases/(default)/documents',{method:'DELETE'});
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-waitinglist/accounts',{method:'DELETE'});
  const clients=[];const create=()=>{const w=new FirebaseWorkspace(config,{emulator});clients.push(w);return w;};
  t.after(async()=>{await Promise.all(clients.map(c=>c.close()));});
  const firstOutsider=create();await assert.rejects(firstOutsider.login(null,{googleIdToken:googleToken('first-outsider@example.test')}));
  const owner=create();await owner.login(null,{googleIdToken:googleToken('owner@example.test')});assert.equal(owner.profile.role,'owner');
  await t.test('unregistered Google account cannot read shared company data',async()=>{
    const outsider=create();await assert.rejects(outsider.login(null,{googleIdToken:googleToken('outsider@example.test')}));assert.equal(outsider.profile,null);
  });
  await owner.addMember('editor@example.test');
  const editor=create();await editor.login(null,{googleIdToken:googleToken('editor@example.test')});assert.equal(editor.profile.role,'editor');
  await t.test('two different users see adds and edits without manual import, including derived +30 day dates',async()=>{
    const {id}=await owner.add({name:'공유 업체',startDate:'2026-10-19',notes:'PC A 메모',category:'상품',mainKeyword:'키워드'});
    await waitFor(()=>editor.companies().some(c=>c.id===id),'New company did not sync');
    const c=editor.companies().find(c=>c.id===id);assert.equal(c.notes,'PC A 메모');assert.equal(c.endDate,'2026-11-18');
    await editor.update(id,{...c,notes:'PC B 수정',startDate:'2026-11-01'});
    await waitFor(()=>owner.companies().find(c=>c.id===id)?.notes==='PC B 수정','Edit did not sync');
    assert.equal(owner.companies().find(c=>c.id===id).endDate,'2026-12-01');
    await assert.rejects(owner.update(id,{...c,notes:'오래된 화면 덮어쓰기'}),e=>e.status===409);
  });
  await t.test('server rules reject arbitrary revision overwrite, privilege escalation and owner removal',async()=>{
    await assert.rejects(setDoc(editor.ref('members/outsider@example.test'),{email:'outsider@example.test',role:'editor',createdAt:serverTimestamp()}));
    await assert.rejects(setDoc(editor.ref('members/editor@example.test'),{email:'editor@example.test',role:'owner',createdAt:serverTimestamp()}));
    const c=editor.companies()[0];await assert.rejects(setDoc(editor.ref('companies/'+c.id),{name:'invalid',version:1}));
    await assert.rejects(owner.removeMember('owner@example.test'));
  });
  await t.test('sheet repeat imports preserve edits, exclude notes, and do not restore deletions',async()=>{
    const source=[{name:'시트 업체',startDate:'2026-10-01',notes:'원본 메모 제외',category:'원본 상품'}];
    const imported=await owner.importCompanies([...source,...source]);assert.equal(imported.added,1);assert.equal(imported.skipped,1);await waitFor(()=>editor.companies().some(c=>c.name==='시트 업체'),'Source did not sync');
    const c=editor.companies().find(c=>c.name==='시트 업체');assert.equal(c.notes,'');await editor.update(c.id,{...c,name:'수정한 이름',notes:'보존할 메모'});
    await waitFor(()=>owner.companies().some(c=>c.notes==='보존할 메모'),'Memo did not sync');
    assert.equal((await owner.importCompanies(source)).added,0);
    const current=owner.companies().find(c=>c.notes==='보존할 메모');await owner.remove(current.id,current);
    await waitFor(()=>!editor.companies().some(c=>c.id===current.id),'Delete did not sync');
    assert.equal((await owner.importCompanies(source)).added,0);assert.equal((await owner.importCompanies([{...source[0],startDate:'2026-10-02'}])).added,0);
  });
  await t.test('offline writes are blocked and reconnect restores the live view',async()=>{
    await disableNetwork(editor.db);await waitFor(()=>!editor.online,'Offline state not visible');
    await assert.rejects(editor.add({name:'오프라인 추가'}),e=>e.code==='offline');await enableNetwork(editor.db);await waitFor(()=>editor.online,'Reconnect did not complete');
  });
  await t.test('explicit legacy transfer preserves local memos and skips newer shared edits',async()=>{
    const existing=owner.companies()[0];
    const result=await owner.importLegacy([{...existing,notes:'덮어쓰면 안 되는 이전 메모'},{name:'이전 PC 업체',startDate:'2026-10-19',notes:'이전 PC 직접 작성 메모'}]);
    assert.equal(result.skipped,1);assert.equal(result.added,1);
    await waitFor(()=>editor.companies().some(c=>c.name==='이전 PC 업체'),'Legacy data did not sync');
    assert.equal(editor.companies().find(c=>c.name==='이전 PC 업체').notes,'이전 PC 직접 작성 메모');
    assert.equal(owner.companies().find(c=>c.id===existing.id).notes,'PC B 수정');
    await assert.rejects(editor.importLegacy([{name:'권한 없음'}]));
  });
  await t.test('notification slot is unique across PCs and read status follows the same Google account only',async()=>{
    await owner.add({name:'알림 대상',startDate:'2026-10-01'});await waitFor(()=>editor.companies().some(c=>c.name==='알림 대상'),'Notification target did not sync');
    const now=new Date('2026-10-25T00:00:00Z');await Promise.all([owner.tick(now),editor.tick(now)]);
    await waitFor(()=>owner.notifications().length===1&&editor.notifications().length===1,'Notification did not sync');
    assert.equal(owner.notifications()[0].companies.find(c=>c.name==='알림 대상').days,6);
    await owner.markNotificationsRead();await waitFor(()=>owner.notifications()[0].readAt,'Read state did not update');assert.equal(editor.notifications()[0].readAt,null);
    const second=create();await second.login(null,{googleIdToken:googleToken('owner@example.test')});await waitFor(()=>second.notifications()[0]?.readAt,'Same-account read state did not sync');
  });
  await t.test('removing an editor immediately locks their open PC and prevents API access',async()=>{
    await owner.removeMember('editor@example.test');await waitFor(()=>editor.profile===null,'Removed member stayed logged in');
    await assert.rejects(editor.add({name:'권한 해제 이후'}));
  });
});
