const {createServer}=require('node:http');
const {randomBytes,createHash,timingSafeEqual}=require('node:crypto');

function createGoogleLogin({openExternal,fetchImpl=fetch,timeoutMs=180000}={}){
  let active=null;
  return {
    cancel(){active?.cancel();},
    async login(config){
      if(!config.client_secret)throw Error('Google에서 내려받은 데스크톱 OAuth JSON을 먼저 선택해 주세요.');
      if(active)throw Error('Google 로그인이 이미 진행 중입니다. 브라우저에서 완료해 주세요.');
      const verifier=randomBytes(48).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url'),state=randomBytes(32).toString('base64url');
      let server,timer,redirect,settled=false;
      const code=await new Promise((resolve,reject)=>{
        function finish(error,value){if(settled)return;settled=true;clearTimeout(timer);server?.close();active=null;if(error)reject(error);else resolve(value);}
        active={cancel:()=>finish(Error('Google 로그인을 취소했습니다.'))};
        server=createServer((req,res)=>{
          const url=new URL(req.url,'http://127.0.0.1');
          if(req.method!=='GET'||url.pathname!=='/oauth/callback'){res.writeHead(404);res.end();return;}
          res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'");
          const returned=Buffer.from(url.searchParams.get('state')||''),expected=Buffer.from(state);
          if(returned.length!==expected.length||!timingSafeEqual(returned,expected)){res.writeHead(400);res.end('Invalid login state. Return to Waiting List.');return;}
          const error=url.searchParams.get('error'),value=url.searchParams.get('code');
          res.setHeader('Content-Type','text/html; charset=utf-8');
          res.end('<!doctype html><html lang="ko"><meta charset="utf-8"><title>Waiting List</title><body style="font-family:system-ui;padding:48px;color:#111">'+(error||!value?'로그인이 취소되었습니다.':'Google 인증을 받았습니다. Waiting List 프로그램으로 돌아가 주세요.')+'</body></html>');
          if(error||!value)finish(Error('Google 로그인을 취소했거나 완료하지 못했습니다.'));else finish(null,value);
        });
        server.on('error',()=>finish(Error('Google 로그인 연결을 열지 못했습니다.')));
        server.listen(0,'127.0.0.1',async()=>{
          redirect=`http://127.0.0.1:${server.address().port}/oauth/callback`;
          const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
          url.search=new URLSearchParams({client_id:config.client_id,redirect_uri:redirect,response_type:'code',scope:'openid email profile',code_challenge:challenge,code_challenge_method:'S256',state,prompt:'select_account'}).toString();
          try{await openExternal(url.toString());}catch{finish(Error('기본 브라우저에서 Google 로그인을 열지 못했습니다.'));}
        });
        timer=setTimeout(()=>finish(Error('Google 로그인 시간이 지났습니다. 다시 시도해 주세요.')),timeoutMs);
      });
      let response;
      try{response=await fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.client_id,...(config.client_secret?{client_secret:config.client_secret}:{}),code,code_verifier:verifier,redirect_uri:redirect,grant_type:'authorization_code'}),signal:AbortSignal.timeout(20000)});}catch{throw Error('Google 인증 서버에 연결하지 못했습니다.');}
      const data=await response.json().catch(()=>({}));
      if(!response.ok||typeof data.access_token!=='string')throw Error('Google 인증을 완료하지 못했습니다. OAuth 클라이언트 설정을 확인해 주세요.');
      return data.access_token;
    }
  };
}
module.exports={createGoogleLogin};
