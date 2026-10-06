import { createHeroFx } from './hero-fx.js';

// Native scroll drives the story; only interpolation schedules follow-up frames.
export function initHeroMotion(doc = document, win = window, options = {}) {
  const html = doc.documentElement;
  if (!doc.getElementById('hero')) return () => {};
  var reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointer = win.matchMedia('(hover: hover) and (pointer: fine)');
  var KEY = 'crux-hero-motion';
  var userOff = false;
  try { userOff = win.localStorage.getItem(KEY) === 'off'; } catch (e) { userOff = false; }

  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return [].slice.call((root || doc).querySelectorAll(sel)); }
  var header = $('.site-header'), headWord = $('.site-header .lockup');
  var hero = doc.getElementById('hero'), scene = $('.scene', hero);
  var constellation = $('.constellation', hero), core = $('.core', hero), coreBoost = $('.core-boost', hero);
  var wordmark = $('.wordmark', hero), intro = $('.intro', hero);
  var flareGlow = $('.flare-glow', hero), horizon = $('.horizon', hero), horizonEdge = $('.horizon-edge', hero);
  var flood = $('.flood', hero), disc = $('.flood-disc', hero), echoHead = $('.explain-head', flood);
  var flareLine = $('.flare-line', hero), cue = $('.cue', hero), cueDot = $('.cue-track i', hero);
  var explain = doc.getElementById('how-it-works'), explainHead = $('.explain-head', explain), realTitle = $('.explain-title', explain), realMark = $('.explain-mark', explain);
  var steps = $('.steps', explain), bodies = $$('.step-body', steps), note = $('.explain-note', explain);
  var example = doc.getElementById('example');
  var sources = $$('[data-source]', hero);
  var toggle = doc.getElementById('motion-toggle'), menu = $('.menu');

  const canvas = $('.fx', hero);
  const fx = (options.createFx || createHeroFx)(canvas, { doc, win });
  const listeners = [];
  let disposed = false;
  function listen(el, event, callback, opts) {
    if (!el) return;
    el.addEventListener(event, callback, opts);
    listeners.push(() => el.removeEventListener(event, callback, opts));
  }
  const debug = new URLSearchParams(win.location.search).get('motion-debug') === '1';
  let frameCount = 0;
  var target = 0, lastT = 0, snapNext = true;
  var mode = '', frame = 0, heroVisible = true, dirty = true, p = 0, mx = 0, my = 0, fitFail = false;
  var g = { top: 0, range: 1, w: 1, h: 1, cx: 0, cy: 0, lineY: 0, stepsW: 1, R: 1, pCover: .45, chord: 1, src: [] };
  var touched = [], headerScrolled = null, headerWord = null;

  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ramp(a, b, v) { var t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); }
  function r4(v) { return Math.round(v * 10000) / 10000; }
  function px(v) { return Math.round(v * 10) / 10 + 'px'; }
  // Story values go straight onto the element that uses them (no custom properties on the hero root),
  // so each frame restyles a handful of elements, not the whole scene.
  function set(el, prop, value) {
    if (!el) return;
    var k = prop + '';
    if (!el.__s) { el.__s = {}; touched.push(el); }
    if (el.__s[k] === value) return;
    el.__s[k] = value;
    if (prop.charAt(0) === '-') el.style.setProperty(prop, value); else el.style[prop] = value;
  }
  // A layer that has not appeared takes no clicks and no selection, but stays in the reading order.
  function seen(el, o) { set(el, 'opacity', String(r4(o))); var on = o > .02; if (el.__seen !== on) { el.__seen = on; el.classList.toggle('is-unseen', !on); } }
  function clearStory() {
    touched.forEach(function (el) { Object.keys(el.__s).forEach(function (k) { if (k.charAt(0) === '-') el.style.removeProperty(k); else el.style[k] = ''; }); el.__s = null; el.__seen = undefined; el.classList.remove('is-unseen'); });
    touched = [];
  }
  function jump(y) { snapNext = true; win.scrollTo({ top: Math.max(0, y), left: 0, behavior: 'auto' }); }
  function tooShort() { return win.innerHeight < 600; }
  function bigText() { return parseFloat(win.getComputedStyle(html).fontSize) > 18; }
  function wanted() { return reduced.matches || userOff || tooShort() || bigText() || fitFail ? 'static' : 'animated'; }

  // Layout offsets ignore the transforms the story applies, so measuring never fights the animation.
  function offsetIn(el) {
    var x = 0, y = 0, node = el;
    while (node && node !== scene) { x += node.offsetLeft; y += node.offsetTop; node = node.offsetParent; }
    return { x: x, y: y };
  }
  function bottomOf(el) { return offsetIn(el).y + el.offsetHeight; }
  function measure() {
    dirty = false;
    g.top = hero.getBoundingClientRect().top + win.pageYOffset;
    g.w = scene.clientWidth; g.h = scene.clientHeight;
    g.range = Math.max(1, hero.offsetHeight - g.h);
    if (mode !== 'animated') return;
    var c = offsetIn(core);
    g.cx = c.x + core.offsetWidth / 2;
    g.cy = c.y + core.offsetHeight / 2;
    g.lineY = offsetIn(steps).y;
    g.stepsW = steps.offsetWidth;
    var sr = scene.getBoundingClientRect(), range = doc.createRange();
    range.selectNodeContents(realTitle);   // the echo has the same geometry, and the real one is always laid out
    var tr = range.getBoundingClientRect(), mr = realMark.getBoundingClientRect();
    var box = { l: Math.min(tr.left, mr.left) - sr.left, t: Math.min(tr.top, mr.top) - sr.top, r: Math.max(tr.right, mr.right) - sr.left, b: Math.max(tr.bottom, mr.bottom) - sr.top };
    // The disc grows from the star (scaled around the core) and comes to rest centred on the heading,
    // so the heading sits inside the light with a margin, and the disc never fills a phone screen.
    var hx = (box.l + box.r) / 2, hy = (box.t + box.b) / 2;
    var half = Math.sqrt(Math.pow((box.r - box.l) / 2, 2) + Math.pow((box.b - box.t) / 2, 2));
    g.R = Math.max(half + 48, Math.sqrt(Math.pow(g.cx - hx, 2) + Math.pow(g.cy - hy, 2)) + 24);
    // The light box is larger than the reveal radius so the soft falloff never meets an edge,
    // and its elliptical light keeps the whole heading inside the bright zone (dark text never lands on dark sky).
    var halfW = (box.r - box.l) / 2 + 30, halfH = (box.b - box.t) / 2 + 30;
    var B = Math.max(g.R * 1.35, halfW / .5 + Math.abs(g.cx - hx) + 8, halfH / .4 + Math.abs(g.cy - hy) + 8);
    var ox = g.cx - (hx - B), oy = g.cy - (hy - B);
    set(disc, 'left', px(hx - B)); set(disc, 'top', px(hy - B)); set(disc, 'width', px(2 * B)); set(disc, 'height', px(2 * B));
    set(disc, 'transformOrigin', px(ox) + ' ' + px(oy));
    // Center the final ellipse on the heading while scaling from the mark. Its
    // transparent falloff ends inside a square box, never a clipped circular edge.
    var rx = B - 6, ry = Math.min(B - 6, Math.max(B * .72, halfH / .4));
    set(disc, 'backgroundImage', 'radial-gradient(ellipse ' + px(rx) + ' ' + px(ry) + ' at ' + px(B) + ' ' + px(B) + ', #fff 0, #fbfbfa 6%, #f4f4f2 18%, #ebeef0 46%, rgba(222,228,232,.92) 60%, rgba(205,212,218,.5) 78%, rgba(197,204,209,.14) 90%, rgba(197,204,209,0) 100%)');
    // Use the rendered ellipse's bright zone, including its moving center, rather
    // than a nominal circle. This protects dark heading contrast on narrow screens.
    var corners = [[box.l, box.t], [box.r, box.t], [box.l, box.b], [box.r, box.b]], fc = 1;
    for (var k = 1; k <= 200; k++) {
      var ff = k / 200, ccx = g.cx + (hx - g.cx) * ff, ccy = g.cy + (hy - g.cy) * ff;
      if (corners.every(pt => Math.hypot((pt[0] - ccx) / (rx * ff), (pt[1] - ccy) / (ry * ff)) <= .60)) { fc = ff; break; }
    }
    g.pCover = .37 + .10 * Math.sqrt(fc);
    var dy = g.lineY - hy;
    g.chord = Math.min(g.w, 2 * Math.sqrt(Math.max(0, g.R * g.R - dy * dy)));
    set(flareLine, 'top', px(g.lineY));
    g.src = sources.map(function (el, i) {
      var o = offsetIn(el), sx = o.x + 12, sy = o.y + el.offsetHeight / 2, dx = g.cx - sx, dy2 = g.cy - sy;
      return { dx: dx, dy: dy2 };
    });
    // Fit test: if larger text or spacing pushes the copy into the cue or under the horizon, use the static layout.
    var cueTop = offsetIn(cue).y, horizonTop = offsetIn(horizon).y;
    fitFail = bottomOf(intro) > cueTop - 8 || bottomOf(explain) > horizonTop - 4 || bottomOf(wordmark) > offsetIn(intro).y + 4;
    if (fitFail) schedule(true);
    fx.update(p, g);
  }

  // Every value is a pure function of scroll progress: scrolling up plays the story backwards.
  function render() {
    var bright = ramp(.06, .13, p), gather = ramp(.10, .28, p), srcOut = ramp(.22, .28, p);
    sources.forEach(function (el, i) {
      var s = g.src[i] || { dx: 0, dy: 0 };
      set(el, 'transform', 'translate3d(' + px(s.dx * gather) + ',' + px(s.dy * gather) + ',0) scale(' + r4(1 - gather * .62) + ')');
      set(el, 'opacity', String(r4(1 - srcOut)));
    });
    seen(intro, 1 - ramp(.20, .28, p));
    var wordOut = ramp(.25, .33, p);
    set(wordmark, 'opacity', String(r4(1 - wordOut)));
    set(wordmark, 'transform', 'translateX(-50%) scale(' + r4(1 + wordOut * .06) + ')');
    var aura = ramp(.18, .29, p) * (1 - ramp(.40, .47, p));
    set(coreBoost, 'opacity', String(r4(aura)));
    set(coreBoost, 'transform', 'scale(' + r4(.5 + aura * .9) + ')');
    set(core, 'opacity', String(r4(1 - ramp(.30, .36, p))));
    // Pre-dawn: the horizon rim already glows faintly at rest, flares with the burst, then settles back.
    var flare = .2 + .8 * ramp(.31, .43, p) * (1 - ramp(.53, .64, p));
    // The horizon sinks away as the bang starts, taking its glow with it.
    var sink = ramp(.27, .36, p);
    set(horizon, 'transform', sink ? 'translate3d(0,' + px(sink * 180) + ',0)' : '');
    set(horizon, 'opacity', String(r4(1 - sink)));
    set(flareGlow, 'opacity', String(r4(flare * (1 - sink))));
    set(horizonEdge, 'opacity', String(r4(flare)));
    // The flood: a crisp disc of starlight grows from the mark, holds, then closes like a shutter onto one line.
    var f = clamp((p - .37) / .10); f *= f;
    var shut = ramp(.52, .61, p);
    var floodOn = p > .37 && shut < 1;
    set(flood, 'display', floodOn ? 'block' : 'none');
    set(disc, 'transform', 'scale(' + r4(f) + ')');
    var clip = 'inset(' + px(g.lineY * shut) + ' 0 ' + px(Math.max(0, g.h - g.lineY) * shut) + ' 0)';
    set(flood, 'clipPath', clip); set(flood, '-webkit-clip-path', clip);
    var echo = ramp(g.pCover, g.pCover + .012, p);
    set(echoHead, 'opacity', String(r4(echo)));
    set(echoHead, 'visibility', echo > 0 ? 'visible' : 'hidden');
    var explainOn = p >= .47 ? 1 : 0;                               // switches while hidden under the full flood
    seen(explainHead, explainOn);
    set(explain, 'pointerEvents', explainOn ? '' : 'none');
    var lineO = ramp(.56, .61, p) * (1 - ramp(.64, .71, p));
    set(flareLine, 'display', lineO > 0 ? 'block' : 'none');
    set(flareLine, 'opacity', String(r4(lineO)));
    var from = g.chord / g.w, to = Math.min(1, g.stepsW / g.w);
    set(flareLine, 'transform', 'scaleX(' + r4(from + (to - from) * ramp(.61, .70, p)) + ')');
    set(steps, '--rules', String(r4(ramp(.61, .67, p))));
    [[.62, .68], [.65, .71], [.68, .74]].forEach(function (span, i) {
      var o = ramp(span[0], span[1], p);
      seen(bodies[i], o);
      set(bodies[i], 'transform', 'translateX(' + px((1 - o) * -22) + ')');
    });
    seen(note, ramp(.71, .77, p));
    seen(cue, Math.max(1 - ramp(.015, .07, p), ramp(.84, .92, p)));
    const parallax = 'translate3d(' + px(mx) + ',' + px(my) + ',0)';
    set(constellation, 'transform', parallax);
    set(canvas, 'transform', parallax);
  }

  function updateHeader() {
    var y = win.pageYOffset;
    var scrolled = y > 8;
    if (scrolled !== headerScrolled) { headerScrolled = scrolled; header.classList.toggle('is-scrolled', scrolled); }
    // The small wordmark appears only once the large one has left, so the two never compete.
    var word = mode === 'animated'
      ? ramp(.27, .36, clamp((y - g.top) / g.range))
      : (wordmark.getBoundingClientRect().bottom < header.offsetHeight ? 1 : 0);
    word = r4(word);
    if (word !== headerWord) { headerWord = word; header.style.setProperty('--head-word', String(word)); headWord.classList.toggle('is-off', word === 0); }
    var away = 0;
    if (mode === 'animated' && !header.contains(doc.activeElement)) {
      var hp = clamp((y - g.top) / g.range);
      away = ramp(.004, .06, hp) * (1 - ramp(.93, .995, hp));
    }
    away = r4(away);
    if (away !== header.__away) {
      header.__away = away;
      header.style.transform = away ? 'translate3d(0,' + (-100 * away).toFixed(2) + '%,0)' : '';
      header.style.opacity = away ? String(r4(1 - away * .9)) : '';
      header.style.pointerEvents = away > .5 ? 'none' : '';
    }
  }

  function update() {
    frame = 0;
    if (disposed || doc.hidden) return;
    if (dirty) measure();
    if (fitFail && mode === 'animated') { setMode(true); return; }
    updateHeader();
    if (mode !== 'animated' || !heroVisible) return;   // paused while the hero is off screen
    target = clamp((win.pageYOffset - g.top) / g.range);
    var now = win.performance.now(), dt = lastT ? Math.min(64, now - lastT) : 16.7;
    // Big jumps (links, reloads, a fast fling) land on the end state at once, so the burst never replays at speed.
    if (snapNext || Math.abs(target - p) > .18) { p = target; snapNext = false; }
    else { p += (target - p) * (1 - Math.pow(1 - .14, dt / 16.7)); if (Math.abs(target - p) < .0004) p = target; }
    render();
    fx.update(p, g);
    if (debug) { hero.dataset.progress = String(r4(p)); hero.dataset.frames = String(++frameCount); }
    if (p !== target) { lastT = now; schedule(); } else lastT = 0;
  }
  function schedule(geometry) {
    if (geometry) dirty = true;
    if (!disposed && !doc.hidden && heroVisible && !frame) frame = win.requestAnimationFrame(update);
  }

  function syncToggle() {
    if (!toggle) return;
    toggle.hidden = reduced.matches || ((tooShort() || bigText() || fitFail) && !userOff);
    var on = mode === 'animated';
    toggle.setAttribute('data-state', on ? 'on' : 'off');
    toggle.setAttribute('aria-pressed', String(!on));
    toggle.querySelector('.motion-label').textContent = on ? 'Pause motion' : 'Play motion';
    toggle.title = on ? 'Pause motion' : 'Play motion';
  }
  function finalHold() { return g.top + g.range * .9; }
  function setMode(keepPlace) {
    var next = wanted();
    if (next === mode) { syncToggle(); return; }
    var was = mode, before = p;
    var below = was && hero.getBoundingClientRect().bottom <= 0;
    var anchorTop = below ? example.getBoundingClientRect().top : 0;
    var r = explain.getBoundingClientRect();
    var readingExplain = was === 'static' && r.top < win.innerHeight * .6 && r.bottom > win.innerHeight * .3;
    mode = next;
    if (mode !== 'animated') clearStory();
    snapNext = true;
    html.setAttribute('data-motion', mode);
    fx.setMode(mode === 'animated');
    doc.dispatchEvent(new win.CustomEvent('crux:motionchange', { detail: { mode } }));
    syncToggle();
    dirty = true; measure();
    if (keepPlace && was) {
      if (below) jump(win.pageYOffset + example.getBoundingClientRect().top - anchorTop);
      else if (mode === 'static') jump(before >= .45 ? explain.getBoundingClientRect().top + win.pageYOffset - header.offsetHeight : g.top);
      else if (readingExplain) jump(finalHold());
      else jump(g.top);
    }
    schedule(true);
  }

  function cancel() { if (frame) win.cancelAnimationFrame(frame); frame = 0; lastT = 0; }
  function visibility(next = heroVisible) {
    if (disposed) return;
    heroVisible = next;
    hero.dataset.visible = String(heroVisible && !doc.hidden);
    html.dataset.pageVisible = String(!doc.hidden);
    fx.setVisible(heroVisible && !doc.hidden);
    if (!heroVisible || doc.hidden) cancel();
    else schedule(true);
    if (!doc.hidden) updateHeader();
  }
  listen(toggle, 'click', function () {
    if (reduced.matches) return;
    userOff = mode === 'animated';
    try { win.localStorage.setItem(KEY, userOff ? 'off' : 'on'); } catch { /* Choice still applies without storage. */ }
    fitFail = false;
    setMode(true);
    toggle.focus({ preventScroll: true });
  });
  listen(hero, 'pointermove', function (e) {
    if (mode !== 'animated' || !finePointer.matches || e.pointerType === 'touch') return;
    mx = (clamp(e.clientX / win.innerWidth) - .5) * 12;
    my = (clamp(e.clientY / win.innerHeight) - .5) * 8;
    schedule();
  }, { passive: true });
  listen(hero, 'pointerleave', function () { if (!mx && !my) return; mx = 0; my = 0; schedule(); });
  listen(finePointer, 'change', function () { mx = 0; my = 0; schedule(); });
  listen(win, 'scroll', function () {
    // Cached page coordinates keep this handler free of layout reads while animated.
    heroVisible = win.pageYOffset + win.innerHeight > g.top && win.pageYOffset < g.top + g.range + g.h;
    hero.dataset.visible = String(heroVisible && !doc.hidden);
    fx.setVisible(heroVisible && !doc.hidden);
    if (!heroVisible) { cancel(); if (!doc.hidden) updateHeader(); }
    else schedule();
  }, { passive: true });
  listen(win, 'resize', function () { fitFail = false; if (wanted() !== mode) setMode(true); schedule(true); }, { passive: true });
  listen(win, 'pageshow', function () { snapNext = true; schedule(true); });
  listen(win, 'load', function () { schedule(true); });
  listen(doc, 'visibilitychange', () => visibility());
  listen(header, 'focusin', updateHeader);
  listen(header, 'focusout', () => schedule());
  doc.fonts?.ready.then(() => { if (!disposed) schedule(true); });
  listen(reduced, 'change', function () { fitFail = false; cancel(); setMode(true); });
  const ro = win.ResizeObserver ? new win.ResizeObserver(() => schedule(true)) : null;
  [scene, intro, explain, cue].forEach(el => ro?.observe(el));
  const io = win.IntersectionObserver ? new win.IntersectionObserver(entries => visibility(entries.at(-1).isIntersecting)) : null;
  io?.observe(hero);

  // "How it works" and the cue land on the finished explanation, instantly, so the flood never replays at speed.
  listen(doc, 'click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (menu && menu.open && (!menu.contains(e.target) || a)) menu.open = false;
    if (!a || a.getAttribute('href') !== '#how-it-works' || mode !== 'animated') return;
    e.preventDefault();
    if (dirty) measure();
    jump(finalHold());
    explain.focus({ preventScroll: true });
    if (win.history && win.history.pushState) win.history.pushState(null, '', '#how-it-works');
  });
  listen(doc, 'keydown', function (e) {
    if (e.key === 'Escape' && menu && menu.open) { menu.open = false; menu.querySelector('summary').focus(); }
  });

  setMode(false);
  visibility(win.pageYOffset + win.innerHeight > g.top && win.pageYOffset < g.top + hero.offsetHeight);
  if (win.location.hash === '#how-it-works' && mode === 'animated') { measure(); jump(finalHold()); }
  schedule(true);
  return () => {
    disposed = true;
    cancel();
    listeners.forEach(remove => remove());
    ro?.disconnect(); io?.disconnect(); fx.dispose();
    clearStory();
    html.dataset.motion = 'static';
    hero.dataset.visible = 'false';
    header.style.transform = ''; header.style.opacity = ''; header.style.pointerEvents = '';
  };
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') initHeroMotion();
