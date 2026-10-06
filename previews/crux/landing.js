/** Enhance the public example without hiding any source when JavaScript is unavailable. */
export function initLandingInteractions(doc, win) {
  const html = doc.documentElement;
  const relay = doc.getElementById('relay');
  const loop = doc.querySelector('.loop');
  const removers = [];
  const observers = [];
  let disposed = false;
  let frame = 0;
  let dirty = true;
  let onScreen = true;
  let forceRender = false;
  let wide = false;
  let length = 0;
  let shown = -1;
  let geometry = { top: 0, height: 1 };
  const svg = relay?.querySelector('.trail');
  const base = svg?.querySelector('.trail-base');
  const lit = svg?.querySelector('.trail-lit');
  const dot = svg?.querySelector('.trail-dot');
  const lanes = [...(relay?.querySelectorAll('[data-lane]') || [])];
  const seal = relay?.querySelector('[data-node="seal"]');
  const step4 = relay?.querySelector('[data-step4]');
  const groups = [...doc.querySelectorAll('[role="tablist"]')].map(list => [...list.querySelectorAll('[role="tab"]')]);
  const tabs = groups.flat();
  const chips = [...doc.querySelectorAll('[data-passage]')];
  const passages = chips.map(link => doc.getElementById(link.getAttribute('data-passage'))).filter(Boolean);
  const clamp = value => Math.max(0, Math.min(1, value));
  const isAnimated = () => html.dataset.motion === 'animated';

  function listen(target, type, callback, options) {
    if (!target) return;
    target.addEventListener(type, callback, options);
    removers.push(() => target.removeEventListener(type, callback, options));
  }
  function cancel() {
    if (frame) win.cancelAnimationFrame(frame);
    frame = 0;
  }
  function schedule(force = false) {
    forceRender ||= force;
    if (disposed || doc.hidden || frame || (!onScreen && !forceRender)) return;
    frame = win.requestAnimationFrame(render);
  }
  function rebuild() {
    dirty = true;
    schedule();
  }
  function select(tab, focus = false) {
    const group = groups.find(items => items.includes(tab));
    if (!group) return;
    for (const item of group) {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      const panel = doc.getElementById(item.getAttribute('aria-controls'));
      if (panel) panel.hidden = !selected;
    }
    if (focus) tab.focus({ preventScroll: true });
    rebuild();
  }
  function revealPassage(link) {
    const target = doc.getElementById(link.getAttribute('data-passage'));
    if (!target) return false;
    const panel = target.closest('[role="tabpanel"]');
    const tab = panel && tabs.find(item => item.getAttribute('aria-controls') === panel.id);
    if (tab) select(tab);
    for (const chip of chips) chip.classList.toggle('is-on', chip === link);
    for (const passage of passages) passage.classList.toggle('is-lit', passage === target);
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    return true;
  }

  for (const group of groups) {
    for (const [index, tab] of group.entries()) {
      listen(tab, 'click', () => select(tab));
      listen(tab, 'keydown', event => {
        const next = event.key === 'ArrowRight' ? group[(index + 1) % group.length]
          : event.key === 'ArrowLeft' ? group[(index + group.length - 1) % group.length]
            : event.key === 'Home' ? group[0]
              : event.key === 'End' ? group[group.length - 1] : null;
        if (!next) return;
        event.preventDefault();
        select(next, true);
      });
    }
    const selected = group.find(tab => tab.getAttribute('aria-selected') === 'true') || group[0];
    if (selected) select(selected);
  }
  for (const link of chips) listen(link, 'click', event => {
    // Keep normal browser navigation available if a source is missing.
    if (revealPassage(link)) event.preventDefault();
  });
  function followPassageHash() {
    const link = chips.find(item => `#${item.getAttribute('data-passage')}` === win.location.hash);
    if (link) revealPassage(link);
  }
  listen(win, 'hashchange', followPassageHash);

  function measure() {
    dirty = false;
    if (loop) loop.style.setProperty('--loop-w', `${loop.offsetWidth}px`);
    if (!relay) return;
    const origin = relay.getBoundingClientRect();
    geometry = { top: origin.top + win.scrollY, height: origin.height };
    wide = Boolean(svg && win.getComputedStyle(svg).display !== 'none');
    length = 0;
    shown = -1;
    if (!wide || !base || !lit || !seal) return;
    const passage = passages.find(item => !item.closest('[role="tabpanel"]')?.hidden);
    const mark = seal.querySelector('.seal-mark');
    const caption = seal.querySelector('div');
    const chip = relay.querySelector('[data-node="chip"]');
    if (!passage || !mark || !caption || !chip) return;
    const box = element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left - origin.left, right: rect.right - origin.left, cy: (rect.top + rect.bottom) / 2 - origin.top };
    };
    const source = box(passage), center = box(mark), label = box(caption), answer = box(chip);
    const x0 = source.right + 6, y0 = source.cy, x1 = center.left - 4, y1 = center.cy;
    const x2 = label.right + 14, x3 = answer.left - 6, y3 = answer.cy;
    const path = `M${x0} ${y0} C${x0 + 40} ${y0} ${x1 - 50} ${y1} ${x1} ${y1} M${x2} ${y1} L${x3 - 70} ${y1} C${x3 - 20} ${y1} ${x3 - 50} ${y3} ${x3} ${y3}`;
    base.setAttribute('d', path);
    lit.setAttribute('d', path);
    length = lit.getTotalLength();
    lit.style.strokeDasharray = `${length} ${length}`;
  }
  function render() {
    frame = 0;
    if (disposed || doc.hidden) return;
    forceRender = false;
    if (dirty) measure();
    if (!relay) return;
    const progress = isAnimated() ? clamp((win.innerHeight * .78 - (geometry.top - win.scrollY)) / Math.max(1, geometry.height * .72)) : 1;
    const thresholds = [0, .38, .86];
    for (const [index, lane] of lanes.entries()) lane.classList.toggle('is-on', progress > thresholds[index]);
    seal?.classList.toggle('is-on', progress > .38);
    step4?.classList.toggle('is-on', progress > .97);
    if (!wide || !length || !dot) return;
    const rounded = Math.round(progress * 1000) / 1000;
    if (rounded === shown) return;
    shown = rounded;
    lit.style.strokeDashoffset = String(length * (1 - rounded));
    const moving = rounded > 0 && rounded < 1 && isAnimated();
    dot.style.opacity = moving ? '1' : '0';
    if (moving) {
      const point = lit.getPointAtLength(length * rounded);
      dot.setAttribute('cx', point.x);
      dot.setAttribute('cy', point.y);
    }
  }
  function motionChanged() { dirty = true; schedule(true); }
  listen(win, 'scroll', () => { if (isAnimated()) schedule(); }, { passive: true });
  listen(win, 'resize', rebuild, { passive: true });
  listen(win, 'load', rebuild);
  listen(doc, 'crux:motionchange', motionChanged);
  listen(doc, 'visibilitychange', () => {
    if (doc.hidden) cancel();
    else schedule();
  });
  if (win.ResizeObserver) {
    const observer = new win.ResizeObserver(rebuild);
    if (relay) observer.observe(relay);
    if (loop) observer.observe(loop);
    observers.push(observer);
  }
  if ((relay || loop) && win.IntersectionObserver) {
    const observer = new win.IntersectionObserver(entries => {
      if (disposed) return;
      for (const entry of entries) {
        entry.target.dataset.motionVisible = String(entry.isIntersecting);
        if (entry.target !== relay) continue;
        onScreen = entry.isIntersecting;
        if (onScreen) schedule();
        else if (!forceRender) cancel();
      }
    }, { rootMargin: '80px 0px' });
    for (const element of [relay, loop].filter(Boolean)) {
      element.dataset.motionVisible = 'false';
      observer.observe(element);
    }
    observers.push(observer);
  }
  if (win.MutationObserver) {
    const observer = new win.MutationObserver(motionChanged);
    observer.observe(html, { attributes: true, attributeFilter: ['data-motion'] });
    observers.push(observer);
  }
  if (doc.fonts?.ready) doc.fonts.ready.then(() => { if (!disposed) rebuild(); });
  followPassageHash();
  schedule(true);

  return () => {
    disposed = true;
    cancel();
    for (const remove of removers) remove();
    for (const observer of observers) observer.disconnect();
    for (const element of [relay, loop].filter(Boolean)) delete element.dataset.motionVisible;
  };
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') initLandingInteractions(document, window);
