const {app,BrowserWindow,Tray,Menu,nativeImage,ipcMain,dialog,shell}=require('electron');
const {fork}=require('node:child_process');
const {randomBytes,randomUUID}=require('node:crypto');
const {join,basename}=require('node:path');
const {existsSync,mkdirSync,mkdtempSync,readFileSync}=require('node:fs');
const {tmpdir}=require('node:os');

const smoke=process.argv.includes('--smoke-test');
const smokeDir=smoke?(process.env.WAITINGLIST_SMOKE_DATA||mkdtempSync(join(tmpdir(),'waitinglist-smoke-'))):null;
if(smokeDir)app.setPath('userData',smokeDir);
app.setName('Waiting List');
app.setAppUserModelId('com.dongkyulab.waitinglist');
const locked=app.requestSingleInstanceLock();
if(!locked){app.quit();}else{
  let window,tray,child,origin,quitting=false,backupBusy=false;
  const token=randomBytes(32).toString('hex');
  const pending=new Map();
  const icon=()=>join(app.getAppPath(),'public','icons','icon-192.png');
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
    quitting=true;await stopBackend();tray?.destroy();
    app.exit(code);
  }
  function requestBackup(path){
    return new Promise((resolve,reject)=>{
      const id=randomUUID(),timer=setTimeout(()=>{pending.delete(id);reject(Error('백업 시간이 초과되었습니다.'));},15000);
      pending.set(id,{resolve,reject,timer});
      child.send({type:'backup',id,path});
    });
  }
  async function startBackend(){
    mkdirSync(join(app.getPath('userData'),'data'),{recursive:true});
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('데이터 서버가 시작되지 않았습니다.')),20000);
      child=fork(join(app.getAppPath(),'server','index.js'),[],{
        cwd:app.isPackaged?process.resourcesPath:app.getAppPath(),execPath:process.execPath,execArgv:['--use-env-proxy'],
        env:{...process.env,ELECTRON_RUN_AS_NODE:'1',WAITINGLIST_DESKTOP:'1',WAITINGLIST_TOKEN:token,WAITINGLIST_DIST:join(app.getAppPath(),'dist'),APP_PASSWORD:'',NODE_ENV:'production',PORT:'0',DATABASE_PATH:dbPath()},
        stdio:['ignore','pipe','pipe','ipc'],windowsHide:true
      });
      child.stdout.on('data',data=>console.log(String(data).trim()));
      child.stderr.on('data',data=>console.error(String(data).trim()));
      child.once('error',err=>{clearTimeout(timer);reject(err);});
      child.on('message',message=>{
        if(message.type==='ready'){clearTimeout(timer);origin=`http://127.0.0.1:${message.port}`;resolve();}
        if(message.type==='backup-result'){
          const item=pending.get(message.id);if(!item)return;clearTimeout(item.timer);pending.delete(message.id);
          if(message.ok)item.resolve({ok:true});else item.reject(Error(message.error));
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
    const response=await fetch(origin+'/api/companies',{method:'POST',headers,body:JSON.stringify({name:'설치 검증용 업체',startDate:'2026-10-19',mainKeyword:'검증 키워드',category:'검증 상품'})});
    if(response.status!==201)throw Error('Desktop create failed');
    const data=await(await fetch(origin+'/api/companies',{headers})).json();
    if(data.companies.length!==1||data.companies[0].endDate!=='2026-11-18'||data.companies[0].mainKeyword!=='검증 키워드')throw Error('Desktop data workflow failed');
    const backupPath=join(smokeDir,'backup.sqlite');await requestBackup(backupPath);
    if(!readFileSync(backupPath).subarray(0,16).equals(Buffer.from('SQLite format 3\0')))throw Error('Backup is invalid');
    const page=await window.webContents.executeJavaScript(`new Promise(resolve=>{let attempts=0;const inspect=()=>{const state={title:document.title,bridge:!!window.waitingListDesktop,heading:document.querySelector('h1')?.textContent};if(state.heading||++attempts>=100)resolve(state);else setTimeout(inspect,100);};inspect();})`);
    if(!page.title.includes('Waiting List')||!page.bridge||!page.heading)throw Error('Desktop window did not render: '+JSON.stringify(page));
    window.close();if(window.isDestroyed()||!child.connected)throw Error('Closing the window stopped the background process');
    show();console.log('DESKTOP_SMOKE_PASS: runtime SQLite, private API, derived dates, keywords, backup, isolated preload, window-to-tray behavior');
    await quit();
  }
  app.on('second-instance',show);
  app.on('window-all-closed',()=>{});
  app.on('activate',show);
  app.on('before-quit',event=>{if(!quitting){event.preventDefault();quit();}});
  app.whenReady().then(async()=>{
    await startBackend();
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
