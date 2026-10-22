import {randomUUID} from 'node:crypto';
import {changedCompany} from './company-data.js';
import {CloudError} from './cloud-config.js';

export const sheetFieldLabels={name:'업체명',startDate:'시작일',category:'진행 상품',mainKeyword:'메인키워드',contact:'연락처',manager:'담당자',existingEndDate:'기존 종료일 · 보관용'};
export function sheetFields(mapping){return Object.keys(sheetFieldLabels).filter(key=>mapping[key]!==''&&mapping[key]!==undefined);}

export function sheetTarget(source,incoming,known){
  const exact=known.filter(d=>d.sourceName===source.name&&d.sourceStartDate===source.startDate);
  if(exact.length===1)return exact[0];
  const byName=known.filter(d=>d.sourceName===source.name||d.name===source.name);
  const sameStart=byName.filter(d=>d.startDate===source.startDate);
  if(sameStart.length===1&&incoming.filter(c=>c.name===source.name&&c.startDate===source.startDate).length===1)return sameStart[0];
  if(byName.length===1&&incoming.filter(c=>c.name===source.name).length===1)return byName[0];
  // A unique, unchanged contact can identify a renamed company. Never infer
  // identity from row position: sheet insertion and sorting move rows.
  if(source.contact&&incoming.filter(c=>c.contact===source.contact).length===1){
    const byContact=known.filter(d=>d.contact===source.contact);
    if(byContact.length===1)return byContact[0];
  }
  return null;
}

export function planSheetUpdates(incoming,known,fields){
  const plans=[];
  for(const source of incoming){
    const old=sheetTarget(source,incoming,known);if(!old||old.deleted)continue;
    const values=Object.fromEntries(fields.filter(key=>Object.hasOwn(sheetFieldLabels,key)).map(key=>[key,String(source[key]||'')]));
    const changes=Object.entries(values).filter(([key,value])=>String(old[key]||'')!==value).map(([field,after])=>({field,label:sheetFieldLabels[field],before:String(old[field]||''),after}));
    if(changes.length)plans.push({id:old.id,name:old.name,updatedAt:old.updatedAt,changes,values:Object.fromEntries(changes.map(c=>[c.field,c.after]))});
  }
  const counts=new Map();for(const p of plans)counts.set(p.id,(counts.get(p.id)||0)+1);
  return plans.filter(p=>counts.get(p.id)===1);
}

export function createSheetReviewStore(){
  let current=null;
  return {
    clear(){current=null;},
    create(plans){current={id:randomUUID(),plans,expires:Date.now()+900000};return {id:current.id,changes:plans.map(({id,name,changes})=>({id,name,changes}))};},
    select(id,selected){
      if(!current||current.id!==id||current.expires<Date.now())throw new CloudError('변경 확인이 만료되었습니다. 시트를 다시 새로고침해 주세요.',409);
      if(!Array.isArray(selected)||!selected.length||selected.length>49||new Set(selected).size!==selected.length||selected.some(key=>!current.plans.some(p=>p.id===key)))throw new CloudError('반영할 업체를 선택해 주세요.',400);
      return current.plans.filter(p=>selected.includes(p.id));
    }
  };
}

export function localSheetCompanies(db){
  return db.prepare(`SELECT c.*,
    (SELECT sourceName FROM sheet_sources s WHERE s.companyId=c.id LIMIT 1) AS sourceName,
    (SELECT sourceStartDate FROM sheet_sources s WHERE s.companyId=c.id LIMIT 1) AS sourceStartDate
    FROM companies c`).all();
}
export function applyLocalSheetUpdates(db,plans){
  db.exec('BEGIN');
  try{
    const changes=plans.map(p=>{const old=db.prepare('SELECT * FROM companies WHERE id=?').get(p.id);if(!old||old.updatedAt!==p.updatedAt)throw new CloudError('다른 PC 또는 화면에서 먼저 수정했습니다. 시트를 다시 확인해 주세요.',409);return {id:p.id,c:changedCompany(old,p.values)};});
    for(const {id,c} of changes)db.prepare('UPDATE companies SET name=?,category=?,mainKeyword=?,manager=?,contact=?,startDate=?,endDate=?,existingEndDate=?,updatedAt=? WHERE id=?').run(c.name,c.category,c.mainKeyword,c.manager,c.contact,c.startDate,c.endDate,c.existingEndDate,new Date().toISOString(),id);
    db.exec('COMMIT');return {updated:changes.length};
  }catch(e){db.exec('ROLLBACK');throw e;}
}
