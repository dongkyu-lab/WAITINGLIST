import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {normalizeEmail,validEmail,validateCloudConfig} from '../server/cloud-config.js';
const [project,owner,source,target='.cloud-private']=process.argv.slice(2);
const email=normalizeEmail(owner);
if(!project||!validEmail(email)||!source){console.error('사용법: node scripts/prepare-cloud.mjs PROJECT_ID OWNER_GOOGLE_EMAIL 연결설정.json [출력폴더]');process.exit(1);}
const config=validateCloudConfig(JSON.parse(readFileSync(source,'utf8')));
if(config.firebase.projectId!==project)throw Error('프로젝트 ID와 연결 설정파일이 일치하지 않습니다.');
const directory=resolve(target);mkdirSync(directory,{recursive:true,mode:0o700});
const rule=readFileSync(new URL('../cloud/firestore.rules',import.meta.url),'utf8').replace("'SET_OWNER_EMAIL_BEFORE_DEPLOYING'",JSON.stringify(email));
writeFileSync(join(directory,'firestore.rules'),rule,{mode:0o600});
writeFileSync(join(directory,'firebase.json'),JSON.stringify({firestore:{rules:'firestore.rules'}},null,2),{mode:0o600});
writeFileSync(join(directory,'waitinglist-cloud.json'),JSON.stringify(config,null,2),{mode:0o600});
console.log('비공개 배포 설정과 PC용 연결 설정파일을 준비했습니다. 출력 폴더는 Git에 올리지 마세요.');
console.log('Firebase CLI에서 로그인한 뒤 해당 프로젝트에 Firestore 규칙을 배포하세요. 자세한 순서는 CLOUD-SETUP.md를 참고하세요.');
