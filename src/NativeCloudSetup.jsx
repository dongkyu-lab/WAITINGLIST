import React,{useEffect,useState} from 'react';
import {FileUp,ExternalLink,Copy,Settings2} from 'lucide-react';
export default function NativeCloudSetup({configured,busy,configure}){
  const [setup,setSetup]=useState(null),[email,setEmail]=useState(''),[message,setMessage]=useState(''),[copying,setCopying]=useState(false);
  useEffect(()=>{window.waitingListDesktop?.getCloudSetup?.().then(setSetup).catch(()=>{});},[configured]);
  async function copyRules(e){
    e.preventDefault();setCopying(true);setMessage('');
    try{await window.waitingListDesktop.copyAccessRules(email);setMessage('규칙을 복사했습니다. 열린 Firebase 화면의 규칙을 모두 선택해 붙여넣고 ‘게시’를 눌러주세요.');}catch(e){setMessage(e.message);}finally{setCopying(false);}
  }
  return <>
    {!configured&&<div className="cloud-setup-box"><b>Google 로그인 설정파일을 선택하세요</b><p>Google에서 내려받은 ‘Waiting List Windows’ 데스크톱 OAuth JSON을 그대로 선택합니다. 파일 내용은 이 PC에 암호화해 저장합니다.</p>{setup?.projectId&&<small className="setup-project">공유 프로젝트 · {setup.projectId}</small>}<button className="btn secondary" disabled={busy||!window.waitingListDesktop} onClick={configure}><FileUp size={16}/>Google OAuth JSON 선택</button><button className="text-button" onClick={()=>window.waitingListDesktop?.openOAuthClients?.()}><ExternalLink size={14}/>Google에서 JSON 내려받기</button></div>}
    <details className="admin-setup"><summary><Settings2 size={15}/>최초 관리자만 · 서버 접속 규칙 설정</summary><p>프로젝트 관리자가 한 번만 진행합니다. 이미 서버 설정을 마친 직원·다른 PC는 생략하세요.</p><form onSubmit={copyRules}><label>최초 관리자 Google 이메일<input type="email" required autoComplete="email" placeholder="관리자@gmail.com" value={email} onChange={e=>setEmail(e.target.value)}/></label><button className="btn secondary" disabled={copying||busy||!window.waitingListDesktop?.copyAccessRules}><Copy size={15}/>{copying?'규칙 복사 중…':'규칙 복사 · Firebase 열기'}</button></form>{message&&<p role="status">{message}</p>}</details>
  </>;
}
