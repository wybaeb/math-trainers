/* Секторная диаграмма: рисуется, крутится пальцем, прилипает к ровным процентам. */
(function (global) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const TAU = Math.PI * 2;
  const mk = (tag, attrs) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    return n;
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /** точка на окружности для доли p (0..100), отсчёт от 12 часов по часовой стрелке */
  function pt(cx, cy, r, p) {
    const a = (p / 100) * TAU - Math.PI / 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }

  /** контур сектора от процента p0 до p1 */
  function sectorPath(cx, cy, r, p0, p1) {
    const span = p1 - p0;
    if (span <= 0) return '';
    if (span >= 99.999) {
      // полный круг двумя дугами — одной path-дугой круг не замыкается
      return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`;
    }
    const [x0, y0] = pt(cx, cy, r, p0);
    const [x1, y1] = pt(cx, cy, r, p1);
    return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${span > 50 ? 1 : 0} 1 ${x1} ${y1} Z`;
  }

  const DEFAULTS = {
    size: 240,
    value: 0,
    interactive: false,
    snapStep: 5,        // шаг прилипающих зон, 0 — выключить
    snapTol: 2.2,       // насколько близко нужно подвести, чтобы прилипло
    strongSnap: [0, 25, 50, 75, 100], // эти зоны ловят чуть шире
    ticks: true,
    tickLabels: true,
    center: 'percent',  // 'percent' | 'none' | строка
    color: null,        // по умолчанию --pie
    segments: null,     // [{v, color, label}] — многоцветный режим (не интерактивный)
    onChange: null,
    onCommit: null,
    label: 'Секторная диаграмма'
  };

  function create(options) {
    const o = Object.assign({}, DEFAULTS, options || {});
    const S = o.size, cx = S / 2, cy = S / 2;
    const r = S * 0.37;              // радиус пирога
    const rTick = r + S * 0.035;     // засечки снаружи
    const rText = r + S * 0.105;

    const svg = mk('svg', {
      viewBox: `0 0 ${S} ${S}`, width: S, height: S,
      class: 'pie nodrag' + (o.interactive ? ' interactive' : ''),
      role: o.interactive ? 'slider' : 'img',
      'aria-label': o.label,
      'aria-valuemin': o.interactive ? 0 : null,
      'aria-valuemax': o.interactive ? 100 : null,
      tabindex: o.interactive ? 0 : null,
      style: 'max-width:100%;height:auto;display:block;touch-action:none'
    });

    // фон-«пустая часть»
    svg.appendChild(mk('circle', { cx, cy, r, fill: 'var(--pie-rest)' }));

    // засечки
    if (o.ticks) {
      const gt = mk('g', { 'stroke-linecap': 'round' });
      for (let p = 0; p < 100; p += (o.snapStep || 5)) {
        const strong = p % 25 === 0;
        const [x1, y1] = pt(cx, cy, r + S * 0.008, p);
        const [x2, y2] = pt(cx, cy, strong ? rTick + S * 0.018 : rTick, p);
        gt.appendChild(mk('line', {
          x1, y1, x2, y2,
          stroke: strong ? 'var(--ink-soft)' : 'var(--line)',
          'stroke-width': strong ? 2.5 : 1.6
        }));
      }
      svg.appendChild(gt);
      if (o.tickLabels) {
        [[0, '0'], [25, '25'], [50, '50'], [75, '75']].forEach(([p, t]) => {
          const [x, y] = pt(cx, cy, rText, p);
          svg.appendChild(mk('text', {
            x, y, fill: 'var(--ink-soft)', 'font-size': S * 0.062, 'font-weight': 600,
            'text-anchor': 'middle', 'dominant-baseline': 'central'
          })).textContent = t;
        });
      }
    }

    // сектора
    const gSeg = mk('g', {});
    svg.appendChild(gSeg);
    const mainPath = mk('path', { fill: o.color || 'var(--pie)', stroke: 'none' });
    gSeg.appendChild(mainPath);

    // обводка круга поверх
    svg.appendChild(mk('circle', { cx, cy, r, fill: 'none', stroke: 'var(--line)', 'stroke-width': 2 }));

    // ручка
    const knob = mk('g', { style: 'pointer-events:none' });
    const knobRing = mk('circle', { r: S * 0.055, fill: 'var(--card)', stroke: o.color || 'var(--pie)', 'stroke-width': 4 });
    knob.appendChild(knobRing);
    if (o.interactive) svg.appendChild(knob);

    // центральная подпись
    let centerText = null;
    if (o.center !== 'none') {
      const plate = mk('circle', { cx, cy, r: S * 0.21, fill: 'var(--card)', opacity: .92 });
      svg.appendChild(plate);
      centerText = mk('text', {
        x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': S * 0.15, 'font-weight': 750, fill: 'var(--ink)'
      });
      svg.appendChild(centerText);
    }

    let value = clamp(o.value, 0, 100);
    let segments = o.segments;

    function renderSegments() {
      // многоцветный режим
      Array.from(gSeg.querySelectorAll('path.seg')).forEach(n => n.remove());
      if (!segments) { mainPath.style.display = ''; return; }
      mainPath.style.display = 'none';
      let acc = 0;
      segments.forEach(s => {
        const v = clamp(s.v, 0, 100 - acc);
        if (v > 0) {
          const p = mk('path', { class: 'seg', d: sectorPath(cx, cy, r, acc, acc + v), fill: s.color || 'var(--pie)' });
          if (s.opacity) p.setAttribute('opacity', s.opacity);
          gSeg.appendChild(p);
        }
        acc += v;
      });
    }

    function render() {
      if (!segments) mainPath.setAttribute('d', sectorPath(cx, cy, r, 0, value));
      const [kx, ky] = pt(cx, cy, r, value);
      knobRing.setAttribute('cx', kx); knobRing.setAttribute('cy', ky);
      if (centerText) {
        centerText.textContent = o.center === 'percent'
          ? (Math.round(value * 10) / 10).toString().replace('.', ',') + '%'
          : o.center;
      }
      svg.setAttribute('aria-valuenow', Math.round(value));
      svg.setAttribute('aria-valuetext', Math.round(value) + '%');
    }

    function snap(v) {
      if (!o.snapStep) return v;
      let best = v, bestD = Infinity;
      const zones = [];
      for (let p = 0; p <= 100; p += o.snapStep) zones.push(p);
      o.strongSnap.forEach(p => { if (zones.indexOf(p) < 0) zones.push(p); });
      zones.forEach(p => {
        const tol = o.strongSnap.indexOf(p) >= 0 ? o.snapTol * 1.35 : o.snapTol;
        const d = Math.abs(v - p);
        if (d <= tol && d < bestD) { best = p; bestD = d; }
      });
      return best;
    }

    let lastSnapped = null;
    function set(v, opts) {
      const prev = value;
      value = clamp(v, 0, 100);
      render();
      if (!(opts && opts.silent) && value !== prev && o.onChange) o.onChange(value);
      return value;
    }

    /* ---- перетаскивание ---- */
    if (o.interactive) {
      let dragging = false;
      const raw = e => {
        const b = svg.getBoundingClientRect();
        const x = (e.clientX - b.left) / b.width * S - cx;
        const y = (e.clientY - b.top) / b.height * S - cy;
        let a = Math.atan2(x, -y);           // 0 = вверх, по часовой
        if (a < 0) a += TAU;
        return a / TAU * 100;
      };
      function apply(e) {
        let v = raw(e);
        // не перескакивать через 0/100: держим край, пока палец не вернётся
        const d = v - value;
        if (d > 50) v = 0; else if (d < -50) v = 100;
        const snapped = snap(v);
        if (snapped !== lastSnapped && snapped !== v) {
          lastSnapped = snapped;
          if (navigator.vibrate) { try { navigator.vibrate(8); } catch (err) {} }
        }
        set(snapped);
      }
      const start = e => { dragging = true; svg.classList.add('dragging'); apply(e.e || e); };
      svg.addEventListener('pointerdown', e => {
        svg.setPointerCapture(e.pointerId); e.preventDefault(); start(e);
      });
      svg.addEventListener('pointermove', e => { if (dragging) { e.preventDefault(); apply(e); } });
      const stop = e => {
        if (!dragging) return;
        dragging = false; lastSnapped = null; svg.classList.remove('dragging');
        try { svg.releasePointerCapture(e.pointerId); } catch (err) {}
        if (o.onCommit) o.onCommit(value);
      };
      svg.addEventListener('pointerup', stop);
      svg.addEventListener('pointercancel', stop);
      svg.addEventListener('keydown', e => {
        const step = e.shiftKey ? 1 : (o.snapStep || 1);
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { set(clamp(value + step, 0, 100)); e.preventDefault(); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { set(clamp(value - step, 0, 100)); e.preventDefault(); }
        if (e.key === 'Home') { set(0); e.preventDefault(); }
        if (e.key === 'End') { set(100); e.preventDefault(); }
        if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'ArrowDown') && o.onCommit) o.onCommit(value);
      });
    }

    renderSegments(); render();

    return {
      node: svg,
      get: () => value,
      set,
      setSegments(arr) { segments = arr; renderSegments(); render(); },
      setCenter(text) { o.center = text; render(); },
      setColor(c) { mainPath.setAttribute('fill', c); knobRing.setAttribute('stroke', c); }
    };
  }

  global.Pie = { create, sectorPath };
})(window);
