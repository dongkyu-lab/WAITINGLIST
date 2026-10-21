import {createHash,randomUUID} from 'node:crypto';
import {initializeApp,deleteApp} from 'firebase/app';
import {initializeAuth,inMemoryPersistence,GoogleAuthProvider,signInWithCredential,signOut,connectAuthEmulator} from 'firebase/auth';
import {getFirestore,doc,collection,query,orderBy,limit,getDocFromServer,getDocsFromServer,onSnapshot,runTransaction,serverTimestamp,connectFirestoreEmulator,terminate} from 'firebase/firestore';
import {cleanCompany} from './company-data.js';
import {CloudError,normalizeEmail,validEmail} from './cloud-config.js';
import {dueSlot,koreaClock,daysLeft} from './dates.js';
import {notificationTargets} from './scheduler.js';
import {sheetTarget,planSheetUpdates} from './sheet-review.js';

export function cloudError(error){
  if(error instanceof CloudError)return error;
  const code=String(error?.code||'');
  if(code==='auth/user-disabled')return new CloudError('이 Google 계정은 Firebase Authentication에서 사용 중지되어 있습니다. 프로젝트 관리자에게 사용자 차단 해제를 요청해 주세요.',401,'user-disabled');
  if(code==='auth/network-request-failed')return new CloudError('Google 인증 서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.',503,'network');
  if(code.includes('permission-denied'))return new CloudError('등록된 Google 계정만 접속할 수 있습니다. 관리자에게 계정 등록을 요청해 주세요.',403,'permission-denied');
  if(code.includes('auth/'))return new CloudError('Google 로그인을 완료하지 못했습니다. 로그인 설정과 계정을 확인해 주세요.',401,'unauthenticated');
  return new CloudError('공유 서버에 연결하지 못했습니다. 저장 여부를 확인한 뒤 다시 시도해 주세요.');
}
const persisted=input=>{try{const c=cleanCompany(input);delete c.endDate;return c;}catch(error){throw new CloudError(error.message,400,'invalid-input');}};
const seedId=c=>'sheet-'+createHash('sha256').update(JSON.stringify([c.name,c.startDate])).digest('hex');
export class FirebaseWorkspace {
  constructor(config,{emulator=null,onChange=()=>{},onLock=()=>{}}={}){
    this.config=config;this.onChange=onChange;this.onLock=onLock;this.profile=null;this.online=false;this.documents=new Map();this.closed=false;this.unsubscribers=[];this.alerts=new Map();this.reads=new Map();this.checkedSlot=null;
    this.app=initializeApp(config.firebase,'waitinglist-'+randomUUID());
    this.auth=initializeAuth(this.app,{persistence:inMemoryPersistence});this.db=getFirestore(this.app);
    // Tests inject local emulators through this constructor. Config files cannot select hosts.
    if(emulator){connectAuthEmulator(this.auth,emulator.auth,{disableWarnings:true});const u=new URL(emulator.firestore);connectFirestoreEmulator(this.db,u.hostname,Number(u.port));}
  }
  ref(path){return doc(this.db,'workspaces',this.config.workspaceId,...path.split('/'));}
  async login(googleAccessToken,{googleIdToken=null}={}){
    try{
      const credential=GoogleAuthProvider.credential(googleIdToken,googleAccessToken);
      const {user}=await signInWithCredential(this.auth,credential);
      const token=await user.getIdTokenResult();
      if(!user.emailVerified||!validEmail(user.email)||token.signInProvider!=='google.com')throw new CloudError('이메일 인증된 Google 계정으로 로그인해 주세요.',403);
      const email=normalizeEmail(user.email),memberRef=this.ref('members/'+email);
      let member=await getDocFromServer(memberRef);
      if(!member.exists()){
        await runTransaction(this.db,async tx=>{
          const workspace=doc(this.db,'workspaces',this.config.workspaceId);let existing;
          try{existing=await tx.get(workspace);}catch(e){if(String(e.code).includes('permission-denied'))throw new CloudError(email+' 계정의 접속 권한을 확인하지 못했습니다. 관리자가 이 이메일을 등록한 뒤 접속 권한 다시 확인을 눌러주세요.',403,'not-registered');throw e;}
          if(existing.exists())throw new CloudError('관리자가 아직 등록하지 않은 Google 계정입니다.',403);
          tx.set(workspace,{ownerEmail:email,createdAt:serverTimestamp()});
          tx.set(memberRef,{email,role:'owner',createdAt:serverTimestamp()});
        });
        member=await getDocFromServer(memberRef);
      }
      const role=member.data()?.role;if(!['owner','editor'].includes(role))throw new CloudError('공유 공간 접속 권한이 없습니다.',403);
      this.profile={uid:user.uid,email,name:user.displayName||email,role};
      await this.listen();
      for(const [path,target] of [['notifications',this.alerts],['members/'+email+'/reads',this.reads]]){
        const timestamp=path==='notifications'?'createdAt':'readAt';
        this.unsubscribers.push(onSnapshot(query(collection(this.db,'workspaces',this.config.workspaceId,...path.split('/')),orderBy(timestamp,'desc'),limit(90)),snapshot=>{
          if(this.closed)return;target.clear();for(const d of snapshot.docs)target.set(d.id,d.data());this.onChange(this.companies());
        },()=>this.lock('알림 접속 권한 또는 연결 설정을 확인해 주세요.')));
      }
      this.unsubscribers.push(onSnapshot(memberRef,snapshot=>{
        if(this.closed||snapshot.metadata.fromCache)return;
        if(!snapshot.exists()||!['owner','editor'].includes(snapshot.data().role)){this.lock('관리자가 이 계정의 접속 권한을 해제했습니다.');return;}
        this.profile={...this.profile,role:snapshot.data().role};
      },()=>this.lock('공유 공간 접속 권한을 다시 확인해 주세요.')));
      return this.profile;
    }catch(error){await this.close();throw cloudError(error);}
  }
  async listen(){
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new CloudError('공유 데이터를 불러오지 못했습니다. 인터넷과 Firebase 설정을 확인해 주세요.')),20000);
      const unsubscribe=onSnapshot(collection(this.db,'workspaces',this.config.workspaceId,'companies'),{includeMetadataChanges:true},snapshot=>{
        if(this.closed)return;
        this.online=!snapshot.metadata.fromCache;
        this.documents=new Map(snapshot.docs.map(d=>[d.id,d.data()]));
        try{this.onChange(this.companies());}catch{clearTimeout(timer);reject(new CloudError('공유 데이터 형식을 확인해 주세요.'));return;}
        if(this.online){clearTimeout(timer);resolve();}
      },error=>{clearTimeout(timer);reject(cloudError(error));this.lock('공유 서버 접속 권한 또는 연결 설정을 확인해 주세요.');});
      this.unsubscribers.push(unsubscribe);
    });
  }
  companies(){
    if(!this.profile)return [];
    return [...this.documents].filter(([,d])=>!d.deleted).map(([id,d])=>({...cleanCompany(d),id,createdAt:d.createdAt?.toDate?.().toISOString()||'',updatedAt:String(d.version)})).sort((a,b)=>a.endDate.localeCompare(b.endDate)||a.name.localeCompare(b.name,'ko'));
  }
  assertWritable(){if(this.closed||!this.profile)throw new CloudError('Google 로그인이 필요합니다.',401);if(!this.online)throw new CloudError('인터넷 연결이 끊겼습니다. 다시 연결된 뒤 수정해 주세요.',503,'offline');}
  async add(input){
    this.assertWritable();const id=randomUUID(),ref=this.ref('companies/'+id),data=persisted(input);
    await runTransaction(this.db,async tx=>{const existing=await tx.get(ref);if(existing.exists())return;tx.set(ref,{...data,version:1,deleted:false,sourceName:'',sourceStartDate:'',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});});return {id};
  }
  async update(id,input){
    this.assertWritable();if(!/^[A-Za-z0-9_-]{1,80}$/.test(id))throw new CloudError('업체를 찾을 수 없습니다.',404);
    const ref=this.ref('companies/'+id),data=persisted(input);
    await runTransaction(this.db,async tx=>{
      const snapshot=await tx.get(ref),old=snapshot.data();
      if(!old||old.deleted)throw new CloudError('삭제된 업체입니다. 목록을 새로 확인해 주세요.',404);
      if(String(old.version)!==input.updatedAt)throw new CloudError('다른 PC에서 먼저 수정했습니다. 창을 닫고 최신 내용을 확인한 뒤 다시 수정해 주세요.',409,'conflict');
      tx.update(ref,{...data,version:old.version+1,updatedAt:serverTimestamp()});
    });return {ok:true};
  }
  async remove(id,input){
    this.assertWritable();if(!/^[A-Za-z0-9_-]{1,80}$/.test(id))throw new CloudError('업체를 찾을 수 없습니다.',404);
    const ref=this.ref('companies/'+id);
    await runTransaction(this.db,async tx=>{
      const snapshot=await tx.get(ref),old=snapshot.data();
      if(!old||old.deleted)throw new CloudError('이미 삭제된 업체입니다.',404);
      if(String(old.version)!==input.updatedAt)throw new CloudError('다른 PC에서 먼저 수정했습니다. 최신 내용을 확인해 주세요.',409,'conflict');
      tx.set(ref,{name:old.name,deleted:true,sourceName:old.sourceName,sourceStartDate:old.sourceStartDate,createdAt:old.createdAt,updatedAt:serverTimestamp(),version:old.version+1});
    });return {ok:true};
  }
  async importCompanies(input){
    this.assertWritable();const incoming=[...new Map(input.map(c=>persisted({...c,notes:''})).map(c=>[seedId(c),c])).values()];
    const known=[...this.documents].map(([id,d])=>({...d,id}));
    const candidates=incoming.filter(c=>!this.documents.has(seedId(c))&&!sheetTarget(c,incoming,known));
    if(!candidates.length)return {added:0,skipped:input.length,total:input.length};
    return runTransaction(this.db,async tx=>{
      const refs=candidates.map(c=>this.ref('companies/'+seedId(c))),existing=await Promise.all(refs.map(ref=>tx.get(ref)));let added=0;
      candidates.forEach((c,i)=>{if(existing[i].exists())return;tx.set(refs[i],{...c,version:1,deleted:false,sourceName:c.name,sourceStartDate:c.startDate,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});added++;});
      return {added,skipped:input.length-added,total:input.length};
    });
  }
  async previewSheetUpdates(incoming,fields){
    this.assertWritable();
    const docs=await getDocsFromServer(collection(this.db,'workspaces',this.config.workspaceId,'companies'));
    return planSheetUpdates(incoming,docs.docs.map(d=>({...d.data(),id:d.id,updatedAt:String(d.data().version)})),fields);
  }
  async applySheetUpdates(plans){
    this.assertWritable();
    return runTransaction(this.db,async tx=>{
      const refs=plans.map(p=>this.ref('companies/'+p.id)),snapshots=await Promise.all(refs.map(r=>tx.get(r)));
      const changes=plans.map((p,i)=>{
        const old=snapshots[i].data();
        if(!old||old.deleted||String(old.version)!==p.updatedAt)throw new CloudError('다른 PC에서 먼저 수정했습니다. 시트를 다시 새로고침해 주세요.',409,'conflict');
        return {c:persisted({...old,...p.values}),old};
      });
      changes.forEach(({c,old},i)=>tx.update(refs[i],{...c,version:old.version+1,updatedAt:serverTimestamp()}));
      return {updated:changes.length};
    });
  }
  async importLegacy(input){
    this.assertWritable();if(this.profile.role!=='owner')throw new CloudError('관리자만 기존 PC 데이터를 공유할 수 있습니다.',403);
    const incoming=input.map(persisted),known=[...this.documents],items=incoming.map(c=>{
      const matches=known.filter(([,d])=>(d.name===c.name&&d.startDate===c.startDate)||d.sourceName===c.name);
      return {c,id:matches.length===1?matches[0][0]:'legacy-'+createHash('sha256').update(JSON.stringify([c.name,c.startDate])).digest('hex'),ambiguous:matches.length>1};
    });
    const counts=new Map();for(const item of items)counts.set(item.id,(counts.get(item.id)||0)+1);for(const item of items)if(counts.get(item.id)>1)item.ambiguous=true;
    return runTransaction(this.db,async tx=>{
      const refs=items.map(item=>this.ref('companies/'+item.id)),old=await Promise.all(refs.map(ref=>tx.get(ref)));let added=0,updated=0,skipped=0;
      items.forEach((item,i)=>{
        const previous=old[i].data();if(item.ambiguous||previous?.deleted||(previous&&previous.version!==1)){skipped++;return;}
        if(previous){tx.update(refs[i],{...item.c,version:previous.version+1,updatedAt:serverTimestamp()});updated++;}
        else{tx.set(refs[i],{...item.c,version:1,deleted:false,sourceName:item.c.name,sourceStartDate:item.c.startDate,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});added++;}
      });return {added,updated,skipped};
    });
  }
  async members(){this.assertWritable();if(this.profile.role!=='owner')throw new CloudError('관리자만 계정을 등록할 수 있습니다.',403);return (await getDocsFromServer(collection(this.db,'workspaces',this.config.workspaceId,'members'))).docs.map(d=>d.data());}
  async addMember(value){
    this.assertWritable();if(this.profile.role!=='owner')throw new CloudError('관리자 권한이 필요합니다.',403);
    const email=normalizeEmail(value);if(!validEmail(email))throw new CloudError('올바른 Google 이메일 주소를 입력해 주세요.',400);
    const alreadyRegistered=await runTransaction(this.db,async tx=>{const ref=this.ref('members/'+email),old=await tx.get(ref);if(old.exists())return true;tx.set(ref,{email,role:'editor',createdAt:serverTimestamp()});return false;});return {ok:true,alreadyRegistered};
  }
  async removeMember(value){
    this.assertWritable();if(this.profile.role!=='owner')throw new CloudError('관리자 권한이 필요합니다.',403);
    const email=normalizeEmail(value);if(!validEmail(email)||email===this.profile.email)throw new CloudError('관리자 본인 계정은 해제할 수 없습니다.',400);
    await runTransaction(this.db,async tx=>{const ref=this.ref('members/'+email),old=await tx.get(ref);if(!old.exists())return;if(old.data().role==='owner')throw new CloudError('관리자 계정은 해제할 수 없습니다.',403);tx.delete(ref);});return {ok:true};
  }
  notifications(){return [...this.alerts].map(([slot,d])=>({slot,companies:d.companies,createdAt:d.createdAt?.toDate?.().toISOString()||'',readAt:this.reads.get(slot)?.readAt?.toDate?.().toISOString()||null})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
  async markNotificationsRead(){
    this.assertWritable();const unread=this.notifications().filter(n=>!n.readAt);
    await runTransaction(this.db,async tx=>{for(const n of unread)tx.set(this.ref('members/'+this.profile.email+'/reads/'+n.slot),{readAt:serverTimestamp()});});return {ok:true};
  }
  async tick(now=new Date()){
    const due=dueSlot(now),slot=due?.replaceAll('/','-');if(!slot||slot===this.checkedSlot||!this.online||!this.profile)return;
    const targets=notificationTargets(this.companies(),koreaClock(now).today);if(!targets.length)return;
    const ref=this.ref('notifications/'+slot);
    await runTransaction(this.db,async tx=>{const old=await tx.get(ref);if(old.exists())return;tx.set(ref,{createdAt:serverTimestamp(),companies:targets.map(c=>({id:c.id,name:c.name,endDate:c.endDate,days:daysLeft(c.endDate,koreaClock(now).today)}))});});this.checkedSlot=slot;
  }
  lock(message){if(this.closed)return;this.profile=null;this.online=false;this.documents.clear();this.onLock(message);void this.close();}
  async close(){if(this.closed)return;this.closed=true;this.online=false;this.profile=null;for(const unsubscribe of this.unsubscribers)unsubscribe();this.unsubscribers=[];this.documents.clear();this.alerts.clear();this.reads.clear();await signOut(this.auth).catch(()=>{});await terminate(this.db).catch(()=>{});await deleteApp(this.app).catch(()=>{});}
}
