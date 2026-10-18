/* Раздел «Столбик и уголок»: доска, мультфильм по шагам и тренажёр с подсказчиком. */
(function () {
  'use strict';
  const { el, $, Progress } = UI;
  const TASK_IDS = [];
  const task = id => { TASK_IDS.push(id); return id; };

  /* ================= доска: сетка ячеек из модели ================= */
  function makeBoard(m, mode) {
    const root = el('div', { class: 'board' });
    const left = el('div', { class: 'left' });
    const slots = new Map();   // 'row/col' → ячейка-контейнер

    // когда появляется черта над строкой: вместе с тем, что под ней подводят
    const minStep = id => {
      const st = m.cells.filter(c => c.row === id).map(c => c.step);
      return st.length ? Math.min.apply(null, st) : Infinity;
    };
    const lines = [];
    m.rows.forEach((r, ri) => {
      const rowEl = el('div', { class: 'brow' + (r.small ? ' small' : '') });
      const lineCells = [];
      for (let c = 0; c < m.cols; c++) {
        const cell = el('div', { class: 'bcell' });
        if (r.lineAbove) {
          const from = r.lineFrom === undefined ? 0 : r.lineFrom;
          const to = r.lineTo === undefined ? m.cols - 1 : r.lineTo;
          if (c >= from && c <= to) lineCells.push(cell);
        }
        rowEl.appendChild(cell);
        slots.set(r.id + '/' + c, cell);
      }
      if (lineCells.length) {
        const prev = m.rows[ri - 1];
        const step = Math.min(minStep(r.id), prev ? minStep(prev.id) : Infinity);
        lines.push({ cells: lineCells, step: isFinite(step) ? step : 0 });
      }
      left.appendChild(rowEl);
    });
    root.appendChild(left);

    // правая часть уголка: делитель и частное
    if (m.kind === 'div') {
      const right = el('div', { class: 'right' });
      const divCells = m.cells.filter(c => c.zone === 'right' && c.row === 'div');
      const qCells = m.cells.filter(c => c.zone === 'right' && c.row === 'q').sort((a, b) => a.col - b.col);
      qCells.forEach((c, i) => { c.seq = i; });
      const width = Math.max(divCells.length, qCells.length, 1);
      [['div', false], ['q', true]].forEach(([id, line]) => {
        const rowEl = el('div', { class: 'brow' + (line ? ' qline' : '') });
        for (let c = 0; c < width; c++) {
          const cell = el('div', { class: 'bcell' });
          rowEl.appendChild(cell);
          slots.set(id + '/' + c, cell);
        }
        right.appendChild(rowEl);
      });
      root.appendChild(right);
    }

    // раскладываем содержимое
    const items = [];
    m.cells.forEach(c => {
      const key = (c.zone === 'right' ? c.row + '/' + (c.row === 'q' ? c.seq : c.col) : c.row + '/' + c.col);
      const slot = slots.get(key);
      if (!slot) return;
      const isInput = mode === 'practice' && c.kind === 'write';
      let node;
      if (isInput) {
        node = el('input', {
          type: 'text', inputmode: 'numeric', maxlength: 1, disabled: 'disabled',
          'aria-label': 'цифра', autocomplete: 'off'
        });
      } else {
        node = el('span', { text: c.text });
        if (c.kind === 'sign') slot.classList.add('sign');
        if (c.kind === 'bring') slot.classList.add('bring');
      }
      slot.appendChild(node);
      items.push({ cell: c, node, slot, isInput });
    });

    function visibleAt(it, cur) {
      const c = it.cell;
      if (c.until !== undefined && cur >= c.until) return false;
      if (mode === 'practice' && c.kind === 'carry') return c.step < cur;
      return c.step <= cur;
    }
    function apply(cur) {
      lines.forEach(l => l.cells.forEach(n => n.classList.toggle('lt', cur >= l.step)));
      items.forEach(it => {
        const on = visibleAt(it, cur);
        it.node.style.visibility = on ? '' : 'hidden';
        if (!on) { it.slot.classList.remove('hl', 'src'); }
      });
    }
    function mark(step) {
      root.querySelectorAll('.bcell.hl,.bcell.src').forEach(n => n.classList.remove('hl', 'src'));
      const s = m.steps[step];
      if (!s) return;
      const key = p => (p.zone === 'right' ? p.row + '/' + p.col : p.row + '/' + p.col);
      if (s.focus) { const n = slots.get(key(s.focus)); if (n) n.classList.add('hl'); }
      (s.source || []).forEach(p => { const n = slots.get(key(p)); if (n) n.classList.add('src'); });
    }

    return { node: root, items, slots, apply, mark };
  }

  /* ================= мультфильм ================= */
  function movie(host, examples, title, hint, maker) {
    const card = el('div', { class: 'card' });
    card.appendChild(el('h2', { text: title, style: 'margin-top:0' }));
    card.appendChild(el('p', { class: 'muted', text: hint }));

    const pick = el('div', { class: 'examples' });
    const stage = el('div', {});
    const say = el('div', { class: 'say' });
    const slider = el('input', { type: 'range', min: 0, max: 1, value: 0, step: 1, 'aria-label': 'Шаг' });
    const prev = el('button', { class: 'btn quiet small', type: 'button', text: '←' });
    const next = el('button', { class: 'btn quiet small', type: 'button', text: '→' });
    const play = el('button', { class: 'btn small', type: 'button', text: '▶ Показать по шагам' });
    const counter = el('span', { class: 'muted' });

    let board = null, model = null, cur = 0, timer = null;

    function show(i) {
      cur = UI.clamp(i, 0, model.steps.length - 1);
      slider.value = cur;
      board.apply(cur);
      board.mark(cur);
      say.textContent = model.steps[cur].say;
      say.classList.toggle('done', !!model.steps[cur].done);
      counter.textContent = 'шаг ' + (cur + 1) + ' из ' + model.steps.length;
      prev.disabled = cur === 0;
      next.disabled = cur === model.steps.length - 1;
      if (timer && cur === model.steps.length - 1) stop();
    }
    function stop() { clearInterval(timer); timer = null; play.textContent = '▶ Показать по шагам'; }
    function start() {
      if (timer) { stop(); return; }
      if (cur >= model.steps.length - 1) show(0);
      play.textContent = '⏸ Пауза';
      timer = setInterval(() => show(cur + 1), 1900);
    }

    function load(ex, btn) {
      stop();
      model = maker(ex[0], ex[1]);
      board = makeBoard(model, 'movie');
      stage.innerHTML = '';
      stage.appendChild(board.node);
      slider.max = model.steps.length - 1;
      Array.from(pick.children).forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      show(0);
    }

    examples.forEach((ex, i) => {
      const b = el('button', { type: 'button', text: ex[0] + (maker === LongMath.multiply ? ' × ' : ' ÷ ') + ex[1] });
      b.addEventListener('click', () => load(ex, b));
      pick.appendChild(b);
    });

    slider.addEventListener('input', () => { stop(); show(+slider.value); });
    prev.addEventListener('click', () => { stop(); show(cur - 1); });
    next.addEventListener('click', () => { stop(); show(cur + 1); });
    play.addEventListener('click', start);

    card.appendChild(pick);
    card.appendChild(stage);
    card.appendChild(say);
    card.appendChild(el('div', { class: 'movie-ctl' }, [prev, slider, next]));
    card.appendChild(el('div', { class: 'movie-ctl' }, [play, counter]));
    host.appendChild(card);
    load(examples[0], pick.firstChild);
  }

  /* ================= тренажёр с подсказчиком ================= */
  function practice(host, id, a, b, maker) {
    const m = maker(a, b);
    const board = makeBoard(m, 'practice');
    const wrap = el('div', { class: 'pcard' });
    const say = el('div', { class: 'say', style: 'display:none' });
    const hintBtn = el('button', { class: 'btn quiet small', type: 'button', text: '💡 Подсказать шаг' });
    const writeBtn = el('button', { class: 'btn quiet small', type: 'button', text: '✍️ Записать за меня' });
    const againBtn = el('button', { class: 'btn quiet small', type: 'button', text: '↺ Сначала' });

    // очередь шагов, в которых ученик что-то пишет
    const stepInputs = m.steps.map((s, i) =>
      board.items.filter(it => it.isInput && it.cell.step === i)
        .sort((x, y) => (x.cell.row === y.cell.row ? x.cell.col - y.cell.col : 0))
    );

    let cur = 0, pos = 0, pending = '';   // pending — рассказ пропущенных шагов

    function currentInputs() { return stepInputs[cur] || []; }

    function refresh() {
      board.apply(cur);
      board.mark(cur);
      board.items.forEach(it => { if (it.isInput) it.node.classList.remove('cur'); });
      const ins = currentInputs();
      ins.forEach((it, i) => {
        it.node.disabled = i !== pos;
        if (i === pos) { it.node.classList.add('cur'); }
      });
      const active = ins[pos];
      if (active) { try { active.focus({ preventScroll: true }); } catch (e) {} }
    }

    function advance() {
      // пропускаем шаги без ввода, копим их рассказ для подсказки
      pos = 0;
      cur++;
      while (cur < m.steps.length && !(stepInputs[cur] || []).length) {
        pending += (pending ? ' ' : '') + m.steps[cur].say;
        if (m.steps[cur].done) break;
        cur++;
      }
      if (cur >= m.steps.length - 1 && !(stepInputs[m.steps.length - 1] || []).length) {
        finish();
        return;
      }
      refresh();
      if (say.style.display !== 'none') showHint();
    }

    function finish() {
      cur = m.steps.length - 1;
      board.apply(cur);
      board.mark(-1);
      board.items.forEach(it => { if (it.isInput) { it.node.disabled = true; it.node.classList.remove('cur'); } });
      say.style.display = '';
      say.className = 'say done';
      say.textContent = m.steps[m.steps.length - 1].say;
      hintBtn.disabled = true; writeBtn.disabled = true;
      Progress.done(id);
      UI.pulse(wrap);
    }

    function showHint() {
      say.style.display = '';
      say.className = 'say';
      say.textContent = (pending ? pending + ' ' : '') + (m.steps[cur] ? m.steps[cur].say : '');
    }

    function accept(it) {
      it.node.classList.remove('bad');
      it.node.classList.add('ok');
      it.node.disabled = true;
      pos++;
      pending = '';
      if (pos >= currentInputs().length) advance(); else refresh();
    }

    board.items.forEach(it => {
      if (!it.isInput) return;
      it.node.addEventListener('input', () => {
        const v = it.node.value.replace(/\D/g, '').slice(-1);
        it.node.value = v;
        if (!v) return;
        if (v === it.cell.text) accept(it);
        else {
          it.node.classList.add('bad');
          setTimeout(() => { it.node.value = ''; it.node.classList.remove('bad'); }, 350);
        }
      });
      it.node.addEventListener('focus', () => it.node.select && it.node.select());
    });

    hintBtn.addEventListener('click', showHint);
    writeBtn.addEventListener('click', () => {
      const ins = currentInputs();
      if (!ins.length) { advance(); return; }
      const it = ins[pos];
      if (!it) return;
      it.node.value = it.cell.text;
      accept(it);
    });
    againBtn.addEventListener('click', () => {
      board.items.forEach(it => {
        if (it.isInput) { it.node.value = ''; it.node.classList.remove('ok', 'bad', 'cur'); it.node.disabled = true; }
      });
      hintBtn.disabled = false; writeBtn.disabled = false;
      say.style.display = 'none';
      cur = 0; pos = 0; pending = '';
      advance();
    });

    wrap.appendChild(el('div', { class: 'title', text: a + (maker === LongMath.multiply ? ' × ' : ' ÷ ') + b + ' = ?' }));
    wrap.appendChild(board.node);
    wrap.appendChild(say);
    wrap.appendChild(el('div', { class: 'ctl' }, [hintBtn, writeBtn, againBtn]));
    host.appendChild(wrap);

    advance();
    if (Progress.isDone(id)) {
      board.items.forEach(it => { if (it.isInput) { it.node.value = it.cell.text; it.node.classList.add('ok'); } });
      finish();
    }
    return wrap;
  }

  /* ================= уровни ================= */
  function buildMulMovie(host) {
    movie(host, [[23, 4], [328, 47], [506, 7], [84, 36]],
      'Умножение столбиком — по шагам',
      'Выбери пример и двигай бегунок: каждый шаг показывает, какую цифру куда писать и что держать в уме. Жёлтым сверху — перенос, голубым — куда пишем сейчас, зелёным — какие цифры перемножаем.',
      LongMath.multiply);
  }
  function buildDivMovie(host) {
    movie(host, [[96, 8], [4256, 7], [728, 13], [2024, 8]],
      'Деление уголком — по шагам',
      'Делимое слева, делитель справа за уголком. Бегунок показывает, как подбираем цифру частного, что вычитаем и какую цифру сносим.',
      LongMath.divide);
  }
  function buildMulPractice(host) {
    host.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'Умножай столбиком сам', style: 'margin-top:0' }),
      el('p', { class: 'muted', text: 'Вписывай цифры в клетки — голубая клетка показывает, куда писать сейчас. Не идёт — нажми «Подсказать шаг»: подсказчик расскажет, что делать. Кнопка «Записать за меня» впишет одну цифру.' })
    ]));
    const box = el('div', { class: 'card' });
    [[36, 4], [128, 7], [47, 23], [205, 36]].forEach((ex, i) =>
      practice(box, task('col/mul-' + i), ex[0], ex[1], LongMath.multiply));
    host.appendChild(box);
  }
  function buildDivPractice(host) {
    host.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'Дели уголком сам', style: 'margin-top:0' }),
      el('p', { class: 'muted', text: 'Сначала подбираем цифру частного справа, потом пишем, что вычитаем, и считаем остаток. Подсказчик рядом.' })
    ]));
    const box = el('div', { class: 'card' });
    [[84, 6], [952, 7], [768, 12], [5184, 16]].forEach((ex, i) =>
      practice(box, task('col/div-' + i), ex[0], ex[1], LongMath.divide));
    host.appendChild(box);
  }

  const L = { lvl1: buildMulMovie, lvl2: buildMulPractice, lvl3: buildDivMovie, lvl4: buildDivPractice };
  Object.keys(L).forEach(id => { const n = document.getElementById(id); if (n) L[id](n); });
  UI.levels();

  const score = $('#score');
  function updScore() {
    const total = TASK_IDS.length;
    if (!total) { score.style.display = 'none'; return; }
    score.textContent = 'Решено ' + Progress.countDone('col/') + ' из ' + total;
  }
  addEventListener('progress', updScore); updScore();
})();
