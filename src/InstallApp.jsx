import React,{useEffect,useState} from 'react';
import {Download,Smartphone,Monitor,Share,X,Check} from 'lucide-react';

export default function InstallApp(){
  const [prompt,setPrompt]=useState(null),[open,setOpen]=useState(false),[installed,setInstalled]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    const media=window.matchMedia('(display-mode: standalone)');
    const update=()=>setInstalled(media.matches||Boolean(navigator.standalone));update();
    const before=e=>{e.preventDefault();setPrompt(e);};
    const done=()=>{setInstalled(true);setPrompt(null);setOpen(false);};
    window.addEventListener('beforeinstallprompt',before);window.addEventListener('appinstalled',done);media.addEventListener('change',update);
    return()=>{window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',done);media.removeEventListener('change',update);};
  },[]);
  useEffect(()=>{if(!open)return;const escape=e=>{if(e.key==='Escape')setOpen(false);};document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);},[open]);
  async function install(){try{await prompt.prompt();const choice=await prompt.userChoice;setPrompt(null);if(choice.outcome==='accepted')setOpen(false);}catch{setPrompt(null);setError('브라우저 메뉴에서 앱 설치 또는 홈 화면에 추가를 선택해 주세요.');}}
  if(installed)return <span className="installed-badge"><Check size={14}/>앱으로 사용 중</span>;
  return <><button className="btn secondary install-open" onClick={()=>setOpen(true)}><Download size={15}/>앱 설치</button>{open&&<div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)setOpen(false);}}><section className="modal install-dialog" role="dialog" aria-modal="true" aria-labelledby="install-title"><div className="modal-header"><div><div className="eyebrow">TAKE YOUR WORKSPACE WITH YOU</div><h2 id="install-title">어디서든, 플로우와 함께</h2></div><button className="icon-button" onClick={()=>setOpen(false)} aria-label="설치 안내 닫기"><X size={20}/></button></div><div className="form-body"><p>같은 배포 주소로 접속하면 PC와 휴대폰에서 같은 업체 정보를 확인하고 수정할 수 있어요.</p>{prompt&&<button className="btn primary install-now" onClick={install}><Download size={17}/>이 기기에 설치</button>}<div className="install-platform"><Monitor size={22}/><div><b>윈도우 PC</b><p>Edge 또는 Chrome에서 접속한 뒤 브라우저 메뉴의 ‘앱 설치’를 선택하세요. 설치 후 시작 메뉴와 작업 표시줄에서 실행할 수 있어요.</p></div></div><div className="install-platform"><Smartphone size={22}/><div><b>갤럭시 · 안드로이드</b><p>Chrome의 ⋮ 메뉴에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택하세요.</p></div></div><div className="install-platform"><Share size={22}/><div><b>아이폰 · 아이패드</b><p>Safari의 공유 버튼에서 ‘홈 화면에 추가’를 선택하세요. 지원되는 기기에서는 ‘웹 앱으로 열기’를 켜 주세요.</p></div></div><div className="notice-info">설치하려면 인터넷에 배포된 HTTPS 주소가 필요합니다. 설치 파일(.exe/.apk)과 앱스토어 배포는 제공하지 않습니다. 알림은 앱 안의 알림함에서 확인합니다.</div>{error&&<p className="error" role="alert">{error}</p>}</div><div className="modal-footer"><div className="spacer"/><button className="btn primary" onClick={()=>setOpen(false)}>확인했어요</button></div></section></div>}</>;
}
