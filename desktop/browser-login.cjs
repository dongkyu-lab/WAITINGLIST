const {createServer}=require('node:http');
const {randomBytes}=require('node:crypto');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');

// The system browser runs Firebase's public web sign-in. Only the short-lived
// Google credential crosses this one-use loopback connection; the private app
// API and Firebase session stay in the desktop process.
function createBrowserLogin({openExternal,assetsPath,timeoutMs=180000}={}){
  let active=null;
  return {
    cancel(){active?.cancel();},
    async login(firebase){
      if(active)throw Error('Google 로그인이 이미 진행 중입니다. 브라우저에서 완료해 주세요.');
      const session='/'+randomBytes(32).toString('hex')+'/',authDomain=firebase.projectId+'.firebaseapp.com';
      const html=readFileSync(join(assetsPath,'index.html'));
      return new Promise((resolve,reject)=>{
        let server,timer,origin,settled=false;
        function finish(error,value){
          if(settled)return;settled=true;clearTimeout(timer);server?.close();server?.closeIdleConnections();if(error)server?.closeAllConnections();active=null;
          if(error)reject(error);else resolve(value);
        }
        active={cancel:()=>finish(Error('Google 로그인을 취소했습니다.'))};
        server=createServer(async(req,res)=>{
          res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
          res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');
          res.setHeader('Content-Security-Policy',`default-src 'none'; script-src 'self' https://apis.google.com https://www.gstatic.com; style-src 'self'; connect-src 'self' https://*.googleapis.com https://apis.google.com https://${authDomain}; frame-src https://${authDomain}; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`);
          // Host validation prevents DNS rebinding. Fetch metadata and the
          // Origin check also reject requests initiated by another website.
          if(!origin||req.headers.host!==new URL(origin).host||req.headers['sec-fetch-site']==='cross-site'){
            res.writeHead(403);res.end();return;
          }
          const path=req.url;
          if(req.method==='GET'&&path===session){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
          if(req.method==='GET'&&path===session+'config'){
            res.setHeader('Content-Type','application/json');res.end(JSON.stringify({apiKey:firebase.apiKey,projectId:firebase.projectId,authDomain}));return;
          }
          if(req.method==='GET'&&/^\/assets\/[A-Za-z0-9_.-]+\.(js|css|png)$/.test(path)){
            try{const content=readFileSync(join(assetsPath,path.slice(1)));res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'image/png');res.end(content);}catch{res.writeHead(404);res.end();}return;
          }
          if(req.method!=='POST'||path!==session+'complete'){res.writeHead(404);res.end();return;}
          if(req.headers.origin!==origin||req.headers['content-type']!=='application/json'){
            res.writeHead(403);res.end();return;
          }
          let body='',size=0;
          try{
            for await(const chunk of req){size+=chunk.length;if(size>16000){res.writeHead(413);res.end();return;}body+=chunk.toString('utf8');}
            if(settled){res.writeHead(410);res.end();return;}
            const {accessToken}=JSON.parse(body);
            if(typeof accessToken!=='string'||!accessToken.trim()||accessToken.length>12000){res.writeHead(400);res.end();return;}
            res.setHeader('Content-Type','application/json');res.end('{"received":true}');
            finish(null,accessToken);
          }catch{if(!res.writableEnded){res.writeHead(400);res.end();}}
        });
        server.headersTimeout=10000;server.requestTimeout=15000;server.keepAliveTimeout=1000;
        server.on('error',()=>finish(Error('Google 로그인 연결을 열지 못했습니다.')));
        // localhost is the Firebase authorized domain. Bind only to IPv4
        // loopback; Windows browsers retry IPv4 if localhost resolves to ::1.
        server.listen(0,'127.0.0.1',async()=>{
          origin='http://localhost:'+server.address().port;
          try{await openExternal(origin+session);}catch{finish(Error('기본 브라우저에서 Google 로그인을 열지 못했습니다.'));}
        });
        timer=setTimeout(()=>finish(Error('Google 로그인 시간이 지났습니다. 다시 시도해 주세요.')),timeoutMs);
      });
    }
  };
}
module.exports={createBrowserLogin};
