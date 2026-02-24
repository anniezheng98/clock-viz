(function () {
  'use strict';

  // ---------- Safe expression evaluator (no eval) ----------
  function tokenize(expr) {
    const s = String(expr).replace(/\s/g, '');
    const tokens = [];
    let i = 0;
    while (i < s.length) {
      if (/\d/.test(s[i])) {
        let n = '';
        while (i < s.length && /\d/.test(s[i])) n += s[i++];
        tokens.push({ type: 'num', value: parseInt(n, 10) });
        continue;
      }
      if (s[i] === '(' || s[i] === ')') {
        tokens.push({ type: s[i] === '(' ? 'open' : 'close' });
        i++;
        continue;
      }
      if (s[i] === '+' || s[i] === '-' || s[i] === '\u2212' || s[i] === '×' || s[i] === '÷' || s[i] === '*' || s[i] === '/') {
        const op = s[i] === '*' ? '×' : s[i] === '/' ? '÷' : s[i];
        tokens.push({ type: 'op', value: op });
        i++;
        continue;
      }
      i++;
    }
    return tokens;
  }

  function parseExpr(tokens) {
    let pos = 0;
    function accept(type, val) {
      if (pos >= tokens.length) return false;
      const t = tokens[pos];
      if (t.type === type && (val === undefined || t.value === val)) {
        pos++;
        return true;
      }
      return false;
    }
    function num() {
      if (accept('num')) return tokens[pos - 1].value;
      if (accept('open')) {
        const v = expr();
        if (!accept('close')) throw new Error('Missing )');
        return v;
      }
      throw new Error('Expected number or (');
    }
    function term() {
      let left = num();
      while (pos < tokens.length && tokens[pos].type === 'op' && (tokens[pos].value === '×' || tokens[pos].value === '÷')) {
        const op = tokens[pos].value;
        pos++;
        const right = num();
        if (op === '×') left = left * right;
        else {
          if (right === 0) throw new Error('Division by zero');
          if (left % right !== 0) throw new Error('Non-integer division');
          left = Math.floor(left / right);
        }
      }
      return left;
    }
    function expr() {
      let left = term();
      while (pos < tokens.length && tokens[pos].type === 'op' && (tokens[pos].value === '+' || tokens[pos].value === '-' || tokens[pos].value === '\u2212')) {
        const op = tokens[pos].value;
        pos++;
        const right = term();
        left = op === '+' ? left + right : left - right;
      }
      return left;
    }
    const result = expr();
    if (pos !== tokens.length) throw new Error('Extra tokens');
    return result;
  }

  function safeEval(displayStr) {
    const tokens = tokenize(displayStr);
    if (tokens.length === 0) throw new Error('Empty');
    return parseExpr(tokens);
  }

  // ---------- Equation generator ----------
  function getFactors(n) {
    if (n <= 0) return [];
    const out = [];
    for (let a = 2; a * a <= n; a++) {
      if (n % a === 0) out.push([a, n / a]);
    }
    return out;
  }

  function generateEquation(target, kind) {
    const candidates = [];
    const T = target;

    if (T === 0) {
      candidates.push({ display: '6−6', type: 'sub', value: 0 });
      candidates.push({ display: '5−5', type: 'sub', value: 0 });
      candidates.push({ display: '12−12', type: 'sub', value: 0 });
    } else {
      // Multiplication (prefer small operands; avoid ×1)
      const factors = getFactors(T);
      factors.forEach(([a, b]) => {
        if (a <= 12 && b <= 12 && a !== 1 && b !== 1) candidates.push({ display: `${a}×${b}`, type: 'mult', value: T });
      });

      // Division: (T*b)÷b (avoid ÷1)
      for (let b = 2; b <= 12; b++) {
        const a = T * b;
        if (a <= 144) candidates.push({ display: `${a}÷${b}`, type: 'div', value: T });
      }

      // Addition (avoid +0)
      for (let a = 1; a < T && a <= 12; a++) {
        const b = T - a;
        if (b >= 1 && b <= 12) candidates.push({ display: `${a}+${b}`, type: 'add', value: T });
      }
      for (let b = 1; b < T && b <= 12; b++) {
        const a = T - b;
        if (a >= 1 && a <= 12) candidates.push({ display: `${a}+${b}`, type: 'add', value: T });
      }
      if (T <= 24) {
        for (let a = Math.max(1, T - 12); a <= Math.min(12, T - 1); a++) {
          const b = T - a;
          if (b >= 1) candidates.push({ display: `${a}+${b}`, type: 'add', value: T });
        }
      }

      // Subtraction (a - b = T, a > b)
      for (let a = T + 1; a <= Math.min(T + 12, 60); a++) {
        const b = a - T;
        if (b >= 1 && b <= 12) candidates.push({ display: `${a}−${b}`, type: 'sub', value: T });
      }
      if (T >= 10 && T <= 23) {
        candidates.push({ display: `24−${24 - T}`, type: 'sub', value: T });
      }
      if (T === 59) {
        candidates.push({ display: '60−1', type: 'sub', value: 59 });
        candidates.push({ display: '118÷2', type: 'div', value: 59 });
        candidates.push({ display: '50+9', type: 'add', value: 59 });
      }
      if (T === 23) {
        candidates.push({ display: '24−1', type: 'sub', value: 23 });
        candidates.push({ display: '46÷2', type: 'div', value: 23 });
        candidates.push({ display: '20+3', type: 'add', value: 23 });
      }
    }

    // Dedupe by display and filter to valid
    const seen = new Set();
    const valid = [];
    for (const c of candidates) {
      if (seen.has(c.display)) continue;
      seen.add(c.display);
      let value;
      try {
        value = safeEval(c.display);
      } catch (_) {
        continue;
      }
      if (value !== target) continue;
      valid.push({ display: c.display, value, tokens: tokenize(c.display) });
    }

    // Fallbacks
    if (valid.length === 0) {
      if (T === 0) valid.push({ display: '0', value: 0, tokens: [{ type: 'num', value: 0 }] });
      else valid.push({ display: String(T), value: T, tokens: [{ type: 'num', value: T }] });
    }

    const idx = Math.floor(Math.random() * valid.length);
    return valid[idx];
  }

  // ---------- Clock state and DOM ----------
  const tileHour = document.getElementById('tile-hour');
  const tileMinute = document.getElementById('tile-minute');
  const tileSecond = document.getElementById('tile-second');
  const textHour = document.getElementById('text-hour');
  const textMinute = document.getElementById('text-minute');
  const textSecond = document.getElementById('text-second');

  let state = { hour: -1, minute: -1, second: -1 };
  let eqHour = null;
  let eqMinute = null;
  let eqSecond = null;
  const use24h = true;
  const ANIM_MS = 200;

  function updateTile(el, textEl, newDisplay, animate) {
    if (textEl.textContent === newDisplay) return;
    if (animate) {
      textEl.classList.add('animating');
      setTimeout(function () {
        textEl.textContent = newDisplay;
        textEl.classList.remove('animating');
        textEl.classList.add('animating-in');
        setTimeout(function () { textEl.classList.remove('animating-in'); }, 80);
      }, ANIM_MS);
    } else {
      textEl.textContent = newDisplay;
    }
  }

  function tick() {
    const now = new Date();
    let hour = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds();
    if (!use24h) hour = hour % 12 || 12;

    const hourChanged = state.hour !== hour;
    const minuteChanged = state.minute !== minute;
    const secondChanged = state.second !== second;

    if (hourChanged) {
      eqHour = generateEquation(hour, 'hour');
      updateTile(tileHour, textHour, eqHour.display, true);
    }
    if (minuteChanged) {
      eqMinute = generateEquation(minute, 'minute');
      updateTile(tileMinute, textMinute, eqMinute.display, true);
    }
    if (secondChanged) {
      eqSecond = generateEquation(second, 'second');
      updateTile(tileSecond, textSecond, eqSecond.display, true);
    }

    state.hour = hour;
    state.minute = minute;
    state.second = second;
  }

  // Initial paint and refresh every 15–30s for variety (same target)
  function init() {
    tick();
    setInterval(tick, 1000);
    setInterval(function () {
      const now = new Date();
      const h = use24h ? now.getHours() : (now.getHours() % 12 || 12);
      const m = now.getMinutes();
      const s = now.getSeconds();
      eqHour = generateEquation(h, 'hour');
      eqMinute = generateEquation(m, 'minute');
      eqSecond = generateEquation(s, 'second');
      textHour.textContent = eqHour.display;
      textMinute.textContent = eqMinute.display;
      textSecond.textContent = eqSecond.display;
    }, 20000);
  }

  init();
})();
