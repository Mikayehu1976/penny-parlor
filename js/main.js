/* Penny Parlor — lobby, stakes, match flow, ledger. */

(function () {
  var el = function (id) { return document.getElementById(id); };

  var SCREENS = ['lobby', 'stake', 'goldrush', 'hilo', 'rsbfu', 'result'];
  var GAME_NAMES = { goldrush: 'Gold Rush', hilo: 'Hi-Lo', rsbfu: 'Ro-Sham-Bo-Fu' };

  var match = null;   // { game, stake, bot } while one is live

  /* ---------------- screens & HUD ---------------- */

  function showScreen(name) {
    SCREENS.forEach(function (s) {
      el('screen-' + s).classList.toggle('hidden', s !== name);
    });
  }

  function updateHUD() {
    var hud = el('hud-bankroll');
    var text = PP.fmtMoney(PP.state.bankroll);
    if (hud.textContent !== text) {
      hud.textContent = text;
      hud.classList.remove('pop');
      void hud.offsetWidth;
      hud.classList.add('pop');
    }
    var r = PP.rung(PP.state.highWater);
    el('hud-rank').textContent = PP.rankName(r) + ' · Rung ' + r + ' of 30';
    el('bust-notice').classList.toggle('hidden', PP.state.bankroll > 0);
  }

  /* ---------------- stake picker ---------------- */

  var pendingGame = null;
  var pendingStake = 0;

  function openStakePicker(game) {
    if (PP.state.bankroll <= 0) return;   // bust notice is showing
    pendingGame = game;
    pendingStake = 0;
    el('stake-title').textContent = GAME_NAMES[game] + ' — name your stake';
    el('btn-stake-go').disabled = true;
    el('opponent-card').innerHTML = '<div class="opp-blurb">Pick a stake and see who’s waiting at that table.</div>';

    var grid = el('stake-grid');
    grid.innerHTML = '';
    var stakes = [];
    for (var s = 1; s <= PP.state.bankroll && stakes.length < 31; s *= 2) stakes.push(s);
    // show at most the top 10 tables so the grid stays tidy at high bankrolls
    stakes.slice(-10).forEach(function (stake) {
      var chip = document.createElement('button');
      chip.className = 'stake-chip';
      chip.textContent = PP.fmtMoney(stake);
      chip.addEventListener('click', function () { selectStake(stake, chip); });
      grid.appendChild(chip);
    });

    showScreen('stake');
  }

  function selectStake(stake, chip) {
    pendingStake = stake;
    document.querySelectorAll('.stake-chip').forEach(function (c) { c.classList.remove('selected'); });
    chip.classList.add('selected');
    var bot = PP.botForStake(stake);
    el('opponent-card').innerHTML =
      '<div class="opp-name">' + bot.name + '</div>' +
      '<div class="opp-blurb">' + bot.blurb + '</div>' +
      '<div class="opp-blurb">Win and ' + PP.fmtMoney(stake) + ' becomes ' + PP.fmtMoney(stake * 2) + '.</div>';
    el('btn-stake-go').disabled = false;
  }

  /* ---------------- match flow ---------------- */

  function startMatch(game, stake) {
    match = { game: game, stake: stake, bot: PP.botForStake(stake) };
    showScreen(game);
    PP[game].start(match.bot, onMatchFinish);
  }

  var WIN_LINES = [
    'The table tips its hat to you.',
    'Drinks are on the house. (The drinks are imaginary.)',
    'Somewhere, a piano player strikes up a happy tune.'
  ];
  var LOSE_LINES = [
    'The felt giveth and the felt taketh away.',
    'Even Silas lost one, once. Probably.',
    'Shake it off — the penny jar never judges.'
  ];
  var PUSH_LINES = [
    'A dead heat. Your stake slides back across the table.',
    'Honors even. Nobody’s pocket gets heavier tonight.'
  ];

  function pickLine(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function onMatchFinish(outcome, extraHonorIds, detail) {
    if (!match) return;   // forfeited or already settled
    var m = match;
    match = null;

    var earned = [];
    (extraHonorIds || []).forEach(function (id) {
      var h = PP.grantHonor(id);
      if (h) earned.push(h);
    });
    earned = earned.concat(PP.settle(m.game, m.stake, outcome));

    var card = el('result-card');
    card.classList.toggle('lost', outcome === 'lose');
    el('result-headline').textContent =
      outcome === 'win' ? 'You won!' : (outcome === 'lose' ? 'Cleaned out.' : 'A push.');
    el('result-detail').textContent =
      (detail ? detail + ' ' : '') +
      pickLine(outcome === 'win' ? WIN_LINES : (outcome === 'lose' ? LOSE_LINES : PUSH_LINES));

    var delta = outcome === 'win' ? '+' + PP.fmtMoney(m.stake)
              : outcome === 'lose' ? '−' + PP.fmtMoney(m.stake)
              : '±p$0.00';
    el('result-bankroll').textContent = delta + '  →  ' + PP.fmtMoney(PP.state.bankroll);

    var honorsBox = el('result-achievements');
    honorsBox.innerHTML = '';
    earned.forEach(function (h) {
      var d = document.createElement('div');
      d.className = 'honor-toast';
      d.textContent = '🏅 Honor earned: ' + h.name + ' — ' + h.desc;
      honorsBox.appendChild(d);
    });

    PP.sound.play(outcome === 'win' ? 'win' : (outcome === 'lose' ? 'lose' : 'push'));
    if (earned.length) setTimeout(function () { PP.sound.play('honor'); }, 700);
    if (outcome === 'win') coinBurst(card);

    var rematch = el('btn-rematch');
    if (PP.state.bankroll >= m.stake && m.stake > 0) {
      rematch.classList.remove('hidden');
      rematch.onclick = function () { startMatch(m.game, m.stake); };
    } else {
      rematch.classList.add('hidden');
    }

    updateHUD();
    showScreen('result');
  }

  function coinBurst(container) {
    for (var i = 0; i < 12; i++) {
      var c = document.createElement('span');
      c.className = 'coin-drop';
      c.style.left = (6 + Math.random() * 88) + '%';
      c.style.animationDelay = (Math.random() * 0.55) + 's';
      container.appendChild(c);
      setTimeout(function (coin) { return function () { coin.remove(); }; }(c), 2200);
    }
  }

  function forfeit(game) {
    if (!match || match.game !== game) return;
    if (!window.confirm('Walk away and forfeit your stake?')) return;
    onMatchFinish('lose', [], 'You pushed back from the table mid-hand.');
  }

  /* ---------------- rules ---------------- */

  var RULES = {
    goldrush:
      '<h3>⚖️ Gold Rush</h3>' +
      '<p>You and your opponent each hold six gold nuggets, valued <b>1 through 6</b>. The game lasts six rounds.</p>' +
      '<ol>' +
      '<li>Each round, a <b>bonus nugget</b> is placed on the scale for all to see.</li>' +
      '<li>Both players secretly bid one nugget from their pouch.</li>' +
      '<li>The <b>higher bid</b> wins the round and hauls in <b>both bids plus the bonus nugget</b>.</li>' +
      '<li>On a tie, both bids are lost to the house and the bonus <b>stays on the scale</b>, sweetening the next round.</li>' +
      '</ol>' +
      '<p>Every nugget can only be bid once. Most points after six rounds takes the stake.</p>' +
      '<h4>A word from the regulars</h4>' +
      '<p><i>Winning 6-over-5 on a scrap prize is how fortunes leak away. Sometimes the shrewdest bid is your 1 — lose the round, save the ammunition.</i></p>',
    hilo:
      '<h3>🂡 Hi-Lo</h3>' +
      '<p>A run against the deck. You have <b>three lives</b>. A card is showing; call whether the next will be <b>higher or lower</b>. Aces are high.</p>' +
      '<ul>' +
      '<li><b>Right call:</b> the card joins your <i>riding</i> streak — winnings that are not yet safe.</li>' +
      '<li><b>Wrong call:</b> you lose a life and every riding card is swept away.</li>' +
      '<li><b>Matched rank:</b> a push. Nothing gained, nothing lost.</li>' +
      '<li><b>Lock:</b> bank your riding cards forever — but locking costs a life too.</li>' +
      '</ul>' +
      '<p>When your lives are spent, your opponent plays their own run. <b>Most cards banked wins.</b></p>' +
      '<h4>A word from the regulars</h4>' +
      '<p><i>Three lives means at most two locks. Ride far enough to make each one count — but not so far you hand it all back.</i></p>',
    rsbfu:
      '<h3>🥋 Ro-Sham-Bo-Fu</h3>' +
      '<p>The ancient art, six rounds, <b>3 points</b> on the table each round.</p>' +
      '<ul>' +
      '<li>Rock crushes scissors, scissors cut paper, paper wraps rock. The round’s winner takes the pot.</li>' +
      '<li>On a tie the pot <b>carries over and grows</b>.</li>' +
      '<li>Each round one hand is declared <b>forbidden</b>. Throw anything else and earn <b>+2 honor points</b> — win or lose.</li>' +
      '</ul>' +
      '<p>Most points after six rounds takes the stake.</p>' +
      '<h4>A word from the regulars</h4>' +
      '<p><i>The forbidden hand thins your choices — and a thin player is a readable player. Watch what the bonus does to your habits, because Silas certainly is.</i></p>'
  };

  function openModal(html) {
    el('modal-body').innerHTML = html;
    el('modal').classList.remove('hidden');
  }

  function closeModal() { el('modal').classList.add('hidden'); }

  /* ---------------- ledger ---------------- */

  function openLedger() {
    var s = PP.state;
    var r = PP.rung(s.highWater);
    var html = '<h3>📜 Ledger &amp; Honors</h3>';
    html += '<div class="ledger-stat"><span>Bankroll</span><b>' + PP.fmtMoney(s.bankroll) + '</b></div>';
    html += '<div class="ledger-stat"><span>High water mark</span><b>' + PP.fmtMoney(s.highWater) + '</b></div>';
    html += '<div class="ledger-stat"><span>Ladder</span><b>' + PP.rankName(r) + ' — rung ' + r + ' of 30</b></div>';
    html += '<div class="ledger-stat"><span>Matches</span><b>' + s.wins + ' won of ' + s.matches + '</b></div>';
    html += '<div class="ledger-stat"><span>Best streak</span><b>' + s.bestStreak + '</b></div>';
    ['goldrush', 'hilo', 'rsbfu'].forEach(function (g) {
      html += '<div class="ledger-stat"><span>' + GAME_NAMES[g] + '</span><b>' +
        s.perGame[g].wins + ' / ' + s.perGame[g].plays + '</b></div>';
    });
    if (s.sweeps > 0) {
      html += '<div class="ledger-stat"><span>Times swept the floor</span><b>' + s.sweeps + '</b></div>';
    }

    html += '<h4 style="margin-top:18px">Honors — ' + Object.keys(s.honors).length + ' of ' + PP.HONORS.length + '</h4>';
    PP.HONORS.forEach(function (h) {
      var got = !!s.honors[h.id];
      html += '<div class="honor-row' + (got ? '' : ' locked') + '">' +
        '<span class="honor-name">' + (got ? '🏅 ' : '🔒 ') + h.name + '</span>' +
        '<span class="honor-desc">' + h.desc + '</span></div>';
    });

    openModal(html);
  }

  /* ---------------- wiring ---------------- */

  document.querySelectorAll('.btn-play').forEach(function (b) {
    b.addEventListener('click', function () { openStakePicker(b.dataset.game); });
  });
  document.querySelectorAll('.btn-rules').forEach(function (b) {
    b.addEventListener('click', function () { openModal(RULES[b.dataset.game]); });
  });
  document.querySelectorAll('.btn-forfeit').forEach(function (b) {
    b.addEventListener('click', function () { forfeit(b.dataset.game); });
  });

  el('btn-stake-back').addEventListener('click', function () { showScreen('lobby'); });
  el('btn-stake-go').addEventListener('click', function () {
    if (pendingGame && pendingStake > 0 && pendingStake <= PP.state.bankroll) {
      startMatch(pendingGame, pendingStake);
    }
  });

  el('btn-sweep').addEventListener('click', function () {
    PP.sweepFloor();
    PP.sound.play('coin');
    updateHUD();
  });

  var muteBtn = el('btn-mute');
  function renderMute() { muteBtn.textContent = PP.sound.isMuted() ? '🔕' : '🔔'; }
  muteBtn.addEventListener('click', function () { PP.sound.toggleMute(); renderMute(); PP.sound.play('click'); });
  renderMute();

  // a soft click on every parlor button; games layer their own sounds on top
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('.btn, .stake-chip')) PP.sound.play('click');
  });

  el('btn-ledger').addEventListener('click', openLedger);
  el('btn-to-lobby').addEventListener('click', function () { showScreen('lobby'); updateHUD(); });

  el('modal-close').addEventListener('click', closeModal);
  el('modal').addEventListener('click', function (e) { if (e.target === el('modal')) closeModal(); });

  el('hl-higher').addEventListener('click', function () { PP.hilo.guess('higher'); });
  el('hl-lower').addEventListener('click', function () { PP.hilo.guess('lower'); });
  el('hl-lock').addEventListener('click', function () { PP.hilo.lock(); });

  document.querySelectorAll('.btn-hand').forEach(function (b) {
    b.addEventListener('click', function () { PP.rsbfu.throwHand(b.dataset.hand); });
  });

  /* ---------------- go ---------------- */

  updateHUD();
  showScreen('lobby');
})();
