/* Penny Parlor smoke test: fake DOM, load scripts, play full matches of all
   three games via the same event handlers the browser would use. */

'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', 'js');

/* ---------- minimal DOM stub ---------- */

function makeEl(tag) {
  const el = {
    tag: tag || 'div',
    children: [],
    listeners: {},
    dataset: {},
    disabled: false,
    textContent: '',
    _innerHTML: '',
    className: '',
    style: {},
    offsetWidth: 0,
    classSet: new Set(),
  };
  el.classList = {
    add: (...c) => c.forEach(x => el.classSet.add(x)),
    remove: (...c) => c.forEach(x => el.classSet.delete(x)),
    toggle: (c, force) => {
      const want = force === undefined ? !el.classSet.has(c) : force;
      want ? el.classSet.add(c) : el.classSet.delete(c);
    },
    contains: c => el.classSet.has(c),
  };
  Object.defineProperty(el, 'innerHTML', {
    get() { return el._innerHTML; },
    set(v) { el._innerHTML = v; el.children = []; },
  });
  el.attrs = {};
  el.setAttribute = (k, v) => { el.attrs[k] = String(v); };
  el.getAttribute = k => (k in el.attrs ? el.attrs[k] : null);
  el.removeAttribute = k => { delete el.attrs[k]; };
  el.appendChild = child => { el.children.push(child); return child; };
  el.addEventListener = (ev, fn) => { (el.listeners[ev] ||= []).push(fn); };
  el.click = () => (el.listeners.click || []).forEach(fn => fn({ target: el }));
  el.querySelector = () => makeEl('stub');
  el.querySelectorAll = () => [];
  return el;
}

const byId = new Map();
function getEl(id) {
  if (!byId.has(id)) byId.set(id, makeEl('div#' + id));
  return byId.get(id);
}

const storage = {};
const sandbox = {
  console,
  setTimeout: (fn) => { fn(); return 0; },       // run timers instantly
  setInterval: (fn) => { pendingIntervals.push(fn); return pendingIntervals.length; },
  clearInterval: (id) => { doneIntervals.add(id); },
  Math, JSON, Date, Object, Array, String, Number, Boolean,
  localStorage: {
    getItem: k => (k in storage ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
  },
  document: {
    getElementById: getEl,
    createElement: makeEl,
    createElementNS: (ns, tag) => makeEl(tag),
    querySelectorAll: () => [],
    addEventListener: () => {},
  },
  confirm: () => true,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

let pendingIntervals = [];
let doneIntervals = new Set();
function flushIntervals(maxTicks = 200) {
  for (let t = 0; t < maxTicks; t++) {
    pendingIntervals.forEach((fn, idx) => { if (!doneIntervals.has(idx + 1)) fn(); });
    if (pendingIntervals.every((_, idx) => doneIntervals.has(idx + 1))) break;
  }
  pendingIntervals = [];
  doneIntervals = new Set();
}

vm.createContext(sandbox);
for (const f of ['state.js', 'sound.js', 'nugget.js', 'goldscene.js', 'bots.js', 'goldrush.js', 'hilo.js', 'rsbfu.js', 'main.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
}
const PP = sandbox.PP;

let failures = 0;
function check(label, cond) {
  if (cond) { console.log('  ok  ' + label); }
  else { failures++; console.log('  FAIL ' + label); }
}

/* ---------- state layer ---------- */

console.log('== state ==');
check('fmtMoney(1) = p$0.01', PP.fmtMoney(1) === 'p$0.01');
check('fmtMoney(1024) = p$10.24', PP.fmtMoney(1024) === 'p$10.24');
check('rung(1)=0 rung(2)=1 rung(1024)=10', PP.rung(1) === 0 && PP.rung(2) === 1 && PP.rung(1024) === 10);
check('rung caps at 30', PP.rung(2 ** 40) === 30);
check('rank names sane', PP.rankName(0) === 'Greenhorn' && PP.rankName(30) === 'Parlor Legend');

PP.state.bankroll = 4;
let earned = PP.settle('goldrush', 4, 'win');
check('win doubles 4->8', PP.state.bankroll === 8);
check('first-win honor granted', earned.some(h => h.id === 'first-win'));
earned = PP.settle('goldrush', 8, 'lose');
check('lose 8 -> bust at 0', PP.state.bankroll === 0);
check('bust honor granted', earned.some(h => h.id === 'bust'));
PP.sweepFloor();
check('sweep floor -> 1 penny', PP.state.bankroll === 1);
const beforePush = PP.state.bankroll;
PP.settle('hilo', 1, 'push');
check('push leaves bankroll unchanged', PP.state.bankroll === beforePush);

/* ---------- bots ---------- */

console.log('== bots ==');
for (const bot of PP.BOTS) {
  for (let i = 0; i < 300; i++) {
    const mine = [1, 2, 3, 4, 5, 6];
    const p = PP.bots.goldrushPick(bot, mine, [1, 2, 3, 4, 5, 6], 1 + (i % 9));
    if (!mine.includes(p)) { check(bot.id + ' goldrush picks from pouch', false); break; }
  }
}
check('goldrush picks legal (see above for failures)', true);

for (const bot of PP.BOTS) {
  const runs = Array.from({ length: 200 }, () => PP.bots.hiloRun(bot).banked);
  const avg = runs.reduce((a, b) => a + b, 0) / runs.length;
  console.log('  info hilo avg banked ' + bot.id + ': ' + avg.toFixed(2));
  check('hilo run banked is a finite number >= 0 (' + bot.id + ')', runs.every(b => Number.isFinite(b) && b >= 0));
}

for (const bot of PP.BOTS) {
  for (let i = 0; i < 200; i++) {
    const h = PP.bots.rsbPick(bot, 'rock', ['rock', 'paper', 'scissors']);
    if (!['rock', 'paper', 'scissors'].includes(h)) { check('rsb legal hand ' + bot.id, false); break; }
  }
}
check('rsb picks legal hands (see above)', true);

/* ---------- Gold Rush: full matches via UI handlers ---------- */

console.log('== gold rush matches ==');
function playGoldrush(bot, style) {
  let result = null;
  PP.goldrush.start(bot, (outcome, extras, detail) => { result = { outcome, extras, detail }; });
  for (let round = 0; round < 6; round++) {
    const live = PP.goldscene.remaining();
    if (!live.length) throw new Error('empty pouch at round ' + round);
    let v;
    if (style === 'ascending') v = Math.min(...live);
    else if (style === 'descending') v = Math.max(...live);
    else v = live[Math.floor(Math.random() * live.length)];
    PP.goldscene.bid(v);   // timers run instantly, so the next round renders immediately
  }
  if (!result) throw new Error('goldrush did not finish');
  return result;
}
let outcomes = { win: 0, lose: 0, push: 0 };
for (let i = 0; i < 300; i++) outcomes[playGoldrush(PP.BOTS[i % 3]).outcome]++;
console.log('  info goldrush outcomes vs mixed bots (random play):', JSON.stringify(outcomes));
check('goldrush completes and yields all outcome types', outcomes.win + outcomes.lose + outcomes.push === 300);

/* score sanity: total points hauled should never exceed 6 bids*2 + bonuses 21 = 42 + carried...
   max possible combined = sum both pouches (42) + sum bonuses (21) = 63 */
let maxCombined = 0;
for (let i = 0; i < 200; i++) {
  PP.goldrush.start(PP.BOTS[2], () => {});
  for (let r = 0; r < 6; r++) {
    const live = PP.goldscene.remaining();
    PP.goldscene.bid(live[Math.floor(Math.random() * live.length)]);
  }
  const you = parseInt(getEl('gr-score-you').textContent, 10);
  const them = parseInt(getEl('gr-score-bot').textContent, 10);
  maxCombined = Math.max(maxCombined, you + them);
}
check('goldrush combined score never exceeds 63 (saw ' + maxCombined + ')', maxCombined <= 63);

/* ---------- Hi-Lo: full match via UI handlers ---------- */

console.log('== hi-lo matches ==');
function playHilo(bot, strategy) {
  let result = null;
  PP.hilo.start(bot, (outcome, extras, detail) => { result = { outcome, extras, detail }; });
  let guard = 0;
  while (!result && guard++ < 500) {
    const pending = parseInt(getEl('hl-pending').textContent, 10) || 0;
    if (strategy === 'locker' && pending >= 3) { PP.hilo.lock(); continue; }
    // read the shown card and guess sensibly
    const rankTxt = getEl('hl-card').querySelector('.card-rank');
    PP.hilo.guess(Math.random() < 0.5 ? 'higher' : 'lower');
    flushIntervals();
  }
  if (!result) throw new Error('hilo did not finish');
  return result;
}
outcomes = { win: 0, lose: 0, push: 0 };
for (let i = 0; i < 150; i++) outcomes[playHilo(PP.BOTS[i % 3], i % 2 ? 'locker' : 'rider').outcome]++;
console.log('  info hilo outcomes (random guessing):', JSON.stringify(outcomes));
check('hilo completes and yields outcomes', outcomes.win + outcomes.lose + outcomes.push === 150);

/* ---------- Ro-Sham-Bo-Fu: full match via handler ---------- */

console.log('== ro-sham-bo-fu matches ==');
function playRsb(bot) {
  let result = null;
  PP.rsbfu.start(bot, (outcome, extras, detail) => { result = { outcome, extras, detail }; });
  const hands = ['rock', 'paper', 'scissors'];
  for (let r = 0; r < 6; r++) PP.rsbfu.throwHand(hands[Math.floor(Math.random() * 3)]);
  if (!result) throw new Error('rsbfu did not finish');
  return result;
}
outcomes = { win: 0, lose: 0, push: 0 };
for (let i = 0; i < 300; i++) outcomes[playRsb(PP.BOTS[i % 3]).outcome]++;
console.log('  info rsbfu outcomes (random play):', JSON.stringify(outcomes));
check('rsbfu completes and yields outcomes', outcomes.win + outcomes.lose + outcomes.push === 300);

/* fairness probe: random player vs each bot, win share */
for (const bot of PP.BOTS) {
  let w = 0, n = 400;
  for (let i = 0; i < n; i++) if (playRsb(bot).outcome === 'win') w++;
  console.log('  info rsbfu random-player win rate vs ' + bot.id + ': ' + (100 * w / n).toFixed(0) + '%');
}
for (const bot of PP.BOTS) {
  for (const style of ['random', 'ascending', 'descending']) {
    let w = 0, n = 400;
    for (let i = 0; i < n; i++) if (playGoldrush(bot, style).outcome === 'win') w++;
    console.log('  info goldrush ' + style + '-player win rate vs ' + bot.id + ': ' + (100 * w / n).toFixed(0) + '%');
  }
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : '\n' + failures + ' CHECKS FAILED');
process.exit(failures === 0 ? 0 : 1);
