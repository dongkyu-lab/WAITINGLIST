import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {createAccessRetry}=createRequire(import.meta.url)('../desktop/access-retry.cjs');
test('after denial, retry performs a fresh server permission check and clears the credential only on success',async()=>{
  let allowed=false,calls=0;const manager=createAccessRetry({connect:async credential=>{calls++;assert.equal(credential,'google-credential');if(!allowed)throw Object.assign(Error('not allowed'),{status:403});return {authenticated:true};}});
  manager.remember('google-credential');await assert.rejects(manager.retry());assert.equal(manager.available(),true);
  allowed=true;assert.deepEqual(await manager.retry(),{authenticated:true});assert.equal(calls,2);assert.equal(manager.available(),false);
  await assert.rejects(manager.retry(),/다시 로그인/);
});
test('expired or invalid Google authentication cannot be reused to bypass sign-in',async()=>{
  let now=0,calls=0;const manager=createAccessRetry({now:()=>now,ttlMs:1000,connect:async()=>{calls++;throw Object.assign(Error('expired'),{status:401});}});
  manager.remember('expired');now=1001;await assert.rejects(manager.retry());assert.equal(calls,0);
  manager.remember('invalid');await assert.rejects(manager.retry());assert.equal(manager.available(),false);manager.clear();
});
