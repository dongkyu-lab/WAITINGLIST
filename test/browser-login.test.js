import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {request} from 'node:http';
const {createBrowserLogin}=createRequire(import.meta.url)('../desktop/browser-login.cjs');
const firebase={projectId:'demo-waitinglist',apiKey:'public-firebase-web-app-key'};
function assets(t){
  const dir=mkdtempSync(join(tmpdir(),'waitinglist-browser-login-'));
  mkdirSync(join(dir,'assets'));writeFileSync(join(dir,'index.html'),'<html>Browser login</html>');writeFileSync(join(dir,'assets','login.js'),'// bundled SDK');
  t.after(()=>rmSync(dir,{recursive:true,force:true}));return dir;
}
test('JSON-free login serves only public settings; one-use credential handoff requires session path and same origin',async t=>{
  let opened;
  const ready=new Promise(resolve=>opened=resolve),manager=createBrowserLogin({assetsPath:assets(t),openExternal:async url=>opened(new URL(url))});
  t.after(()=>manager.cancel());
  const pending=manager.login(firebase),url=await ready;
  assert.equal(url.hostname,'localhost');assert.match(url.pathname,/^\/[a-f0-9]{64}\/$/);
  assert.equal((await fetch(url)).status,200);
  const config=await(await fetch(new URL('config',url))).json();
  assert.deepEqual(config,{...firebase,authDomain:'demo-waitinglist.firebaseapp.com'});
  assert.equal((await fetch(new URL('/api/companies',url))).status,404);
  assert.equal((await fetch(new URL('/wrong/config',url))).status,404);
  const headers={'Content-Type':'application/json',Origin:url.origin},complete=new URL('complete',url);
  assert.equal((await fetch(complete,{method:'POST',headers:{...headers,Origin:'https://attacker.invalid'},body:'{"accessToken":"injected"}'})).status,403);
  assert.equal((await fetch(complete,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"accessToken":"injected"}'})).status,403);
  assert.equal((await fetch(complete,{method:'POST',headers,body:'{"accessToken":""}'})).status,400);
  assert.equal((await fetch(complete,{method:'POST',headers,body:'not json'})).status,400);
  assert.equal((await fetch(complete,{method:'POST',headers,body:JSON.stringify({accessToken:'x'.repeat(17000)})})).status,413);
  // A forged DNS name cannot address this service even from a local socket.
  const rebinding=await new Promise((resolve,reject)=>{const r=request({host:'127.0.0.1',port:url.port,path:url.pathname,headers:{Host:'attacker.invalid:'+url.port}},res=>{res.resume();resolve(res.statusCode);});r.on('error',reject);r.end();});
  assert.equal(rebinding,403);
  const response=await fetch(complete,{method:'POST',headers,body:'{"accessToken":"google-access-token"}'});
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{received:true});assert.equal(await pending,'google-access-token');
  await assert.rejects(fetch(url));
});
test('JSON-free login cancellation and expiry close the loopback server and permit a fresh session',async t=>{
  const urls=[];let opened;
  let ready=new Promise(resolve=>opened=resolve);
  const manager=createBrowserLogin({assetsPath:assets(t),timeoutMs:1000,openExternal:async url=>{urls.push(url);opened();}});
  t.after(()=>manager.cancel());
  const pending=manager.login(firebase);await ready;
  await assert.rejects(manager.login(firebase),/이미 진행/);manager.cancel();await assert.rejects(pending,/취소/);
  await assert.rejects(fetch(urls[0]));
  ready=new Promise(resolve=>opened=resolve);const next=manager.login(firebase);await ready;
  assert.notEqual(new URL(urls[0]).pathname,new URL(urls[1]).pathname);
  await assert.rejects(next,/시간/);await assert.rejects(fetch(urls[1]));
});
test('failure to launch the system browser cannot leave a login session running',async t=>{
  const manager=createBrowserLogin({assetsPath:assets(t),openExternal:async()=>{throw Error('browser failed');}});
  await assert.rejects(manager.login(firebase),/브라우저/);
});
