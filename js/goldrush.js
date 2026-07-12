/* Penny Parlor — Gold Rush.
   Six rounds. Each player holds nuggets 1-6 and blind-bids one per round.
   Bids perch beside the mine as "?" nuggets, flip to reveal, and drop onto
   the great plank scale; the heavier side tips it and hauls in both bids
   plus the bonus (plus anything carried from ties). Most points wins.
   All the visuals live in js/goldscene.js. */

var PP = window.PP || {};
window.PP = PP;

(function () {
  var el = function (id) { return document.getElementById(id); };

  var game = {};
  var S = null;   // match state

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  game.start = function (bot, onFinish) {
    S = {
      bot: bot,
      onFinish: onFinish,
      mine: [1, 2, 3, 4, 5, 6],
      theirs: [1, 2, 3, 4, 5, 6],
      bonusOrder: shuffle([1, 2, 3, 4, 5, 6]),
      round: 0,
      carry: 0,
      you: 0,
      them: 0,
      bestHaul: 0,
      locked: false
    };
    el('gr-bot-name').textContent = bot.name;
    PP.goldscene.init(el('gr-scene'), { onBid: playRound });
    renderRound();
  };

  function renderRound() {
    el('gr-round').textContent = 'Round ' + (S.round + 1) + ' of 6';
    el('gr-score-you').textContent = S.you;
    el('gr-score-bot').textContent = S.them;

    var bonus = S.bonusOrder[S.round];
    el('gr-pot').textContent = S.carry > 0
      ? 'Worth ' + (bonus + S.carry) + ' pts (carried gold on the scale!)'
      : 'Worth ' + bonus + ' pts + both bids';

    PP.goldscene.setRound({
      bonus: bonus, carry: S.carry,
      mine: S.mine, theirs: S.theirs,
      you: S.you, them: S.them
    });

    el('gr-prompt').textContent = 'Pick a nugget from your pouch to bid against ' + S.bot.name + '.';
    S.locked = false;
  }

  function playRound(myBid) {
    if (S.locked) return;
    S.locked = true;

    var bonus = S.bonusOrder[S.round];
    var prize = bonus + S.carry;
    var theirBid = PP.bots.goldrushPick(S.bot, S.theirs, S.mine, prize);

    S.mine.splice(S.mine.indexOf(myBid), 1);
    S.theirs.splice(S.theirs.indexOf(theirBid), 1);

    /* settle the books now; the scene animates its way to these numbers */
    var winner, haul = 0;
    if (myBid > theirBid) {
      winner = 'you';
      haul = myBid + theirBid + prize;
      S.you += haul;
      S.bestHaul = Math.max(S.bestHaul, haul);
      S.carry = 0;
    } else if (theirBid > myBid) {
      winner = 'them';
      haul = myBid + theirBid + prize;
      S.them += haul;
      S.carry = 0;
    } else {
      winner = 'tie';
      S.carry += bonus;
    }

    el('gr-prompt').textContent = 'The bids are in…';
    PP.sound.play('shake');

    var me = S;   // ignore the settle if the match was forfeited or replaced
    PP.goldscene.playRound(myBid, theirBid,
      { winner: winner, youTotal: S.you, themTotal: S.them },
      function () {
        if (S !== me) return;
        settleRound(myBid, theirBid, winner, haul);
      });
  }

  function settleRound(myBid, theirBid, winner, haul) {
    if (winner === 'you') {
      PP.sound.play('coinBig');
      el('gr-prompt').textContent = 'Your ' + myBid + ' tips the plank — you haul ' + haul + ' lbs of gold!';
    } else if (winner === 'them') {
      PP.sound.play('lifeLost');
      el('gr-prompt').textContent = S.bot.name + '’s ' + theirBid + ' tips it — they haul ' + haul + ' lbs.';
    } else {
      PP.sound.play('push');
      el('gr-prompt').textContent = 'Perfectly balanced at ' + myBid + '! Both bids are lost; the gold stays on the scale.';
    }

    el('gr-score-you').textContent = S.you;
    el('gr-score-bot').textContent = S.them;

    S.round += 1;
    var me = S;
    setTimeout(function () {
      if (S !== me) return;
      if (S.round >= 6) return finish();
      renderRound();
    }, 1400);
  }

  function finish() {
    var outcome = S.you > S.them ? 'win' : (S.you < S.them ? 'lose' : 'push');
    var extras = [];
    if (S.bestHaul >= 15) extras.push('gr-sweep');
    var detail = 'Final tally: you ' + S.you + ', ' + S.bot.name + ' ' + S.them + '.';
    S.onFinish(outcome, extras, detail);
  }

  PP.goldrush = game;
})();
