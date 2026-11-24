# 예향한정식 목포보리굴비 평화광장점 — 홈페이지

기존 예향 홈페이지(yehyang-mokpo-peace-square…chatgpt.site)의 **디자인과 문구를 그대로 유지**하면서,
전라도음식이야기(jeollafoodstory.com)의 **페이지 구성**을 적용한 정적 웹사이트입니다.
매장 정보·메뉴·사진은 네이버 플레이스(ID 1922092055)와 매장 메뉴판, 목포문화관광 자료를 기준으로 작성했습니다 (2026년 11월).

## 페이지 구성

| 주소 | 내용 | 참고한 구성 |
|---|---|---|
| `/` (index.html) | 메인: 히어로, 연말 모임 배너, 소개, 대표 메뉴, 맛·공간·이야기 카드, 모임, 예약 방법, 오시는 길 | jeollafoodstory.com 홈 |
| `/about` | 예향 이야기, 명인 소개, 인증·수상, 주변 관광지 | /about |
| `/menu` | 정식 5종(구성표), 목포식 한정식, 단품, 한 상의 이야기(사진 탭), 도시락·계절, 주류, 원산지 | /menu |
| `/space` | 룸·별실 12실, 90석, 편의시설 | /spaces |
| `/gathering` | 상견례·가족 모임·접대·여행·송년회·도시락 | /gatherings |
| `/news` | 네이버 소식 기반 이벤트·공지 | /stories |
| `/visit` | 지도(OpenStreetMap), 영업시간, 주차, 길안내, 자주 묻는 질문 | /visit |
| `/reservation` | 네이버 예약·전화 예약·예약 전 안내 | /booking |

GitHub Pages, Cloudflare Pages, Netlify 모두 `menu.html`을 `/menu` 주소로도 열어 줍니다.

## 공개하기 (일반 한정식집 주소로)

1. **도메인 구입** — 예: `yehyang.co.kr`, `mokpoyehyang.com` 등 (가비아·후이즈·Cloudflare 등에서 연 1~2만원대).
2. **무료 호스팅에 이 폴더 올리기** — 가장 쉬운 방법:
   - Netlify Drop(app.netlify.com/drop)에 `yehyang-homepage` 폴더를 끌어다 놓기 → 바로 공개 주소 발급
   - 또는 Cloudflare Pages / GitHub Pages에 이 폴더를 연결
3. 호스팅 설정의 **Custom domain**에 구입한 도메인을 입력하고, 안내대로 도메인 업체 DNS에 레코드를 추가.
4. 연결 후 네이버 플레이스 → 정보 → **홈페이지**에 새 주소를 등록하면 검색에서도 연결됩니다.

## 수정하기

- 페이지는 순수 HTML이라 각 `.html` 파일을 직접 고쳐도 됩니다.
- 공통 머리말·꼬리말이나 메뉴·가격을 한꺼번에 바꾸려면 `_tools/build.py`의 데이터를 고친 뒤
  `python3 _tools/build.py .` 를 이 폴더에서 실행하면 8개 페이지가 다시 만들어집니다.
- `styles.css` 앞부분은 기존 사이트 스타일 그대로이고, `/* ===== 추가 구성 … */` 아래가 새로 추가된 부분입니다.
- 사진은 `assets/` 폴더(WebP). 모두 네이버 플레이스에 매장이 직접 올린 사진이며, 자르기·크기 조정·밝기/대비/채도 약간 보정만 했습니다. (AI 연출 이미지는 사용하지 않습니다.)
