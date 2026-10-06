const TAU = Math.PI * 2;
const clamp = value => Math.max(0, Math.min(1, value));
function ramp(start, end, value) {
  const t = clamp((value - start) / (end - start));
  return t * t * (3 - 2 * t);
}
function random(seed) {
  return () => {
    seed = seed * 16807 % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

/** A decorative canvas. The scene controller supplies measured layout and scroll state. */
export function createHeroFx(canvas, { doc = document, win = window } = {}) {
  const idle = { update() {}, setMode() {}, setVisible() {}, dispose() {} };
  if (!canvas?.getContext) return idle;
  const ctx = canvas.getContext('2d');
  if (!ctx) return idle;
  const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
  const rings = [0, 1].map(() => ({ canvas: doc.createElement('canvas'), key: '' }));
  let width = 0, height = 0, ratio = 1, cx = 0, cy = 0, scale = 1;
  let progress = 0, frame = null, last = null, time = 0;
  let animated = false, visible = true, disposed = false, painted = false;
  let stars = [], streams = [], sources = [];

  function build() {
    const count = width < 700 ? 650 : 1400;
    if (stars.length === count) return;
    const rnd = random(42);
    stars = Array.from({ length: count }, () => {
      const orbit = 1.55 + rnd() ** 1.7 * 4.2;
      return {
        angle: rnd() * TAU, galaxyRadius: rnd() ** 1.35 * 540 + 30,
        galaxy: rnd() < .64, arm: rnd() < .62, orbit,
        speed: 1.15 * (orbit / 1.55) ** -1.5,
        size: .35 + rnd() * 1.05, brightness: .3 + rnd() * .7,
        phase: rnd() * TAU, lens: rnd() < .55,
        x: 0, y: 0, alpha: 0, near: false,
      };
    });
    streams = Array.from({ length: (width < 700 ? 18 : 30) * 3 }, (_, i) => ({
      source: i % 3, offset: rnd(), bend: (rnd() - .5) * 120, size: .5 + rnd() * 1.1,
    }));
    for (const ring of rings) ring.key = '';
  }

  function active() {
    return !disposed && animated && visible && !doc.hidden && !reduced.matches
      && width > 0 && height > 0 && progress < .55;
  }

  function clear() {
    if (!painted) return;
    ctx.clearRect(0, 0, width, height);
    painted = false;
  }

  function schedule() {
    if (active()) {
      if (frame === null) frame = win.requestAnimationFrame(draw);
    } else {
      if (frame !== null) win.cancelAnimationFrame(frame);
      frame = null;
      last = null;
      // A paused or completed scene leaves no frozen, half-transformed image behind.
      if (!animated || reduced.matches || progress >= .55) clear();
    }
  }

  function glow(x, y, radius, alpha, inner = .18) {
    if (alpha <= .002 || radius <= 1) return;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(255,255,255,${clamp(alpha)})`);
    gradient.addColorStop(inner, `rgba(236,240,242,${clamp(alpha * .55)})`);
    gradient.addColorStop(.55, `rgba(197,204,209,${clamp(alpha * .16)})`);
    gradient.addColorStop(1, 'rgba(197,204,209,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  // Unit-size annuli are cached; breathing only changes their draw opacity.
  // Quantizing the inner radius avoids repainting textures for tiny scroll deltas.
  function ringTexture(slot, innerRatio) {
    const ring = rings[slot];
    const size = width < 700 ? 256 : 512;
    const inner = Math.round(clamp(innerRatio) * 256) / 256;
    const key = `${size}:${inner}`;
    if (ring.key === key) return ring.canvas;
    const off = ring.canvas;
    const target = off.getContext('2d');
    if (!target) return null;
    if (off.width !== size || off.height !== size) { off.width = size; off.height = size; }
    else target.clearRect(0, 0, size, size);
    target.globalCompositeOperation = 'source-over';
    const outer = size / 2;
    const gradient = target.createRadialGradient(outer, outer, outer * inner, outer, outer, outer);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(.05, 'rgba(255,255,255,1)');
    gradient.addColorStop(.22, 'rgba(242,244,245,.62)');
    gradient.addColorStop(.55, 'rgba(222,226,229,.22)');
    gradient.addColorStop(1, 'rgba(222,226,229,0)');
    target.fillStyle = gradient;
    target.beginPath();
    target.arc(outer, outer, outer, 0, TAU);
    target.arc(outer, outer, outer * inner, 0, TAU, true);
    target.fill();
    target.globalCompositeOperation = 'destination-in';
    const doppler = target.createLinearGradient(0, 0, size, 0);
    doppler.addColorStop(0, 'rgba(0,0,0,1)');
    doppler.addColorStop(.5, 'rgba(0,0,0,.72)');
    doppler.addColorStop(1, 'rgba(0,0,0,.36)');
    target.fillStyle = doppler;
    target.fillRect(0, 0, size, size);
    ring.key = key;
    return off;
  }

  function half(texture, radius, tilt, top, alpha) {
    if (!texture) return;
    const w = radius * 2, h = w * tilt;
    ctx.save();
    ctx.globalAlpha = clamp(alpha);
    // Crop the texture into adjoining halves instead of overlapping additive clips.
    // Even a half-pixel overlap creates a hard bright seam through the centre.
    ctx.drawImage(texture, 0, top ? 0 : texture.height / 2, texture.width, texture.height / 2,
      cx - radius, top ? cy - h / 2 : cy, w, h / 2);
    ctx.restore();
  }

  function dot(x, y, alpha, size) {
    ctx.globalAlpha = clamp(alpha);
    ctx.fillStyle = '#f0f2f3';
    if (size < .9) ctx.fillRect(x, y, size * 1.5, size * 1.5);
    else { ctx.beginPath(); ctx.arc(x, y, size, 0, TAU); ctx.fill(); }
  }

  function draw(now) {
    frame = null;
    if (!active()) { schedule(); return; }
    const dt = last === null ? 0 : Math.max(0, Math.min(.05, (now - last) / 1000));
    last = now;
    time += dt;
    const form = ramp(.025, .22, progress);
    const gather = ramp(.10, .30, progress);
    const bloom = ramp(.30, .45, progress);
    const spread = ramp(.33, .50, progress);
    const gone = ramp(.46, .55, progress);
    const streamOn = 1 - ramp(.18, .28, progress);
    const breathe = .5 + .5 * Math.sin(time * .7);
    const baseRadius = 58 * scale;
    const shadowRadius = baseRadius * form * (1 + .14 * gather) * (1 - .92 * bloom);
    const tilt = .36 + (.105 - .36) * form + .035 * gather;
    const fling = 1 + 2.8 * spread;
    const fade = (1 - gone) * (1 - .55 * spread);
    const spin = 1 + gather * 2.4 + bloom * 1.6;
    ctx.clearRect(0, 0, width, height);
    painted = true;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';

    // The galaxy's breathing core gives way to a black centre as the sources gather.
    glow(cx, cy, (70 + 30 * breathe) * scale, (.16 + .1 * breathe) * (1 - form), .12);
    glow(cx, cy, baseRadius * 9 * fling, (.07 + .04 * breathe + .1 * gather) * fade * form, .08);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, tilt * 1.15);
    glow(0, 0, baseRadius * 6.2 * fling, (.2 + .05 * breathe + .22 * gather) * fade * form, .22);
    ctx.restore();

    for (const star of stars) {
      const galaxySpeed = (.05 + 9 / star.galaxyRadius) * .22;
      star.angle += dt * (galaxySpeed + (star.speed - galaxySpeed) * form) * spin;
      const angle = star.angle;
      const sin = Math.sin(angle), cos = Math.cos(angle);
      const arm = star.arm ? Math.sin(angle * 2 + star.galaxyRadius * .012) * 14 * (1 - form) : 0;
      const galaxyRadius = (star.galaxyRadius + arm) * scale;
      const discRadius = star.orbit * baseRadius * (1 + .14 * gather) * (1 - .6 * bloom);
      const radius = (galaxyRadius + (discRadius - galaxyRadius) * form) * fling;
      star.x = cx + cos * radius;
      star.y = cy + sin * radius * tilt;
      star.near = sin >= 0;
      const beam = 1 + (.3 + .7 * (.5 - .5 * cos) - 1) * form;
      const galaxyAlpha = star.galaxy ? star.brightness * (.55 + .45 * Math.sin(time * 1.3 + star.phase)) * (.55 + .45 * (1 - star.galaxyRadius / 600)) : 0;
      const discAlpha = .62 * star.brightness * beam * (1.25 - star.orbit / 6.5) * (.8 + .2 * Math.sin(time * 1.7 + star.phase));
      star.alpha = (galaxyAlpha + (discAlpha - galaxyAlpha) * form) * fade;
    }

    const discRadius = baseRadius * 6.4 * fling;
    const discAlpha = (.62 + .3 * gather) * fade * form * (.93 + .07 * breathe);
    const disc = form > .02 && fade > .01
      ? ringTexture(0, Math.max(.5, baseRadius * 1.42 * fling * (1 - bloom)) / discRadius) : null;
    half(disc, discRadius, tilt, true, discAlpha);
    for (const star of stars) {
      if (star.near || star.alpha < .02) continue;
      if (shadowRadius > 2 && (star.x - cx) ** 2 + (star.y - cy) ** 2 < shadowRadius ** 2 * 1.08) continue;
      dot(star.x, star.y, star.alpha, star.size * (1 + .3 * bloom));
    }

    if (streamOn > .01 && sources.length === 3) {
      for (const stream of streams) {
        const source = sources[stream.source];
        const u = (stream.offset + time * .11 + gather * .9) % 1;
        const eased = u * u * (3 - 2 * u);
        const sx = source.x + (cx - source.x) * gather;
        const sy = source.y + (cy - source.y) * gather;
        const mx = (sx + cx) / 2 + stream.bend * (1 - gather);
        const my = (sy + cy) / 2 - 40 * (1 - gather);
        const curl = ramp(.7, 1, u) * form;
        const angle = stream.offset * TAU + time * 1.4;
        const x = (1 - eased) ** 2 * sx + 2 * (1 - eased) * eased * mx + eased ** 2 * cx
          + Math.cos(angle) * baseRadius * 1.3 * curl * (1 - curl * .6);
        const y = (1 - eased) ** 2 * sy + 2 * (1 - eased) * eased * my + eased ** 2 * cy
          + Math.sin(angle) * baseRadius * .35 * curl;
        dot(x, y, Math.sin(Math.PI * u) * .55 * streamOn, stream.size);
      }
    }

    const lensAlpha = fade * form * (1 - bloom);
    if (lensAlpha > .01 && shadowRadius > 2) {
      const radius = shadowRadius * 2.45 * (1 + .4 * spread);
      const lens = ringTexture(1, 1.08 / 2.45);
      const alpha = .95 * lensAlpha * (1 + .3 * gather);
      half(lens, radius, .93, true, alpha);
      half(lens, radius, .93, false, alpha * .42);
      for (const star of stars) {
        if (!star.lens || star.alpha < .02) continue;
        const sin = Math.sin(star.angle), cos = Math.cos(star.angle);
        const radius = shadowRadius * (1.16 + (star.orbit - 1.55) * .16) * (1 + .4 * spread);
        const alpha = star.brightness * lensAlpha * (.25 + .75 * Math.abs(sin)) * (sin < 0 ? 1 : .55)
          * (.3 + .7 * (.5 - .5 * cos)) * (1.4 - (star.orbit - 1.55) * .22);
        if (alpha > .02) dot(cx + cos * radius * 1.04, cy + sin * radius, alpha * .55, star.size * .7);
      }
    }

    if (shadowRadius > 2) {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      const alpha = (1 - bloom) * Math.min(1, form * 1.4);
      const shadow = ctx.createRadialGradient(cx, cy, 0, cx, cy, shadowRadius * 1.1);
      shadow.addColorStop(0, `rgba(0,0,0,${alpha})`);
      shadow.addColorStop(.86, `rgba(2,2,3,${alpha})`);
      shadow.addColorStop(1, 'rgba(8,9,11,0)');
      ctx.fillStyle = shadow; ctx.beginPath(); ctx.arc(cx, cy, shadowRadius * 1.1, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      const light = clamp((.5 + .2 * breathe + .3 * gather + 1.2 * bloom) * (1 - gone) * form);
      ctx.lineWidth = 1.6; ctx.strokeStyle = `rgba(245,246,247,${light})`;
      ctx.beginPath(); ctx.arc(cx, cy, shadowRadius * 1.06, 0, TAU); ctx.stroke();
      ctx.lineWidth = 6; ctx.strokeStyle = `rgba(220,224,227,${light * .16})`;
      ctx.beginPath(); ctx.arc(cx, cy, shadowRadius * 1.1, 0, TAU); ctx.stroke();
    }

    half(disc, discRadius, tilt, false, discAlpha);
    for (const star of stars) {
      if (star.near && star.alpha >= .02) dot(star.x, star.y, star.alpha * 1.08, star.size * (1 + .3 * bloom));
    }
    // A soft bloom hands over to the DOM flood: no spokes, flashes or expanding rings.
    glow(cx, cy, (140 + 560 * bloom) * scale, .55 * bloom * (1 - gone * .9), .12);
    if (bloom * (1 - gone) > .01) {
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1, .08);
      glow(0, 0, width * .5 * bloom, .14 * bloom * (1 - gone), .05);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    schedule();
  }

  function update(value, geometry) {
    if (disposed) return;
    progress = clamp(Number.isFinite(value) ? value : 0);
    if (geometry) {
      const nextWidth = Math.max(0, Number(geometry.w) || 0);
      const nextHeight = Math.max(0, Number(geometry.h) || 0);
      const nextRatio = Math.max(1, Math.min(2, win.devicePixelRatio || 1));
      if (nextWidth !== width || nextHeight !== height || nextRatio !== ratio) {
        width = nextWidth; height = nextHeight; ratio = nextRatio;
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        scale = Math.max(.55, Math.min(1.25, Math.min(width, height * 1.6) / 1300));
        painted = false;
        build();
      }
      cx = Number(geometry.cx) || 0;
      cy = Number(geometry.cy) || 0;
      sources = (geometry.src || []).map(source => ({ x: cx - source.dx, y: cy - source.dy }));
    }
    schedule();
  }

  doc.addEventListener('visibilitychange', schedule);
  reduced.addEventListener?.('change', schedule);
  return {
    update,
    setMode(value) { animated = Boolean(value); schedule(); },
    setVisible(value) { visible = Boolean(value); schedule(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      schedule(); clear();
      doc.removeEventListener('visibilitychange', schedule);
      reduced.removeEventListener?.('change', schedule);
      stars = []; streams = []; sources = [];
      for (const ring of rings) { ring.canvas.width = 0; ring.canvas.height = 0; }
    },
  };
}
