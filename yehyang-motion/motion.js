/* 예향 모션 메인 — 스크롤에 따라 장면이 바뀌는 움직임 */
(() => {
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const header = document.querySelector('.site-header');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // 머리말 높이 → 첫 화면 높이 계산
  const setHdr = () => header && root.style.setProperty('--hdr', header.offsetHeight + 'px');
  setHdr(); window.addEventListener('resize', setHdr);

  // 1. 첫 화면 등장
  const hero = document.querySelector('.m-hero');
  requestAnimationFrame(() => setTimeout(() => hero && hero.classList.add('entered'), 120));

  // 영상 재생 / 일시정지
  const video = document.querySelector('.m-hero-video');
  const toggle = document.querySelector('.m-motion-toggle');
  if (video) {
    if (reduce) { video.removeAttribute('autoplay'); video.pause(); toggle?.setAttribute('aria-pressed', 'true'); }
    video.play?.().catch(() => {});
    toggle?.addEventListener('click', () => {
      const paused = toggle.getAttribute('aria-pressed') === 'true';
      if (paused) { video.play().catch(() => {}); toggle.setAttribute('aria-pressed', 'false'); toggle.setAttribute('aria-label', '영상 일시정지'); }
      else { video.pause(); toggle.setAttribute('aria-pressed', 'true'); toggle.setAttribute('aria-label', '영상 재생'); }
    });
  }

  // 스크롤 등장
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
  }), { threshold: .18, rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  // 숫자 올라가기
  const countIO = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    countIO.unobserve(e.target);
    const el = e.target, end = +el.dataset.count;
    if (reduce) { el.textContent = end; return; }
    const t0 = performance.now(), dur = 1400;
    const step = t => { const p = clamp((t - t0) / dur, 0, 1); el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
    el.textContent = 0; requestAnimationFrame(step);
  }), { threshold: .6 });
  document.querySelectorAll('[data-count]').forEach(el => countIO.observe(el));

  // 고정 화면 장면: 진행률(0~1) → 사진이 아래에서 차례로 밀려 올라옴
  const stageProgress = stage => {
    const r = stage.getBoundingClientRect();
    const total = stage.offsetHeight - window.innerHeight;
    return total > 0 ? clamp(-r.top / total, 0, 1) : 0;
  };
  const layer = (images, p) => {
    const n = images.length, seg = 1 / n;
    images.forEach((img, i) => {
      if (i === 0) return;
      const local = clamp((p - seg * i + seg * .55) / (seg * .55), 0, 1); // 각 구간 끝부분에서 다음 사진이 올라옴
      img.style.transform = `translate3d(0,${(1 - local) * 100}%,0)`;
    });
    return clamp(Math.floor(p * n), 0, n - 1);
  };

  const story = document.querySelector('.m-story-stage');
  const storyImgs = [...document.querySelectorAll('.m-story-image')];
  const storyCopies = [...document.querySelectorAll('.m-story-copy')];
  const storyDots = [...document.querySelectorAll('.m-story-dots button')];
  let storyIdx = 0;
  const setStory = i => {
    if (i === storyIdx) return; storyIdx = i;
    storyCopies.forEach((c, k) => c.classList.toggle('active', k === i));
    storyDots.forEach((d, k) => d.setAttribute('aria-pressed', String(k === i)));
  };
  storyDots.forEach((d, i) => d.addEventListener('click', () => {
    const total = story.offsetHeight - window.innerHeight;
    window.scrollTo({ top: story.offsetTop + total * ((i + .75) / storyImgs.length), behavior: reduce ? 'auto' : 'smooth' });
  }));

  const scene = document.querySelector('.m-scene-stage');
  const sceneImgs = [...document.querySelectorAll('.m-scene-image')];
  const cards = [...document.querySelectorAll('.m-card')];
  const bar = document.querySelector('.m-progress i');
  let sceneIdx = 0;
  const setScene = i => {
    if (i === sceneIdx) return; sceneIdx = i;
    cards.forEach((c, k) => { c.classList.toggle('active', k === i); c.querySelector('.m-card-toggle').setAttribute('aria-expanded', String(k === i)); });
  };
  cards.forEach((c, i) => c.querySelector('.m-card-toggle').addEventListener('click', () => {
    const total = scene.offsetHeight - window.innerHeight;
    window.scrollTo({ top: scene.offsetTop + total * ((i + .7) / cards.length), behavior: reduce ? 'auto' : 'smooth' });
  }));

  const contactImg = document.querySelector('.m-contact-backdrop img');
  const contact = document.querySelector('.m-contact');
  const backTop = document.querySelector('.m-back-top');
  backTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));

  let lastY = window.scrollY, ticking = false;
  const onScroll = () => {
    ticking = false;
    const y = window.scrollY;
    // 머리말: 내려가면 숨고 올라오면 나타남
    if (header) header.classList.toggle('is-hidden', y > lastY && y > header.offsetHeight * 2 && !document.body.classList.contains('menu-open'));
    lastY = y;
    if (story) setStory(layer(storyImgs, stageProgress(story)));
    if (scene) {
      const p = stageProgress(scene);
      setScene(layer(sceneImgs, p));
      if (bar) bar.style.transform = `scaleX(${clamp((sceneIdx + 1) / cards.length, 0, 1)})`;
    }
    if (contactImg && !reduce) {
      const r = contact.getBoundingClientRect();
      const t = clamp((window.innerHeight - r.top) / (window.innerHeight + r.height), 0, 1);
      contactImg.style.transform = `translate3d(0,${-t * 13}%,0)`;
    }
    backTop?.classList.toggle('visible', y > window.innerHeight);
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  // 공간 가로 넘김 버튼
  const track = document.querySelector('.m-space-track');
  const prev = document.querySelector('.m-prev'), next = document.querySelector('.m-next');
  if (track && prev && next) {
    const step = () => (track.firstElementChild?.getBoundingClientRect().width || 300) + 22;
    prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
    const upd = () => { prev.disabled = track.scrollLeft < 5; next.disabled = track.scrollLeft + track.clientWidth > track.scrollWidth - 5; };
    track.addEventListener('scroll', upd, { passive: true }); window.addEventListener('resize', upd); upd();
  }
})();
