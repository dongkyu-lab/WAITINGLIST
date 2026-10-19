import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {validateCloudConfig,resolveDesktopSetup,ownerAccessRules} from '../server/cloud-config.js';
import {readFileSync} from 'node:fs';
const {createGoogleLogin}=createRequire(import.meta.url)('../desktop/google-login.cjs');
const google={client_id:'123456-example.apps.googleusercontent.com',client_secret:'installed-public-client-secret'};

test('native Google OAuth uses system browser, state, PKCE and loopback; credentials never go in the authorization URL',async()=>{
  let authorization;
  const login=createGoogleLogin({openExternal:async value=>{
    authorization=new URL(value);assert.equal(authorization.origin,'https://accounts.google.com');
    assert.equal(authorization.searchParams.get('code_challenge_method'),'S256');
    assert.equal(authorization.searchParams.get('scope'),'openid email profile');
    assert.equal(authorization.searchParams.has('client_secret'),false);
    const callback=new URL(authorization.searchParams.get('redirect_uri'));
    assert.equal(callback.hostname,'127.0.0.1');
    callback.search=new URLSearchParams({state:'wrong-state',code:'stolen'});assert.equal((await fetch(callback)).status,400);
    callback.search=new URLSearchParams({state:authorization.searchParams.get('state'),code:'verified-code'});assert.equal((await fetch(callback)).status,200);
  },fetchImpl:async(url,options)=>{
    assert.equal(url,'https://oauth2.googleapis.com/token');const body=options.body;
    assert.equal(body.get('code'),'verified-code');assert.equal(body.get('client_secret'),google.client_secret);
    assert.equal(createHash('sha256').update(body.get('code_verifier')).digest('base64url'),authorization.searchParams.get('code_challenge'));
    return {ok:true,json:async()=>({access_token:'test-access-token'})};
  }});
  assert.equal(await login.login(google),'test-access-token');
});
test('cancelled native login closes the callback listener and cannot silently sign in',async()=>{
  let ready;const opened=new Promise(resolve=>ready=resolve);
  const manager=createGoogleLogin({openExternal:async()=>ready(),timeoutMs:1000});
  const pending=manager.login(google);await opened;
  await assert.rejects(manager.login(google),/이미 진행/);manager.cancel();await assert.rejects(pending,/취소/);
});
test('cloud configuration accepts only project identifiers and fixed Google OAuth clients',()=>{
  const config={firebase:{projectId:'demo-waitinglist',apiKey:'not-a-secret-public-test-api-key'},google,workspaceId:'waitinglist'};
  assert.equal(validateCloudConfig(config).workspaceId,'waitinglist');
  assert.throws(()=>validateCloudConfig({...config,firebase:{...config.firebase,projectId:'https://attacker.invalid'}}));
  assert.throws(()=>validateCloudConfig({...config,google:{client_id:'https://attacker.invalid'}}));
  assert.throws(()=>validateCloudConfig({...config,workspaceId:'../other'}));
  assert.equal(validateCloudConfig({...config,emulatorOrigin:'http://attacker.invalid'}).emulatorOrigin,undefined);
});
test('downloaded Desktop OAuth JSON merges only into the expected public app configuration',()=>{
  const defaults={firebase:{projectId:'demo-waitinglist',apiKey:'not-a-secret-public-test-api-key'},google:{client_id:google.client_id},workspaceId:'waitinglist'};
  const result=resolveDesktopSetup({installed:{...google,project_id:'demo-waitinglist',token_uri:'https://untrusted.invalid/token'}},defaults);
  assert.equal(result.firebase.projectId,'demo-waitinglist');assert.equal(result.google.client_secret,google.client_secret);assert.equal(result.google.token_uri,undefined);
  assert.throws(()=>resolveDesktopSetup({installed:{...google,project_id:'wrong-project'}},defaults));
  assert.throws(()=>resolveDesktopSetup({installed:{...google,client_id:'123456-other.apps.googleusercontent.com'}},defaults));
  assert.throws(()=>resolveDesktopSetup({...defaults,google:{client_id:google.client_id}},defaults),/OAuth JSON/);
});
test('an owner-specific copy preserves the deny-by-default access rules without changing the shared template',()=>{
  const template=readFileSync('cloud/firestore.rules','utf8'),result=ownerAccessRules(template,' OWNER@EXAMPLE.TEST ');
  assert.ok(result.includes('email() == "owner@example.test"'));assert.ok(!result.includes('SET_OWNER_EMAIL_BEFORE_DEPLOYING'));
  assert.ok(template.includes('SET_OWNER_EMAIL_BEFORE_DEPLOYING'));assert.ok(result.includes('function member('));
  assert.throws(()=>ownerAccessRules(template,'invalid-email'));assert.throws(()=>ownerAccessRules('missing placeholder','owner@example.test'));
});
test('missing desktop OAuth credentials fail before opening a Google sign-in window',async()=>{
  let opened=false;const manager=createGoogleLogin({openExternal:async()=>{opened=true;}});
  await assert.rejects(manager.login({client_id:google.client_id}),/OAuth JSON/);assert.equal(opened,false);
});
