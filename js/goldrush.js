/* Penny Parlor — Gold Rush.
   Six rounds. Each player holds nuggets 1-6 and blind-bids one per round.
   A bonus nugget sits on the scale each round; the higher bid takes the
   value of BOTH bids plus the bonus (plus anything carried from ties).
   Ties discard the bids and carry the bonus forward. Most points wins. */

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
    renderRound();
  };

  function renderRound() {
    el('gr-round').textContent = 'Round ' + (S.round + 1) + ' of 6';
    el('gr-score-you').textContent = S.you;
    el('gr-score-bot').textContent = S.them;

    var bonus = S.bonusOrder[S.round];
    el('gr-bonus').textContent = bonus;
    el('gr-pot').textContent = S.carry > 0
      ? 'Worth ' + (bonus + S.carry) + ' pts (carried gold on the scale!)'
      : 'Worth ' + bonus + ' pts + both bids';

    var youPlate = el('gr-played-you'), botPlate = el('gr-played-bot');
    youPlate.textContent = '?';
    botPlate.textContent = '?';
    youPlate.className = 'nugget ghost';
    botPlate.className = 'nugget ghost';

    el('gr-prompt').textContent = 'Pick a nugget to bid against ' + S.bot.name + '.';
    renderRacks(true);
    S.locked = false;
  }

  function renderRacks(clickable) {
    var rack = el('gr-rack');
    rack.innerHTML = '';
    S.mine.forEach(function (v) {
      var b = document.createElement('button');
      b.innerHTML = '<div class="nugget">' + v + '</div>';
      b.disabled = !clickable;
      b.addEventListener('click', function () { playRound(v); });
      rack.appendChild(b);
    });

    var botRack = el('gr-rack-bot');
    botRack.innerHTML = '';
    S.theirs.forEach(function (v) {
      var d = document.createElement('div');
      d.className = 'nugget';
      d.textContent = v;
      botRack.appendChild(d);
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

    var youPlate = el('gr-played-you'), botPlate = el('gr-played-bot');
    youPlate.textContent = myBid;
    youPlate.className = 'nugget';
    botPlate.textContent = theirBid;
    botPlate.className = 'nugget';

    if (myBid > theirBid) {
      var haul = myBid + theirBid + prize;
      S.you += haul;
      S.bestHaul = Math.max(S.bestHaul, haul);
      S.carry = 0;
      youPlate.classList.add('win');
      el('gr-prompt').textContent = 'Your ' + myBid + ' beats their ' + theirBid + ' — you haul ' + haul + ' pts!';
    } else if (theirBid > myBid) {
      var theirHaul = myBid + theirBid + prize;
      S.them += theirHaul;
      S.carry = 0;
      botPlate.classList.add('win');
      el('gr-prompt').textContent = S.bot.name + '’s ' + theirBid + ' beats your ' + myBid + ' — they haul ' + theirHaul + ' pts.';
    } else {
      S.carry += bonus;
      el('gr-prompt').textContent = 'Dead heat at ' + myBid + '! Both bids are lost; the gold stays on the scale.';
    }

    el('gr-score-you').textContent = S.you;
    el('gr-score-bot').textContent = S.them;

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
    if (S.bestHaul >= 15) extras.push('gr-sweep');
    var detail = 'Final tally: you ' + S.you + ', ' + S.bot.name + ' ' + S.them + '.';
    S.onFinish(outcome, extras, detail);
  }

  PP.goldrush = game;
})();
