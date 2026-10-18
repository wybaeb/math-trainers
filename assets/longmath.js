/* Движок умножения столбиком и деления уголком: превращает пример в сетку ячеек и
   последовательность шагов с рассказом. Чистая математика, без DOM. */
(function (global) {
  'use strict';

  const RANK = ['единицы', 'десятки', 'сотни', 'тысячи'];

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
        m.step('Теперь умножаем всё число ' + a + ' на ' + bd + ' — это ' + RANK[j] + ' второго числа.' +
          (j > 0 ? ' Результат сдвигаем на ' + j + ' ' + (j === 1 ? 'клетку' : 'клетки') + ' влево.' : ''), []);
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
        m.step('В уме остался ' + carry + ' — записываем его слева.', [c], { focus: { row, col } });
      }
    }

    if (multiRow) {
      const si = m.steps.length;
      carryCells.forEach(c => { c.until = si; });
      carryCells = [];
      const plus = put('p' + (B.length - 1), cols - 1 - (A.length + B.length - 1) - 1, '+', 'sign', si);
      m.step('Все кусочки готовы — складываем их столбиком.', [plus]);

      let carry = 0;
      for (let col = cols - 1; col >= 0; col--) {
        const parts = m.cells.filter(c => partIds.indexOf(c.row) >= 0 && c.col === col && c.kind === 'write');
        if (!parts.length && !carry) { if (col < cols - 1 - (A.length + B.length - 1)) break; else continue; }
        const nums = parts.map(c => +c.text);
        const total = nums.reduce((s, x) => s + x, 0) + carry;
        const dg = total % 10, nc = (total - dg) / 10;
        const added = [put('sum', col, dg, 'write', m.steps.length)];
        if (nc) { const c = put('carry2', col - 1, nc, 'carry', m.steps.length); carryCells.push(c); added.push(c); }
        let say = nums.length ? nums.join(' + ') : '0';
        if (carry) say += ' + ' + carry + ' в уме';
        say += ' = ' + total + '. Пишем ' + dg + (nc ? ', ' + nc + ' в уме.' : '.');
        m.step(say, added, { focus: { row: 'sum', col } });
        carry = nc;
      }
    }

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
        m.step('Сносим цифру ' + dg + '. Теперь делим ' + (cur * 10 + dg) + '.', added,
          { focus: curRow !== 'd' ? { row: curRow, col: i + 1 } : null });
      }
      cur = cur * 10 + dg;

      if (cur < b) {
        if (started) {
          const c = put('q', i, 0, 'write', m.steps.length, 'right');
          m.step(cur + ' меньше ' + b + ' — в частное пишем 0 и сносим следующую цифру.', [c], { focus: { row: 'q', col: i, zone: 'right' } });
        } else {
          m.step(cur + ' на ' + b + ' не делится — берём ещё одну цифру.', []);
        }
        continue;
      }

      const q = Math.floor(cur / b), prod = q * b, rem = cur - prod;
      started = true;
      const qc = put('q', i, q, 'write', m.steps.length, 'right');
      m.step('Сколько раз ' + b + ' помещается в ' + cur + '? ' + q + ' раз, ведь ' + b + ' × ' + q + ' = ' + prod + '.',
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

    m.rows = rows;
    m.step('Готово: ' + a + ' ÷ ' + b + ' = ' + m.answer +
      (m.remainder ? ' и ещё ' + m.remainder + ' в остатке.' : '. Разделилось без остатка.'), [], { done: true });
    return m;
  }

  global.LongMath = { multiply, divide, RANK };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.LongMath;
})(typeof window !== 'undefined' ? window : globalThis);
