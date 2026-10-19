# Waiting List · 마케팅 업체 관리 프로그램

**현재 main은 1.1.0-rc.3 Google 로그인·PC 공유 연결 준비 버전입니다.** 프로젝트 waitinglist-da493의 공개 Firebase 앱 설정과 데스크톱 OAuth 클라이언트 ID를 포함합니다. 새 PC에서 OAuth JSON을 선택할 필요 없이 기본 브라우저의 Google 로그인으로 연결합니다. 관리자는 최초 서버 접속 규칙 게시·Google 로그인 활성화·localhost 승인과 직원 계정 등록을 완료해야 합니다. 기존 JSON을 등록한 PC의 연결 설정은 유지합니다. 실제 계정 로그인과 서버 규칙 배포는 아직 확인하지 않았습니다. [무료 공유 연결 설정 안내](CLOUD-SETUP.md)를 확인하세요.

[공유 연결 준비 설치파일](https://github.com/dongkyu-lab/WAITINGLIST/releases/tag/desktop-v1.1.0-rc.3) · [기존 로컬 버전 1.0.3](https://github.com/dongkyu-lab/WAITINGLIST/releases/tag/desktop-v1.0.3)

RC3는 JSON 없는 브라우저 인증 전달, 로그인 전 API 차단, 기존 로컬 데이터 보존을 검사합니다. 실제 Google 계정 승인과 여러 사용자 PC의 공유 확인은 사용자 환경에서 별도로 진행해야 합니다.

## Windows 설치

Windows 10/11 64비트용입니다. 일반 사용자는 Setup.exe만으로 설치하며 Node.js·VS Code·유료 서버 가입이 필요하지 않습니다. 관리자가 최초 Firebase 프로젝트·OAuth·규칙을 준비해야 합니다. 모든 PC가 같은 프로젝트와 공유 공간 설정을 사용합니다. 이전 프로그램은 트레이에서 완전히 종료한 뒤 설치합니다. 기존 로컬 DB는 보존하며 새 공유 서버로 자동 업로드하지 않습니다.

설치파일은 코드 서명이 없어 게시자 확인 경고가 표시될 수 있습니다. 보안 설정을 끄지 마세요. Windows CI는 테스트·Electron 실행·패키징·패키지 실행·로그인 전 접근 차단을 검증합니다. 사용자 PC의 설치 마법사와 실제 Google 프로젝트 연결은 별도 확인이 필요합니다.

## 기능

- 기본 브라우저의 Firebase Google 로그인: 새 PC에서 JSON 등록 없이 사용합니다. 인증 결과는 일회용 로컬 연결로 전달하며 프로그램이 Google 계정과 공유 권한을 검증합니다. 기존 JSON 방식의 PKCE·state 인증도 유지합니다. Google 비밀번호를 앱에 입력·저장하지 않습니다.
- Firestore로 업체·상품·메인키워드·시작일·메모·추가·삭제를 공유합니다. UI는 수신 내용을 약 5초마다 갱신합니다. 오래된 화면의 저장은 충돌을 표시합니다.
- 관리자가 Google 이메일을 등록하며 미등록 계정은 차단합니다. 임의의 최초 로그인 사용자가 관리자가 되지 않습니다. 규칙에 지정한 이메일만 최초 관리자 공간을 만들 수 있습니다.
- 원본 현재진행업체NEW!A1:G50만 로그인 시와 5분마다 읽습니다. 원본 특이사항은 비웁니다. 새 업체만 추가하고 기존 앱 수정·삭제는 유지합니다. 원본 시트에는 쓰지 않습니다.
- 종료일은 예외 없이 시작일 +30일이며 직접 수정하지 않습니다. 시작일이 비면 종료일도 비웁니다.
- 종료 7~6일 전 노랑, 5~4일 전 주황, 3~0일 전 빨강, 다음날부터 회색입니다. 회색 배경의 종료 날짜·상태·남은 기간 글씨는 검정색입니다.
- 청록색 테마, 본문 글씨 +2pt, Waiting List 로고 글씨 22px 한 줄, 사용자 제공 로고 기준 고해상도 아이콘.
- 한국 시간 09/12/15시 종료 7일 전~종료 당일 명단. 명단은 공유하며 읽음 상태는 같은 Google 계정의 PC끼리 공유합니다. 정시 기록에는 한 PC 이상이 켜져 있고 로그인한 프로그램이 실행 중이어야 합니다. 과거 슬롯 소급·OS 푸시·메일 발송은 하지 않습니다.
- 트레이 실행, Windows 로그인 시 실행 선택, 계정별 SQLite 백업, CSV 내보내기, 관리자의 기존 PC 데이터 이전.

인터넷 단절 시 현재 세션의 수신 내용을 조회할 수 있지만 수정은 제한합니다. 재연결 시 공유 상태를 다시 받습니다. 무료 Spark 한도를 사용하며 카드 등록·Blaze 전환·유료 호스팅은 만들지 않습니다. 사용량 한도가 있어 무제한 무료는 아닙니다.

## 데이터 보존

기존 로컬 데이터는 Electron 사용자 데이터 폴더의 data/waitinglist.sqlite에 보존됩니다. 공유 버전은 프로젝트·공유 공간·계정별로 data/accounts/ 안에 별도 캐시 DB를 만듭니다. 인증 토큰을 DB에 저장하지 않습니다. 연결 설정은 Windows 계정 보안 기능으로 암호화합니다. 로그인 토큰은 프로세스 메모리에서만 유지하며 프로그램을 완전히 종료하면 다시 로그인합니다.

전체 백업은 현재 계정의 수신된 업체·알림 캐시를 SQLite VACUUM INTO로 저장합니다. 백업에는 고객 정보가 들어갑니다. 로컬에 백업을 놓는 것만으로 공유 서버가 복원되지는 않습니다. 기존 PC 데이터를 공유할 때는 관리자가 건수와 안내를 확인해 실행합니다. 이미 수정된 공유 업체는 덮어쓰지 않습니다. 실제 고객 데이터·OAuth 인증 비밀번호·로그인 토큰·환경 파일·계정 캐시는 저장소와 설치파일에 넣지 않습니다. Firebase 웹 API 키와 앱용 OAuth 클라이언트 ID는 공개 앱 식별 정보로 desktop/project-defaults.json에 포함합니다.

## 개발과 검증

Node.js 24.5 이상, Electron 44.9.0, 클라우드 규칙 테스트에는 Java 21이 필요합니다.

```sh
npm ci
node node_modules/electron/install.js
npm test
npm run test:cloud
npm run build
npm run desktop:smoke
npm run desktop:cloud-smoke
```

npm test는 로컬·API·OAuth PKCE·Google 로그인 전 접근 차단을 검증합니다. test:cloud는 공식 Firebase 로컬 에뮬레이터에서 서로 다른 계정·서버 규칙·실시간 변경·충돌·권한 해제·메모 이전·읽음 공유를 검증합니다. 가짜 자격 증명은 로컬 에뮬레이터 테스트에만 사용하며, 배포 설정에서 에뮬레이터 주소를 지정할 수 없습니다.

Linux GUI 검사에는 Xvfb/DISPLAY와 쓰기 가능한 XDG_CACHE_HOME이 필요합니다. Electron 런타임은 node node_modules/electron/install.js로 체크섬 검증 설치합니다. 클라우드 캐시는 /tmp/waitinglist-npm, /tmp/waitinglist-electron, /tmp/waitinglist-builder를 사용합니다. TLS·체크섬 검증을 끄지 마세요.

npm run desktop은 Google 로그인을 요구합니다. 테스트용 --smoke-test는 임시 데이터에서 로컬 기능을 검사하며, 별도 desktop:cloud-smoke는 Google 로그인 전 차단을 검사합니다. 정상 설치 실행은 환경변수로 로그인 필수를 해제할 수 없습니다. API는 루프백 무작위 포트와 프로세스 전용 연결 키로 보호하며 렌더러 Node 접근은 차단합니다.

Windows x64 NSIS는 npm run desktop:pack으로 만듭니다. Actions는 먼저 공식 에뮬레이터 규칙 검사를 통과한 뒤 Windows 실행과 패키지 실행을 검사합니다. desktop-v*-rc.* 태그는 정식 최신 버전을 바꾸지 않는 사전 출시로 게시합니다. 실제 서비스 연결은 [CLOUD-SETUP.md](CLOUD-SETUP.md)를 따라 완료해야 합니다.

휴대폰/PWA 실험은 [app-prototype 브랜치](https://github.com/dongkyu-lab/WAITINGLIST/tree/app-prototype)에 분리했습니다. 현재 생성형 AI API는 필요하지 않습니다. 향후 요청 시 Google Gemini의 공식 모델 ID부터 확인합니다.
