/* Penny Parlor — Gold Rush.
   Six rounds. Each player holds nuggets 1-6 and blind-bids one per round.
   A bonus nugget hovers over the prospector's scale; both bids drop into
   the pans and the beam tips toward the heavier. The winner hauls in both
   bids plus the bonus (plus anything carried from ties). Ties discard the
   bids and leave the bonus hanging. Most points wins. */

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
    PP.scale.init(el('gr-scale-stage'));
    renderRound();
  };

  function renderRound() {
    el('gr-round').textContent = 'Round ' + (S.round + 1) + ' of 6';
    el('gr-score-you').textContent = S.you;
    el('gr-score-bot').textContent = S.them;

    var bonus = S.bonusOrder[S.round];
    PP.scale.reset();
    PP.scale.setBonus(bonus, S.carry);
    el('gr-pot').textContent = S.carry > 0
      ? 'Worth ' + (bonus + S.carry) + ' pts (carried gold on the scale!)'
      : 'Worth ' + bonus + ' pts + both bids';

    el('gr-prompt').textContent = 'Pick a nugget to bid against ' + S.bot.name + '.';
    renderRacks(true);
    S.locked = false;
  }

  function renderRacks(clickable) {
    var rack = el('gr-rack');
    rack.innerHTML = '';
    S.mine.forEach(function (v) {
      var b = document.createElement('button');
      b.innerHTML = PP.nuggetHTML(v);
      b.disabled = !clickable;
      b.addEventListener('click', function () { playRound(v); });
      rack.appendChild(b);
    });

    var botRack = el('gr-rack-bot');
    botRack.innerHTML = '';
    S.theirs.forEach(function (v) {
      botRack.innerHTML += PP.nuggetHTML(v);
    });
  }

  function playRound(myBid) {
    if (S.locked) return;
    S.locked = true;

    var bonus = S.bonusOrder[S.round];
    var prize = bonus + S.carry;
    var theirBid = PP.bots.goldrushPick(S.bot, S.theirs, S.mine, prize);

    S.mine.splice(S.mine.indexOf(myBid), 1);
    S.theirs.splice(S.theirs.indexOf(theirBid), 1);
    renderRacks(false);

    el('gr-prompt').textContent = 'Onto the scale…';
    PP.sound.play('shake');

    var me = S;   // ignore the settle if the match was forfeited or replaced
    PP.scale.weigh(myBid, theirBid, function () {
      if (S !== me) return;
      settleRound(myBid, theirBid, bonus, prize);
    });
  }

  function settleRound(myBid, theirBid, bonus, prize) {
    if (myBid > theirBid) {
      var haul = myBid + theirBid + prize;
      S.you += haul;
      S.bestHaul = Math.max(S.bestHaul, haul);
      S.carry = 0;
      PP.scale.pulseWinner('you');
      PP.sound.play('coinBig');
      el('gr-prompt').textContent = 'Your ' + myBid + ' tips the scale — you haul ' + haul + ' pts!';
    } else if (theirBid > myBid) {
      var theirHaul = myBid + theirBid + prize;
      S.them += theirHaul;
      S.carry = 0;
      PP.scale.pulseWinner('them');
      PP.sound.play('lifeLost');
      el('gr-prompt').textContent = S.bot.name + '’s ' + theirBid + ' tips it — they haul ' + theirHaul + ' pts.';
    } else {
      S.carry += bonus;
      PP.sound.play('push');
      el('gr-prompt').textContent = 'Perfectly balanced at ' + myBid + '! Both bids are lost; the gold stays put.';
    }

    el('gr-score-you').textContent = S.you;
    el('gr-score-bot').textContent = S.them;

    S.round += 1;
    var me = S;
    setTimeout(function () {
      if (S !== me) return;
      if (S.round >= 6) return finish();
      renderRound();
    }, 1500);
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
