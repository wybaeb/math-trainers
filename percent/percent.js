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

  /* ================= сборка страницы ================= */
  const L = {
    lvl1: buildSandbox,
    lvl2: buildSetPercent
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
