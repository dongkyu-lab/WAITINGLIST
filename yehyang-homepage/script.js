const toggle = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('.mobile-nav');
function closeMenu() {
toggle.setAttribute('aria-expanded', 'false');
toggle.setAttribute('aria-label', '메뉴 열기');
mobileNav.hidden = true;
document.body.classList.remove('menu-open');
}
toggle.addEventListener('click', () => {
const isOpen = toggle.getAttribute('aria-expanded') === 'true';
toggle.setAttribute('aria-expanded', String(!isOpen));
toggle.setAttribute('aria-label', isOpen ? '메뉴 열기' : '메뉴 닫기');
mobileNav.hidden = isOpen;
document.body.classList.toggle('menu-open', !isOpen);
});
mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });

/* 한 상의 이야기: 사진 탭 */
document.querySelectorAll('[data-tabs]').forEach(group => {
  const tabs = [...group.querySelectorAll('[role=tab]')];
  const select = tab => {
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      select(next); next.focus();
    });
  });
});

/* 첫 화면 사진 슬라이드 */
(() => {
  const slides = [...document.querySelectorAll('.hero-slide')];
  const dots = [...document.querySelectorAll('.hero-dot')];
  if (slides.length < 2) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const load = el => { if (el.dataset.bg) { el.style.backgroundImage = `url('${el.dataset.bg}')`; delete el.dataset.bg; } };
  window.addEventListener('load', () => slides.forEach(load));
  let current = 0, timer = null;
  const show = i => {
    load(slides[i]);
    slides[current].classList.remove('is-active'); dots[current]?.classList.remove('is-active');
    current = i;
    slides[current].classList.add('is-active'); dots[current]?.classList.add('is-active');
  };
  const next = () => show((current + 1) % slides.length);
  const start = () => { if (!reduce && !timer) timer = setInterval(next, 6000); };
  const stop = () => { clearInterval(timer); timer = null; };
  dots.forEach((d, i) => d.addEventListener('click', () => { stop(); show(i); start(); }));
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  start();
})();

document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
