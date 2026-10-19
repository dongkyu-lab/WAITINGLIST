import test from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {once} from 'node:events';
test('desktop cloud mode denies legacy data and all management APIs until Google authentication',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'waitinglist-cloud-gate-')),token=randomBytes(32).toString('hex');
  const child=fork('server/index.js',[],{env:{...process.env,WAITINGLIST_DESKTOP:'1',WAITINGLIST_REQUIRE_GOOGLE:'1',WAITINGLIST_TOKEN:token,WAITINGLIST_AUTO_SHEET:'0',PORT:'0',DATABASE_PATH:join(directory,'legacy.sqlite'),NODE_ENV:'production',APP_PASSWORD:''},stdio:['ignore','ignore','pipe','ipc']});
  t.after(async()=>{if(child.exitCode===null){child.send({type:'shutdown'});await once(child,'exit');}rmSync(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});});
  const {port}=await new Promise((resolve,reject)=>{child.on('message',m=>{if(m.type==='ready')resolve(m);});child.once('error',reject);child.once('exit',()=>reject(Error('Backend startup failed')));});
  const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'},base=`http://127.0.0.1:${port}/api`;
  const auth=await(await fetch(base+'/auth',{headers})).json();assert.equal(auth.provider,'google');assert.equal(auth.authenticated,false);assert.equal(auth.configured,false);
  for(const path of ['/companies','/notifications','/settings','/members','/legacy/preview'])assert.equal((await fetch(base+path,{headers})).status,401);
  for(const path of ['/companies','/sheet/read','/import','/members','/legacy/import'])assert.equal((await fetch(base+path,{method:'POST',headers,body:'{}'})).status,401);
  assert.equal((await fetch(base+'/login',{method:'POST',headers,body:'{"password":"anything"}'})).status,405);
});
