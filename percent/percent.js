/* Раздел «Проценты». Каждый уровень собирается своей функцией build*(host). */
(function () {
  'use strict';
  const { el, $, Progress, num } = UI;
  const TASK_IDS = [];                 // регистр заданий: из него считается общий счётчик
  const task = id => { TASK_IDS.push(id); return id; };

  /* ================= Уровень 1 — песочница ================= */
  function buildSandbox(host) {
    const pie = Pie.create({
      size: 300, value: 25, interactive: true, snapStep: 5, snapTol: 2.2,
      label: 'Диаграмма: доля круга в процентах',
      onChange: v => set(v, 'pie')
    });

    const slider = el('input', { type: 'range', min: 0, max: 100, step: 1, value: 25,
      'aria-label': 'Процент' });
    const readout = el('div', { class: 'readout' });
    const quick = el('div', { class: 'quick' });
    const QUICK = [0, 10, 25, 50, 75, 100];
    const qbtns = QUICK.map(v => {
      const b = el('button', { type: 'button', text: v + '%' });
      b.addEventListener('click', () => { set(v); UI.pulse(pie.node); });
      quick.appendChild(b);
      return b;
    });

    function words(v) {
      if (v === 0) return 'Ничего не закрашено — это <b>0%</b>, пустой круг.';
      if (v === 100) return 'Закрашен весь круг — это <b>100%</b>, целое.';
      if (v === 50) return 'Ровно половина круга — это <b>50%</b>.';
      if (v === 25) return 'Четверть круга — это <b>25%</b>.';
      if (v === 75) return 'Три четверти круга — это <b>75%</b>.';
      if (v === 10) return 'Десятая часть круга — это <b>10%</b>.';
      if (v === 20) return 'Пятая часть круга — это <b>20%</b>.';
      if (v === 33 || v === 34) return 'Примерно треть круга — около <b>33%</b>.';
      return 'Закрашено <b>' + num(v) + '%</b>, а осталось ' + num(100 - v) + '%.';
    }
    function set(v, from) {
      if (from !== 'pie') pie.set(v, { silent: true });
      if (from !== 'slider') slider.value = Math.round(pie.get());
      const cur = pie.get();
      readout.innerHTML = words(Math.round(cur * 10) / 10);
      qbtns.forEach((b, i) => b.classList.toggle('on', QUICK[i] === Math.round(cur)));
    }
    slider.addEventListener('input', () => set(+slider.value, 'slider'));

    host.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'Весь круг — это 100%', style: 'margin-top:0' }),
      el('p', { class: 'muted', text: 'Хватай пальцем край диаграммы и крути. Или двигай бегунок. Диаграмма сама прилипает к ровным процентам: 5, 10, 15, 25…' }),
      el('div', { class: 'sandbox' }, [
        el('div', {}, [pie.node]),
        el('div', { class: 'side' }, [
          readout,
          el('div', { style: 'margin:14px 0 4px' }, [slider]),
          quick
        ])
      ])
    ]));
    set(25);
  }


  /* ================= Уровень 2 — поставь нужный процент (без подсказки) ================= */
  function buildSetPercent(host) {
    const TASKS = [50, 25, 75, 10, 30, 60];
    const grid = el('div', { class: 'task-grid' });

    TASKS.forEach((target, i) => {
      const id = task('pct/l2-' + target);
      const cell = el('div', { class: 'task-cell' });
      const pie = Pie.create({
        size: 230, value: 0, interactive: true, snapStep: 5, snapTol: 2.2,
        center: '', tickLabels: false, label: 'Поставь ' + target + ' процентов'
      });
      const verdict = el('div', { class: 'verdict' });
      const btn = el('button', { class: 'btn small', type: 'button', text: 'Проверить' });

      function check() {
        const v = pie.get();
        const ok = Math.abs(v - target) < 0.51;
        cell.classList.toggle('solved', ok);
        verdict.className = 'verdict ' + (ok ? 'ok' : 'bad');
        if (ok) {
          pie.setCenter(target + '%');
          verdict.textContent = 'Верно! Это ' + target + '%';
          Progress.done(id);
          UI.pulse(cell);
        } else {
          pie.setCenter('');
          verdict.textContent = v < target ? 'Пока мало — поверни дальше' : 'Перебор — поверни назад';
        }
      }
      btn.addEventListener('click', check);

      cell.appendChild(el('div', { class: 'ask', text: 'Поставь ' + target + '%' }));
      cell.appendChild(pie.node);
      cell.appendChild(btn);
      cell.appendChild(verdict);
      grid.appendChild(cell);

      if (Progress.isDone(id)) { pie.set(target); pie.setCenter(target + '%'); cell.classList.add('solved'); }
    });

    host.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'Поставь нужную долю', style: 'margin-top:0' }),
      el('p', { class: 'muted', text: 'Числа на диаграмме спрятаны — ставь на глаз, по засечкам. Потом нажми «Проверить».' })
    ]));
    host.appendChild(grid);
  }


  /* ======= общий конструктор примера с процентами и диаграммами ======= */
  /** cfg: {id, a, op:'+'|'−'|'×'|'÷', b, reveal:'always'|'button'|'none', size}
   *  для '+' и '−' b — тоже проценты; для '×' и '÷' b — обычное число. */
  function percentExample(cfg) {
    const a = cfg.a, b = cfg.b, op = cfg.op;
    const scalar = op === '×' || op === '÷';
    const answer = op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b;
    const size = cfg.size || 124;
    const wrap = el('div', { class: 'ex' });

    const pieA = Pie.create({ size, value: a, center: a + '%', tickLabels: false, label: a + ' процентов' });
    const pieB = scalar ? null
      : Pie.create({ size, value: b, center: b + '%', tickLabels: false, label: b + ' процентов' });
    const pieR = Pie.create({ size, value: answer, center: '', tickLabels: false,
      color: 'var(--ok)', label: 'Диаграмма ответа' });
    const capR = el('div', { class: 'cap', text: 'сколько?' });

    const pies = el('div', { class: 'pies' }, [
      el('div', { class: 'pie-box' }, [pieA.node]),
      el('div', { class: 'op', text: scalar ? op + ' ' + b : op }),
      scalar ? el('span') : el('div', { class: 'pie-box' }, [pieB.node]),
      el('div', { class: 'op', text: '=' }),
      el('div', { class: 'pie-box' }, [pieR.node, capR])
    ]);

    const inp = el('input', { type: 'number', inputmode: 'decimal', 'aria-label': 'Ответ в процентах', placeholder: '?' });
    const btn = el('button', { class: 'btn small', type: 'button', text: 'Проверить' });
    const verdict = el('div', { class: 'verdict' });

    const exprText = a + '% ' + op + ' ' + b + (scalar ? '' : '%') + ' = ?';
    wrap.appendChild(el('div', { class: 'expr', text: exprText }));

    let peekBtn = null;
    if (cfg.reveal === 'button') {
      pies.classList.add('hidden-pies');
      peekBtn = el('button', { class: 'btn quiet small peek', type: 'button', text: '👀 Подсмотреть диаграммы' });
      peekBtn.addEventListener('click', () => {
        const on = pies.classList.toggle('show');
        peekBtn.textContent = on ? '🙈 Спрятать диаграммы' : '👀 Подсмотреть диаграммы';
      });
      wrap.appendChild(peekBtn);
    }
    if (cfg.reveal !== 'none') wrap.appendChild(pies);

    wrap.appendChild(el('div', { class: 'answer' }, [
      el('span', { class: 'muted', text: 'Ответ:' }), inp, el('span', { text: '%' }), btn
    ]));
    wrap.appendChild(verdict);

    UI.checker({
      id: cfg.id, answer, tolerance: 1e-9, input: inp, button: btn, verdict,
      okText: 'Верно! ' + exprText.replace('?', UI.num(answer) + '%'),
      onSolved() {
        pieR.setCenter(UI.num(answer) + '%');
        capR.textContent = 'ответ';
        if (cfg.reveal === 'button' && !pies.classList.contains('show')) {
          pies.classList.add('show');
          peekBtn.textContent = '🙈 Спрятать диаграммы';
        }
        UI.pulse(wrap);
      }
    });

    if (Progress.isDone(cfg.id)) {
      inp.value = answer; inp.classList.add('ok'); pieR.setCenter(UI.num(answer) + '%'); capR.textContent = 'ответ';
      verdict.className = 'verdict ok'; verdict.textContent = 'Решено';
      if (cfg.reveal === 'button') pies.classList.add('show');
    }
    return wrap;
  }

  /* ================= Уровень 3 — сложение и вычитание с подсказками ================= */
  const ADD_SUB = [
    { a: 25, op: '+', b: 50 },
    { a: 10, op: '+', b: 15 },
    { a: 60, op: '−', b: 25 },
    { a: 35, op: '+', b: 40 },
    { a: 100, op: '−', b: 40 },
    { a: 50, op: '−', b: 20 },
    { a: 45, op: '+', b: 45 }
  ];

  function buildAddSubHinted(host) {
    const card = el('div', { class: 'card' }, [
      el('h2', { text: 'Складываем и вычитаем проценты', style: 'margin-top:0' }),
      el('p', { class: 'muted', text: 'Зелёная диаграмма справа — это ответ. Посчитай сам, а если трудно — сосчитай её доли по засечкам.' })
    ]);
    host.appendChild(card);
    const box = el('div', { class: 'card' });
    ADD_SUB.forEach((t, i) => box.appendChild(percentExample({
      id: task('pct/l3-' + i), a: t.a, op: t.op, b: t.b, reveal: 'always'
    })));
    host.appendChild(box);
  }


  /* ================= Уровень 4 — то же, но диаграммы спрятаны ================= */
  const HIDDEN = [
    { a: 45, op: '+', b: 30 },
    { a: 80, op: '−', b: 35 },
    { a: 60, op: '÷', b: 2 },
    { a: 25, op: '×', b: 3 },
    { a: 90, op: '÷', b: 3 },
    { a: 12, op: '×', b: 5 }
  ];

  function buildHidden(host) {
    host.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'Теперь без подсказок', style: 'margin-top:0' }),
      el('p', { class: 'muted', text: 'Считай числами в уме или на бумаге. Диаграммы спрятаны — их можно открыть кнопкой «Подсмотреть», если застрял.' })
    ]));
    const box = el('div', { class: 'card' });
    HIDDEN.forEach((t, i) => box.appendChild(percentExample({
      id: task('pct/l4-' + i), a: t.a, op: t.op, b: t.b, reveal: 'button'
    })));
    host.appendChild(box);
  }


  /* ======= ряд яблок: n штук, k закрашено ======= */
  function applesRow(n, k) {
    const row = el('div', { class: 'apples', 'aria-hidden': 'true' });
    const items = [];
    for (let i = 0; i < n; i++) {
      const a = el('span', { text: '🍎' });
      row.appendChild(a); items.push(a);
    }
    function set(k) { items.forEach((a, i) => a.classList.toggle('on', i < k)); }
    set(k || 0);
    return { node: row, set };
  }

  /* ================= Уровень 5 — процент от числа (яблоки) ================= */
  function buildApples(host) {
    /* --- песочница: сколько яблок в корзине и какой процент берём --- */
    let total = 20, pct = 25, basketRow = null;
    const pie = Pie.create({
      size: 230, value: pct, interactive: true, snapStep: 5, snapTol: 2.2,
      label: 'Какой процент берём', onChange: v => { pct = v; sync('pie'); }
    });
    const pctSlider = el('input', { type: 'range', min: 0, max: 100, step: 5, value: pct, 'aria-label': 'Процент' });
    const totalInput = el('input', { type: 'number', min: 1, max: 100, step: 1, value: total, 'aria-label': 'Сколько яблок в корзине' });
    const basketHost = el('div', {});
    const result = el('div', { class: 'readout' });

    function rebuildBasket() {
      basketHost.innerHTML = '';
      basketRow = applesRow(total, 0);
      basketHost.appendChild(basketRow.node);
    }
    function sync(from) {
      if (from !== 'pie') pie.set(pct, { silent: true });
      if (from !== 'slider') pctSlider.value = Math.round(pct);
      const exact = total * pct / 100;
      const k = Math.round(exact);
      basketRow.set(k);
      const whole = Math.abs(exact - k) < 1e-9;
      result.innerHTML = '<b>' + UI.num(pct) + '%</b> от <b>' + total + '</b> ' + UI.apples(total) +
        ' = <b>' + UI.num(exact) + '</b> ' + UI.apples(k) +
        (whole ? '' : ' <span class="muted">(ровно не делится — подсвечено ' + k + ')</span>') +
        '<div class="muted" style="margin-top:4px">' + total + ' ÷ 100 × ' + UI.num(pct) + ' = ' + UI.num(exact) + '</div>';
    }
    pctSlider.addEventListener('input', () => { pct = +pctSlider.value; sync('slider'); });
    totalInput.addEventListener('input', () => {
      total = UI.clamp(Math.round(+totalInput.value || 1), 1, 100);
      rebuildBasket(); sync('total');
    });

    host.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'Процент от числа', style: 'margin-top:0' }),
      el('p', { class: 'muted', text: 'Процент — это часть от целого. Целое здесь — корзина яблок. Меняй корзину и долю и смотри, сколько яблок получится.' }),
      el('div', { class: 'sandbox' }, [
        el('div', {}, [pie.node]),
        el('div', { class: 'side' }, [
          el('div', { class: 'row' }, [el('span', { text: 'В корзине' }), totalInput, el('span', { text: 'яблок' })]),
          el('div', { style: 'margin:12px 0 2px' }, [pctSlider]),
          result
        ])
      ]),
      basketHost
    ]));
    rebuildBasket(); sync('init');

    /* --- задания --- */
    const TASKS = [
      { p: 50, n: 18 }, { p: 25, n: 40 }, { p: 10, n: 70 },
      { p: 75, n: 12 }, { p: 20, n: 35 }, { p: 5, n: 60 }
    ];
    const box = el('div', { class: 'card' });
    box.appendChild(el('h3', { text: 'Посчитай сам', style: 'margin-top:0' }));
    TASKS.forEach((t, i) => {
      const id = task('pct/l5-' + i);
      const ans = t.n * t.p / 100;
      const row = el('div', { class: 'ex' });
      const pieT = Pie.create({ size: 110, value: t.p, center: t.p + '%', tickLabels: false, label: t.p + ' процентов' });
      const ap = applesRow(t.n, 0);
      const inp = el('input', { type: 'number', inputmode: 'numeric', placeholder: '?', 'aria-label': 'Сколько яблок' });
      const btn = el('button', { class: 'btn small', type: 'button', text: 'Проверить' });
      const verdict = el('div', { class: 'verdict' });

      row.appendChild(el('div', { class: 'expr', text: t.p + '% от ' + t.n + ' ' + UI.apples(t.n) + ' = ?' }));
      row.appendChild(el('div', { class: 'pies' }, [pieT.node]));
      row.appendChild(ap.node);
      row.appendChild(el('div', { class: 'answer' }, [inp, el('span', { class: 'muted', text: 'шт.' }), btn]));
      row.appendChild(verdict);
      box.appendChild(row);

      UI.checker({
        id, answer: ans, input: inp, button: btn, verdict,
        okText: 'Верно! ' + t.p + '% от ' + t.n + ' — это ' + ans,
        onSolved() { ap.set(ans); UI.pulse(row); }
      });
      if (Progress.isDone(id)) {
        inp.value = ans; inp.classList.add('ok'); ap.set(ans);
        verdict.className = 'verdict ok'; verdict.textContent = 'Решено';
      }
    });
    host.appendChild(box);
  }


  /* ======= пример «процент от процента» ======= */
  /** cfg: {id, inner, outer, reveal:'always'|'button'} — считаем inner% от outer% */
  function pctOfPct(cfg) {
    const inner = cfg.inner, outer = cfg.outer;
    const answer = Math.round(inner * outer) / 100;
    const size = cfg.size || 136;
    const wrap = el('div', { class: 'ex' });
    const exprText = inner + '% от ' + outer + '% = ?';
    wrap.appendChild(el('div', { class: 'expr', text: exprText }));

    // наложение: внутри сектора outer выделена доля inner
    const pieMix = Pie.create({
      size, value: outer, center: '', tickLabels: false, label: 'Доля внутри доли',
      segments: [
        { v: answer, color: 'var(--ok)' },
        { v: outer - answer, color: 'var(--pie)', opacity: .45 }
      ]
    });
    const pieR = Pie.create({ size, value: answer, center: '', tickLabels: false,
      color: 'var(--ok)', label: 'Диаграмма ответа' });
    const capR = el('div', { class: 'cap', text: 'сколько?' });

    const pies = el('div', { class: 'pies' }, [
      el('div', { class: 'pie-box' }, [pieMix.node,
        el('div', { class: 'cap', text: 'зелёное — это ' + inner + '% от ' + outer + '%' })]),
      el('div', { class: 'op', text: '=' }),
      el('div', { class: 'pie-box' }, [pieR.node, capR])
    ]);

    let peekBtn = null;
    if (cfg.reveal === 'button') {
      pies.classList.add('hidden-pies');
      peekBtn = el('button', { class: 'btn quiet small peek', type: 'button', text: '👀 Подсмотреть диаграммы' });
      peekBtn.addEventListener('click', () => {
        const on = pies.classList.toggle('show');
        peekBtn.textContent = on ? '🙈 Спрятать диаграммы' : '👀 Подсмотреть диаграммы';
      });
      wrap.appendChild(peekBtn);
    }
    wrap.appendChild(pies);

    const inp = el('input', { type: 'number', inputmode: 'decimal', placeholder: '?', 'aria-label': 'Ответ в процентах' });
    const btn = el('button', { class: 'btn small', type: 'button', text: 'Проверить' });
    const verdict = el('div', { class: 'verdict' });
    wrap.appendChild(el('div', { class: 'answer' }, [el('span', { class: 'muted', text: 'Ответ:' }), inp, el('span', { text: '%' }), btn]));
    wrap.appendChild(verdict);

    UI.checker({
      id: cfg.id, answer, tolerance: 1e-9, input: inp, button: btn, verdict,
      okText: 'Верно! ' + inner + '% × ' + outer + '% = ' + UI.num(answer) + '%',
      badText: 'Пока нет. Подсказка: ' + inner + ' ÷ 100 × ' + outer,
      onSolved() { pieR.setCenter(UI.num(answer) + '%'); capR.textContent = 'ответ'; UI.pulse(wrap);
        if (cfg.reveal === 'button' && !pies.classList.contains('show')) {
          pies.classList.add('show'); peekBtn.textContent = '🙈 Спрятать диаграммы';
        } }
    });
    if (Progress.isDone(cfg.id)) {
      inp.value = answer; inp.classList.add('ok'); pieR.setCenter(UI.num(answer) + '%'); capR.textContent = 'ответ';
      verdict.className = 'verdict ok'; verdict.textContent = 'Решено';
      if (cfg.reveal === 'button') pies.classList.add('show');
    }
    return wrap;
  }

  /* ================= Уровень 6 — процент от процента, с диаграммами ================= */
  function buildPctOfPct(host) {
    /* песочница: обе доли крутятся */
    let outer = 60, inner = 50;
    const pieO = Pie.create({ size: 200, value: outer, interactive: true, snapStep: 5,
      label: 'Большая доля', onChange: v => { outer = v; sync(); } });
    const pieI = Pie.create({ size: 200, value: inner, interactive: true, snapStep: 5,
      label: 'Какую часть от неё берём', onChange: v => { inner = v; sync(); } });
    const pieMix = Pie.create({ size: 200, value: 60, center: '', label: 'Наложение' });
    const out = el('div', { class: 'readout center' });

    function sync() {
      const res = Math.round(inner * outer) / 100;
      pieMix.setSegments([
        { v: res, color: 'var(--ok)' },
        { v: outer - res, color: 'var(--pie)', opacity: .45 }
      ]);
      pieMix.setCenter(UI.num(res) + '%');
      out.innerHTML = '<b>' + UI.num(inner) + '%</b> от <b>' + UI.num(outer) + '%</b> = <b>' + UI.num(res) + '%</b>' +
        '<div class="muted">' + UI.num(inner) + ' ÷ 100 × ' + UI.num(outer) + ' = ' + UI.num(res) + '</div>';
    }

    host.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'Процент от процента', style: 'margin-top:0' }),
      el('p', { class: 'muted', text: 'Берём долю не от целого круга, а от уже отрезанного куска. Крути обе диаграммы: слева — какой кусок был, посередине — какую его часть берём, справа — что вышло от целого круга.' }),
      el('div', { class: 'pie-row' }, [
        el('div', { class: 'pie-box' }, [pieO.node, el('div', { class: 'cap', text: 'было (от целого)' })]),
        el('div', { class: 'op', text: '×' }),
        el('div', { class: 'pie-box' }, [pieI.node, el('div', { class: 'cap', text: 'какую часть берём' })]),
        el('div', { class: 'op', text: '=' }),
        el('div', { class: 'pie-box' }, [pieMix.node, el('div', { class: 'cap', text: 'зелёное — результат' })])
      ]),
      out
    ]));
    sync();

    const box = el('div', { class: 'card' });
    box.appendChild(el('h3', { text: 'Посчитай сам', style: 'margin-top:0' }));
    [[50, 60], [25, 80], [10, 50], [50, 50], [75, 40]].forEach((t, i) => {
      box.appendChild(pctOfPct({ id: task('pct/l6-' + i), inner: t[0], outer: t[1], reveal: 'always' }));
    });
    host.appendChild(box);
  }

  /* ================= Уровень 7 — процент от процента без диаграмм ================= */
  function buildPctOfPctHidden(host) {
    host.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'Процент от процента — без диаграмм', style: 'margin-top:0' }),
      el('p', { class: 'muted', text: 'Правило простое: раздели первый процент на 100 и умножь на второй. Диаграммы откроются кнопкой, если захочется проверить себя.' })
    ]));
    const box = el('div', { class: 'card' });
    [[20, 40], [30, 50], [25, 60], [10, 90], [40, 50]].forEach((t, i) => {
      box.appendChild(pctOfPct({ id: task('pct/l7-' + i), inner: t[0], outer: t[1], reveal: 'button' }));
    });
    host.appendChild(box);
  }

  /* ================= сборка страницы ================= */
  const L = {
    lvl1: buildSandbox,
    lvl2: buildSetPercent,
    lvl3: buildAddSubHinted,
    lvl4: buildHidden,
    lvl5: buildApples,
    lvl6: buildPctOfPct,
    lvl7: buildPctOfPctHidden
  };
  Object.keys(L).forEach(id => { const n = document.getElementById(id); if (n) L[id](n); });
  UI.levels();

  /* общий счётчик решённого */
  const score = $('#score');
  function updScore() {
    const total = TASK_IDS.length;
    const done = Progress.countDone('pct/');
    if (!total) { score.style.display = 'none'; return; }
    score.textContent = 'Решено ' + done + ' из ' + total;
    score.classList.toggle('ok', done >= total);
  }
  addEventListener('progress', updScore); updScore();
})();
