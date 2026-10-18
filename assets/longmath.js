/* Движок умножения столбиком и деления уголком: превращает пример в сетку ячеек и
   последовательность шагов с рассказом. Чистая математика, без DOM. */
(function (global) {
  'use strict';

  const RANK = ['единицы', 'десятки', 'сотни', 'тысячи', 'десятки тысяч', 'сотни тысяч'];
  const rank = j => RANK[j] || ('разряд №' + (j + 1));
  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }
  const times = n => plural(n, 'раз', 'раза', 'раз');

  /** Ячейка: {zone,row,col,text,kind,step,until}
   *  kind: given — дано, write — то, что записывает ученик, carry — в уме, sign — знак, bring — снесённая цифра
   *  step — с какого шага ячейка видна; until — с какого шага её стирают (необязательно). */
  function model(kind) {
    return {
      kind, cells: [], steps: [], rows: [],
      put(c) { this.cells.push(c); return c; },
      step(say, cells, extra) {
        const s = Object.assign({ say, cells: cells || [] }, extra || {});
        this.steps.push(s);
        return this.steps.length - 1;
      }
    };
  }

  /* ================= умножение столбиком ================= */
  function multiply(a, b) {
    const A = String(a), B = String(b);
    const m = model('mul');
    const cols = A.length + B.length + 1;   // слева запас под знак и перенос
    m.cols = cols;
    m.a = a; m.b = b; m.answer = a * b;

    const multiRow = B.length > 1;
    const rowIds = ['carry', 'a', 'b'];
    const partIds = [];
    for (let j = 0; j < B.length; j++) partIds.push(multiRow ? 'p' + j : 'sum');
    partIds.forEach(id => { if (rowIds.indexOf(id) < 0) rowIds.push(id); });
    if (multiRow) { rowIds.push('carry2', 'sum'); }
    m.rows = rowIds.map(id => ({
      id,
      small: id === 'carry' || id === 'carry2',
      lineAbove: id === partIds[0] || (multiRow && id === 'carry2')
    }));

    const put = (row, col, text, kind, step) => m.put({ row, col, text: String(text), kind, step });

    // нулевой шаг — запись условия
    A.split('').forEach((d, i) => put('a', cols - A.length + i, d, 'given', 0));
    B.split('').forEach((d, i) => put('b', cols - B.length + i, d, 'given', 0));
    put('b', cols - B.length - 1, '×', 'sign', 0);
    m.step('Записываем столбиком: единицы под единицами, десятки под десятками. Умножать будем справа налево.', []);

    let carryCells = [];
    for (let j = 0; j < B.length; j++) {
      const bd = +B[B.length - 1 - j];
      const row = partIds[j];
      // стираем переносы от прошлой строки
      const si = m.steps.length;
      carryCells.forEach(c => { c.until = si; });
      carryCells = [];

      if (B.length > 1) {
        m.step('Теперь умножаем всё число ' + a + ' на ' + bd + ' — это ' + rank(j) + ' второго числа.' +
          (j > 0 ? ' Результат сдвигаем на ' + j + ' ' + plural(j, 'клетку', 'клетки', 'клеток') + ' влево.' : ''), []);
      } else {
        m.step('Умножаем ' + a + ' на ' + bd + ', начиная с единиц.', []);
      }

      let carry = 0;
      for (let i = 0; i < A.length; i++) {
        const ad = +A[A.length - 1 - i];
        const raw = ad * bd;
        const total = raw + carry;
        const dg = total % 10, nc = (total - dg) / 10;
        const col = cols - 1 - (i + j);
        const added = [put(row, col, dg, 'write', m.steps.length)];
        if (nc) { const c = put('carry', col - 1, nc, 'carry', m.steps.length); carryCells.push(c); added.push(c); }
        let say = bd + ' × ' + ad + ' = ' + raw;
        if (carry) say += ', да ещё ' + carry + ' в уме — всего ' + total;
        say += '. Пишем ' + dg + (nc ? ', а ' + nc + ' держим в уме.' : '.');
        m.step(say, added, { focus: { row, col }, source: [{ row: 'a', col: cols - 1 - i }, { row: 'b', col: cols - 1 - j }] });
        carry = nc;
      }
      if (carry) {
        const col = cols - 1 - (A.length + j);
        const c = put(row, col, carry, 'write', m.steps.length);
        carryCells.forEach(x => { x.until = m.steps.length; });
        carryCells = [];
        m.step('В уме ' + plural(carry, 'остался', 'осталось', 'осталось') + ' ' + carry + ' — записываем его слева.',
          [c], { focus: { row, col } });
      }
    }

    if (multiRow) addPhase(m, partIds, cols, carryCells, put);

    m.step('Готово: ' + a + ' × ' + b + ' = ' + m.answer + '.', [], { done: true });
    return m;
  }

  /** Складываем готовые частичные произведения столбиком. Переносы пишем над чертой,
   *  а не держим в уме. */
  function addPhase(m, partIds, cols, carryCells, put) {
    const si = m.steps.length;
    carryCells.forEach(c => { c.until = si; });

    // знак «плюс» слева от самой длинной строки-слагаемого
    let leftMost = cols - 1;
    m.cells.forEach(c => {
      if (partIds.indexOf(c.row) >= 0 && c.kind === 'write' && c.col < leftMost) leftMost = c.col;
    });
    const plus = put(partIds[partIds.length - 1], Math.max(0, leftMost - 1), '+', 'sign', si);
    m.step('Все кусочки готовы — складываем их столбиком.', [plus]);

    let carry = 0;
    const carry2 = [];
    for (let col = cols - 1; col >= 0; col--) {
      const parts = m.cells.filter(c => partIds.indexOf(c.row) >= 0 && c.col === col && c.kind === 'write');
      if (!parts.length && !carry) { if (col < leftMost) break; else continue; }
      const nums = parts.map(c => +c.text);
      const total = nums.reduce((s2, x) => s2 + x, 0) + carry;
      const dg = total % 10, nc = (total - dg) / 10;
      const added = [put('sum', col, dg, 'write', m.steps.length)];
      if (nc) { const c = put('carry2', col - 1, nc, 'carry', m.steps.length); carry2.push(c); added.push(c); }
      let say;
      if (!nums.length && carry) {
        say = 'Здесь остался только перенос ' + carry + ' — его и пишем.';
      } else if (nums.length + (carry ? 1 : 0) < 2) {
        say = 'В этом столбике только одна цифра — ' + total + '. Так и пишем.';
      } else {
        say = (nums.length ? nums.join(' + ') : '0') + (carry ? ' + ' + carry + ' сверху' : '') +
          ' = ' + total + '. Пишем ' + dg + (nc ? ', а ' + nc + ' надписываем над следующим столбиком.' : '.');
      }
      m.step(say, added, { focus: { row: 'sum', col } });
      carry = nc;
    }
  }

  /* ================= умножение через сложение (частичные произведения) ================= */
  /** Каждую цифру умножаем на каждую, результат записываем отдельной строкой со сдвигом,
   *  потом складываем всё столбиком. В уме держать нечего. */
  function multiplyBySum(a, b) {
    const A = String(a), B = String(b);
    const m = model('mul');
    m.method = 'sum';
    const cols = A.length + B.length + 1;
    m.cols = cols;
    m.a = a; m.b = b; m.answer = a * b;

    const parts = [];
    for (let j = 0; j < B.length; j++) {
      for (let i = 0; i < A.length; i++) {
        parts.push({ i, j, ad: +A[A.length - 1 - i], bd: +B[B.length - 1 - j] });
      }
    }
    const multi = parts.length > 1;
    const partIds = parts.map((p, k) => (multi ? 'pp' + k : 'sum'));

    const rowIds = ['a', 'b'].concat(partIds.filter((id, k) => partIds.indexOf(id) === k));
    if (multi) rowIds.push('carry2', 'sum');
    m.rows = rowIds.map(id => ({
      id,
      small: id === 'carry2',
      lineAbove: id === partIds[0] || (multi && id === 'carry2')
    }));

    const put = (row, col, text, kind, step) => m.put({ row, col, text: String(text), kind, step });

    A.split('').forEach((d, i) => put('a', cols - A.length + i, d, 'given', 0));
    B.split('').forEach((d, i) => put('b', cols - B.length + i, d, 'given', 0));
    put('b', cols - B.length - 1, '×', 'sign', 0);
    m.step('Записываем столбиком. Умножать будем по частям: каждую цифру на каждую, ' +
      'каждый кусочек запишем отдельной строчкой, а в конце всё сложим — держать в уме ничего не придётся.', []);

    parts.forEach((p, k) => {
      const prod = p.ad * p.bd;
      const shift = p.i + p.j;
      const P = String(prod);
      const row = partIds[k];
      const added = [];
      P.split('').forEach((d, t) => {
        added.push(put(row, cols - 1 - shift - (P.length - 1 - t), d, 'write', m.steps.length));
      });
      const realA = p.ad * Math.pow(10, p.i);
      const realB = p.bd * Math.pow(10, p.j);
      let say = p.bd + ' × ' + p.ad + ' = ' + prod + '. ';
      if (shift === 0) {
        say += 'Это единицы — пишем ' + prod + ' в самый правый край.';
      } else {
        say += 'Но на самом деле это ' + realB + ' × ' + realA + ' = ' + (prod * Math.pow(10, shift)) +
          ', поэтому ' + prod + ' сдвигаем на ' + shift + ' ' +
          plural(shift, 'клетку', 'клетки', 'клеток') + ' влево.';
      }
      m.step(say, added, {
        focus: { row, col: cols - 1 - shift },
        source: [{ row: 'a', col: cols - 1 - p.i }, { row: 'b', col: cols - 1 - p.j }]
      });
    });

    if (multi) addPhase(m, partIds, cols, [], put);
    m.step('Готово: ' + a + ' × ' + b + ' = ' + m.answer + '.', [], { done: true });
    return m;
  }

  /* ================= деление уголком ================= */
  function divide(a, b) {
    const A = String(a);
    const m = model('div');
    const cols = A.length + 1;        // колонка 0 — под знак «−»
    m.cols = cols;
    m.a = a; m.b = b;
    m.answer = Math.floor(a / b);
    m.remainder = a % b;

    const rows = [{ id: 'd' }];
    const put = (row, col, text, kind, step, zone) =>
      m.put({ row, col, text: String(text), kind, step, zone: zone || 'left' });

    A.split('').forEach((d, i) => put('d', i + 1, d, 'given', 0));
    String(b).split('').forEach((d, i) => put('div', i, d, 'given', 0, 'right'));
    m.step('Записываем уголком: делимое ' + a + ' слева, делитель ' + b + ' справа. Частное будем писать под делителем.', []);

    let cur = 0, k = 0, curRow = 'd', started = false;
    for (let i = 0; i < A.length; i++) {
      const dg = +A[i];
      if (i > 0) {
        const added = [];
        if (curRow !== 'd') added.push(put(curRow, i + 1, dg, 'bring', m.steps.length));
        m.step(curRow === 'd'
          ? 'Вместе с ней получается ' + (cur * 10 + dg) + ' — его и делим.'
          : 'Сносим цифру ' + dg + '. Теперь делим ' + (cur * 10 + dg) + '.', added,
          { focus: curRow !== 'd' ? { row: curRow, col: i + 1 } : null });
      }
      cur = cur * 10 + dg;

      const last = i === A.length - 1;
      if (cur < b) {
        if (started) {
          const c = put('q', i, 0, 'write', m.steps.length, 'right');
          m.step(cur + ' меньше ' + b + ' — в частное пишем 0' +
            (last ? (cur === 0 ? ', остатка нет.' : ', а ' + cur + ' останется в остатке.')
                  : ' и сносим следующую цифру.'),
            [c], { focus: { row: 'q', col: i, zone: 'right' } });
        } else if (!last) {
          m.step(b + ' в ' + cur + ' не помещается — берём ещё одну цифру.', []);
        }
        continue;
      }

      const q = Math.floor(cur / b), prod = q * b, rem = cur - prod;
      started = true;
      const qc = put('q', i, q, 'write', m.steps.length, 'right');
      m.step('Сколько раз ' + b + ' помещается в ' + cur + '? ' + q + ' ' + times(q) + ', ведь ' + b + ' × ' + q + ' = ' + prod + '.',
        [qc], { focus: { row: 'q', col: i, zone: 'right' } });

      const sRow = 's' + k, rRow = 'r' + k;
      const P = String(prod);
      const from = i + 1 - P.length + 1;      // первая колонка вычитаемого
      rows.push({ id: sRow });
      rows.push({ id: rRow, lineAbove: true, lineFrom: from - 1, lineTo: i + 1 });

      const sCells = [put(sRow, from - 1, '−', 'sign', m.steps.length)];
      P.split('').forEach((d, t) => sCells.push(put(sRow, from + t, d, 'write', m.steps.length)));
      m.step('Пишем ' + prod + ' под ' + cur + ' и вычитаем.', sCells, { focus: { row: sRow, col: i + 1 } });

      const R = String(rem);
      const rCells = [];
      const writeRem = rem > 0 || i === A.length - 1;
      if (writeRem) R.split('').forEach((d, t) => rCells.push(put(rRow, i + 1 - R.length + 1 + t, d, 'write', m.steps.length)));
      m.step(cur + ' − ' + prod + ' = ' + rem + '.' + (rem === 0 && i < A.length - 1 ? ' Остатка нет — сносим следующую цифру.' : ''),
        rCells, { focus: writeRem ? { row: rRow, col: i + 1 } : null });

      cur = rem; curRow = rRow; k++;
    }

    if (!started) {
      const c = put('q', 0, 0, 'write', m.steps.length, 'right');
      m.step(b + ' в ' + a + ' не помещается ни разу — в частном 0, а ' + a + ' целиком остаётся в остатке.',
        [c], { focus: { row: 'q', col: 0, zone: 'right' } });
    }

    m.rows = rows;
    m.step('Готово: ' + a + ' ÷ ' + b + ' = ' + m.answer +
      (m.remainder ? ' и ещё ' + m.remainder + ' в остатке.' : '. Разделилось без остатка.'), [], { done: true });
    return m;
  }

  global.LongMath = { multiply, multiplyBySum, divide, RANK };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.LongMath;
})(typeof window !== 'undefined' ? window : globalThis);
