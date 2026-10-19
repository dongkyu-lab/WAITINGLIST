import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('install manifest contains real PNG assets with matching dimensions',()=>{
  const manifest=JSON.parse(readFileSync('public/manifest.webmanifest','utf8'));
  assert.equal(manifest.display,'standalone');
  assert.equal(manifest.scope,'/');
  assert.equal(manifest.start_url,'/');
  assert.equal(manifest.theme_color,'#18aaa8');
  for(const icon of manifest.icons){
    const bytes=readFileSync('public'+icon.src);
    assert.equal(bytes.subarray(1,4).toString(),'PNG');
    assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`,icon.sizes);
  }
});

test('service worker excludes customer APIs, mutations and other origins; offline navigation has a fallback',async()=>{
  const events={},offline={offline:true},removed=[];
  let cached=[];
  runInNewContext(readFileSync('public/sw.js','utf8'),{
    URL,fetch:async()=>{throw Error('offline');},
    self:{location:{origin:'https://flow.example'},addEventListener:(name,fn)=>events[name]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}},
    caches:{open:async()=>({addAll:async files=>{cached=files;}}),keys:async()=>['flow-offline-v1','other-app-cache'],delete:async key=>removed.push(key),match:async path=>path==='/offline.html'?offline:undefined}
  });
  let work;events.install({waitUntil:p=>work=p});await work;
  assert.ok(cached.includes('/offline.html'));
  assert.ok(cached.every(p=>!p.startsWith('/api')));
  events.activate({waitUntil:p=>work=p});await work;
  assert.deepEqual(removed,['flow-offline-v1']);
  for(const request of [
    {url:'https://flow.example/api/companies',method:'GET'},
    {url:'https://flow.example/api/auth',method:'GET'},
    {url:'https://flow.example/api/companies',method:'POST'},
    {url:'https://other.example/',method:'GET',mode:'navigate'}
  ]) events.fetch({request,respondWith:()=>assert.fail('Sensitive request was intercepted')});
  let response;events.fetch({request:{url:'https://flow.example/',method:'GET',mode:'navigate'},respondWith:p=>response=p});
  assert.equal(await response,offline);
});
