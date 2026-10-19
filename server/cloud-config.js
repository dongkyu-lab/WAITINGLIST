export function validateCloudConfig(input){
  const c=input?.firebase||{},g=input?.google?.installed||input?.google||{};
  if(!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(c.projectId||''))throw new Error('Firebase 프로젝트 ID를 확인해 주세요.');
  if(!/^[A-Za-z0-9_-]{20,100}$/.test(c.apiKey||''))throw new Error('Firebase 웹 앱 API 키를 확인해 주세요.');
  if(!/^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(g.client_id||''))throw new Error('Google 데스크톱 앱 OAuth 클라이언트 ID를 확인해 주세요.');
  const workspaceId=input.workspaceId||'waitinglist';
  if(!/^[A-Za-z0-9_-]{1,64}$/.test(workspaceId))throw new Error('공유 공간 ID를 확인해 주세요.');
  if(g.client_secret!==undefined&&(typeof g.client_secret!=='string'||g.client_secret.length>500))throw new Error('OAuth 설정 형식을 확인해 주세요.');
  return {firebase:{projectId:c.projectId,apiKey:c.apiKey},google:{client_id:g.client_id,...(g.client_secret?{client_secret:g.client_secret}:{})},workspaceId};
}
export const normalizeEmail=value=>String(value||'').trim().toLowerCase();
export const validEmail=value=>typeof value==='string'&&value.length<=254&&/^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(value);
export class CloudError extends Error{constructor(message,status=503,code='unavailable'){super(message);this.status=status;this.code=code;}}

export function resolveDesktopSetup(input,defaults){
  let value=input;
  if(input?.installed){
    if(input.installed.project_id&&input.installed.project_id!==defaults.firebase.projectId)throw new Error('이 프로그램과 같은 Firebase 프로젝트의 데스크톱 OAuth JSON을 선택해 주세요.');
    if(input.installed.client_id!==defaults.google.client_id)throw new Error('Waiting List Windows로 만든 데스크톱 OAuth JSON을 선택해 주세요.');
    value={...defaults,google:input.installed};
  }
  const config=validateCloudConfig(value);
  if(!config.google.client_secret)throw new Error('Google에서 내려받은 데스크톱 OAuth JSON 파일을 선택해 주세요. 인증 설정이 파일에 포함되어 있어야 합니다.');
  return config;
}

export function ownerAccessRules(template,owner){
  const email=normalizeEmail(owner);
  if(!validEmail(email))throw new Error('최초 관리자 Google 이메일을 확인해 주세요.');
  const placeholder="'SET_OWNER_EMAIL_BEFORE_DEPLOYING'";
  if(template.split(placeholder).length!==2)throw new Error('접속 규칙 템플릿을 확인하지 못했습니다.');
  return template.replace(placeholder,JSON.stringify(email));
}
