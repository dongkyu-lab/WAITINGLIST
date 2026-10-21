import {Router} from 'express';
import {createHash} from 'node:crypto';
import {join,dirname} from 'node:path';
import {FirebaseWorkspace,cloudError} from './firebase-workspace.js';
import {validateCloudConfig,CloudError} from './cloud-config.js';
import {openStore} from './store.js';
import {koreaClock} from './dates.js';
import {fetchSheetRows} from './auto-sheet.js';
import {sanitizeSheetRows,inferSheetMapping,companiesFromRows} from './sheet-data.js';
import {createSheetReviewStore,sheetFields} from './sheet-review.js';

export function createCloudAPI({legacyPath,legacyStore,workspaceFactory=config=>new FirebaseWorkspace(config),fetchRows=fetchSheetRows}={}){
  const router=Router();let config=null,workspace=null,db=null,sheetTimer=null,closed=false,loginBusy=false,epoch=0;
  let authError='',sheetState={enabled:true,status:'idle',lastSuccess:null,error:null,result:null},sheetRead=null;
  const reviews=createSheetReviewStore();
  const status=()=>({provider:'google',protected:true,authenticated:Boolean(workspace?.profile),configured:Boolean(config),user:workspace?.profile||null,error:authError});
  function syncLocal(companies){
    if(!db)return;db.exec('BEGIN');
    try{db.exec('DELETE FROM companies');const insert=db.prepare('INSERT INTO companies(id,name,category,mainKeyword,manager,contact,startDate,endDate,notes,existingEndDate,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
      for(const c of companies)insert.run(c.id,c.name,c.category,c.mainKeyword,c.manager,c.contact,c.startDate,c.endDate,c.notes,c.existingEndDate,c.createdAt,c.updatedAt);
      for(const n of workspace?.notifications()||[])db.prepare('INSERT OR REPLACE INTO notifications(slot,payload,createdAt,readAt) VALUES(?,?,?,?)').run(n.slot,JSON.stringify(n.companies),n.createdAt,n.readAt);
      db.exec('COMMIT');
    }catch(e){db.exec('ROLLBACK');throw e;}
  }
  async function logout(){
    epoch++;clearInterval(sheetTimer);sheetTimer=null;sheetRead=null;reviews.clear();
    const previous=workspace;workspace=null;if(db){db.close();db=null;}
    sheetState={enabled:true,status:'idle',lastSuccess:null,error:null,result:null};
    await previous?.close();return {ok:true};
  }
  async function configure(value){if(workspace?.profile)throw new CloudError('로그아웃한 뒤 연결 설정을 바꿔 주세요.',409);config=validateCloudConfig(value);authError='';return status();}
  async function readSheet({review=false}={}){
    const current=workspace,generation=epoch;if(!current?.profile)throw new CloudError('Google 로그인이 필요합니다.',401);
    if(sheetRead){await sheetRead;if(!review)return {...sheetState};if(current!==workspace||generation!==epoch)throw new CloudError('다시 로그인해 주세요.',401);}
    sheetState={...sheetState,status:'loading',error:null};
    sheetRead=Promise.resolve().then(async()=>{
      try{
        const rows=await fetchRows();if(current!==workspace||generation!==epoch)return sheetState;
        const mapping=inferSheetMapping(rows);
        if(['name','startDate','category','mainKeyword'].some(key=>mapping[key]===''))throw Error('시트의 업체명·시작날짜·상품·키워드 열을 확인해 주세요.');
        const incoming=companiesFromRows(sanitizeSheetRows(rows),mapping);
        const result=await current.importCompanies(incoming);
        const changes=review?await current.previewSheetUpdates(incoming,sheetFields(mapping)):null;
        if(current!==workspace||generation!==epoch)return sheetState;
        sheetState={enabled:true,status:'success',lastSuccess:new Date().toISOString(),error:null,result,...(changes?{review:reviews.create(changes)}:{})};
      }catch(e){if(current===workspace&&generation===epoch)sheetState={...sheetState,status:'error',error:e instanceof CloudError?e.message:'시트 읽기에 실패했습니다. '+(e.message||'인터넷 연결을 확인해 주세요.')};}
      finally{if(generation===epoch)sheetRead=null;}
      return {...sheetState};
    });return sheetRead;
  }
  async function login(accessToken){
    if(!config)throw new CloudError('먼저 Google 로그인 연결 설정을 등록해 주세요.',400);
    if(loginBusy)throw new CloudError('Google 로그인이 진행 중입니다.',409);
    loginBusy=true;
    try{
      await logout();authError='';const generation=epoch;
      const next=workspaceFactory(config);workspace=next;
      next.onChange=companies=>{if(workspace===next&&generation===epoch)syncLocal(companies);};
      next.onLock=message=>{if(workspace!==next)return;authError=message;void logout();};
      await next.login(accessToken);
      if(closed||workspace!==next||generation!==epoch)throw new CloudError('로그인이 취소되었습니다.',401);
      const key=createHash('sha256').update(JSON.stringify([config.firebase.projectId,config.workspaceId,next.profile.uid])).digest('hex');
      db=openStore(join(dirname(legacyPath),'accounts',key+'.sqlite'));syncLocal(next.companies());
      await next.tick();void readSheet();sheetTimer=setInterval(()=>void readSheet(),300000);sheetTimer.unref?.();
      return status();
    }catch(error){await logout();const e=cloudError(error);authError=e.message;throw e;}finally{loginBusy=false;}
  }
  const timer=setInterval(()=>{if(workspace?.profile&&workspace.online)void workspace.tick().catch(()=>{});},15000);timer.unref?.();
  router.get('/auth',(_,res)=>res.json(status()));
  router.post('/login',(_,res)=>res.status(405).json({error:'Google 로그인 버튼을 이용해 주세요.'}));
  router.post('/logout',async(_,res)=>res.json(await logout()));
  router.use((req,res,next)=>workspace?.profile&&db?next():res.status(401).json({error:authError||'Google 로그인이 필요합니다.'}));
  router.get('/companies',(_,res)=>res.json({companies:workspace.companies(),today:koreaClock().today,sheetAuto:sheetState}));
  router.post('/companies',async(req,res)=>res.status(201).json(await workspace.add(req.body)));
  router.put('/companies/:id',async(req,res)=>res.json(await workspace.update(req.params.id,req.body)));
  router.delete('/companies/:id',async(req,res)=>res.json(await workspace.remove(req.params.id,req.body)));
  router.get('/settings',(_,res)=>res.json({timezone:'Asia/Seoul',hours:[9,12,15],channel:'in-app',lastImport:sheetState.lastSuccess,protected:true,desktop:true,sheetAuto:sheetState,cloud:{enabled:true,online:workspace.online,workspaceId:config.workspaceId,projectId:config.firebase.projectId,user:workspace.profile}}));
  router.get('/notifications',(_,res)=>res.json(workspace.notifications()));
  router.post('/notifications/read',async(_,res)=>res.json(await workspace.markNotificationsRead()));
  router.post('/sheet/read',async(_,res)=>{const state=await readSheet({review:true});res.status(state.status==='error'?502:200).json(state);});
  router.post('/sheet/apply',async(req,res)=>{const result=await workspace.applySheetUpdates(reviews.select(req.body.reviewId,req.body.selected));reviews.clear();res.json(result);});
  router.get('/sheet/preview',async(_,res)=>res.json({rows:await fetchSheetRows(),source:'현재진행업체NEW!A1:G50'}));
  router.post('/import',async(req,res)=>{if(!Array.isArray(req.body.companies)||!req.body.companies.length||req.body.companies.length>49)throw new CloudError('최대 49개 업체만 가져올 수 있습니다.',400);res.json(await workspace.importCompanies(req.body.companies));});
  router.get('/members',async(_,res)=>res.json({members:await workspace.members()}));
  router.post('/members',async(req,res)=>res.json(await workspace.addMember(req.body.email)));
  router.delete('/members/:email',async(req,res)=>res.json(await workspace.removeMember(req.params.email)));
  router.get('/legacy/preview',(_,res)=>{
    if(workspace.profile.role!=='owner')throw new CloudError('관리자 권한이 필요합니다.',403);
    const rows=legacyStore?.prepare('SELECT * FROM companies').all()||[];
    res.json({count:rows.length,withNotes:rows.filter(c=>c.notes).length});
  });
  router.post('/legacy/import',async(req,res)=>{
    if(workspace.profile.role!=='owner'||req.body.confirm!==true)throw new CloudError('관리자가 기존 PC 데이터 공유를 확인해 주세요.',403);
    const rows=legacyStore?.prepare('SELECT * FROM companies').all()||[];if(rows.length>300)throw new CloudError('기존 데이터가 너무 많습니다. 관리자에게 문의해 주세요.',400);
    res.json(await workspace.importLegacy(rows));
  });
  router.use((req,res)=>res.status(404).json({error:'요청을 찾을 수 없습니다.'}));
  router.use((error,req,res,next)=>{const e=cloudError(error);res.status(e.status).json({error:e.message});});
  return {router,status,configure,login,logout,async close(){closed=true;clearInterval(timer);await logout();},backup(path){if(!db||!workspace?.profile)throw new CloudError('Google 로그인 후 백업해 주세요.',401);db.prepare('VACUUM INTO ?').run(path);}};
}
