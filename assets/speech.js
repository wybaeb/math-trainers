/* Чтение шагов вслух. Web Speech API есть в Safari на iPad, но первый запуск
   обязан случиться внутри касания — поэтому «прогреваем» синтез на нажатии кнопки. */
(function (global) {
  'use strict';
  const synth = global.speechSynthesis;
  const KEY = 'math-trainers/voice';
  let enabled = false;
  let voice = null;
  let primed = false;
  let watchdog = null;
  let probe = null;
  let pendingDone = null;      // колбэк текущей реплики — его обязан дёрнуть и cancel()
  const listeners = [];

  try { enabled = localStorage.getItem(KEY) === '1'; } catch (e) {}

  const supported = !!(synth && global.SpeechSynthesisUtterance);

  function pickVoice() {
    if (!supported) return;
    const all = synth.getVoices() || [];
    voice = all.find(v => /^ru/i.test(v.lang) && /Milena|Katya|Yuri|Russian|Русск/i.test(v.name))
      || all.find(v => /^ru/i.test(v.lang))
      || null;
  }
  if (supported) {
    pickVoice();
    synth.addEventListener && synth.addEventListener('voiceschanged', pickVoice);
  }

  /** знаки читаются плохо — подставляем слова */
  function prepare(text) {
    return String(text)
      .replace(/×/g, ' умножить на ')
      .replace(/÷/g, ' разделить на ')
      .replace(/−/g, ' минус ')
      .replace(/=/g, ' равно ')
      .replace(/≈/g, ' примерно равно ')
      .replace(/%/g, ' процентов')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cancel() {
    if (watchdog) { clearTimeout(watchdog); watchdog = null; }
    if (probe) { clearInterval(probe); probe = null; }
    if (supported) { try { synth.cancel(); } catch (e) {} }
    // иначе тот, кто ждал конца фразы, не дождётся никогда
    const d = pendingDone; pendingDone = null;
    if (d) d();
  }

  /** Произнести текст. onEnd вызывается ровно один раз — по окончании речи,
   *  по сторожевому таймеру или сразу, если голос выключен. */
  function say(text, onEnd) {
    let called = false;
    const done = () => {
      if (called) return;
      called = true;
      if (pendingDone === done) pendingDone = null;
      if (watchdog) { clearTimeout(watchdog); watchdog = null; }
      if (probe) { clearInterval(probe); probe = null; }
      if (onEnd) onEnd();
    };
    if (!enabled || !supported || !text) { done(); return; }
    cancel();
    const said = prepare(text);
    const u = new SpeechSynthesisUtterance(said);
    u.lang = 'ru-RU';
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.onend = done;
    u.onerror = done;
    pendingDone = done;
    // если голосов в системе нет, onend может не прийти — страхуемся
    watchdog = setTimeout(done, Math.min(12000, 1200 + said.length * 60));
    let ticks = 0;
    probe = setInterval(() => {
      ticks++;
      let busy = true;
      try { busy = synth.speaking || synth.pending; } catch (e) {}
      // речь не стартовала за полсекунды или уже закончилась, а onend не пришёл
      if (!busy && ticks >= 2) done();
      if (ticks > 60) { clearInterval(probe); probe = null; }
    }, 250);
    try { synth.speak(u); } catch (e) { done(); }
  }

  function setEnabled(on) {
    enabled = !!on;
    try { localStorage.setItem(KEY, enabled ? '1' : '0'); } catch (e) {}
    if (!enabled) cancel();
    if (enabled && supported && !primed) {
      // «разбудить» синтез внутри жеста пользователя — требование iOS
      primed = true;
      try {
        const warm = new SpeechSynthesisUtterance(' ');
        warm.volume = 0; warm.lang = 'ru-RU';
        synth.speak(warm);
      } catch (e) {}
      pickVoice();
    }
    listeners.forEach(fn => fn(enabled));
  }

  /** Кнопка-переключатель; её можно поставить в шапку страницы. */
  function button() {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'back voice';
    const paint = () => {
      b.textContent = enabled ? '🔊 Читаю вслух' : '🔇 Читать вслух';
      b.setAttribute('aria-pressed', String(enabled));
    };
    b.addEventListener('click', () => { setEnabled(!enabled); paint(); });
    listeners.push(paint);
    paint();
    if (!supported) { b.disabled = true; b.title = 'Браузер не умеет читать вслух'; }
    return b;
  }

  // уход со страницы не должен оставлять говорящую реплику
  global.addEventListener('pagehide', cancel);

  global.Speech = {
    say, cancel, button, prepare,
    onChange(fn) { listeners.push(fn); fn(enabled); },
    isOn: () => enabled && supported,
    supported: () => supported,
    setEnabled
  };
})(window);
