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

document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
