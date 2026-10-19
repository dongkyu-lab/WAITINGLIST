import { addDays, validDate } from './dates.js';

// Shared by server-side Google Sheets preview and browser CSV import.
// Two-digit years in the source sheet are explicitly interpreted as 2000–2099.
export function parseSheetDate(value) {
  const text=String(value??'').trim().replace(/\s/g,'').replace(/[./]/g,'-').replace(/-$/,'');
  if(!text) return '';
  const match=text.match(/^(\d{2}|\d{4})-(\d{1,2})-(\d{1,2})$/);
  if(!match) throw new Error('날짜는 YY.M.D 또는 YYYY-MM-DD 형식이어야 합니다.');
  const year=match[1].length===2?`20${match[1]}`:match[1];
  const date=`${year}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`;
  if(!validDate(date)) throw new Error('존재하지 않는 날짜입니다.');
  return date;
}

export function sanitizeSheetRows(input) {
  const rows=input.slice(0,50).map(row=>row.slice(0,7).map(v=>String(v??'')));
  const notes=(rows[0]||[]).map((h,i)=>/특이|비고|메모/.test(h)?i:-1).filter(i=>i>=0);
  for(const row of rows.slice(1)) for(const i of notes) row[i]='';
  return rows;
}

export function inferSheetMapping(rows) {
  const headers=rows[0]||[];
  const find=pattern=>{const i=headers.findIndex(h=>pattern.test(h));return i<0?'':String(i);};
  return {
    name:find(/업체|상호|회사|플레이스\s*등\s*진행/),
    category:find(/상품|유형|카테고리|서비스|매체/),
    mainKeyword:find(/키워드/),
    manager:find(/담당/),contact:find(/연락|전화/),startDate:find(/시작|개시/),existingEndDate:find(/종료/)
  };
}

export function companiesFromRows(input,mapping) {
  const rows=sanitizeSheetRows(input);
  if(mapping.name===''||mapping.name===undefined) throw new Error('업체명 열을 선택해 주세요.');
  const indexes=Object.values(mapping).filter(x=>x!=='');
  if(new Set(indexes).size!==indexes.length) throw new Error('하나의 열을 여러 항목에 중복으로 연결할 수 없습니다.');
  for(const i of indexes) {
    if(!/^[0-6]$/.test(String(i)) || /특이|비고|메모/.test(rows[0]?.[Number(i)]||'')) throw new Error('연결할 수 없는 열입니다.');
  }
  return rows.slice(1).map((row,index)=>({row,index})).filter(({row})=>row.some(v=>v.trim())).map(({row,index})=>{
    const c=Object.fromEntries(['name','category','mainKeyword','manager','contact','startDate','existingEndDate'].map(key=>[key,mapping[key]===''||mapping[key]===undefined?'':String(row[Number(mapping[key])]||'').trim()]));
    if(!c.name) throw new Error(`${index+2}행에 업체명이 없습니다.`);
    try {c.startDate=parseSheetDate(c.startDate);} catch(e) {throw new Error(`${index+2}행의 시작일: ${e.message}`);}
    return {...c,endDate:c.startDate?addDays(c.startDate,30):'',notes:''};
  });
}
