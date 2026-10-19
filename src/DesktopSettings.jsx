import React,{useEffect,useState} from 'react';
import {Monitor,Download,FolderOpen} from 'lucide-react';
export default function DesktopSettings({cloud}){
  const [info,setInfo]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{window.waitingListDesktop?.getInfo().then(setInfo).catch(()=>setMessage('프로그램 설정을 불러오지 못했습니다.'));},[]);
  if(!window.waitingListDesktop)return null;
  async function autoStart(e){setBusy(true);try{setInfo(await window.waitingListDesktop.setAutoStart(e.target.checked));setMessage('시작 설정을 저장했습니다.');}catch{setMessage('시작 설정을 저장하지 못했습니다.');}finally{setBusy(false);}}
  async function backup(){setBusy(true);try{const r=await window.waitingListDesktop.backup();setMessage(r.canceled?'백업을 취소했습니다.':'업체와 메모, 알림을 백업했습니다.');}catch(e){setMessage(e.message||'백업하지 못했습니다.');}finally{setBusy(false);}}
  return <section className="panel settings-card"><div className="setting-icon"><Monitor/></div><h2>윈도우 프로그램</h2><p>{cloud?.enabled?'업체 정보는 공유 서버에 저장하며, 이 PC에는 계정별 백업 캐시를 보관합니다.':'이 PC에 정보를 저장하며 별도 호스팅 요금이 없습니다.'}</p><label className="desktop-setting-toggle"><span>Windows 로그인 시 백그라운드 실행</span><input type="checkbox" checked={info?.autoStart||false} disabled={!info?.canAutoStart||busy} onChange={autoStart}/></label><div className="desktop-buttons"><button className="btn secondary" onClick={backup} disabled={busy}><Download size={16}/>전체 데이터 백업</button><button className="btn secondary" onClick={()=>window.waitingListDesktop.openDataFolder()}><FolderOpen size={16}/>데이터 폴더</button></div><p className="desktop-setting-footnote">창을 닫아도 작업 표시줄 오른쪽 트레이에서 계속 실행됩니다. 완전히 종료하려면 트레이 메뉴의 ‘프로그램 종료’를 선택하세요. PC가 켜져 있고 절전 상태가 아니며 프로그램이 실행 중일 때 알림이 기록됩니다. 백업에는 업체 정보가 포함되니 안전한 위치에 보관하세요.</p>{info&&<small>Waiting List {info.version}</small>}{message&&<p role="status" className="desktop-setting-footnote">{message}</p>}</section>;
}
