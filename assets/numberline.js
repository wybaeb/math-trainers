/* Числовая полоска с засечками: бегунок, подсветка целого, куда округляем. */
(function (global) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    return n;
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = v => (Math.round(v * 100) / 100).toString().replace('.', ',');

  const MODES = {
    nearest: { title: 'до ближайшего', round: v => Math.round(v) },
    up:      { title: 'вверх',          round: v => Math.ceil(v - 1e-9) },
    down:    { title: 'вниз',           round: v => Math.floor(v + 1e-9) }
  };

  const DEFAULTS = {
    min: 4, max: 8, value: 5.5, step: 0.1,
    interactive: false,
    mode: 'nearest',
    showTarget: true,     // рисовать ли, куда округляем
    showValue: true,      // подпись значения над бегунком
    compact: false,
    onChange: null,
    label: 'Числовая полоска'
  };

  function create(options) {
    const o = Object.assign({}, DEFAULTS, options || {});
    const W = 640, H = o.compact ? 108 : 132, PAD = 34;
    const axis = o.compact ? 62 : 82;
    const x = v => PAD + (v - o.min) / (o.max - o.min) * (W - 2 * PAD);

    const svg = mk('svg', {
      viewBox: `0 0 ${W} ${H}`, class: 'nline nodrag' + (o.interactive ? ' interactive' : ''),
      role: o.interactive ? 'slider' : 'img', 'aria-label': o.label,
      tabindex: o.interactive ? 0 : null,
      'aria-valuemin': o.min, 'aria-valuemax': o.max,
      style: 'width:100%;height:auto;display:block;touch-action:none;overflow:visible'
    });

    // зона «куда округлится»
    const zone = mk('rect', { y: axis - 16, height: 32, rx: 8, fill: 'var(--ok)', opacity: .12 });
    if (o.showTarget) svg.appendChild(zone);

    svg.appendChild(mk('line', { x1: PAD - 14, y1: axis, x2: W - PAD + 14, y2: axis, stroke: 'var(--ink-soft)', 'stroke-width': 2.5, 'stroke-linecap': 'round' }));

    // засечки
    const steps = Math.round((o.max - o.min) * 10);
    const intTicks = {};
    for (let i = 0; i <= steps; i++) {
      const v = o.min + i / 10, xx = x(v);
      const big = i % 10 === 0, half = i % 5 === 0;
      svg.appendChild(mk('line', {
        x1: xx, y1: axis - (big ? 14 : half ? 9 : 5), x2: xx, y2: axis + (big ? 14 : half ? 9 : 5),
        stroke: big ? 'var(--ink)' : 'var(--ink-soft)',
        'stroke-width': big ? 2.5 : half ? 1.8 : 1.1, opacity: big ? 1 : half ? .7 : .45
      }));
      if (big) {
        const t = mk('text', {
          x: xx, y: axis + (o.compact ? 32 : 36), 'text-anchor': 'middle',
          'font-size': o.compact ? 16 : 18, 'font-weight': 700, fill: 'var(--ink-soft)'
        });
        t.textContent = String(Math.round(v));
        svg.appendChild(t);
        intTicks[Math.round(v)] = t;
      }
    }

    // точка-цель
    const target = mk('circle', { r: 9, cy: axis, fill: 'var(--ok)' });
    const arrow = mk('path', { fill: 'none', stroke: 'var(--ok)', 'stroke-width': 2.5, 'stroke-linecap': 'round' });
    if (o.showTarget) { svg.appendChild(arrow); svg.appendChild(target); }

    // бегунок
    const knobY = axis - (o.compact ? 34 : 44);
    const stem = mk('line', { y1: knobY, y2: axis, stroke: 'var(--accent)', 'stroke-width': 3 });
    const knob = mk('circle', { cy: knobY, r: o.compact ? 13 : 16, fill: 'var(--accent)', stroke: 'var(--card)', 'stroke-width': 3 });
    const vlabel = mk('text', {
      y: knobY - (o.compact ? 20 : 26), 'text-anchor': 'middle',
      'font-size': o.compact ? 18 : 22, 'font-weight': 750, fill: 'var(--accent)'
    });
    svg.appendChild(stem); svg.appendChild(knob);
    if (o.showValue) svg.appendChild(vlabel);

    let value = clamp(o.value, o.min, o.max);
    let mode = o.mode;

    function render() {
      const xx = x(value);
      stem.setAttribute('x1', xx); stem.setAttribute('x2', xx);
      knob.setAttribute('cx', xx);
      vlabel.setAttribute('x', xx);
      vlabel.textContent = fmt(value);

      const t = clamp(MODES[mode].round(value), o.min, o.max);
      const tx = x(t);
      target.setAttribute('cx', tx);
      // зона — все числа, которые при этом способе округляются сюда же
      const band = mode === 'up' ? [t - 1, t] : mode === 'down' ? [t, t + 1] : [t - 0.5, t + 0.5];
      const z0 = x(clamp(band[0], o.min, o.max)), z1 = x(clamp(band[1], o.min, o.max));
      zone.setAttribute('x', z0);
      zone.setAttribute('width', Math.max(0, z1 - z0));
      const lift = axis - (o.compact ? 26 : 32);
      arrow.setAttribute('d', Math.abs(tx - xx) < 1 ? '' :
        `M ${xx} ${axis - 2} Q ${(xx + tx) / 2} ${lift} ${tx} ${axis - 10}`);
      Object.keys(intTicks).forEach(k => {
        const on = Number(k) === t;
        intTicks[k].setAttribute('fill', on ? 'var(--ok)' : 'var(--ink-soft)');
        intTicks[k].setAttribute('font-size', (on ? (o.compact ? 19 : 21) : (o.compact ? 16 : 18)));
      });
      svg.setAttribute('aria-valuenow', value);
      svg.setAttribute('aria-valuetext', fmt(value));
    }

    function set(v, silent) {
      const prev = value;
      value = clamp(Math.round(v / o.step) * o.step, o.min, o.max);
      value = Math.round(value * 1000) / 1000;
      render();
      if (!silent && value !== prev && o.onChange) o.onChange(value);
      return value;
    }

    if (o.interactive) {
      const vAt = e => {
        const b = svg.getBoundingClientRect();
        const px = (e.clientX - b.left) / b.width * W;
        return o.min + (px - PAD) / (W - 2 * PAD) * (o.max - o.min);
      };
      let dragging = false;
      svg.addEventListener('pointerdown', e => {
        dragging = true; svg.setPointerCapture(e.pointerId); e.preventDefault(); set(vAt(e));
      });
      svg.addEventListener('pointermove', e => { if (dragging) { e.preventDefault(); set(vAt(e)); } });
      const stop = e => {
        if (!dragging) return;
        dragging = false;
        try { svg.releasePointerCapture(e.pointerId); } catch (err) {}
      };
      svg.addEventListener('pointerup', stop);
      svg.addEventListener('pointercancel', stop);
      svg.addEventListener('keydown', e => {
        const d = e.shiftKey ? 1 : o.step;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { set(value + d); e.preventDefault(); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { set(value - d); e.preventDefault(); }
      });
    }

    render();
    return {
      node: svg,
      get: () => value,
      set,
      setMode(m) { mode = m; render(); },
      getMode: () => mode,
      rounded: () => MODES[mode].round(value)
    };
  }

  global.NumberLine = { create, MODES, fmt };
})(window);
