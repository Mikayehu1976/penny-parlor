/* Penny Parlor — Hi-Lo.
   Call each card higher or lower. Right calls ride as an unlocked streak;
   a wrong call costs a life and drops the streak. Locking banks the streak
   but also costs a life. Three lives, then your run ends and the house
   regular plays theirs. Most cards banked wins. */

var PP = window.PP || {};
window.PP = PP;

(function () {
  var el = function (id) { return document.getElementById(id); };

  var game = {};
  var S = null;

  var SUITS = [
    { glyph: '♠', red: false }, { glyph: '♥', red: true },
    { glyph: '♦', red: true },  { glyph: '♣', red: false }
  ];

  function rankLabel(r) {
    return { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }[r] || String(r);
  }

  function freshDeck() {
    var deck = [];
    for (var s = 0; s < 4; s++) for (var r = 2; r <= 14; r++) deck.push({ rank: r, suit: SUITS[s] });
    for (var i = deck.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = deck[i]; deck[i] = deck[j]; deck[j] = t;
    }
    return deck;
  }

  game.start = function (bot, onFinish) {
    S = {
      bot: bot,
      onFinish: onFinish,
      deck: freshDeck(),
      pos: 0,
      lives: 3,
      pending: 0,
      banked: 0,
      over: false,
      locked: false
    };
    S.current = S.deck[S.pos++];
    el('hl-bot-name').textContent = bot.name;
    el('hl-score-bot').textContent = 'waiting';
    el('hl-phase').textContent = 'Your run';
    el('hl-botrun').classList.add('hidden');
    el('hl-botrun').innerHTML = '';
    setControls(true);
    render('Will the next card be higher or lower?');
  };

  function setControls(on) {
    el('hl-higher').disabled = !on;
    el('hl-lower').disabled = !on;
    el('hl-lock').disabled = !on || !S || S.pending === 0;
  }

  function render(msg) {
    var card = el('hl-card');
    card.querySelector('.card-rank').textContent = rankLabel(S.current.rank);
    card.querySelector('.card-suit').textContent = S.current.suit.glyph;
    card.className = 'playing-card' + (S.current.suit.red ? ' red-suit' : '');
    // retrigger the flip animation
    void card.offsetWidth;
    card.classList.add('flip');
    PP.sound.play('flip');

    el('hl-lives').textContent = '♥ '.repeat(S.lives).trim() || '—';
    el('hl-pending').textContent = S.pending;
    el('hl-score-you').textContent = S.banked + ' banked';
    el('hl-prompt').textContent = msg;
    el('hl-lock').disabled = S.pending === 0 || S.over;
  }

  game.guess = function (dir) {
    if (!S || S.over || S.locked) return;
    if (S.pos >= S.deck.length) S.deck = S.deck.concat(freshDeck());

    var next = S.deck[S.pos++];
    var msg;

    if (next.rank === S.current.rank) {
      msg = 'A matched ' + rankLabel(next.rank) + ' — push. No harm done.';
    } else {
      var actual = next.rank > S.current.rank ? 'higher' : 'lower';
      if (dir === actual) {
        S.pending += 1;
        msg = 'Called it! ' + S.pending + ' riding — lock them in or press on?';
        PP.sound.play('coin');
      } else {
        S.lives -= 1;
        msg = S.pending > 0
          ? 'Wrong — ' + S.pending + ' riding card' + (S.pending > 1 ? 's' : '') + ' swept away, and a life with them.'
          : 'Wrong — that costs a life.';
        S.pending = 0;
        PP.sound.play('lifeLost');
        var lives = el('hl-lives');
        lives.classList.remove('hit');
        void lives.offsetWidth;
        lives.classList.add('hit');
      }
    }

    S.current = next;
    render(msg);
    if (S.lives <= 0) endRun();
  };

  game.lock = function () {
    if (!S || S.over || S.pending === 0) return;
    S.banked += S.pending;
    var lockedNow = S.pending;
    S.pending = 0;
    S.lives -= 1;
    PP.sound.play('lock');
    render('Locked in ' + lockedNow + ' — safe forever, but it cost a life.');
    if (S.lives <= 0) endRun();
  };

  function endRun() {
    S.over = true;
    setControls(false);
    el('hl-prompt').textContent = 'Your run is done: ' + S.banked + ' banked. Now ' + S.bot.name + ' takes the deck…';
    el('hl-phase').textContent = S.bot.name + '’s run';

    var result = PP.bots.hiloRun(S.bot);
    var box = el('hl-botrun');
    box.classList.remove('hidden');
    box.innerHTML = '';

    var lines = result.log.length ? result.log : ['plays a quiet, careful run'];
    var i = 0;
    var me = S;   // ignore this ticker if the match was forfeited or replaced
    var ticker = setInterval(function () {
      if (S !== me) { clearInterval(ticker); return; }
      if (i < lines.length) {
        var p = document.createElement('div');
        p.textContent = S.bot.name + ' ' + lines[i];
        box.appendChild(p);
        i += 1;
        return;
      }
      clearInterval(ticker);
      el('hl-score-bot').textContent = result.banked + ' banked';
      var outcome = S.banked > result.banked ? 'win' : (S.banked < result.banked ? 'lose' : 'push');
      var extras = S.banked >= 5 ? ['hl-five'] : [];
      var detail = 'You banked ' + S.banked + '; ' + S.bot.name + ' banked ' + result.banked + '.';
      setTimeout(function () { if (S === me) S.onFinish(outcome, extras, detail); }, 1100);
    }, 700);
  }

  PP.hilo = game;
})();
