import Papa from 'papaparse';
import {sanitizeSheetRows,inferSheetMapping,companiesFromRows} from './sheet-data.js';
import {cleanCompany,insertCompany} from './company-data.js';

export const SHEET_URL='https://docs.google.com/spreadsheets/d/1r_XoTBynA9_oWg9D3dzg18a5V3s1tej7R_7sapnGwII/gviz/tq?'+new URLSearchParams({tqx:'out:csv',sheet:'현재진행업체NEW',range:'A1:G50'});
const sourceKey=c=>JSON.stringify([c.name,c.startDate]);

export async function fetchSheetRows(signal) {
  const response=await fetch(SHEET_URL,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000),redirect:'error'});
  if(!response.ok)throw new Error('Google Sheets 응답 오류');
  const text=await response.text();
  if(text.length>500000||/^\s*</.test(text))throw new Error('시트 응답 형식 오류');
  const parsed=Papa.parse(text,{skipEmptyLines:false});
  if(parsed.errors.length)throw new Error('CSV 응답 형식 오류');
  return sanitizeSheetRows(parsed.data);
}

export function rememberSheetDeletion(db,c) {
  db.prepare('INSERT OR IGNORE INTO sheet_sources(sourceKey,companyId,sourceName,sourceStartDate) VALUES(?,NULL,?,?)').run(sourceKey(c),c.name,c.startDate);
}

export function applySheetRows(db,input) {
  const rows=sanitizeSheetRows(input),mapping=inferSheetMapping(rows);
  if(mapping.name===''||mapping.startDate===''||mapping.category===''||mapping.mainKeyword==='')throw new Error('시트의 업체명·시작날짜·상품·키워드 열을 확인해 주세요.');
  // Validate the entire response before changing anything. Existing app fields are never overwritten.
  const companies=companiesFromRows(rows,mapping).map(c=>cleanCompany({...c,notes:''}));
  const nameCounts=new Map();for(const c of companies)nameCounts.set(c.name,(nameCounts.get(c.name)||0)+1);
  let added=0,skipped=0;
  db.exec('BEGIN');
  try {
    for(const c of companies) {
      const key=sourceKey(c);
      if(db.prepare('SELECT sourceKey FROM sheet_sources WHERE sourceKey=?').get(key)){skipped++;continue;}
      let match=db.prepare('SELECT id FROM companies WHERE name=? AND startDate=? ORDER BY createdAt LIMIT 1').get(c.name,c.startDate);
      let deleted=false;
      if(!match&&nameCounts.get(c.name)===1) {
        const links=db.prepare('SELECT DISTINCT companyId FROM sheet_sources WHERE sourceName=?').all(c.name);
        if(links.length===1){if(links[0].companyId)match={id:links[0].companyId};else deleted=true;}
        if(!match&&!deleted&&links.length===0){
          const candidates=db.prepare('SELECT id FROM companies WHERE name=?').all(c.name);
          if(candidates.length===1)match=candidates[0];
        }
      }
      const id=deleted?null:match?.id||insertCompany(db,c);
      db.prepare('INSERT INTO sheet_sources(sourceKey,companyId,sourceName,sourceStartDate) VALUES(?,?,?,?)').run(key,id,c.name,c.startDate);
      if(match||deleted)skipped++;else added++;
    }
    const now=new Date().toISOString();
    db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES('sheetAutoLastSuccess',?)").run(now);
    if(added)db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES('lastImport',?)").run(now);
    db.exec('COMMIT');
  } catch(error){db.exec('ROLLBACK');throw error;}
  return {added,skipped,total:companies.length};
}

export function createAutoSheetReader(db,{fetchRows=fetchSheetRows,enabled=true,intervalMs=300000}={}) {
  let timer=null,inflight=null,controller=null,closed=false;
  const state={enabled,status:enabled?'idle':'disabled',lastAttempt:null,lastSuccess:db.prepare("SELECT value FROM settings WHERE key='sheetAutoLastSuccess'").get()?.value||null,error:null,result:null};
  async function read(){
    if(closed||!enabled)return {...state};
    if(inflight)return inflight;
    controller=new AbortController();state.status='loading';state.lastAttempt=new Date().toISOString();state.error=null;
    inflight=Promise.resolve().then(async()=>{
      try {
        const rows=await fetchRows(controller.signal);
        if(closed)return {...state};
        state.result=applySheetRows(db,rows);state.lastSuccess=new Date().toISOString();state.status='success';
      } catch {
        if(!closed){state.status='error';state.error='시트에 연결하지 못했습니다. 저장된 데이터는 유지되며 5분 뒤 자동으로 다시 시도합니다.';}
      }finally{inflight=null;controller=null;}
      return {...state};
    });
    return inflight;
  }
  return {
    read,status:()=>({...state}),
    start(){if(timer||closed||!enabled)return;void read();timer=setInterval(read,intervalMs);timer.unref?.();},
    stop(){closed=true;clearInterval(timer);controller?.abort();}
  };
}
