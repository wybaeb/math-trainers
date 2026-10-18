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


  /* ======= общий конструктор задания на округление ======= */
  /** cfg: {id, value, mode, prompt, exprPrefix} */
  function roundTask(cfg) {
    const v = cfg.value, mode = cfg.mode;
    const answer = NumberLine.MODES[mode].round(v);
    const lo = Math.floor(v) - 1, hi = Math.floor(v) + 2;
    const row = el('div', { class: 'rt' });

    const line = NumberLine.create({
      min: lo, max: hi, value: v, mode, compact: true, showTarget: false,
      label: 'Где стоит число ' + fmt(v)
    });

    const inp = el('input', { type: 'number', inputmode: 'numeric', placeholder: '?', 'aria-label': 'Ответ' });
    const btn = el('button', { class: 'btn small', type: 'button', text: 'Проверить' });
    const verdict = el('div', { class: 'verdict' });

    row.appendChild(el('div', { class: 'q', text: cfg.prompt }));
    row.appendChild(el('div', { class: 'line-wrap' }, [line.node]));
    row.appendChild(el('div', { class: 'answer' }, [inp, btn]));
    row.appendChild(verdict);

    UI.checker({
      id: cfg.id, answer, input: inp, button: btn, verdict,
      okText: 'Верно: ' + fmt(v) + ' → ' + answer,
      onSolved() { line.reveal(true); UI.pulse(row); }
    });
    if (Progress.isDone(cfg.id)) {
      inp.value = answer; inp.classList.add('ok'); line.reveal(true);
      verdict.className = 'verdict ok'; verdict.textContent = 'Решено';
    }
    return row;
  }

  function taskLevel(host, cfg) {
    host.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: cfg.title, style: 'margin-top:0' }),
      el('p', { class: 'muted', text: cfg.hint })
    ]));
    const box = el('div', { class: 'card' });
    cfg.items.forEach((v, i) => box.appendChild(roundTask({
      id: task(cfg.prefix + i), value: v, mode: cfg.mode,
      prompt: cfg.verb + ': ' + fmt(v)
    })));
    host.appendChild(box);
  }

  /* ================= Уровни 2–4 — вверх, вниз, до ближайшего ================= */
  function buildUp(host) {
    taskLevel(host, {
      title: 'Округляем вверх', mode: 'up', prefix: 'rnd/up-', verb: 'Округли вверх',
      hint: 'Вверх — всегда к большему целому, даже если хвостик совсем маленький. Полоска подсказывает, между какими целыми стоит число.',
      items: [4.3, 7.1, 2.8, 5.5, 9.2, 1.9]
    });
  }
  function buildDown(host) {
    taskLevel(host, {
      title: 'Округляем вниз', mode: 'down', prefix: 'rnd/dn-', verb: 'Округли вниз',
      hint: 'Вниз — всегда к меньшему целому: просто отбрасываем хвостик, каким бы большим он ни был.',
      items: [4.7, 8.2, 3.5, 6.9, 2.1, 9.8]
    });
  }
  function buildNearest(host) {
    taskLevel(host, {
      title: 'До ближайшего целого', mode: 'nearest', prefix: 'rnd/nr-', verb: 'Округли до целого',
      hint: 'Смотрим на хвостик: меньше половины — вниз, половина и больше — вверх.',
      items: [4.4, 4.6, 7.5, 2.3, 8.7, 5.5]
    });
  }

  /* ================= Уровень 5 — раздели и округли ================= */
  const DIVS = [[17, 4], [23, 5], [9, 2], [31, 6], [44, 8], [50, 7]];
  function buildDivide(host) {
    host.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'Раздели и округли', style: 'margin-top:0' }),
      el('p', { class: 'muted', text: 'Сначала раздели, потом округли результат до ближайшего целого. Полоска покажет, куда попал ответ, когда решишь.' })
    ]));
    const box = el('div', { class: 'card' });
    DIVS.forEach((d, i) => {
      const q = d[0] / d[1];
      const id = task('rnd/div-' + i);
      const answer = Math.round(q);
      const row = el('div', { class: 'rt' });
      const lo = Math.floor(q) - 1, hi = Math.floor(q) + 2;
      const line = NumberLine.create({ min: lo, max: hi, value: q, mode: 'nearest', compact: true,
        showTarget: false, label: 'Где стоит частное' });

      const inp = el('input', { type: 'number', inputmode: 'numeric', placeholder: '?', 'aria-label': 'Ответ' });
      const btn = el('button', { class: 'btn small', type: 'button', text: 'Проверить' });
      const peek = el('button', { class: 'btn quiet small', type: 'button', text: '👀 Показать полоску' });
      const verdict = el('div', { class: 'verdict' });
      const lineWrap = el('div', { class: 'line-wrap', style: 'display:none' }, [line.node]);

      peek.addEventListener('click', () => {
        const on = lineWrap.style.display === 'none';
        lineWrap.style.display = on ? '' : 'none';
        peek.textContent = on ? '🙈 Спрятать полоску' : '👀 Показать полоску';
      });

      row.appendChild(el('div', { class: 'q', text: d[0] + ' ÷ ' + d[1] + ' = ? (до целого)' }));
      row.appendChild(el('div', { class: 'center', style: 'margin:8px 0' }, [peek]));
      row.appendChild(lineWrap);
      row.appendChild(el('div', { class: 'answer' }, [inp, btn]));
      row.appendChild(verdict);
      box.appendChild(row);

      const exact = Math.abs(q - Math.round(q * 100) / 100) < 1e-9;
      UI.checker({
        id, answer, input: inp, button: btn, verdict,
        okText: 'Верно: ' + d[0] + ' ÷ ' + d[1] + ' = ' + (exact ? '' : '≈ ') + fmt(q) + ' → ' + answer,
        onSolved() { lineWrap.style.display = ''; peek.textContent = '🙈 Спрятать полоску'; line.reveal(true); UI.pulse(row); }
      });
      if (Progress.isDone(id)) {
        inp.value = answer; inp.classList.add('ok'); lineWrap.style.display = ''; line.reveal(true);
        peek.textContent = '🙈 Спрятать полоску';
        verdict.className = 'verdict ok'; verdict.textContent = 'Решено';
      }
    });
    host.appendChild(box);
  }

  /* ================= сборка ================= */
  const L = { lvl1: buildDemo, lvl2: buildUp, lvl3: buildDown, lvl4: buildNearest, lvl5: buildDivide };
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
