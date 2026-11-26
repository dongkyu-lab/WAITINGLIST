# -*- coding: utf-8 -*-
"""예향 모션 메인(index.html) 생성기.
먼저 build.py로 전체 페이지를 만든 뒤 실행합니다:
  python3 _tools/build.py . && python3 _tools/build_motion.py .
머리말·꼬리말은 build.py가 만든 index.html에서 그대로 가져옵니다."""
import re, sys, os

OUT = sys.argv[1]
TEL = '061-262-9595'
NAVER_BOOK = 'https://m.booking.naver.com/booking/6/bizes/640982'
src = open(os.path.join(OUT, 'index.html'), encoding='utf-8').read()

head = src[:src.index('</head>')]
head = head.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<script>document.documentElement.classList.add(\'js\')</script>', 1)
head = head.replace('<link rel="stylesheet" href="styles.css">',
                    '<link rel="stylesheet" href="styles.css">\n<link rel="stylesheet" href="motion.css">')
head = head.replace('<link rel="preload" href="assets/fonts/yehyang-brush.woff2"',
                    '<link rel="preload" href="assets/video/poster.webp" as="image">\n<link rel="preload" href="assets/fonts/yehyang-brush.woff2"')
header = src[src.index('<body>') + len('<body>'):src.index('<main id="main">')]
footer = src[src.index('<footer class="site-footer">'):src.index('<script src="script.js"></script>')]

ARROW = '<span class="m-circle" aria-hidden="true">→</span>'

STORY = [
    ('01', 'hoe-flower', '꽃 모양으로 담아낸 활어회와 유부초밥', '목포 바다의<br>제철 활어회',
     '그날 들어온 활어를 꽃 모양으로 정성껏 담아냅니다. 울금으로 지은 노란 초밥과 함께 목포 바다의 신선함을 먼저 맛보세요.'),
    ('02', 'abalone-new', '구운 전복 요리', '남도의 별미를<br>한 접시에',
     '전복, 낙지호롱, 홍어삼합까지. 남도의 귀한 재료를 명인의 손으로 다듬어 한 접시씩 정갈하게 올립니다.'),
    ('03', 'course-special', '여럿이 함께 나누는 예향의 한상차림', '모두 함께 나누는<br>한 상',
     '풍성한 찬과 정갈한 상차림. 가족 모임, 상견례, 귀한 손님 접대까지 함께 나누는 식사에 마음을 더합니다.'),
]

SCENES = [
    ('course-nakgul', '정식', '목포식 굴비 정식부터 낙굴 정식까지',
     '점심 특선 목포식 굴비 정식(1인 20,000원), 명품 정식·떡갈비랑 굴비랑(1인 30,000원), 판매 1위 낙굴 정식(1인 40,000원).',
     ['2만 · 3만 · 4만 원', '점심 특선', '판매 1위 낙굴 정식'], 'menu.html#courses'),
    ('hongsam-samhap', '홍삼 정식', '홍어삼합에 낙지, 회와 보리굴비까지',
     '목포의 대표 음식 홍어삼합과 낙지, 활어회와 초밥, 큼직한 보리굴비를 한 번에 즐기는 가장 풍성한 정식입니다. 1인 50,000원.',
     ['1인 50,000원', '만족도 1위', '홍어삼합'], 'menu.html#hongsam'),
    ('course-special', '코스 정식', '함께 나누는 한상차림 코스',
     '꽃 활어회와 해산물 모둠, 초밥과 제철 찬을 한 상 가득. 예향 정식 3~4인 160,000원, 예향 특정식 4~5인 200,000원.',
     ['한상 160,000원', '한상 200,000원', '상견례 · 모임'], 'menu.html#set-courses'),
    ('dosirak', '프리미엄 도시락', '정성 가득한 한 상을 도시락에',
     '보리굴비, 낙지호롱, 수제 떡갈비를 한 도시락에 담았습니다. 행사·모임 도시락은 전화로 주문해 주세요. 1개 20,000원.',
     ['1개 20,000원', '단체 주문', '포장'], 'menu.html#dosirak'),
]

SPACES = [
    ('store-front', '예향 외관', '평화광장 바로 앞', '목포시 평화로 40. Since 1969 간판을 찾아오세요.', 'visit.html'),
    ('store-setting', '단체석', '최대 90명까지', '회식·단체 모임을 위한 넓은 자리를 준비합니다.', 'space.html'),
    ('store-room', '개별 룸', '룸 · 별실 12실', '상견례와 접대를 위한 조용한 개별 룸.', 'space.html'),
    ('hoe-flower-wide', '상견례', '두 가족의 첫 만남', '격식을 갖춘 상차림과 조용한 룸으로 준비합니다.', 'gathering.html#meeting'),
    ('scallop-samhap', '접대 · 회식', '품격 있는 자리', '홍어삼합과 활어회로 목포의 맛을 소개하세요.', 'gathering.html#business'),
]

FAQ = [
    ('단체 모임도 예약할 수 있나요?', f'네. 룸·별실 12실과 단체석이 있어 2명부터 최대 90명까지 이용하실 수 있습니다. 예상 인원과 날짜를 전화({TEL})로 알려주시면 메뉴와 자리를 상담해 드립니다.'),
    ('주차는 어디에 하나요?', '매장에서 도보 1분 거리의 평화광장 무료 공영주차장을 이용해 주세요.'),
    ('영업시간과 브레이크타임은 어떻게 되나요?', '매일 11:00 – 21:00 영업하며, 브레이크타임은 14:30 – 17:00, 라스트오더는 20:00입니다. 명절 당일 휴무는 예향 소식에서 안내드립니다.'),
    ('아이 또는 어르신과 함께 방문해도 되나요?', '유아 의자가 준비되어 있고, 출입구와 좌석 모두 휠체어 이용이 가능합니다. 필요하신 사항은 예약 시 말씀해 주세요.'),
]

story_imgs = ''.join(
    f'<div class="m-story-image"><img src="assets/{img}.webp" alt="{alt}"{" loading=\"lazy\"" if i else ""}></div>'
    for i, (_, img, alt, _, _) in enumerate(STORY))
story_copy = ''.join(
    f'<article class="m-story-copy{" active" if i == 0 else ""}"><span class="m-story-index">{n}</span><h3>{h}</h3><p>{p}</p></article>'
    for i, (n, _, _, h, p) in enumerate(STORY))
story_dots = ''.join(
    f'<button type="button" aria-label="{i + 1}번째 이야기" aria-pressed="{"true" if i == 0 else "false"}"><span></span></button>'
    for i in range(len(STORY)))

scene_imgs = ''.join(
    f'<div class="m-scene-image"><img src="assets/{img}.webp" alt=""{" loading=\"lazy\"" if i else ""}></div>'
    for i, (img, *_r) in enumerate(SCENES))
scene_cards = ''.join(f'''<article class="m-card{" active" if i == 0 else ""}">
<button type="button" class="m-card-toggle" aria-expanded="{"true" if i == 0 else "false"}"><span class="m-card-num">0{i + 1}</span>{t}<span class="m-card-plus" aria-hidden="true">+</span></button>
<div class="m-card-detail"><div><p><b>{h}</b><br>{d}</p><span class="m-card-tags">{" · ".join(tags)}</span><a href="{href}">메뉴 자세히 보기 →</a></div></div>
</article>''' for i, (img, t, h, d, tags, href) in enumerate(SCENES))

space_cards = ''.join(f'''<a class="m-space-card" href="{href}">
<figure><img src="assets/{img}.webp" alt="{t}" loading="lazy"><figcaption><small>{t}</small><strong>{h}</strong></figcaption></figure>
<div class="m-space-caption"><h3>{t}</h3><span aria-hidden="true">→</span></div><p>{p}</p>
</a>''' for img, t, h, p, href in SPACES)

faq = ''.join(f'<details><summary>{q}<span class="m-expand" aria-hidden="true"></span></summary><p>{a}</p></details>' for q, a in FAQ)

main = f'''<main id="main">
<section class="m-hero" id="top-hero" aria-labelledby="m-hero-title">
<div class="m-hero-media">
<video class="m-hero-video" autoplay muted loop playsinline preload="metadata" poster="assets/video/poster.webp" aria-hidden="true">
<source src="assets/video/hero-mobile.mp4" type="video/mp4" media="(max-width: 800px)">
<source src="assets/video/hero.mp4" type="video/mp4">
</video>
<div class="m-hero-shade"></div>
</div>
<div class="wrap m-hero-content">
<p class="eyebrow light"><span class="line"></span>MOKPO · NAMDO DINING<span class="m-hide-sm"> · SINCE 1969</span></p>
<h1 id="m-hero-title"><span class="m-line"><span>한 상에 담아낸</span></span><span class="m-line"><span><em>목포의 깊은 맛</em></span></span></h1>
<p class="m-hero-lead">바다의 풍미를 품은 남도 한정식. 평화광장에서 특별한 식사 한 끼를 만나보세요.</p>
<div class="m-hero-actions">
<a class="button primary" href="tel:{TEL}">전화로 예약하기</a>
<a class="text-link light-link" href="#m-essence">예향 알아보기 <span aria-hidden="true">↓</span></a>
</div>
</div>
<div class="wrap m-hero-bottom">
<span class="m-scroll-cue">SCROLL TO EXPLORE <span aria-hidden="true">↓</span></span>
<button type="button" class="m-motion-toggle" aria-label="영상 일시정지" aria-pressed="false"><span class="m-icon-pause" aria-hidden="true"></span></button>
<span class="m-hero-address">전남 목포시 평화로 40</span>
</div>
</section>

<section class="m-essence section-pad" id="m-essence">
<div class="wrap">
<p class="eyebrow reveal"><span class="line"></span>OUR ESSENCE</p>
<h2 class="reveal">남도 한정식의 변하지 않는 공식</h2>
<p class="m-formula reveal"><span>목포의 바다</span><i aria-hidden="true">+</i><span>명인의 정성</span></p>
<p class="m-essence-lead reveal">좋은 재료를 고르고, 정성으로 차려냅니다.<br>1969년부터 이어온 목포식 한정식, 예향입니다.</p>
</div>
</section>

<section class="m-story-stage" aria-label="예향의 한 상 이야기">
<div class="m-story-sticky">
<div class="m-story-visual">{story_imgs}</div>
<div class="m-story-narrative">
{story_copy}
<div class="m-story-dots">{story_dots}</div>
</div>
</div>
</section>

<section class="m-signature-intro">
<div class="wrap">
<p class="eyebrow reveal"><span class="line"></span>SIGNATURE MENU</p>
<h2 class="reveal"><span>점심 특선부터 코스 정식까지,</span><span>예향의 <em>대표 한 상</em></span></h2>
</div>
</section>

<section class="m-scene-stage" aria-label="대표 메뉴">
<div class="m-scene-sticky">
<div class="m-scene-visual">{scene_imgs}</div>
<div class="m-scene-dim"></div>
<p class="m-scene-statement">가볍게 즐기는 점심부터<br>귀한 손님을 모시는 날까지,<br>자리에 맞는 한 상을 준비합니다.</p>
<div class="m-cards">{scene_cards}</div>
<div class="m-progress" aria-hidden="true"><i></i></div>
</div>
</section>

<section class="m-record section-pad">
<div class="wrap">
<div class="section-heading">
<div><p class="eyebrow reveal"><span class="line"></span>AWARDS &amp; HONORS</p><h2 class="reveal">대한민국이 인정한 한&nbsp;상</h2></div>
<p class="reveal">목포음식 제18호 명인 · 한국음식명장 · 대한민국 한식대가</p>
</div>
<div class="m-stats">
<article class="reveal"><strong><span data-count="18">18</span><small>호</small></strong><p>목포음식 명인 인증</p></article>
<article class="reveal"><strong><span data-count="12">12</span><small>년 연속</small></strong><p>남도음식명가 선정</p></article>
<article class="reveal"><strong><span data-count="5">5</span><small>회</small></strong><p>대상 수상 (2022–2026)</p></article>
<article class="reveal"><strong><span data-count="90">90</span><small>석</small></strong><p>룸 · 별실 12실 포함</p></article>
</div>
<a class="text-link m-record-link reveal" href="about.html#awards">수상 · 인증 경력 전체 보기 <span aria-hidden="true">→</span></a>
</div>
</section>

<section class="m-space section-pad">
<div class="wrap">
<div class="m-space-heading">
<div><p class="eyebrow reveal"><span class="line"></span>SPACE &amp; GATHERINGS</p><h2 class="reveal">함께하는 자리,<br>예향의 공간</h2></div>
<div class="m-carousel-controls"><button type="button" class="m-prev" aria-label="이전">←</button><button type="button" class="m-next" aria-label="다음">→</button></div>
</div>
<div class="m-space-track" tabindex="0" aria-label="공간과 모임 사진">{space_cards}</div>
</div>
</section>

<section class="m-contact">
<div class="m-contact-backdrop"><img src="assets/course-nakgul.webp" alt="" loading="lazy"></div>
<div class="wrap m-contact-content">
<p class="eyebrow light reveal"><span class="line"></span>RESERVATION</p>
<h2 class="reveal">오늘의 한&nbsp;상,<br>예향에서 준비하겠습니다.</h2>
<p class="reveal">매일 11:00 – 21:00 · 브레이크타임 14:30 – 17:00 · 라스트오더 20:00</p>
<div class="m-contact-actions reveal">
<a class="button primary" href="{NAVER_BOOK}" target="_blank" rel="noopener">네이버 예약하기</a>
<a class="button outline" href="tel:{TEL}">전화 {TEL}</a>
</div>
</div>
</section>

<section class="m-faq section-pad">
<div class="wrap m-faq-grid">
<div><p class="eyebrow reveal"><span class="line"></span>QUESTIONS</p><h2 class="reveal">방문 전<br>확인하세요.</h2><a class="text-link reveal" href="visit.html">오시는 길 보기 <span aria-hidden="true">→</span></a></div>
<div class="m-faq-list">{faq}</div>
</div>
</section>
</main>
<button type="button" class="m-back-top" aria-label="맨 위로">↑</button>
'''

html = head + '</head>\n<body class="motion-page">\n' + header + main + footer + \
    '<script src="script.js"></script>\n<script src="motion.js"></script>\n</body>\n</html>\n'
open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(html)
print('motion index built')
