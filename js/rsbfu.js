/* Penny Parlor — Ro-Sham-Bo-Fu.
   Six rounds of rock-paper-scissors, 3 points on the table each round.
   Ties carry the pot forward. Every round one hand is declared forbidden;
   throwing anything else earns +2 honor, win or lose. Most points wins. */

var PP = window.PP || {};
window.PP = PP;

(function () {
  var el = function (id) { return document.getElementById(id); };

  var GLYPH = { rock: '✊', paper: '✋', scissors: '✌️' };
  var BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

  var game = {};
  var S = null;

  // Session-long throw history; this is what lets Silas read you across matches.
  var throwHistory = [];

  game.start = function (bot, onFinish) {
    S = {
      bot: bot,
      onFinish: onFinish,
      round: 0,
      pot: 3,
      you: 0,
      them: 0,
      threwForbidden: false,
      locked: false
    };
    el('rs-bot-name').textContent = bot.name;
    renderRound();
  };

  function pickForbidden() {
    return PP.bots.HANDS[Math.floor(Math.random() * 3)];
  }

  function renderRound() {
    S.forbidden = pickForbidden();
    el('rs-round').textContent = 'Round ' + (S.round + 1) + ' of 6';
    el('rs-pot').textContent = 'Pot: ' + S.pot + ' pts';
    el('rs-forbidden').textContent = GLYPH[S.forbidden];
    el('rs-score-you').textContent = S.you;
    el('rs-score-bot').textContent = S.them;
    el('rs-thrown-you').textContent = '–';
    el('rs-thrown-bot').textContent = '–';
    el('rs-prompt').textContent = 'The ' + S.forbidden + ' is forbidden this round. Choose your hand.';
    setHands(true);
    S.locked = false;
  }

  function setHands(on) {
    document.querySelectorAll('.btn-hand').forEach(function (b) { b.disabled = !on; });
  }

  game.throwHand = function (mine) {
    if (!S || S.locked) return;
    S.locked = true;
    setHands(false);

    var theirs = PP.bots.rsbPick(S.bot, S.forbidden, throwHistory);
    throwHistory.push(mine);
    if (throwHistory.length > 60) throwHistory.shift();

    // ro… sham… bo! — both fists pump before the reveal
    var youEl = el('rs-thrown-you'), botEl = el('rs-thrown-bot');
    youEl.textContent = GLYPH.rock;
    botEl.textContent = GLYPH.rock;
    youEl.className = 'rs-thrown shaking';
    botEl.className = 'rs-thrown shaking';
    el('rs-prompt').textContent = 'Ro… sham… bo!';
    PP.sound.play('shake');

    var me = S;
    setTimeout(function () {
      if (S !== me) return;
      youEl.className = 'rs-thrown reveal';
      botEl.className = 'rs-thrown reveal';
      resolveRound(mine, theirs);
    }, 900);
  };

  function resolveRound(mine, theirs) {
    el('rs-thrown-you').textContent = GLYPH[mine];
    el('rs-thrown-bot').textContent = GLYPH[theirs];

    var msgs = [];

    // honor bonuses, win or lose
    if (mine !== S.forbidden) {
      S.you += 2;
      msgs.push('+2 honor to you');
    } else {
      S.threwForbidden = true;
    }
    if (theirs !== S.forbidden) {
      S.them += 2;
      msgs.push('+2 honor to ' + S.bot.name);
    }

    // the pot
    if (mine === theirs) {
      S.pot += 3;
      msgs.unshift('Both throw ' + mine + ' — the pot grows');
      PP.sound.play('push');
    } else if (BEATS[mine] === theirs) {
      S.you += S.pot;
      msgs.unshift('Your ' + mine + ' takes the pot (' + S.pot + ' pts)');
      S.pot = 3;
      PP.sound.play('coinBig');
    } else {
      S.them += S.pot;
      msgs.unshift(S.bot.name + '’s ' + theirs + ' takes the pot (' + S.pot + ' pts)');
      S.pot = 3;
      PP.sound.play('lifeLost');
    }

    el('rs-score-you').textContent = S.you;
    el('rs-score-bot').textContent = S.them;
    el('rs-prompt').textContent = msgs.join(' · ') + '.';

    S.round += 1;
    var me = S;   // ignore this timer if the match was forfeited or replaced
    setTimeout(function () {
      if (S !== me) return;
      if (S.round >= 6) return finish();
      renderRound();
    }, 1700);
  }

  function finish() {
    var outcome = S.you > S.them ? 'win' : (S.you < S.them ? 'lose' : 'push');
    var extras = [];
    if (outcome === 'win' && !S.threwForbidden) extras.push('rs-honor');
    var detail = 'Final score: you ' + S.you + ', ' + S.bot.name + ' ' + S.them + '.';
    S.onFinish(outcome, extras, detail);
  }

  PP.rsbfu = game;
})();
