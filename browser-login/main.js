import {initializeApp} from 'firebase/app';
import {initializeAuth,inMemoryPersistence,browserPopupRedirectResolver,GoogleAuthProvider,signInWithPopup,signOut} from 'firebase/auth';
import './style.css';
import logo from '../public/icons/icon-192.png';

const button=document.querySelector('#login'),status=document.querySelector('#status');
document.querySelector('#logo').src=logo;
let auth;
const messages={
  'auth/unauthorized-domain':'관리자가 Firebase → Authentication → 설정 → 승인된 도메인에 localhost를 한 번 추가해야 합니다. 추가한 뒤 다시 눌러주세요.',
  'auth/popup-blocked':'브라우저에서 이 화면의 팝업을 허용한 뒤 다시 눌러주세요.',
  'auth/popup-closed-by-user':'로그인 창이 닫혔습니다. 다시 눌러 로그인하세요.',
  'auth/network-request-failed':'인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
  'auth/operation-not-allowed':'관리자가 Firebase Authentication의 Google 로그인 방법을 사용 설정해야 합니다.'
};
async function prepare(){try{
  const response=await fetch('./config',{cache:'no-store'});
  if(!response.ok)throw Error('expired');
  auth=initializeAuth(initializeApp(await response.json()),{persistence:inMemoryPersistence,popupRedirectResolver:browserPopupRedirectResolver});
  button.textContent='Google 계정 선택';button.disabled=false;
}catch{status.textContent='로그인 연결이 만료되었습니다. Waiting List 프로그램에서 Google 로그인을 다시 눌러주세요.';button.textContent='프로그램에서 다시 시작하세요';}}
void prepare();

button.addEventListener('click',async()=>{
  button.disabled=true;status.textContent='열린 Google 창에서 본인 계정을 선택하세요.';
  try{
    const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
    const result=await signInWithPopup(auth,provider),credential=GoogleAuthProvider.credentialFromResult(result);
    if(!credential?.accessToken)throw Error('credential');
    const response=await fetch('./complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accessToken:credential.accessToken})});
    if(!response.ok)throw Error('expired');
    button.textContent='Google 인증 완료';status.textContent='Waiting List 프로그램으로 돌아가세요. 프로그램에서 공유 공간 접속 권한을 확인합니다.';
  }catch(error){status.textContent=messages[error.code]||'로그인을 완료하지 못했습니다. Waiting List 프로그램에서 다시 시작해 주세요.';button.disabled=false;}
  finally{await signOut(auth).catch(()=>{});}
});
