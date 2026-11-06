/* Scrollytelling for the Experience section.
 * A sticky panel tells the "chapter" of whichever role is in view, a progress
 * bar tracks how far through the career story the reader is, and each role
 * fades in as it arrives. Without JS (or with reduced motion) the timeline
 * still renders normally.
 */
(function () {
  'use strict';

  var root = document.querySelector('.experience .scrolly');
  if (!root) return;

  var items = Array.prototype.slice.call(root.querySelectorAll('.tl-item[data-company]'));
  var panel = root.querySelector('.scrolly-panel');
  if (!items.length || !panel) return;

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var el = {
    card: panel.querySelector('.scrolly-card'),
    chapter: panel.querySelector('.sp-chapter'),
    years: panel.querySelector('.sp-years'),
    company: panel.querySelector('.sp-company'),
    title: panel.querySelector('.sp-title'),
    stat: panel.querySelector('.sp-stat-text'),
    fill: panel.querySelector('.sp-progress-fill'),
    rail: panel.querySelector('.sp-rail')
  };

  root.classList.add('scrolly-on');
  if (reduceMotion) root.classList.add('scrolly-reduced');

  // Rail: one dot per chapter, clickable to jump to that role.
  var railDots = items.map(function (item, i) {
    var li = document.createElement('li');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = '<span class="dot"></span><span class="lbl"></span>';
    btn.querySelector('.lbl').innerHTML = item.getAttribute('data-company');
    btn.addEventListener('click', function () {
      var offset = (nav ? nav.offsetHeight : 70) + 20;
      var top = item.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
    li.appendChild(btn);
    el.rail.appendChild(li);
    return li;
  });
  // The rail is interactive, so expose the panel to assistive tech after all.
  panel.removeAttribute('aria-hidden');
  panel.setAttribute('aria-label', 'Career chapters');

  // Reveal each role as it scrolls into view.
  if ('IntersectionObserver' in window && !reduceMotion) {
    var revealer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          revealer.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    items.forEach(function (item) { revealer.observe(item); });
  } else {
    items.forEach(function (item) { item.classList.add('is-in'); });
  }

  var current = -1;
  var swapTimer = null;

  function render(i) {
    var item = items[i];
    el.chapter.innerHTML = item.getAttribute('data-chapter');
    el.years.innerHTML = item.getAttribute('data-years');
    el.company.innerHTML = item.getAttribute('data-company');
    el.title.innerHTML = item.getAttribute('data-title');
    el.stat.innerHTML = item.getAttribute('data-stat');
  }

  function setActive(i) {
    if (i === current) return;
    current = i;

    items.forEach(function (item, k) { item.classList.toggle('is-active', k === i); });
    railDots.forEach(function (li, k) {
      li.classList.toggle('is-active', k === i);
      li.classList.toggle('is-past', k < i);
    });

    if (reduceMotion) { render(i); return; }
    clearTimeout(swapTimer);
    el.card.classList.add('is-swapping');
    swapTimer = setTimeout(function () {
      render(i);
      el.card.classList.remove('is-swapping');
    }, 180);
  }

  // The navbar shrinks once the page scrolls, so keep the sticky offset in sync.
  var nav = document.querySelector('.navbar');
  var navH = -1;
  function syncNavHeight() {
    if (!nav) return;
    var h = nav.offsetHeight;
    if (h !== navH) {
      navH = h;
      root.style.setProperty('--nav-h', h + 'px');
    }
  }

  function update() {
    syncNavHeight();
    var vh = window.innerHeight;
    var focusLine = vh * 0.45;

    // Active role: the last one whose top has crossed the focus line.
    var active = 0;
    for (var i = 0; i < items.length; i++) {
      if (items[i].getBoundingClientRect().top <= focusLine) active = i;
    }
    setActive(active);

    // Progress through the whole timeline.
    var first = items[0].getBoundingClientRect();
    var last = items[items.length - 1].getBoundingClientRect();
    var span = (last.bottom - first.top) || 1;
    var p = Math.min(1, Math.max(0, (focusLine - first.top) / span));
    el.fill.style.setProperty('--p', p.toFixed(4));
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () { ticking = false; update(); });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { syncNavHeight(); onScroll(); });
  syncNavHeight();
  update();
})();
