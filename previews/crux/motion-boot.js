/* Decide the hero mode before first paint so the page never jumps.
     Static when: motion paused, reduced motion, a short screen, or a larger browser text size. */
  (function (d, w) {
    var html = d.documentElement, off = false, reduced = false, big = false;
    html.classList.remove('no-js');
    html.classList.add('js');
    try { off = w.localStorage.getItem('crux-hero-motion') === 'off'; } catch (e) { off = false; }
    try { reduced = w.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduced = false; }
    try { big = parseFloat(w.getComputedStyle(html).fontSize) > 18; } catch (e) { big = false; }
    html.setAttribute('data-motion', off || reduced || big || w.innerHeight < 600 ? 'static' : 'animated');
  })(document, window);
