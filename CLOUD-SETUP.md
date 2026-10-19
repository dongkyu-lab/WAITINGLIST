# Google 로그인과 여러 PC 공유 연결

1.1.0-rc.3는 Google 로그인과 Firestore 실시간 공유를 구현한 **연결 준비 버전**입니다. 프로젝트 waitinglist-da493의 공개 앱 설정과 데스크톱 클라이언트 ID를 포함합니다. 실제 Google 로그인과 서버 규칙 배포는 사용자 PC에서 완료해야 합니다. 이 과정을 완료하기 전에는 로그인 화면에서 업체 목록에 들어갈 수 없습니다. 테스트용 가짜 로그인은 제공하지 않습니다. 기존 로컬 버전 1.0.3은 별도로 유지됩니다.

별도 서버·유료 호스팅·AI API는 필요하지 않습니다. Firebase **Spark 무료 요금제**와 Firestore 기본 데이터베이스를 사용합니다. 무료 읽기·쓰기·저장 한도가 있으며 사용량이 커지면 동기화가 제한될 수 있습니다. 이 설정은 카드 등록·Blaze 전환·Cloud Functions·Cloud Run·Hosting을 요구하지 않습니다. 프로젝트와 결제 설정은 소유자가 Google 콘솔에서 관리합니다.

## 현재 프로젝트에서 가장 간단하게 연결하기

1. 프로젝트 관리자만 첫 화면의 **최초 관리자 서버 접속 규칙 설정**을 펼칩니다. 관리자 Google 이메일을 입력하고 **규칙 복사·Firebase 열기**를 누릅니다. 열린 Firestore 규칙 편집기의 내용을 복사된 규칙으로 바꾼 뒤 **게시**합니다. 이미 게시했다면 반복할 필요가 없습니다. 프로그램은 관리자 권한을 얻거나 규칙을 자동 배포하지 않습니다.
2. Firebase **Authentication → 로그인 방법**에서 Google을 사용 설정합니다. **설정 → 승인된 도메인**에 `localhost`가 있어야 합니다. 없으면 한 번 추가합니다. 프로젝트 waitinglist-da493는 읽기 전용 공개 설정 조회에서 localhost 등록을 확인했습니다.
3. **Google 계정으로 로그인**을 누르고, 기본 브라우저에서 **Google 계정 선택**을 눌러 인증합니다. **새 PC에 OAuth JSON을 등록할 필요가 없습니다.** Google 비밀번호는 Google 창에서만 입력합니다. 인증 후 프로그램으로 돌아오면 등록된 계정의 접속 권한을 확인합니다.
4. 관리자가 프로그램 **설정 → 접속 가능한 Google 계정**에서 직원 이메일을 등록합니다. 직원은 새 설치파일을 설치하고 자기 Google 계정으로 로그인합니다. Google 앱이 테스트 상태라면 Google Cloud **대상 → 테스트 사용자**에도 계정을 등록해야 합니다.

공개 Firebase 앱 설정만 설치파일에 포함합니다. 로그인용 브라우저 화면과 Firebase SDK는 설치파일에 함께 들어 있으며 유료 서버나 Hosting 배포가 필요하지 않습니다. 브라우저는 메모리에서만 인증을 유지하고, 일회용 로컬 연결로 Google 인증 결과를 프로그램에 전달합니다. 프로그램이 다시 Firebase 인증과 공유 공간 권한을 확인합니다. Google 인증 완료 화면 자체는 업체 목록 접속 허용을 뜻하지 않습니다.

이미 JSON을 등록한 PC는 암호화해 저장한 기존 데스크톱 OAuth 방식을 유지합니다. 필요한 경우 첫 화면의 **고급 설정 · 기존 OAuth JSON 방식**에서 예전 설정파일을 선택할 수 있습니다. 이 방식에서만 Google 토큰 서버가 client_secret을 요구합니다. 비밀번호·서비스 계정 키·OAuth JSON 내용을 채팅으로 보내거나 공개 저장소에 올리지 마세요.

## 다른 Firebase 프로젝트를 처음부터 준비하는 경우

1. [Firebase 콘솔](https://console.firebase.google.com/)에서 프로젝트를 만듭니다. Google Analytics는 필수가 아닙니다. Spark 요금제를 유지합니다.
2. **빌드 → Firestore Database**에서 `(default)` 데이터베이스를 만듭니다. 프로덕션 모드로 시작하고 적절한 지역을 선택합니다. 테스트 모드의 전체 공개 규칙을 사용하지 마세요.
3. **Authentication → 로그인 방법**에서 Google을 사용 설정하고 지원 이메일을 선택합니다. 다른 로그인 제공자는 필요하지 않습니다.
4. 같은 프로젝트의 [Google Cloud OAuth 클라이언트](https://console.cloud.google.com/auth/clients)에서 앱 정보를 설정하고 **데스크톱 앱** OAuth 클라이언트를 만든 뒤 JSON을 내려받습니다. 웹 앱 유형이 아닙니다. 권한은 `openid email profile`만 사용합니다. 앱이 테스트 상태라면 접속할 Google 계정을 테스트 사용자에도 등록합니다. 필요 시 Google OAuth 화면에서 앱을 게시합니다. 비밀번호·서비스 계정 비밀키는 필요하지 않습니다.
5. Firebase **프로젝트 설정 → 내 앱 → 웹 앱 등록**에서 웹 앱을 추가하고 `projectId`와 `apiKey`를 확인합니다. Hosting 설정은 생략합니다. 이 API 키는 Firebase 앱 식별용 공개 설정이며, 데이터 보호는 아래 서버 규칙과 계정 등록으로 처리합니다.
6. [연결 설정 예제](cloud/waitinglist-cloud.example.json)를 복사해 `firebase.projectId`, `firebase.apiKey`, `google.installed.client_id`, `google.installed.client_secret`를 채웁니다. Google 값은 4번에서 받은 **동일 프로젝트의 데스크톱 OAuth JSON**에서 옮깁니다. `workspaceId`는 모든 PC에서 같은 `waitinglist`를 사용합니다. 완성한 파일을 `waitinglist-cloud.json`으로 저장합니다. 비밀번호·Firebase 관리자 SDK JSON·서비스 계정 키를 넣지 마세요.

## 접속 규칙 배포

초기 규칙에는 소유자 이메일이 비어 있어 누구도 공유 공간을 만들 수 없습니다. 관리자가 사용하는 Google 이메일을 **비공개 배포 사본**에 넣고 규칙을 배포해야 합니다. 먼저 로그인한 임의의 사람을 관리자로 만드는 방식이 아닙니다.

저장소를 가진 관리자 PC에서 Node.js 24.5 이상으로 다음을 실행합니다. 이 준비 작업에만 개발 도구가 필요하며, 일반 사용자는 설치파일만 있으면 됩니다. 실제 프로젝트 ID와 이메일을 사용하세요.

```sh
node scripts/prepare-cloud.mjs PROJECT_ID OWNER_GOOGLE_EMAIL waitinglist-cloud.json
npx --yes firebase-tools@15.34.0 login
npx --yes firebase-tools@15.34.0 deploy --only firestore:rules --project PROJECT_ID --config .cloud-private/firebase.json
```

이 스크립트는 `.cloud-private/`에 개인 이메일이 포함된 배포 규칙과 PC용 설정파일을 만듭니다. 이 폴더와 입력 설정파일을 공개 저장소에 올리지 마세요. 다른 출력 폴더를 지정했다면 그 폴더도 따로 보호하세요. 준비 스크립트 자체는 서버를 배포하거나 결제를 변경하지 않습니다.

CLI 대신 Firestore 콘솔의 **규칙** 화면에서도 배포할 수 있습니다. `cloud/firestore.rules`의 `SET_OWNER_EMAIL_BEFORE_DEPLOYING` 한 곳을 실제 소유자 Google 이메일의 소문자 값으로 바꾸고 전체 규칙을 게시합니다. 규칙을 `allow read, write: if true`로 바꾸지 마세요.

## 각 PC에서 연결하기

1. 새 프로그램을 설치하고 **Google 계정으로 로그인**을 누릅니다. 새 PC에서는 JSON을 선택하지 않습니다. 기존 JSON 설정을 등록한 PC는 해당 연결을 유지합니다.
2. 기본 브라우저에서 **Google 계정 선택**을 누르고 본인 계정으로 인증한 뒤 Waiting List로 돌아옵니다. 로그인에는 인터넷이 필요하며 앱을 완전히 종료했다가 다시 켜면 다시 로그인합니다.
3. 규칙에 지정한 관리자는 최초 로그인 시 공유 공간과 관리자 등록을 생성합니다. **프로그램 설정 → 접속 가능한 Google 계정**에서 다른 사용자 이메일을 등록합니다. 이메일 초대장을 보내지는 않습니다.
4. 다른 사용자는 자기 Google 계정으로 로그인합니다. 등록되지 않은 계정은 업체 정보에 접근할 수 없습니다. 관리자가 권한을 해제하면 열려 있던 PC에서도 목록 접근을 해제합니다.
5. 이전 버전의 PC 메모가 있으면 관리자가 **이 PC의 기존 데이터 공유**에서 건수와 안내를 확인한 뒤 복사합니다. 자동 업로드하지 않습니다. 원래 로컬 DB는 보존하고 다른 PC에서 이미 수정한 공유 업체는 덮어쓰지 않습니다.

## 공유되는 내용

- 업체·상품·키워드·시작일·메모·추가·삭제는 Firestore 구독으로 다른 PC에 전달됩니다. 화면은 약 5초마다 수신한 변경을 표시합니다. 시트 자동 읽기는 시작 시와 5분마다 별도로 수행하며 지정 `현재진행업체NEW!A1:G50`만 읽습니다. 원본 특이사항은 계속 제외합니다.
- 종료일은 저장된 시작일에서 +30일로 계산합니다. 오래된 화면에서 저장하면 버전 충돌을 알리고 최신 수정을 덮어쓰지 않습니다.
- 알림 명단은 공유하고 같은 Google 계정의 읽음 상태는 PC 간 공유합니다. 다른 사람의 읽음 상태는 독립적입니다. 정시 기록에는 적어도 한 PC가 켜져 있고 로그인한 프로그램이 실행 중이어야 합니다. 꺼져 있던 시간대는 소급 생성하지 않습니다.
- 인터넷이 끊기면 현재 로그인 세션에서 받은 화면을 읽을 수 있지만 수정은 제한합니다. 재연결되면 변경을 다시 받습니다. 무인 서버 예약 작업은 만들지 않았습니다.
- 백업은 현재 로그인 계정의 업체·알림 캐시를 SQLite 파일로 저장합니다. 백업을 로컬에 놓는 것만으로 공유 서버가 복원되지는 않습니다. 이전 버전의 로컬 DB와 계정별 캐시는 설치파일에 포함되지 않습니다.

## 검증 범위

Firebase Auth·Firestore 공식 로컬 에뮬레이터로 서로 다른 Google 계정, 실시간 변경, 충돌 거부, 미등록 계정 차단, 관리자 권한, 권한 해제, 삭제 복원 방지, 원본 메모 제외, 계정별 읽음 공유를 검증합니다. 실제 Google OAuth 승인과 실제 Firebase 프로젝트 배포는 프로젝트 연결 후 별도로 확인해야 합니다. 일회용 브라우저 연결의 출처·경로 검증, 잘못된 호스트 거부, 취소·만료, 비공개 API 차단을 검사합니다. Windows 설치파일 검증은 Google 로그인 전 API 차단, JSON 없이 활성화된 로그인 버튼과 브라우저 화면 포함까지 확인합니다. 실제 계정의 Google 승인과 사용자 PC의 동기화는 별도로 확인해야 합니다.

```sh
npm test
npm run test:cloud
npm run build
npm run desktop:cloud-smoke
```

참고: [Google 데스크톱 OAuth와 PKCE](https://developers.google.com/identity/protocols/oauth2/native-app), [Firebase Google 인증](https://firebase.google.com/docs/auth/web/google-signin), [Firestore 보안 규칙](https://firebase.google.com/docs/firestore/security/get-started).
