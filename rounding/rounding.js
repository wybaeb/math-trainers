/* Раздел «Округление». */
(function () {
  'use strict';
  const { el, $, Progress } = UI;
  const TASK_IDS = [];
  const task = id => { TASK_IDS.push(id); return id; };
  const fmt = NumberLine.fmt;

  /* ================= Уровень 1 — как это работает ================= */
  function buildDemo(host) {
    let mode = 'nearest';
    const line = NumberLine.create({
      min: 4, max: 8, value: 5.5, step: 0.1, interactive: true, mode,
      label: 'Число на полоске', onChange: () => sync()
    });
    const out = el('div', { class: 'verdict-big' });
    const why = el('div', { class: 'why' });

    const MODES = [
      ['nearest', 'До ближайшего'],
      ['up', 'Вверх ↑'],
      ['down', 'Вниз ↓']
    ];
    const modeBar = el('div', { class: 'modes' });
    const mbtns = MODES.map(([key, title]) => {
      const b = el('button', { type: 'button', text: title, 'aria-pressed': String(key === mode) });
      b.addEventListener('click', () => {
        mode = key; line.setMode(key);
        mbtns.forEach((x, i) => x.setAttribute('aria-pressed', String(MODES[i][0] === key)));
        sync();
      });
      modeBar.appendChild(b);
      return b;
    });

    const quick = el('div', { class: 'quickv' });
    [4.2, 5.5, 5.4, 6, 6.8, 7.5].forEach(v => {
      const b = el('button', { type: 'button', text: fmt(v) });
      b.addEventListener('click', () => { line.set(v); sync(); });
      quick.appendChild(b);
    });

    function sync() {
      const v = line.get(), r = line.rounded();
      const frac = Math.round((v - Math.floor(v)) * 10) / 10;
      out.innerHTML = '<span>' + fmt(v) + '</span><span class="to">→</span><span class="res">' + r + '</span>';
      let text;
      if (Math.abs(frac) < 1e-9) {
        text = 'Число и так целое — округлять нечего, остаётся ' + r + '.';
      } else if (mode === 'up') {
        text = 'Округление вверх всегда идёт к большему целому: даже от ' + fmt(v) + ' прыгаем к ' + r + '.';
      } else if (mode === 'down') {
        text = 'Округление вниз всегда идёт к меньшему целому: от ' + fmt(v) + ' откидываем хвостик и остаётся ' + r + '.';
      } else if (Math.abs(frac - 0.5) < 1e-9) {
        text = 'Ровно половина: до ' + Math.floor(v) + ' и до ' + Math.ceil(v) + ' одинаково. Договорились в таком случае округлять к большему — ' + r + '.';
      } else if (frac < 0.5) {
        text = 'Хвостик ' + fmt(frac) + ' меньше половины — ближе левая засечка, ' + r + '.';
      } else {
        text = 'Хвостик ' + fmt(frac) + ' больше половины — ближе правая засечка, ' + r + '.';
      }
      why.textContent = text;
    }

    host.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'Куда округлять?', style: 'margin-top:0' }),
      el('p', { class: 'muted', text: 'Полоска — это числа подряд. Большие засечки — целые числа, маленькие — десятые. Двигай синий бегунок и смотри, к какому целому он притянется зелёной стрелкой.' }),
      el('div', {}, [line.node]),
      modeBar,
      out,
      why,
      el('p', { class: 'muted center', style: 'margin-top:14px', text: 'Быстро поставить число:' }),
      quick
    ]));
    sync();
  }

  /* ================= сборка ================= */
  const L = { lvl1: buildDemo };
  Object.keys(L).forEach(id => { const n = document.getElementById(id); if (n) L[id](n); });
  UI.levels();

  const score = $('#score');
  function updScore() {
    const total = TASK_IDS.length;
    if (!total) { score.style.display = 'none'; return; }
    score.textContent = 'Решено ' + Progress.countDone('rnd/') + ' из ' + total;
  }
  addEventListener('progress', updScore); updScore();
})();
