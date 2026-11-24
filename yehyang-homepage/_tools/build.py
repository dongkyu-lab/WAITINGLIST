# -*- coding: utf-8 -*-
"""예향한정식 홈페이지 정적 HTML 생성기. 결과물은 순수 HTML이며 직접 수정해도 됩니다."""
import json, os, sys

OUT = sys.argv[1]
NAME = '예향한정식 목포보리굴비 평화광장점'
TEL = '061-262-9595'
TEL2 = '0507-1417-9597'
ADDR = '전남 목포시 평화로 40 (상동)'
NAVER_PLACE = 'https://m.place.naver.com/restaurant/1922092055/home'
NAVER_MAP = 'https://map.naver.com/p/entry/place/1922092055'
NAVER_BOOK = 'https://m.booking.naver.com/booking/6/bizes/640982'
NAVER_FEED = 'https://m.place.naver.com/restaurant/1922092055/feed'
INSTA = 'https://www.instagram.com/yehyang.061.262.9595/'
BLOG = 'https://blog.naver.com/yehyang9595'
KAKAO_MAP = 'https://map.kakao.com/link/to/%EC%98%88%ED%96%A5%ED%95%9C%EC%A0%95%EC%8B%9D,34.794817,126.4299216'
MOKPO_TOUR = 'https://www.mokpo.go.kr/tour/attraction/area?idx=80255&amp;mode=view'

NAV = [
    ('about.html', '예향 이야기'),
    ('menu.html', '메뉴 안내'),
    ('space.html', '공간 안내'),
    ('gathering.html', '모임 안내'),
    ('news.html', '예향 소식'),
    ('visit.html', '오시는 길'),
    ('reservation.html', '예약·문의'),
]

ARROW = '<span aria-hidden="true">→</span>'


def eyebrow(text, light=False, extra=''):
    cls = 'eyebrow' + (' light' if light else '') + (' ' + extra if extra else '')
    return f'<p class="{cls}"><span class="line"></span>{text}</p>'


def head(title, desc, path, extra_head=''):
    return f'''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{NAME}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="assets/hero-table.webp">
<meta property="og:locale" content="ko_KR">
<meta name="theme-color" content="#322e29">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%23322e29'/%3E%3Crect x='6' y='6' width='52' height='52' fill='none' stroke='%23c5a473' stroke-width='2'/%3E%3Ctext x='32' y='41' font-size='22' text-anchor='middle' fill='%23e3c79c' font-family='serif'%3E%EC%98%88%ED%96%A5%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&amp;family=Noto+Serif+KR:wght@500;600&amp;display=swap">
<link rel="stylesheet" href="styles.css">
{extra_head}</head>
'''


def header(current):
    links = '\n'.join(
        f'<a href="{h}"' + (' aria-current="page"' if h == current else '') + f'>{t}</a>' for h, t in NAV)
    return f'''<body>
<a class="skip-link" href="#main">본문 바로가기</a>
<header class="site-header" id="top">
<div class="header-inner">
<a class="brand" href="index.html" aria-label="{NAME} 홈">
<span class="brand-mark" aria-hidden="true">예향</span>
<span class="brand-text"><strong>예향한정식</strong><small>목포보리굴비 평화광장점</small></span>
</a>
<nav class="desktop-nav" aria-label="주요 메뉴">
{links}
</nav>
<a class="header-call" href="tel:{TEL}">예약 문의<span>{TEL}</span></a>
<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-nav" aria-label="메뉴 열기"><span></span><span></span><span></span></button>
</div>
<nav class="mobile-nav" id="mobile-nav" aria-label="모바일 메뉴" hidden>
<a href="index.html"{' aria-current="page"' if current == 'index.html' else ''}>홈</a>
{links}
<a href="tel:{TEL}">전화 걸기 · {TEL}</a>
</nav>
</header>
'''


def footer(extra_scripts=''):
    return f'''<footer class="site-footer">
<div class="wrap footer-inner">
<div>
<div class="footer-brand">{NAME}</div>
<p>{ADDR} · 예약 문의 <a href="tel:{TEL}">{TEL}</a><br>매일 11:00 – 21:00 · 브레이크타임 14:30 – 17:00 · 라스트오더 20:00</p>
<p><a href="{NAVER_PLACE}" target="_blank" rel="noopener">네이버 플레이스</a> · <a href="{INSTA}" target="_blank" rel="noopener">인스타그램</a> · <a href="{BLOG}" target="_blank" rel="noopener">블로그</a> · <a href="{MOKPO_TOUR}" target="_blank" rel="noopener">목포문화관광</a></p>
</div>
<div class="footer-end">
<a href="#top">맨 위로 ↑</a>
<small>메뉴·가격·영업시간은 매장 사정에 따라 달라질 수 있습니다.<br>© <span data-year>2026</span> 예향한정식. All rights reserved.</small>
</div>
</div>
</footer>
<nav class="mobile-cta" aria-label="빠른 예약">
<a href="tel:{TEL}">전화 예약</a>
<a href="{NAVER_BOOK}" target="_blank" rel="noopener">네이버 예약</a>
</nav>
{extra_scripts}<script src="script.js"></script>
</body>
</html>
'''


def inner_hero(cls, eb, title, sub):
    return f'''<section class="inner-hero {cls}">
<div class="wrap">
{eyebrow(eb, light=True)}
<h1>{title}</h1>
<p>{sub}</p>
</div>
</section>
'''


def chips(items):
    out = []
    for i, it in enumerate(items):
        if i:
            out.append('<li class="plus" aria-hidden="true">+</li>')
        out.append(f'<li>{it}</li>')
    return '<ul class="chips">' + ''.join(out) + '</ul>'


def page(fname, title, desc, body, current=None, extra_head='', extra_scripts=''):
    html = head(title, desc, fname, extra_head) + header(current or fname) + '<main id="main">\n' + body + '</main>\n' + footer(extra_scripts)
    with open(os.path.join(OUT, fname), 'w', encoding='utf-8') as f:
        f.write(html)


# ------------------------------------------------------------------ 데이터
COURSES = [
    dict(id='hongsam', tier='예향 특품 메뉴', rank='만족도 1위', name='홍삼 정식', fish='부세', price='50,000', img='samhap',
         desc='목포를 대표하는 홍어삼합과 낙지, 활어회와 초밥, 큼직한 보리굴비까지 한 번에 즐기는 예향의 가장 풍성한 정식입니다.',
         items=['홍어삼합', '낙지', '회', '초밥', '스끼', '굴비 大']),
    dict(id='nakgul', tier='예향 진품 메뉴', rank='판매 1위', name='낙굴 정식', fish='부세', price='40,000', img='tangtang',
         desc='목포 낙지와 보리굴비의 만남. 낙지탕탕이·낙지호롱과 활어회, 보리굴비가 함께 나오는 요즘 가장 많이 찾으시는 상차림입니다.',
         items=['낙지', '회', '초밥', '스끼', '굴비 大']),
    dict(id='myeongpum', tier='예향 진품 메뉴', rank='', name='명품 정식', fish='부세', price='30,000', img='hoe-gulbi',
         desc='신선한 활어회와 울금 초밥, 다양한 스끼와 옛날 방식으로 손질해 조리한 큼직한 보리굴비가 함께하는 정성 가득한 한 상.',
         items=['회', '초밥', '스끼', '굴비 大']),
    dict(id='tteokgalbi', tier='예향 진품 메뉴', rank='', name='떡갈비랑 굴비랑', fish='부세', price='30,000', img='tteokgalbi',
         desc='국내산 한돈으로 직접 빚은 수제 떡갈비와 보리굴비를 함께. 어르신과 아이가 함께하는 가족 식사에 특히 좋습니다.',
         items=['수제 한돈 떡갈비', '초밥', '스끼', '굴비 大']),
    dict(id='gulbi', tier='점심 특선', rank='', name='굴비 정식', fish='부세', price='20,000', img='gulbi',
         desc='정갈한 기본 반찬과 해풍에 맛 들인 보리굴비 한 마리. 점심에 가볍고 든든하게 즐기는 목포식 보리굴비 정식입니다.',
         items=['기본반찬', '굴비 小'], foot='※ 점심특선 메뉴입니다.'),
]

SETS = [('2 ~ 3인', '140,000원'), ('3 ~ 4인', '160,000원'), ('4 ~ 5인', '200,000원')]

ORIGIN = [
    ('소고기', '국내산 한우'), ('부세굴비', '중국산'), ('넙치(광어)', '국내산'), ('명태(황태·북어)', '사용 안 함'),
    ('돼지고기', '국내산'), ('배추', '국내산'), ('조피볼락(우럭)', '국내산'), ('오징어', '국내산'),
    ('닭고기', '국내산'), ('고춧가루', '국내산'), ('참돔', '국내산'), ('참조기', '국내산'),
    ('오리고기', '사용 안 함'), ('콩·두부자반', '중국산'), ('아귀', '국내산'), ('꽃게장', '중국산'),
    ('양(염소고기)', '사용 안 함'), ('대두', '수입산'), ('낙지', '국내산'), ('꽃게찜', '국내산'),
    ('쌀(공기·죽·누룽지)', '국내산'), ('뱀장어(민물)', '사용 안 함'), ('고등어', '노르웨이산'), ('갈치', '국내산'),
    ('쭈꾸미', '국내산'), ('미꾸라지', '사용 안 함'), ('방어', '국내산'), ('가리비', '국내산'),
    ('우렁쉥이(멍게)', '국내산'), ('전복', '국내산'), ('떡갈비', '국내산 한돈'),
]

DRINKS_L = [('소주 <small>참이슬·잎새주·새로</small>', '5,000'), ('맥주 <small>카스·테라·켈리</small>', '5,000'),
            ('매실막걸리 <span class="menu-badge">BEST</span>', '9,000'), ('한라봉막걸리', '6,000'),
            ('막걸리 <small>보해순희</small>', '6,000'), ('청하', '8,000'),
            ('복분자 <span class="menu-badge">BEST</span>', '20,000'), ('매취순 5년', '20,000'), ('매취순 15년', '30,000'),
            ('화요 17도', '30,000'), ('화요 25도 <span class="menu-badge">BEST</span>', '60,000'),
            ('일품진로 <span class="menu-badge">BEST</span>', '35,000')]
DRINKS_R = [('고흥유자주 <span class="menu-badge">BEST</span>', '25,000'), ('마루 900ml', '40,000'),
            ('사케 <small>주전자</small>', '30,000'), ('사케 <small>1잔</small>', '10,000'), ('와인 한 잔', '8,000'),
            ('산토리 하이볼 <span class="menu-badge">BEST</span>', '8,000'), ('봄베이', '8,000'),
            ('카르멘 그란 리제르바 프리다칼로 까르메네르 750ml', '60,000'), ('골든블루 450ml', '170,000'),
            ('홍초', '5,000'), ('토닉워터', '2,000'), ('음료수', '2,000')]


def price_rows(rows):
    return '<ul class="price-list">' + ''.join(
        f'<li class="price-row"><strong>{n}</strong><span class="price">{p}원</span></li>' for n, p in rows) + '</ul>'


# ------------------------------------------------------------------ HOME
home = f'''<section class="hero" aria-labelledby="hero-title">
<div class="hero-shade"></div>
<div class="wrap hero-content">
{eyebrow('MOKPO · NAMDO DINING', light=True)}
<h1 id="hero-title">한 상에 담아낸<br><em>목포의 깊은 맛</em></h1>
<p>바다의 풍미를 품은 보리굴비와 정갈한 남도 음식.<br class="desktop-break"> 평화광장에서 특별한 식사 한 끼를 만나보세요.</p>
<div class="hero-actions">
<a class="button primary" href="tel:{TEL}">전화로 예약하기</a>
<a class="text-link light-link" href="menu.html">음식 둘러보기 {ARROW}</a>
</div>
</div>
<div class="wrap hero-bottom"><span>YEHYANG KOREAN DINING · SINCE 1969</span><span>전남 목포시 평화로 40</span></div>
</section>

<section class="promo-band" aria-label="연말 모임 안내">
<div class="wrap promo-inner">
<p class="promo-year"><span data-year>2026</span><small>YEAR END</small></p>
<div class="promo-copy"><strong>올해의 마지막 모임, 정성 가득한 한 상으로.</strong><p>송년회 · 가족 모임 · 회사 회식 — 전 좌석 개별 룸에서 조용하게 준비해 드립니다.</p></div>
<a class="text-link light-link" href="gathering.html#yearend">연말 모임 상담하기 {ARROW}</a>
</div>
</section>

<section class="intro-section section-pad" aria-labelledby="intro-title">
<div class="wrap intro-grid">
<div class="intro-lead">
{eyebrow('ABOUT YEHYANG')}
<h2 id="intro-title">좋은 음식으로<br>기억되는 <em>시간</em></h2>
</div>
<div class="intro-copy">
<p>예향한정식은 목포 평화광장에 자리한 남도 한정식 식당입니다. 목포의 식재료와 바다 음식이 어우러진 한 상을 선보입니다.</p>
<p>국내 1호 보리굴비 명장이 직접 손질한 보리굴비와 제철 활어회, 낙지 요리까지. 가족과 나누는 식사부터 소중한 분을 모시는 자리까지, 음식에 집중할 수 있는 편안한 시간을 준비합니다.</p>
<div class="intro-facts">
<div><b>평화광장</b><span>목포시 평화로 40</span></div>
<div><b>남도음식명가</b><span>12년 연속 선정</span></div>
<div><b>전 좌석 룸</b><span>2인부터 90인까지</span></div>
</div>
</div>
</div>
</section>

<section class="signature-section" aria-labelledby="signature-title">
<div class="signature-photo"><img src="assets/table-angle.webp" alt="보리굴비와 활어회, 남도 반찬이 차려진 예향의 한 상" loading="lazy"></div>
<div class="signature-content">
{eyebrow('OUR TABLE')}
<h2 id="signature-title">남도의 맛을<br><em>천천히 즐기다</em></h2>
<p>정성스럽게 차려낸 보리굴비와 다양한 남도 음식이 한 자리에서 어우러집니다. 계절과 식재료에 따라 달라지는 상차림을 즐겨보세요.</p>
<a class="text-link" href="menu.html">전체 메뉴 보기 {ARROW}</a>
</div>
</section>

<section class="menu-section section-pad" aria-labelledby="menu-title">
<div class="wrap">
<div class="section-heading">
<div>{eyebrow('SIGNATURE MENU')}<h2 id="menu-title">예향의 대표 음식</h2></div>
<p>한 끼를 풍성하게 채우는 목포의 맛</p>
</div>
<div class="menu-grid">
<article class="menu-card"><span class="menu-index">01 · 점심특선</span><div class="menu-icon fish-icon" aria-hidden="true">魚</div><h3>목포식 굴비 정식</h3><p>정갈한 기본 반찬과 해풍에 맛 들인 보리굴비</p><p class="menu-price">1인 20,000원</p></article>
<article class="menu-card"><span class="menu-index">02 · 판매 1위</span><div class="menu-icon" aria-hidden="true">珍</div><h3>낙굴 정식</h3><p>낙지 · 활어회 · 초밥 · 스끼 · 보리굴비(大)</p><p class="menu-price">1인 40,000원</p></article>
<article class="menu-card"><span class="menu-index">03 · 만족도 1위</span><div class="menu-icon" aria-hidden="true">特</div><h3>홍삼 정식</h3><p>홍어삼합 · 낙지 · 회 · 초밥 · 스끼 · 보리굴비(大)</p><p class="menu-price">1인 50,000원</p></article>
</div>
<p class="menu-note">명품 정식·떡갈비랑 굴비랑(1인 30,000원), 목포식 한정식(2~5인)과 단품 요리는 <a href="menu.html">전체 메뉴</a>에서 확인하세요.</p>
</div>
</section>

<section class="section-pad cream-bg" aria-labelledby="story-title">
<div class="wrap">
<div class="section-heading">
<div>{eyebrow('TASTE, SPACE &amp; STORIES')}<h2 id="story-title">목포의 맛, 그리고 이야기</h2></div>
<p>한 상의 정성과 함께하는 순간을 만나보세요.</p>
</div>
<div class="story-grid">
<a class="story-card" href="menu.html#table-story"><figure><img src="assets/table-top.webp" alt="한 상 가득 차려진 예향 정식" loading="lazy"></figure><div><span>MENU</span><h3>한 상의 이야기</h3><p>정식별 상차림을 사진으로 살펴보세요.</p><b>메뉴 보기 →</b></div></a>
<a class="story-card" href="space.html"><figure><img src="assets/hoe-platter.webp" alt="정갈하게 담아낸 활어회" loading="lazy"></figure><div><span>SPACE</span><h3>전 좌석 개별 룸</h3><p>룸·별실 12실, 최대 90명까지.</p><b>공간 보기 →</b></div></a>
<a class="story-card" href="gathering.html"><figure><img src="assets/spread.webp" alt="여럿이 함께하는 한정식 상차림" loading="lazy"></figure><div><span>GATHERINGS</span><h3>모임별 안내</h3><p>상견례·가족 모임·접대·회식.</p><b>모임 안내 →</b></div></a>
<a class="story-card" href="news.html"><figure><img src="assets/dosirak.webp" alt="목포 프리미엄 한정식 도시락" loading="lazy"></figure><div><span>NEWS</span><h3>예향 소식</h3><p>새 메뉴와 이벤트, 휴무 안내.</p><b>소식 보기 →</b></div></a>
</div>
</div>
</section>

<section class="gathering-section section-pad" aria-labelledby="gathering-title">
<div class="wrap gathering-grid">
<div>
{eyebrow('GATHER TOGETHER', light=True)}
<h2 id="gathering-title">함께하는 날,<br>더 오래 기억될 식사</h2>
<p>가족 모임, 손님 접대, 특별한 기념일. 넉넉한 상차림과 별실에서 소중한 사람들과 식사하는 시간을 가져보세요.</p>
<a class="button outline" href="gathering.html">모임 안내 보기</a>
</div>
<div class="gathering-details">
<div><span>01</span><strong>가족 모임</strong><p>온 가족이 함께 둘러앉는 편안한 자리</p></div>
<div><span>02</span><strong>소중한 만남</strong><p>상견례·손님 접대처럼 격식을 갖춘 식사와 대화가 필요한 날</p></div>
<div><span>03</span><strong>단체 식사</strong><p>최대 90명까지, 인원과 자리 구성은 전화로 상담해 주세요</p></div>
</div>
</div>
</section>

<section class="section-pad" aria-labelledby="book-title">
<div class="wrap">
<div class="section-heading center">
{eyebrow('RESERVATION', extra='center')}
<h2 id="book-title">편하신 방법으로 예약하세요</h2>
<p>소중한 만남, 함께 준비하겠습니다.</p>
</div>
<div class="booking-grid">
<div class="booking-card"><span>NAVER</span><h3>네이버 예약</h3><p>날짜·시간·인원을 골라 바로 예약하세요. 예약 후 방문하시면 대기 없이 안내해 드립니다.</p><a class="button primary" href="{NAVER_BOOK}" target="_blank" rel="noopener">네이버 예약하기</a></div>
<div class="booking-card"><span>CALL</span><h3>전화 예약</h3><p class="phone">{TEL}</p><p>단체·상견례·도시락 주문은 전화 상담이 가장 정확합니다.</p><a class="button dark" href="tel:{TEL}">전화 걸기</a></div>
<div class="booking-card"><span>GUIDE</span><h3>예약 전 안내</h3><p>매일 11:00–21:00 영업, 14:30–17:00 브레이크타임, 라스트오더 20:00입니다.</p><a class="button pale" href="reservation.html">예약 안내 보기</a></div>
</div>
</div>
</section>

<section class="visit-section section-pad cream-bg" aria-labelledby="visit-title">
<div class="wrap visit-grid">
<div class="visit-info">
{eyebrow('VISIT US')}
<h2 id="visit-title">예향에서 뵙겠습니다</h2>
<p style="color:var(--muted);margin:14px 0 30px">목포 평화광장 바로 앞, 편하게 찾아오세요.</p>
<div class="info-row"><span>주소</span><p><strong>{ADDR}</strong><small>{NAME}</small></p></div>
<div class="info-row"><span>전화</span><p><strong>{TEL}</strong><small>방문 및 단체 예약 문의</small></p></div>
<div class="info-row"><span>영업 안내</span><p><strong>매일 11:00 – 21:00</strong><small>브레이크타임 14:30 – 17:00 · 라스트오더 20:00<br>명절 당일 휴무는 소식에서 안내드립니다.</small></p></div>
<div class="info-row"><span>주차</span><p><strong>평화광장 무료 공영주차장</strong><small>매장에서 도보 1분 거리</small></p></div>
<div class="visit-actions"><a class="button dark" href="visit.html">오시는 길 보기</a><a class="button pale" href="tel:{TEL}">전화 걸기</a></div>
</div>
<a class="map-teaser" href="visit.html" aria-label="오시는 길 페이지로 이동">
<div class="map-teaser-inner"><span class="eyebrow">MOKPO · PEACE SQUARE</span><strong>평화로 40,<br>예향에서 만나요.</strong><span class="text-link">지도와 길 안내 보기 {ARROW}</span></div>
</a>
</div>
</section>
'''

ld = {
    "@context": "https://schema.org", "@type": "Restaurant", "name": NAME,
    "servesCuisine": ["한정식", "보리굴비", "남도음식"], "telephone": "+82-61-262-9595", "priceRange": "₩20,000~₩200,000",
    "address": {"@type": "PostalAddress", "streetAddress": "평화로 40", "addressLocality": "목포시", "addressCountry": "KR"},
    "geo": {"@type": "GeoCoordinates", "latitude": 34.794817, "longitude": 126.4299216},
    "openingHoursSpecification": [
        {"@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], "opens": "11:00", "closes": "14:30"},
        {"@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], "opens": "17:00", "closes": "21:00"}],
    "acceptsReservations": "True", "sameAs": [NAVER_PLACE, INSTA, BLOG]
}
page('index.html', f'목포 한정식 · 보리굴비 맛집 | {NAME}',
     '목포 평화광장 예향한정식 공식 홈페이지. 국내 1호 보리굴비 명장이 손질한 보리굴비 정식, 낙굴 정식, 목포식 한정식과 상견례·가족 모임 예약 안내.',
     home, extra_head=f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>\n')

# ------------------------------------------------------------------ ABOUT
about = inner_hero('about-hero', 'ABOUT YEHYANG', '정성을 담은<br>목포의 한 상', '평화광장에서 만나는 남도의 음식 이야기.') + f'''
<section class="intro-section section-pad">
<div class="wrap intro-grid">
<div class="intro-lead">
{eyebrow('OUR STORY')}
<h2>한 상에 담긴<br><em>남도의 맛</em></h2>
</div>
<div class="intro-copy">
<p>남도의 맛과 멋, 목포의 바다를 한 상에 담습니다. 예향한정식은 목포 평화광장에 자리한 한정식 식당으로, 직접 손질해 내는 보리굴비 정식과 제철 활어회, 낙지탕탕이·연포탕 같은 목포의 향토 음식이 이곳의 상차림을 이룹니다.</p>
<p>풍부한 찬을 채운 정갈한 상차림에 ‘집밥의 정성’과 ‘전통 한식의 품격’을 함께 담고자 합니다. 굴비는 손님이 드시기 편하도록 자리에서 하나하나 손질해 드립니다.</p>
<div class="intro-facts">
<div><b>Since 1969</b><span>목포식 한정식</span></div>
<div><b>국내 1호</b><span>보리굴비 명장</span></div>
<div><b>위생등급</b><span>매우 우수 (별 3개)</span></div>
</div>
</div>
</div>
</section>

<section class="signature-section">
<div class="signature-photo"><img src="assets/chef-award.webp" alt="농림축산식품부 장관상을 받은 예향한정식 오선영 대표" loading="lazy"></div>
<div class="signature-content">
{eyebrow('THE CHEF')}
<h2>대한민국이 인정한<br><em>한식의 명인</em></h2>
<p>목포 조리명인 오선영 대표가 직접 보리굴비를 손질합니다. 한식·중식·양식 조리 자격을 갖추고 호텔조리학을 다시 공부할 만큼, 손님을 위한 맛을 꾸준히 연구해 왔습니다. 2026 대한민국 국제요리&amp;제과 경연대회에서 농림축산식품부 장관상을 받았습니다.</p>
<a class="text-link" href="menu.html">메뉴 살펴보기 {ARROW}</a>
</div>
</section>

<section class="section-pad cream-bg">
<div class="wrap">
<div class="section-heading">
<div>{eyebrow('CERTIFIED')}<h2>믿고 찾는 이유</h2></div>
<p>오랜 시간 한결같이 지켜온 맛과 정성</p>
</div>
<div class="award-grid">
<article><span>전라남도</span><h3>남도음식명가<br>12년 연속 선정</h3><p>전라남도가 지정한 남도음식명가로, 목포문화관광에도 소개된 식당입니다.</p></article>
<article><span>AWARD</span><h3>농림축산식품부 장관상<br>보건복지부 장관상</h3><p>2026 대한민국 국제요리&amp;제과 경연대회 농림축산식품부 장관상 수상.</p></article>
<article><span>전남 · 목포</span><h3>으뜸맛집 인증<br>모범음식점</h3><p>전라남도와 목포시가 인증한 으뜸맛집입니다.</p></article>
<article><span>식품의약품안전처</span><h3>음식점 위생등급<br>매우 우수</h3><p>위생등급 최고 등급(별 3개)을 받은 매장입니다.</p></article>
<article><span>농림축산식품부</span><h3>안심식당</h3><p>덜어 먹는 도구 제공, 위생적인 수저 관리, 종사자 마스크 착용을 지킵니다.</p></article>
<article><span>2026. 10</span><h3>제31회 남도음식문화큰잔치<br>목포시 대표 참가</h3><p>목포를 대표하는 남도음식으로 참여했습니다.</p></article>
</div>
</div>
</section>

<section class="gathering-section section-pad">
<div class="wrap gathering-grid">
<div>
{eyebrow('AT THE TABLE', light=True)}
<h2>함께 나누는<br><em>맛과 시간</em></h2>
<p>가족 식사와 소중한 만남을 위해 정갈한 상차림을 준비합니다. 식사 후에는 평화광장의 바다를 따라 산책하며 목포 여행을 이어가 보세요.</p>
<a class="button outline" href="gathering.html">모임 안내 보기</a>
</div>
<div>
<p class="eyebrow light"><span class="line"></span>NEARBY</p>
<ul class="nearby-list">
<li><b>평화광장 · 춤추는 바다분수</b><span>도보 1분</span></li>
<li><b>목포역</b><span>차량 약 12분</span></li>
<li><b>목포 동부시장</b><span>차량 약 13분</span></li>
<li><b>목포해상케이블카</b><span>차량 약 19분</span></li>
<li><b>삼학도 유람선 크루즈</b><span>목포 여행 코스</span></li>
</ul>
</div>
</div>
</section>

<section class="about-cta section-pad">
<div class="wrap">
<p class="eyebrow light" style="justify-content:center"><span class="line"></span>YEHYANG IN MOKPO</p>
<h2>목포에서, 예향에서</h2>
<p>{ADDR}</p>
<a class="button outline" href="visit.html">오시는 길</a>
</div>
</section>
'''
page('about.html', f'예향 이야기 · 남도음식명가 | {NAME}',
     '남도음식명가 12년 연속 선정, 국내 1호 보리굴비 명장. 목포 평화광장 예향한정식의 이야기와 인증·수상 내역을 소개합니다.', about)

# ------------------------------------------------------------------ MENU
course_cards = ''
for c in COURSES:
    rank = f'<span class="rank-badge">{c["rank"]}</span>' if c['rank'] else ''
    foot = c.get('foot', '')
    course_cards += f'''<article class="course-card" id="{c['id']}">
<figure><img src="assets/{c['img']}.webp" alt="{c['name']}" loading="lazy"></figure>
<div class="course-body">
<div class="course-top"><span class="course-tier">{c['tier']}</span>{rank}</div>
<h3>{c['name']} <small>({c['fish']})</small></h3>
<p class="course-price"><small>1인</small>{c['price']}원</p>
<p class="course-desc">{c['desc']}</p>
{chips(c['items'])}
<p class="course-foot">1인 1찬 기준 · 굴비는 부세를 사용합니다. {foot}</p>
</div>
</article>
'''

tabs_data = [
    ('nakgul', '낙굴 정식', '1인 40,000원', 'table-top', '낙지와 활어회, 초밥, 스끼, 보리굴비가 차례로 차려지는 예향의 판매 1위 상차림입니다.', ['낙지', '회', '초밥', '스끼', '굴비 大']),
    ('hongsam', '홍삼 정식', '1인 50,000원', 'hongsam', '홍어삼합에 낙지, 회·초밥, 보리굴비까지 목포의 맛을 모두 담았습니다.', ['홍어삼합', '낙지', '회', '초밥', '스끼', '굴비 大']),
    ('myeongpum', '명품 정식', '1인 30,000원', 'hoe-gulbi', '활어회와 울금 초밥, 큼직한 보리굴비가 함께 나옵니다.', ['회', '초밥', '스끼', '굴비 大']),
    ('set', '목포식 한정식', '2~5인 140,000원부터', 'spread', '활어회를 중심으로 지역 특산물과 제철 음식으로 한 상 가득 차려 드립니다.', ['활어회', '지역 특산물', '제철 음식']),
    ('gulbi', '굴비 정식', '1인 20,000원 · 점심특선', 'gulbi-grill', '기본 반찬과 보리굴비. 울금밥을 울금물에 살짝 말아 굴비 한 점을 올려 드셔보세요.', ['기본반찬', '굴비 小']),
]
tab_btns = ''.join(
    f'<button type="button" role="tab" id="tab-{k}" aria-controls="panel-{k}" aria-selected="{"true" if i == 0 else "false"}" tabindex="{0 if i == 0 else -1}">{n}</button>'
    for i, (k, n, *_r) in enumerate(tabs_data))
tab_panels = ''.join(f'''<div class="tab-panel" role="tabpanel" id="panel-{k}" aria-labelledby="tab-{k}"{'' if i == 0 else ' hidden'}>
<figure><img src="assets/{img}.webp" alt="{n} 상차림" loading="lazy"></figure>
<div><p class="eyebrow light"><span class="line"></span>HANJEONGSIK</p><h3>{n}</h3><p class="course-price">{p}</p><p>{d}</p>{chips(items)}
<a class="text-link light-link" href="{NAVER_BOOK}" target="_blank" rel="noopener">{n} 예약하기 {ARROW}</a></div>
</div>
''' for i, (k, n, p, img, d, items) in enumerate(tabs_data))

origin_html = ''.join(f'<div><b>{a}</b><span>{b}</span></div>' if a else '<div aria-hidden="true"></div>' for a, b in ORIGIN)

menu = inner_hero('menu-hero', 'OUR MENU', '메뉴 안내', '정갈한 한 상에 담은 목포의 맛, 소중한 분들과 함께 나누세요.') + f'''
<nav class="subnav" aria-label="메뉴 바로가기"><div class="wrap">
<a href="#courses">정식 메뉴</a><a href="#mokpo-set">목포식 한정식</a><a href="#single">단품 요리</a><a href="#table-story">한 상의 이야기</a><a href="#special">도시락·계절</a><a href="#drinks">주류</a><a href="#origin">원산지</a>
</div></nav>

<section class="wrap inner-content">
<div class="menu-intro">
{eyebrow('WHY YEHYANG')}
<h2>왜, 예향일까요?</h2>
<p class="lead-copy">소중한 분을 대접하는 마음으로 한 상을 준비합니다. 국내 1호 보리굴비 명장이 손질한 보리굴비와 목포 바다의 제철 활어회, 낙지 요리를 정갈하게 담고, 함께 나누는 식사에 따뜻한 마음을 더합니다.</p>
</div>

<div id="courses" class="course-list" style="scroll-margin-top:30px">
{course_cards}</div>

<section class="price-section" id="mokpo-set" style="margin-top:70px">
<div class="price-title">{eyebrow('SIGNATURE COURSE')}<h2>목포식 한정식</h2><p>시그니처 코스 Best 1위 · 활어회를 중심으로 지역 특산물과 제철 음식으로 한 상 가득 차린 회 한정식입니다.</p></div>
<div>
<table class="set-table"><caption class="sr-only" style="position:absolute;left:-9999px">목포식 한정식 인원별 가격</caption>
{''.join(f'<tr><th scope="row">{a}</th><td>{b}</td></tr>' for a, b in SETS)}
</table>
<p class="small-note">4~5인 특정식은 특별한 제철 메뉴가 더해진 업그레이드 구성입니다. 철따라 맛보는 목포 9미 계절 한상(1인 40,000원)도 준비합니다.</p>
</div>
</section>

<section class="price-section" id="single">
<div class="price-title">{eyebrow('À LA CARTE')}<h2>예향 단품 요리</h2><p>한 상에 더하는 목포의 별미</p></div>
<ul class="price-list">
<li class="price-row"><strong>낙지탕탕이 · 낙지호롱 · 홍어삼합<span class="sub">청양고추·마늘·참기름의 낙지탕탕이, 생낙지로 만든 낙지호롱, 국내산 홍어와 삼겹살·묵은지의 홍어삼합</span></strong><span class="price-multi"><span class="price"><small>한 접시</small>60,000원</span><span class="price"><small>반 접시</small>30,000원</span></span></li>
<li class="price-row"><strong>연포탕 · 초밥 · 산낙지비빔밥 · 회덮밥<span class="sub">예향만의 비법이 담긴 진한 연포탕</span></strong><span class="price">40,000원</span></li>
<li class="price-row"><strong>(수제 한돈) 떡갈비</strong><span class="price"><small>한 접시</small>30,000원</span></li>
</ul>
</section>
</section>

<section class="table-story section-pad" id="table-story" aria-labelledby="ts-title" style="scroll-margin-top:0">
<div class="wrap">
<div class="section-heading">
<div>{eyebrow('OUR TABLE, IN PICTURES', light=True)}<h2 id="ts-title">한 상의 이야기</h2></div>
<p>메뉴를 선택해 상차림을 살펴보세요.</p>
</div>
<div data-tabs>
<div class="tab-list" role="tablist" aria-label="상차림 선택">{tab_btns}</div>
{tab_panels}</div>
</div>
</section>

<section class="wrap inner-content">
<section class="price-section" id="special" style="border-top:0;padding-top:0">
<div class="price-title">{eyebrow('TAKE-OUT &amp; SEASON')}<h2>도시락 · 계절 메뉴</h2><p>행사·모임 도시락과 철따라 달라지는 한 상</p></div>
<ul class="price-list">
<li class="price-row"><strong>목포 프리미엄 한정식 도시락 <span class="menu-badge">NEW</span><span class="sub">고소한 보리굴비 · 쫄깃한 낙지호롱 · 육즙 가득 수제 떡갈비를 한 도시락에</span></strong><span class="price">20,000원</span></li>
<li class="price-row"><strong>계절 메뉴 <span class="menu-badge">제철</span><span class="sub">목포를 대표하는 9미, 제철에만 맛볼 수 있는 맞춤형 한상차림 (철따라 달라질 수 있습니다)</span></strong><span class="price">40,000원</span></li>
<li class="price-row"><strong>3분 간편 영광 찐 보리굴비 택배<span class="sub">집에서도 간편하게 즐기는 보리굴비, 전화로 주문받습니다</span></strong><span class="price"><a href="tel:{TEL}">전화 주문</a></span></li>
</ul>
</section>

<section class="price-section" id="drinks">
<div class="price-title">{eyebrow('DRINKS')}<h2>예향 주류 메뉴</h2><p>콜키지 가능 · 병당 20,000원 (최대 2병)</p></div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:0 40px">
{price_rows(DRINKS_L)}
{price_rows(DRINKS_R)}
</div>
</section>

<section class="price-section" id="origin">
<div class="price-title">{eyebrow('ORIGIN')}<h2>원산지 안내</h2><p>쌀은 국내산만 사용합니다.</p></div>
<div class="origin-grid">{origin_html}</div>
</section>

<div class="source-note">
<p>메뉴와 가격은 2026년 11월 매장 메뉴판 기준입니다. 요리 구성은 계절과 재료 수급에 따라 달라질 수 있으니 방문 전 확인해 주세요.</p>
<a class="button dark" href="tel:{TEL}">전화로 메뉴 확인하기</a>
</div>
</section>
'''
page('menu.html', f'메뉴 안내 · 보리굴비 정식·낙굴 정식 | {NAME}',
     '홍삼 정식 50,000원 · 낙굴 정식 40,000원 · 명품 정식 30,000원 · 점심특선 굴비 정식 20,000원, 목포식 한정식 2~5인. 예향한정식 메뉴와 원산지를 확인하세요.', menu)

# ------------------------------------------------------------------ SPACE
space = inner_hero('space-hero', 'OUR SPACE', '공간 안내', '함께하는 인원에 맞춰, 편안한 만남의 공간을 준비합니다.') + f'''
<section class="intro-section section-pad">
<div class="wrap intro-grid">
<div class="intro-lead">
{eyebrow('PRIVATE ROOMS')}
<h2>음식과 대화에만<br><em>집중하는 자리</em></h2>
</div>
<div class="intro-copy">
<p>예향한정식은 개별 룸으로 이루어져 있어 조용하게 식사하실 수 있습니다. 룸마다 냉난방이 따로 갖춰져 있어 계절에 상관없이 편안합니다.</p>
<p>두 분의 식사부터 90명 단체 모임까지, 인원과 목적에 맞는 자리를 예약 상담 때 배정해 드립니다.</p>
<div class="stat-row">
<div><strong>12실</strong><span>룸 · 별실</span></div>
<div><strong>90석</strong><span>전체 좌석 (테이블 80석)</span></div>
<div><strong>2–90명</strong><span>룸 · 단체석 이용 인원</span></div>
</div>
</div>
</div>
</section>

<section class="signature-section">
<div class="signature-photo"><img src="assets/group-table.webp" alt="여럿이 함께 앉는 단체석에 차려진 한정식 상" loading="lazy"></div>
<div class="signature-content">
{eyebrow('FOR EVERY GATHERING')}
<h2>작은 만남부터<br><em>큰 모임까지</em></h2>
<p>상견례와 접대처럼 격식이 필요한 자리는 조용한 룸으로, 회식과 단체 모임은 여럿이 함께 앉을 수 있는 단체석으로 준비합니다. 이용 가능 여부와 룸 배정은 예약 상담 시 확인해 주세요.</p>
<a class="text-link" href="reservation.html">이 공간으로 문의 {ARROW}</a>
</div>
</section>

<section class="section-pad cream-bg">
<div class="wrap">
<div class="section-heading">
<div>{eyebrow('FACILITIES')}<h2>편의시설 및 서비스</h2></div>
<p>모두가 편안한 식사를 위해</p>
</div>
<div class="feature-grid">
<div><b>개별 룸</b><span>룸·별실 12실, 룸별 냉난방</span></div>
<div><b>단체석</b><span>최소 2명 ~ 최대 90명</span></div>
<div><b>무료 주차</b><span>평화광장 공영주차장, 도보 1분</span></div>
<div><b>대기 공간</b><span>출입구 앞 대기석 마련</span></div>
<div><b>휠체어 이용</b><span>출입구·좌석 휠체어 이용 가능</span></div>
<div><b>유아 의자</b><span>아이와 함께하는 가족 식사</span></div>
<div><b>남/녀 화장실 구분</b><span>쾌적한 화장실</span></div>
<div><b>포장 · 도시락</b><span>프리미엄 한정식 도시락</span></div>
<div><b>콜키지</b><span>병당 20,000원, 최대 2병</span></div>
<div><b>결제</b><span>카드·간편결제·제로페이·지역화폐</span></div>
<div><b>반려동물</b><span>동반 입장은 어렵습니다</span></div>
<div><b>전화 예약</b><span>{TEL}</span></div>
</div>
</div>
</section>

<section class="section-pad center-cta">
<div class="wrap">
{eyebrow('RESERVATION', extra='center')}
<h2>원하시는 자리를 알려주세요</h2>
<p>날짜와 인원, 모임 목적을 말씀해 주시면 알맞은 공간을 안내해 드립니다.</p>
<a class="button primary" href="tel:{TEL}">전화 예약 문의</a>
</div>
</section>
'''
page('space.html', f'공간 안내 · 전 좌석 개별 룸 | {NAME}',
     '룸·별실 12실, 전체 90석. 2인부터 90인 단체까지 상견례·가족 모임·회식을 위한 예향한정식의 공간과 편의시설을 안내합니다.', space)

# ------------------------------------------------------------------ GATHERING
OCC = [
    ('meeting', 'MEETING', '상견례', '두 가족의 첫 만남을 정갈한 한 상으로.', 'abalone',
     '격식을 갖춘 상차림과 조용한 개별 룸에서 대화에 집중하실 수 있도록 준비합니다. 어르신 입맛에 맞는 보리굴비와 남도 음식이 자연스럽게 이야기를 이어 줍니다.',
     ['양가 인원과 희망 시간을 먼저 알려주세요.', '홍삼 정식·목포식 한정식 등 메뉴를 미리 정해 두시면 편합니다.', '조용한 룸으로 배정해 드립니다.']),
    ('family', 'FAMILY', '가족 모임', '온 가족이 둘러앉는 편안한 자리.', 'tteokgalbi',
     '생신, 기념일, 부모님 모시는 날. 아이를 위한 유아 의자와 떡갈비 메뉴, 어르신을 위한 휠체어 이용 좌석까지 세심하게 준비합니다.',
     ['유아 의자·휠체어 이용이 필요하시면 말씀해 주세요.', '떡갈비랑 굴비랑 정식은 아이와 함께하기 좋습니다.', '식사 후 평화광장 산책을 추천합니다.']),
    ('business', 'BUSINESS', '접대 · 회식', '손님을 모시는 자리, 품격 있게.', 'samhap',
     '목포의 대표 음식인 홍어삼합과 낙지, 활어회로 손님께 목포의 맛을 소개해 보세요. 단체석은 최대 90명까지 이용할 수 있습니다.',
     ['인원과 예산을 알려주시면 메뉴를 제안해 드립니다.', '콜키지 가능 (병당 20,000원, 최대 2병).', '평화광장 무료 공영주차장을 이용하세요.']),
    ('travel', 'TRAVEL', '목포 여행 식사', '목포에서의 하루에 맛있는 기억을 더하다.', 'gulbi-grill',
     '평화광장 바로 앞이라 바다분수, 해상케이블카, 삼학도 크루즈와 함께 여행 코스로 들르기 좋습니다. 점심에는 굴비 정식, 저녁에는 낙굴 정식을 추천합니다.',
     ['주말·여행 성수기에는 예약을 권장합니다.', '네이버 예약으로 날짜와 인원을 간편하게 정하세요.', '보리굴비 택배로 여행의 맛을 집까지 이어가세요.']),
    ('yearend', 'YEAR END', '송년회 · 연말 모임', '올해의 마지막 모임, 정성 가득한 한 상으로.', 'spread',
     '고마웠던 사람들과 한 해를 마무리하는 자리. 연말에는 예약이 몰리니 날짜와 인원을 일찍 알려주시면 자리와 메뉴를 넉넉히 준비해 드립니다.',
     ['12월 주말 저녁은 일찍 마감될 수 있습니다.', '인원이 많으면 단체석으로 배정해 드립니다.', '목포식 한정식(2~5인)으로 테이블별 주문이 편합니다.']),
    ('dosirak', 'CATERING', '단체 · 행사 도시락', '정성 가득한 한 상을 도시락에.', 'dosirak',
     '보리굴비, 낙지호롱, 수제 떡갈비를 한 도시락에 담은 목포 프리미엄 한정식 도시락(20,000원). 각종 모임과 행사 도시락으로 준비해 드립니다.',
     ['수량과 받으실 날짜·시간을 전화로 알려주세요.', '대량 주문은 미리 상담해 주시면 좋습니다.', '포장 주문도 가능합니다.']),
]
occ_html = ''
for k, en, ko, tag, img, desc, checks in OCC:
    occ_html += f'''<section class="occasion-detail" id="{k}">
<figure><img src="assets/{img}.webp" alt="{ko}" loading="lazy"></figure>
<div>
{eyebrow(en)}
<h2>{ko}</h2>
<h3>{tag}</h3>
<p>{desc}</p>
<ul class="check-list">{''.join(f'<li>{c}</li>' for c in checks)}</ul>
<div class="occasion-actions"><a class="button primary" href="tel:{TEL}">{ko} 문의</a><a class="text-link" href="space.html">공간 먼저 둘러보기 {ARROW}</a></div>
</div>
</section>
'''

gathering = inner_hero('gathering-hero', 'GATHER TOGETHER', '좋은 날,<br>좋은 사람들과', '소중한 만남의 순간, 정성으로 차린 한 상을 준비합니다.') + f'''
<nav class="subnav" aria-label="모임 바로가기"><div class="wrap">
{''.join(f'<a href="#{k}">{ko}</a>' for k, en, ko, *_r in OCC)}
</div></nav>
<section class="wrap inner-content">
<div class="menu-intro">
{eyebrow('OCCASIONS')}
<h2>모임의 순간마다</h2>
<p>만남의 목적에 맞는 메뉴와 자리를 안내해 드립니다. 인원과 자리 구성은 전화로 상담해 주세요.</p>
</div>
{occ_html}
</section>

<section class="gathering-section section-pad">
<div class="wrap gathering-grid">
<div>
{eyebrow('PRIVATE DINING', light=True)}
<h2>편안하게 모이는<br>예향의 자리</h2>
<p>룸·별실 12실과 최대 90명까지 이용 가능한 단체석을 갖추고 있습니다. 방문 인원에 맞는 자리와 메뉴는 예약 전 전화로 확인해 주세요.</p>
<a class="button outline" href="tel:{TEL}">전화 예약 문의</a>
</div>
<div class="gathering-details">
<div><span>01</span><strong>날짜 · 인원</strong><p>모임 날짜와 예상 인원을 먼저 알려주세요.</p></div>
<div><span>02</span><strong>메뉴 · 공간</strong><p>목적에 맞는 메뉴와 룸을 상담으로 안내합니다.</p></div>
<div><span>03</span><strong>예약 확정</strong><p>매장 확인 후 최종 확정 연락을 드립니다.</p></div>
</div>
</div>
</section>

<section class="section-pad center-cta">
<div class="wrap">
{eyebrow('RESERVATION', extra='center')}
<h2>모임을 계획하고 계신가요?</h2>
<p>일정, 인원, 메뉴를 전화로 상담해 드립니다.</p>
<a class="button primary" href="tel:{TEL}">{TEL}</a>
</div>
</section>
'''
page('gathering.html', f'모임 안내 · 상견례·가족 모임·회식 | {NAME}',
     '상견례, 가족 모임, 접대·회식, 목포 여행 식사, 송년회와 단체 도시락. 만남의 목적에 맞는 예향한정식의 메뉴와 공간을 안내합니다.', gathering)

# ------------------------------------------------------------------ NEWS
NEWS = [
    ('2026.11.13', 'EVENT', '네이버 예약·리뷰로 적립 혜택 — 맛동여지도 광주·전라남도편', '네이버 Pick 인기맛집 기획전에 참여합니다. 행사 기간(2026.11.11 ~ 11.30) 동안 네이버 예약 후 방문하면 1,000원, 예약 리뷰를 쓰면 1,000원이 추가로 적립됩니다. 커넥트 매장 네이버페이 결제 시 최대 20% 추가 적립.', 'spread'),
    ('2026.11.06', 'NEW', '목포 프리미엄 한정식 도시락 출시', '고소한 보리굴비, 쫄깃한 낙지호롱, 육즙 가득한 수제 떡갈비까지 세 가지 메인 요리를 하나의 도시락에 담았습니다. 소중한 분들과의 식사, 각종 모임과 행사 도시락으로 즐겨보세요.', 'dosirak'),
    ('2026.10.28', 'NEWS', '제31회 남도음식문화큰잔치 목포시 대표 참가', '목포 예향한정식이 제31회 남도음식문화큰잔치에 목포시를 대표하는 남도음식으로 참여했습니다.', 'table-top'),
    ('2026.06.05', 'AWARD', '2026 국제요리대회 농림축산식품부 장관상 수상', '2026 대한민국 국제요리 &amp; 제과 경연대회에서 농림축산식품부 장관상을 받았습니다. 앞으로도 좋은 식재료와 정성 어린 음식으로 보답하겠습니다.', 'chef-award'),
    ('2026.02.05', 'NOTICE', '설날 당일 하루 휴무 안내', '설날 당일 하루만 휴무하며, 연휴 전·후에는 정상 영업합니다. 명절 휴무는 매년 소식으로 미리 안내드립니다.', None),
]
news_items = ''.join(f'''<li class="news-item">
<div class="news-meta"><time datetime="{d.replace('.', '-')}">{d}</time><span class="news-tag">{t}</span></div>
<div><h3>{h}</h3><p>{b}</p></div>
{f'<figure><img src="assets/{img}.webp" alt="" loading="lazy"></figure>' if img else '<div></div>'}
</li>''' for d, t, h, b, img in NEWS)
news = inner_hero('news-hero', 'NEWS &amp; NOTICE', '예향 소식', '새 메뉴와 이벤트, 휴무 안내를 전해드립니다.') + f'''
<section class="wrap inner-content">
<ul class="news-list">
{news_items}
</ul>
<div class="channel-row">
<a class="button dark" href="{NAVER_FEED}" target="_blank" rel="noopener">네이버 소식 전체 보기</a>
<a class="button pale" href="{INSTA}" target="_blank" rel="noopener">인스타그램</a>
<a class="button pale" href="{BLOG}" target="_blank" rel="noopener">네이버 블로그</a>
</div>
</section>
'''
page('news.html', f'예향 소식 · 이벤트·공지 | {NAME}',
     '예향한정식의 새 메뉴, 이벤트, 수상 소식과 명절 휴무 안내.', news)

# ------------------------------------------------------------------ VISIT
visit = inner_hero('visit-hero', 'FIND US', '오시는 길', '소중한 분들과 함께 걸음해 주시는 마음, 깊이 감사드립니다.') + f'''
<section class="wrap inner-content">
<div class="menu-intro">
{eyebrow('LOCATION')}
<h2>전남 목포시 평화로 40</h2>
<p>{NAME} · 목포 평화광장 바로 앞</p>
</div>
<div class="map-frame">
<div class="visit-map" id="visit-map" role="region" aria-label="예향한정식 위치 지도">
<div class="map-placeholder"><strong>목포 평화로 40</strong><p>매장 위치와 길 안내를 확인하세요.</p><a class="button dark" href="{NAVER_MAP}" target="_blank" rel="noopener">네이버 지도 열기</a></div>
</div>
</div>
<p class="map-help">지도 데이터 © OpenStreetMap 기여자 · 네이버 지도에 <b>[목포 예향]</b>을 검색하면 쉽게 찾아오실 수 있습니다.</p>

<div class="visit-detail-grid">
<div class="visit-detail"><span>ADDRESS</span><h3>매장 주소</h3><p>{ADDR}<br>지번 · 목포시 상동 1153-1</p></div>
<div class="visit-detail"><span>CALL</span><h3>예약 및 문의</h3><p><a href="tel:{TEL}">{TEL}</a><br>네이버 스마트콜 {TEL2}</p></div>
<div class="visit-detail"><span>PARKING</span><h3>주차 안내</h3><p>매장에서 도보 1분, 평화광장 무료 공영주차장을 이용해 주세요.</p></div>
</div>
<div class="visit-actions">
<a class="button dark" href="{NAVER_MAP}" target="_blank" rel="noopener">네이버 지도로 길찾기</a>
<a class="button pale" href="{KAKAO_MAP}" target="_blank" rel="noopener">카카오맵 길찾기</a>
<a class="button pale" href="tel:{TEL}">전화 걸기</a>
</div>

<div class="way-grid">
<div>
{eyebrow('HOURS')}
<h2>영업 안내</h2>
<table class="hours-table">
<tr><th scope="row">영업시간</th><td>매일 11:00 – 21:00</td></tr>
<tr><th scope="row">브레이크타임</th><td>14:30 – 17:00</td></tr>
<tr><th scope="row">라스트오더</th><td>20:00</td></tr>
<tr><th scope="row">휴무</th><td>설날·추석 당일 (연휴 전후 정상 영업)<br><small style="color:#857c71">휴무 일정은 <a href="news.html" style="text-decoration:underline">예향 소식</a>에서 미리 안내드립니다.</small></td></tr>
<tr><th scope="row">점심특선</th><td>목포식 굴비 정식 1인 20,000원</td></tr>
</table>
</div>
<div>
{eyebrow('DIRECTIONS')}
<h2>주변에서 오시는 길</h2>
<ul class="way-list">
<li>목포 평화광장 · 춤추는 바다분수<span>1분</span></li>
<li>목포역<span>12분</span></li>
<li>목포 동부시장<span>13분</span></li>
<li>목포해상케이블카<span>19분</span></li>
</ul>
<p class="small-note">자차 이용 시 내비게이션에 ‘전남 목포시 평화로 40’ 또는 ‘목포 예향’을 입력하세요. 소요 시간은 차량 기준입니다.</p>
</div>
</div>

<div class="faq">
{eyebrow('FAQ')}
<h2>방문 전 자주 묻는 질문</h2>
<details><summary>단체 모임도 예약할 수 있나요?</summary><p>네. 룸·별실 12실과 단체석이 있어 최소 2명부터 최대 90명까지 이용하실 수 있습니다. 예상 인원과 날짜를 전화({TEL})로 알려주시면 메뉴와 공간을 상담해 드립니다.</p></details>
<details><summary>예약 없이 방문해도 되나요?</summary><p>방문하실 수 있지만, 점심·저녁 시간과 주말에는 대기가 생기거나 자리가 없을 수 있습니다. 네이버 예약이나 전화 예약 후 방문하시면 바로 안내받으실 수 있습니다.</p></details>
<details><summary>주차는 어디에 하나요?</summary><p>매장에서 도보 1분 거리의 평화광장 무료 공영주차장을 이용해 주세요.</p></details>
<details><summary>아이 또는 어르신과 함께 방문하려면 무엇을 확인해야 하나요?</summary><p>유아 의자가 준비되어 있고, 출입구와 좌석 모두 휠체어 이용이 가능합니다. 필요하신 사항은 예약 시 미리 말씀해 주세요.</p></details>
<details><summary>술을 가져가도 되나요?</summary><p>콜키지가 가능합니다. 병당 20,000원이며 최대 2병까지 가능합니다.</p></details>
<details><summary>포장이나 도시락 주문도 되나요?</summary><p>네. 목포 프리미엄 한정식 도시락(20,000원)과 포장, 보리굴비 택배 주문이 가능합니다. 수량과 날짜를 전화로 알려주세요.</p></details>
</div>
</section>
'''
leaflet_css = '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">\n'
leaflet_js = '<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>\n'
page('visit.html', f'오시는 길 · 목포시 평화로 40 | {NAME}',
     '예향한정식 주소·지도·길찾기와 영업시간 안내. 전남 목포시 평화로 40 (평화광장 앞), 예약 문의 061-262-9595. 평화광장 무료 공영주차장 이용.', visit,
     extra_head=leaflet_css, extra_scripts=leaflet_js)

# ------------------------------------------------------------------ RESERVATION
reservation = inner_hero('reservation-hero', 'RESERVATION', '예약 · 문의', '편하신 방법으로, 소중한 만남을 준비하세요.') + f'''
<section class="wrap inner-content">
<div class="menu-intro">
{eyebrow('HOW TO BOOK')}
<h2>어떤 방법으로 예약하시겠어요?</h2>
<p>네이버 예약과 전화로 안내합니다.</p>
</div>
<div class="booking-grid">
<div class="booking-card"><span>NAVER</span><h3>네이버 예약</h3><p>원하는 날짜와 시간, 인원을 골라 바로 예약하세요. 예약 후 방문하시면 대기 없이 안내해 드립니다.</p><a class="button primary" href="{NAVER_BOOK}" target="_blank" rel="noopener">네이버 예약하기</a></div>
<div class="booking-card"><span>CALL</span><h3>전화 예약</h3><p class="phone">{TEL}</p><p>상견례·단체 모임·연말 모임 등 상담이 필요한 예약은 전화로 문의해 주세요.</p><a class="button dark" href="tel:{TEL}">전화 걸기</a></div>
<div class="booking-card"><span>TAKE-OUT</span><h3>도시락 · 택배 주문</h3><p>목포 프리미엄 한정식 도시락과 영광 찐 보리굴비 택배는 전화로 주문받습니다.</p><a class="button pale" href="menu.html#special">메뉴 보기</a></div>
</div>

<div class="menu-intro" style="margin:110px 0 40px">
{eyebrow('BEFORE YOU BOOK')}
<h2>예약 전 안내</h2>
</div>
<ol class="steps">
<li><b>날짜 · 인원 · 모임 목적</b><span>방문 날짜와 시간, 인원, 상견례·가족 모임 등 모임 목적을 알려주세요.</span></li>
<li><b>희망 메뉴 · 공간</b><span>정식 메뉴나 목포식 한정식, 룸·단체석 등 희망 사항을 함께 말씀해 주세요.</span></li>
<li><b>매장 확인 후 확정</b><span>매장에서 일정과 공간을 확인한 뒤 예약을 확정해 드립니다.</span></li>
</ol>

<div class="source-note">
<p><b>영업시간</b> 매일 11:00 – 21:00 · 브레이크타임 14:30 – 17:00 · 라스트오더 20:00<br>브레이크타임과 라스트오더 이후에는 예약을 받기 어렵습니다. 명절 당일 휴무는 <a href="news.html">예향 소식</a>에서 확인해 주세요.</p>
<a class="button dark" href="tel:{TEL}">{TEL}</a>
</div>
</section>
'''
page('reservation.html', f'예약 · 문의 | {NAME}',
     '네이버 예약과 전화 예약(061-262-9595) 안내. 날짜·인원·희망 메뉴와 공간을 알려주시면 매장 확인 후 예약을 확정합니다.', reservation)

print('built', sorted(f for f in os.listdir(OUT) if f.endswith('.html')))
