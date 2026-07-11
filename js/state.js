/* Penny Parlor — persistent state: bankroll, ladder, stats, honors.
   All money is stored in integer pennies of play currency ("p$"). */

var PP = window.PP || {};
window.PP = PP;

(function () {
  var SAVE_KEY = 'pennyParlor.v1';

  var defaults = function () {
    return {
      bankroll: 1,            // pennies; everyone starts with a single cent
      highWater: 1,
      sweeps: 0,              // times bailed out from zero
      streak: 0,              // current win streak
      bestStreak: 0,
      matches: 0,
      wins: 0,
      perGame: {
        goldrush: { plays: 0, wins: 0 },
        hilo:     { plays: 0, wins: 0 },
        rsbfu:    { plays: 0, wins: 0 }
      },
      honors: {}              // id -> timestamp
    };
  };

  var state = defaults();

  try {
    var raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      var loaded = JSON.parse(raw);
      var base = defaults();
      for (var k in base) if (loaded[k] !== undefined) base[k] = loaded[k];
      state = base;
    }
  } catch (e) { /* private browsing or corrupt save: play with a fresh slate */ }

  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  /* ---- money ---- */

  function fmtMoney(pennies) {
    if (pennies < 100) return 'p$0.' + String(pennies).padStart(2, '0');
    var dollars = pennies / 100;
    return 'p$' + dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /* ---- the ladder: rung = doublings achieved from one penny ---- */

  function rung(pennies) {
    if (pennies < 1) return 0;
    return Math.min(30, Math.floor(Math.log2(pennies)));
  }

  var RANKS = [
    [0,  'Greenhorn'],
    [2,  'Bootblack'],
    [4,  'Deckhand'],
    [6,  'Prospector'],
    [9,  'Card Sharp'],
    [12, 'High Roller'],
    [15, 'Parlor Regular'],
    [18, 'Velvet Rope'],
    [21, 'Gold Baron'],
    [24, 'Magnate'],
    [27, 'Tycoon'],
    [30, 'Parlor Legend']
  ];

  function rankName(r) {
    var name = RANKS[0][1];
    for (var i = 0; i < RANKS.length; i++) {
      if (r >= RANKS[i][0]) name = RANKS[i][1];
    }
    return name;
  }

  /* ---- honors (achievements) ---- */

  var HONORS = [
    { id: 'first-win',   name: 'First Blood',        desc: 'Win your first match.' },
    { id: 'gr-win',      name: 'Struck Gold',        desc: 'Win a game of Gold Rush.' },
    { id: 'hl-win',      name: 'Card Reader',        desc: 'Win a game of Hi-Lo.' },
    { id: 'rs-win',      name: 'Dragonhand',         desc: 'Win a game of Ro-Sham-Bo-Fu.' },
    { id: 'streak-3',    name: 'On a Heater',        desc: 'Win three matches in a row.' },
    { id: 'streak-5',    name: 'House Favorite',     desc: 'Win five matches in a row.' },
    { id: 'rung-5',      name: 'Pocket Change',      desc: 'Hold 32¢ — five doublings.' },
    { id: 'rung-10',     name: 'Folding Money',      desc: 'Hold p$10.24 — ten doublings.' },
    { id: 'rung-15',     name: 'Three Figures',      desc: 'Hold p$327.68 — fifteen doublings.' },
    { id: 'rung-20',     name: 'The Vault',          desc: 'Hold p$10,485.76 — twenty doublings.' },
    { id: 'gr-sweep',    name: 'Motherlode',         desc: 'Win a Gold Rush round haul of 15+ points.' },
    { id: 'hl-five',     name: 'Iron Nerves',        desc: 'Bank five or more cards in one Hi-Lo run.' },
    { id: 'rs-honor',    name: 'Honorable Master',   desc: 'Win Ro-Sham-Bo-Fu without ever throwing the forbidden hand.' },
    { id: 'bust',        name: 'Character Building', desc: 'Lose your whole bankroll. It happens to everyone.' },
    { id: 'comeback',    name: 'The Phoenix',        desc: 'Go bust, then climb back to a full p$1.00.' }
  ];

  function grantHonor(id) {
    if (state.honors[id]) return null;
    state.honors[id] = Date.now();
    save();
    for (var i = 0; i < HONORS.length; i++) {
      if (HONORS[i].id === id) return HONORS[i];
    }
    return null;
  }

  /* ---- match settlement ----
     outcome: 'win' | 'lose' | 'push'
     Returns list of honors newly earned by the settlement itself. */
  function settle(game, stake, outcome) {
    var earned = [];
    state.matches += 1;
    state.perGame[game].plays += 1;

    if (outcome === 'win') {
      state.bankroll += stake;
      state.wins += 1;
      state.perGame[game].wins += 1;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);

      var e;
      if ((e = grantHonor('first-win'))) earned.push(e);
      var gameHonor = { goldrush: 'gr-win', hilo: 'hl-win', rsbfu: 'rs-win' }[game];
      if ((e = grantHonor(gameHonor))) earned.push(e);
      if (state.streak >= 3 && (e = grantHonor('streak-3'))) earned.push(e);
      if (state.streak >= 5 && (e = grantHonor('streak-5'))) earned.push(e);

      if (state.bankroll > state.highWater) state.highWater = state.bankroll;
      var r = rung(state.bankroll);
      if (r >= 5  && (e = grantHonor('rung-5')))  earned.push(e);
      if (r >= 10 && (e = grantHonor('rung-10'))) earned.push(e);
      if (r >= 15 && (e = grantHonor('rung-15'))) earned.push(e);
      if (r >= 20 && (e = grantHonor('rung-20'))) earned.push(e);
      if (state.sweeps > 0 && state.bankroll >= 100) {
        if ((e = grantHonor('comeback'))) earned.push(e);
      }
    } else if (outcome === 'lose') {
      state.bankroll -= stake;
      state.streak = 0;
      if (state.bankroll <= 0) {
        state.bankroll = 0;
        var eb = grantHonor('bust');
        if (eb) earned.push(eb);
      }
    }
    // push: money returned, streak unchanged

    save();
    return earned;
  }

  function sweepFloor() {
    if (state.bankroll > 0) return;
    state.bankroll = 1;
    state.sweeps += 1;
    save();
  }

  PP.state = state;
  PP.save = save;
  PP.fmtMoney = fmtMoney;
  PP.rung = rung;
  PP.rankName = rankName;
  PP.HONORS = HONORS;
  PP.grantHonor = grantHonor;
  PP.settle = settle;
  PP.sweepFloor = sweepFloor;
})();
