const {app,BrowserWindow,Tray,Menu,nativeImage,ipcMain,dialog,shell,safeStorage,clipboard}=require('electron');
const {fork}=require('node:child_process');
const {randomBytes,randomUUID}=require('node:crypto');
const {join,basename}=require('node:path');
const {existsSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync,renameSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {createGoogleLogin}=require('./google-login.cjs');
// Public app identifiers only. OAuth secrets and tokens are never bundled here.
const projectDefaults=require('./project-defaults.json');

const smoke=process.argv.includes('--smoke-test');
const cloudSmoke=smoke&&process.argv.includes('--require-google-smoke');
const smokeDir=smoke?(process.env.WAITINGLIST_SMOKE_DATA||mkdtempSync(join(tmpdir(),'waitinglist-smoke-'))):null;
if(smokeDir){app.setPath('userData',smokeDir);writeFileSync(join(smokeDir,'sheet.json'),JSON.stringify([['플레이스 등 진행','연락처','시작날짜','종료날짜','마케팅 진행 상품','메인키워드','특이사항'],['자동 연결 검증업체','','26.10.01','','검증 상품','자동 키워드','가져오면 안 되는 원본 메모']]));}
app.setName('Waiting List');
app.setAppUserModelId('com.dongkyulab.waitinglist');
const locked=app.requestSingleInstanceLock();
if(!locked){app.quit();}else{
  let window,tray,child,origin,quitting=false,backupBusy=false,cloudConfig=null,googleBusy=false;
  const googleLogin=createGoogleLogin({openExternal:url=>shell.openExternal(url)});
  const token=randomBytes(32).toString('hex');
  const pending=new Map();
  const icon=()=>join(app.getAppPath(),'public','icons','icon-512.png');
  const dbPath=()=>join(app.getPath('userData'),'data','waitinglist.sqlite');
  function show(){if(!window)return;window.show();if(window.isMinimized())window.restore();window.focus();}
  function info(){return {version:app.getVersion(),autoStart:process.platform==='win32'?app.getLoginItemSettings({args:['--background']}).openAtLogin:false,canAutoStart:process.platform==='win32'&&app.isPackaged};}
  async function stopBackend(){
    if(!child||child.exitCode!==null)return;
    await new Promise(resolve=>{
      const timer=setTimeout(()=>{child.kill();resolve();},5000);
      child.once('exit',()=>{clearTimeout(timer);resolve();});
      if(child.connected)child.send({type:'shutdown'});else child.kill();
    });
  }
  async function quit(code=0){
    if(quitting)return;
    if(backupBusy&&!smoke){dialog.showMessageBox(window,{type:'info',message:'백업이 끝난 뒤 종료해 주세요.'});return;}
    quitting=true;googleLogin.cancel();await stopBackend();tray?.destroy();
    app.exit(code);
  }
  function requestBackup(path){
    return new Promise((resolve,reject)=>{
      const id=randomUUID(),timer=setTimeout(()=>{pending.delete(id);reject(Error('백업 시간이 초과되었습니다.'));},15000);
      pending.set(id,{resolve,reject,timer});
      child.send({type:'backup',id,path});
    });
  }
  function requestCloud(type,payload={}){
    return new Promise((resolve,reject)=>{
      const id=randomUUID(),timer=setTimeout(()=>{pending.delete(id);reject(Error('공유 서버 응답 시간이 지났습니다. 로그인 상태를 다시 확인해 주세요.'));},60000);
      pending.set(id,{resolve,reject,timer});child.send({type,id,...payload});
    });
  }
  async function startBackend(){
    mkdirSync(join(app.getPath('userData'),'data'),{recursive:true});
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('데이터 서버가 시작되지 않았습니다.')),20000);
      child=fork(join(app.getAppPath(),'server','index.js'),[],{
        cwd:app.isPackaged?process.resourcesPath:app.getAppPath(),execPath:process.execPath,execArgv:['--use-env-proxy'],
        env:{...process.env,ELECTRON_RUN_AS_NODE:'1',WAITINGLIST_DESKTOP:'1',WAITINGLIST_TOKEN:token,WAITINGLIST_REQUIRE_GOOGLE:smoke&&!cloudSmoke?'0':'1',WAITINGLIST_AUTO_SHEET:'1',WAITINGLIST_SMOKE_DATA:smokeDir||'',WAITINGLIST_SHEET_FIXTURE:smokeDir?join(smokeDir,'sheet.json'):'',WAITINGLIST_DIST:join(app.getAppPath(),'dist'),APP_PASSWORD:'',NODE_ENV:'production',PORT:'0',DATABASE_PATH:dbPath()},
        stdio:['ignore','pipe','pipe','ipc'],windowsHide:true
      });
      child.stdout.on('data',data=>console.log(String(data).trim()));
      child.stderr.on('data',data=>console.error(String(data).trim()));
      child.once('error',err=>{clearTimeout(timer);reject(err);});
      child.on('message',message=>{
        if(message.type==='ready'){clearTimeout(timer);origin=`http://127.0.0.1:${message.port}`;resolve();}
        if(message.type==='backup-result'||message.type==='cloud-result'){
          const item=pending.get(message.id);if(!item)return;clearTimeout(item.timer);pending.delete(message.id);
          if(message.ok)item.resolve(message.value||{ok:true});else item.reject(Error(message.error));
        }
      });
      child.once('exit',()=>{
        clearTimeout(timer);
        for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('데이터 서버가 종료되었습니다.'));}pending.clear();
        if(!quitting){reject(Error('데이터 서버가 종료되었습니다.'));if(window){dialog.showErrorBox('Waiting List','데이터 서버가 종료되었습니다. 프로그램을 다시 실행해 주세요.');quit(1);}}
      });
    });
  }
  async function runSmoke(){
    const headers={'Authorization':`Bearer ${token}`,'Content-Type':'application/json'};
    const denied=await fetch(origin+'/api/companies');if(denied.status!==401)throw Error('Private desktop API is unprotected');
    if(cloudSmoke){
      if(!readFileSync(join(app.getAppPath(),'cloud','firestore.rules'),'utf8').includes('SET_OWNER_EMAIL_BEFORE_DEPLOYING'))throw Error('Administrator access-rule template missing');
      const state=await(await fetch(origin+'/api/auth',{headers})).json();
      if(state.authenticated||state.provider!=='google')throw Error('Google login gate failed');
      if((await fetch(origin+'/api/companies',{headers})).status!==401)throw Error('Company data leaked before Google login');
      const page=await window.webContents.executeJavaScript(`new Promise(resolve=>{let attempts=0;const inspect=()=>{const h=document.querySelector('h1')?.textContent;if(h||++attempts>=100)resolve({h,button:document.querySelector('.google-sign-in')?.textContent});else setTimeout(inspect,100);};inspect();})`);
      if(!page.h?.includes('Google')||!page.button?.includes('Google'))throw Error('Google login screen did not render');
      const setup=await window.webContents.executeJavaScript('window.waitingListDesktop.getCloudSetup()');
      if(setup.projectId!==projectDefaults.firebase.projectId||setup.oauthReady)throw Error('Setup state exposed incomplete OAuth as ready');
      console.log('CLOUD_DESKTOP_SMOKE_PASS: Google login gate, denied data, local OAuth setup, packaged access-rule template');await quit();return;
    }
    const auto=await(await fetch(origin+'/api/companies',{headers})).json();if(auto.sheetAuto.status!=='success'||auto.companies.length!==1||auto.companies[0].notes!=='')throw Error('Automatic sheet startup read failed');
    const response=await fetch(origin+'/api/companies',{method:'POST',headers,body:JSON.stringify({name:'설치 검증용 업체',startDate:'2026-10-19',mainKeyword:'검증 키워드',category:'검증 상품'})});
    if(response.status!==201)throw Error('Desktop create failed');
    const data=await(await fetch(origin+'/api/companies',{headers})).json();
    const created=data.companies.find(c=>c.name==='설치 검증용 업체');
    if(data.companies.length!==2||created?.endDate!=='2026-11-18'||created?.mainKeyword!=='검증 키워드')throw Error('Desktop data workflow failed');
    const backupPath=join(smokeDir,'backup.sqlite');await requestBackup(backupPath);
    if(!readFileSync(backupPath).subarray(0,16).equals(Buffer.from('SQLite format 3\0')))throw Error('Backup is invalid');
    const page=await window.webContents.executeJavaScript(`new Promise(resolve=>{let attempts=0;const inspect=()=>{const state={title:document.title,bridge:!!window.waitingListDesktop,heading:document.querySelector('h1')?.textContent};if(state.heading||++attempts>=100)resolve(state);else setTimeout(inspect,100);};inspect();})`);
    if(!page.title.includes('Waiting List')||!page.bridge||!page.heading)throw Error('Desktop window did not render: '+JSON.stringify(page));
    window.close();if(window.isDestroyed()||!child.connected)throw Error('Closing the window stopped the background process');
    show();console.log('DESKTOP_SMOKE_PASS: automatic sheet startup import, excluded notes, runtime SQLite, private API, derived dates, keywords, backup, isolated preload, window-to-tray behavior');
    await quit();
  }
  app.on('second-instance',show);
  app.on('window-all-closed',()=>{});
  app.on('activate',show);
  app.on('before-quit',event=>{if(!quitting){event.preventDefault();quit();}});
  app.whenReady().then(async()=>{
    await startBackend();
    if(!smoke){
      const saved=join(app.getPath('userData'),'cloud-config.bin'),bundled=join(__dirname,'cloud-config.json');
      try{
        const {validateCloudConfig}=await import('../server/cloud-config.js');
        if(existsSync(saved)&&safeStorage.isEncryptionAvailable())cloudConfig=validateCloudConfig(JSON.parse(safeStorage.decryptString(readFileSync(saved))));
        else if(existsSync(bundled))cloudConfig=validateCloudConfig(JSON.parse(readFileSync(bundled,'utf8')));
        if(cloudConfig?.google.client_secret)await requestCloud('cloud-configure',{config:cloudConfig});else cloudConfig=null;
      }catch{cloudConfig=null;console.error('공유 연결 설정을 다시 등록해 주세요.');}
    }
    window=new BrowserWindow({width:1440,height:960,minWidth:1050,minHeight:720,show:false,title:'Waiting List',icon:icon(),backgroundColor:'#f4f8f8',webPreferences:{preload:join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,partition:'waitinglist-desktop'}});
    window.removeMenu();
    window.webContents.session.webRequest.onBeforeSendHeaders({urls:[origin+'/*']},(details,callback)=>callback({requestHeaders:{...details.requestHeaders,Authorization:`Bearer ${token}`}}));
    window.webContents.session.setPermissionRequestHandler((_,__,callback)=>callback(false));
    window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    window.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin)event.preventDefault();});
    window.webContents.on('will-attach-webview',event=>event.preventDefault());
    window.webContents.session.on('will-download',(_,item)=>item.setSaveDialogOptions({defaultPath:join(app.getPath('downloads'),basename(item.getFilename()))}));
    window.on('close',event=>{if(!quitting){event.preventDefault();window.hide();}});
    const image=nativeImage.createFromPath(icon());
    tray=new Tray(process.platform==='win32'?image.resize({width:16,height:16}):image.resize({width:22,height:22}));
    tray.setToolTip('Waiting List · 백그라운드 실행 중');
    tray.setContextMenu(Menu.buildFromTemplate([{label:'Waiting List 열기',click:show},{type:'separator'},{label:'프로그램 종료',click:()=>quit()}]));
    tray.on('double-click',show);
    ipcMain.handle('desktop:info',()=>info());
    ipcMain.handle('desktop:cloud-setup',()=>({projectId:cloudConfig?.firebase.projectId||projectDefaults.firebase.projectId,oauthReady:Boolean(cloudConfig?.google.client_secret)}));
    ipcMain.handle('desktop:oauth-clients',()=>shell.openExternal(`https://console.cloud.google.com/auth/clients?project=${projectDefaults.firebase.projectId}`));
    ipcMain.handle('desktop:copy-access-rules',async(_,email)=>{
      const {ownerAccessRules}=await import('../server/cloud-config.js');
      const rules=ownerAccessRules(readFileSync(join(app.getAppPath(),'cloud','firestore.rules'),'utf8'),email);
      const projectId=cloudConfig?.firebase.projectId||projectDefaults.firebase.projectId;
      clipboard.writeText(rules);
      await shell.openExternal(`https://console.firebase.google.com/project/${projectId}/firestore/rules`);
      return {copied:true};
    });
    ipcMain.handle('desktop:google-login',async()=>{
      if(!cloudConfig)throw Error('먼저 공유 연결 설정파일을 등록해 주세요.');
      if(googleBusy)throw Error('Google 로그인이 이미 진행 중입니다.');
      googleBusy=true;try{const accessToken=await googleLogin.login(cloudConfig.google);return await requestCloud('cloud-login',{accessToken});}finally{googleBusy=false;}
    });
    ipcMain.handle('desktop:configure-cloud',async()=>{
      if(googleBusy)throw Error('Google 로그인이 끝난 뒤 설정을 바꿔 주세요.');
      const {canceled,filePaths}=await dialog.showOpenDialog(window,{title:'Google에서 내려받은 데스크톱 OAuth JSON 선택',filters:[{name:'Google 데스크톱 OAuth / 공유 연결 설정',extensions:['json']}],properties:['openFile']});
      if(canceled)return {canceled:true};
      const raw=readFileSync(filePaths[0]);if(raw.length>20000)throw Error('20KB 이하의 공유 연결 설정파일을 선택해 주세요.');
      const {resolveDesktopSetup}=await import('../server/cloud-config.js');
      let parsed;try{parsed=JSON.parse(raw.toString('utf8'));}catch{throw Error('올바른 JSON 연결 설정파일이 아닙니다.');}
      const config=resolveDesktopSetup(parsed,projectDefaults);
      if(!safeStorage.isEncryptionAvailable())throw Error('이 PC에서 연결 설정을 안전하게 저장할 수 없습니다. Windows 계정 보안 설정을 확인해 주세요.');
      const status=await requestCloud('cloud-configure',{config});
      const destination=join(app.getPath('userData'),'cloud-config.bin');
      writeFileSync(destination+'.tmp',safeStorage.encryptString(JSON.stringify(config)),{mode:0o600});renameSync(destination+'.tmp',destination);cloudConfig=config;return status;
    });
    ipcMain.handle('desktop:cloud-guide',()=>shell.openExternal('https://github.com/dongkyu-lab/WAITINGLIST/blob/main/CLOUD-SETUP.md'));
    ipcMain.handle('desktop:auto-start',(_,value)=>{
      if(typeof value!=='boolean'||!info().canAutoStart)throw Error('윈도우 설치 버전에서 사용할 수 있습니다.');
      app.setLoginItemSettings({openAtLogin:value,args:['--background']});return info();
    });
    ipcMain.handle('desktop:open-data-folder',()=>shell.openPath(join(app.getPath('userData'),'data')));
    ipcMain.handle('desktop:backup',async()=>{
      if(backupBusy)throw Error('이미 백업 중입니다.');
      const {canceled,filePath}=await dialog.showSaveDialog(window,{title:'Waiting List 전체 데이터 백업',defaultPath:`WaitingList-backup-${new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}.sqlite`,filters:[{name:'Waiting List 데이터베이스',extensions:['sqlite']}]});
      if(canceled)return {canceled:true};
      if(existsSync(filePath))throw Error('새 파일 이름을 선택해 주세요. 기존 백업은 덮어쓰지 않습니다.');
      backupBusy=true;try{await requestBackup(filePath);return {ok:true};}finally{backupBusy=false;}
    });
    await window.loadURL(origin);
    if(smoke)await runSmoke();else if(!process.argv.includes('--background'))show();
  }).catch(async error=>{console.error(error.message);if(!smoke)dialog.showErrorBox('Waiting List 실행 오류',error.message);await quit(1);});
}
