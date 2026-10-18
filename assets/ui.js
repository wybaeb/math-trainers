/* Общие помощники тренажёров: DOM, прогресс, проверка ответов, вкладки уровней. */
(function (global) {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function el(tag, attrs, children) {
    const n = document.createElementNS(
      tag === 'svg' || SVG_TAGS.has(tag) ? 'http://www.w3.org/2000/svg' : 'http://www.w3.org/1999/xhtml',
      tag
    );
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    (children || []).forEach(c => n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return n;
  }
  const SVG_TAGS = new Set(['svg','g','path','circle','line','rect','text','polygon','polyline','defs','clipPath','tspan','ellipse','use','marker','title']);

  /* ---------- прогресс в localStorage ---------- */
  const KEY = 'math-trainers/v1';
  function readAll() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; }
  }
  function writeAll(obj) {
    try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch (e) { /* приватный режим — просто не сохраняем */ }
  }
  const Progress = {
    get(id) { return readAll()[id] || null; },
    set(id, val) { const a = readAll(); a[id] = val; writeAll(a); },
    done(id) { this.set(id, { done: true, at: Date.now() }); dispatchEvent(new CustomEvent('progress')); },
    isDone(id) { const v = this.get(id); return !!(v && v.done); },
    reset(prefix) {
      const a = readAll();
      Object.keys(a).forEach(k => { if (!prefix || k.startsWith(prefix)) delete a[k]; });
      writeAll(a); dispatchEvent(new CustomEvent('progress'));
    },
    countDone(prefix) { return Object.keys(readAll()).filter(k => k.startsWith(prefix) && readAll()[k].done).length; }
  };

  /* ---------- индикатор прогресса ---------- */
  function progressBar(container, prefix, total, label) {
    const bar = el('i');
    const txt = el('span', { text: '' });
    container.appendChild(el('div', { class: 'progress' }, [
      el('span', { text: label || 'Решено' }), el('div', { class: 'bar' }, [bar]), txt
    ]));
    const upd = () => {
      const n = Progress.countDone(prefix);
      bar.style.width = Math.round((n / total) * 100) + '%';
      txt.textContent = n + ' / ' + total;
    };
    addEventListener('progress', upd); upd();
    return upd;
  }

  /* ---------- вкладки уровней ---------- */
  function levels(host) {
    const panes = $$('.level', host || document);
    const bar = $('.levels');
    if (!bar) return;
    const btns = $$('button', bar);
    function show(i) {
      panes.forEach((p, k) => p.classList.toggle('on', k === i));
      btns.forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
      try { location.hash = 'l' + (i + 1); } catch (e) {}
      window.scrollTo({ top: 0, behavior: 'smooth' });
      dispatchEvent(new CustomEvent('levelshown', { detail: { index: i } }));
    }
    btns.forEach((b, i) => b.addEventListener('click', () => show(i)));
    const m = /^#l(\d+)$/.exec(location.hash || '');
    show(m && panes[+m[1] - 1] ? +m[1] - 1 : 0);
    return show;
  }

  /* ---------- проверка числового ответа ---------- */
  /** opts: {id, answer, tolerance, input, button, verdict, onSolved, format} */
  function checker(opts) {
    const tol = opts.tolerance === undefined ? 1e-9 : opts.tolerance;
    const inp = opts.input, out = opts.verdict;
    let solved = false;
    function norm(s) { return String(s).replace(',', '.').replace(/\s/g, '').trim(); }
    function check(silent) {
      const raw = norm(inp.value);
      if (raw === '') { if (!silent) { out.textContent = 'Впиши ответ'; out.className = 'verdict'; } return false; }
      const v = Number(raw);
      const ok = isFinite(v) && Math.abs(v - opts.answer) <= tol;
      inp.classList.toggle('ok', ok); inp.classList.toggle('bad', !ok);
      out.className = 'verdict ' + (ok ? 'ok' : 'bad');
      out.textContent = ok ? (opts.okText || 'Верно!') : (opts.badText || 'Пока нет. Попробуй ещё раз');
      if (ok && !solved) {
        solved = true;
        if (opts.id) Progress.done(opts.id);
        if (opts.onSolved) opts.onSolved();
      }
      return ok;
    }
    inp.addEventListener('input', () => { inp.classList.remove('ok', 'bad'); out.textContent = ''; out.className = 'verdict'; });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
    if (opts.button) opts.button.addEventListener('click', () => check());
    return { check, isSolved: () => solved };
  }

  /* ---------- перетаскивание указателем (мышь + палец + Pencil) ---------- */
  function drag(node, handlers) {
    let id = null;
    const pt = e => ({ x: e.clientX, y: e.clientY, e });
    node.addEventListener('pointerdown', e => {
      if (id !== null) return;
      id = e.pointerId;
      node.setPointerCapture(id);
      e.preventDefault();
      handlers.start && handlers.start(pt(e));
    });
    node.addEventListener('pointermove', e => {
      if (e.pointerId !== id) return;
      e.preventDefault();
      handlers.move && handlers.move(pt(e));
    });
    const end = e => {
      if (e.pointerId !== id) return;
      try { node.releasePointerCapture(id); } catch (err) {}
      id = null;
      handlers.end && handlers.end(pt(e));
    };
    node.addEventListener('pointerup', end);
    node.addEventListener('pointercancel', end);
  }

  /* ---------- мелочи ---------- */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }
  const apples = n => plural(n, 'яблоко', 'яблока', 'яблок');
  /** красивое число: 12.5 → «12,5», 12.0 → «12» */
  function num(v, digits) {
    const d = digits === undefined ? 2 : digits;
    const s = Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : String(Number(v.toFixed(d)));
    return s.replace('.', ',');
  }
  function shuffle(a) {
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
    return r;
  }
  function pulse(node) {
    node.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }],
      { duration: 260, easing: 'ease-out' }
    );
  }

  global.UI = { $, $$, el, Progress, progressBar, levels, checker, drag, clamp, plural, apples, num, shuffle, pulse };
})(window);
