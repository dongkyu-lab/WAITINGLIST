import {randomUUID} from 'node:crypto';
import {validDate,addDays} from './dates.js';

export function cleanCompany(input) {
  const name=String(input.name||'').trim();
  if(!name||name.length>150)throw new Error('업체명은 1~150자로 입력해 주세요.');
  const startDate=String(input.startDate||'').trim();
  if(startDate&&!validDate(startDate))throw new Error('시작일을 확인해 주세요.');
  const fields=Object.fromEntries(['category','mainKeyword','manager','contact','notes','existingEndDate'].map(key=>[key,String(input[key]||'').trim()]));
  if(Object.values(fields).some(value=>value.length>5000))throw new Error('입력값은 5,000자 이내로 작성해 주세요.');
  const endDate=Object.hasOwn(input,'endDate')?String(input.endDate??'').trim():startDate?addDays(startDate,30):'';
  if(endDate&&!validDate(endDate))throw new Error('종료일을 확인해 주세요.');
  return {name,startDate,endDate,...fields};
}

export function changedCompany(previous,changes){
  const input={...previous,...changes};
  if(Object.hasOwn(changes,'startDate')&&changes.startDate!==previous.startDate&&!changes.endDateEdited&&(!Object.hasOwn(changes,'endDate')||changes.endDate===cleanCompany(previous).endDate))delete input.endDate;
  return cleanCompany(input);
}

export function insertCompany(db,c) {
  const id=randomUUID(),now=new Date().toISOString();
  db.prepare('INSERT INTO companies(id,name,category,mainKeyword,manager,contact,startDate,endDate,notes,existingEndDate,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,c.name,c.category,c.mainKeyword,c.manager,c.contact,c.startDate,c.endDate,c.notes,c.existingEndDate,now,now);
  return id;
}
