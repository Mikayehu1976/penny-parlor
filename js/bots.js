/* Penny Parlor — the house regulars.
   Bot skill rises with the stake: cheap tables get Rusty, big money gets the Undertaker. */

var PP = window.PP || {};
window.PP = PP;

(function () {

  var BOTS = [
    {
      id: 'rusty', name: 'Rusty Pete', skill: 0,
      blurb: 'Sweeps up, plays a little. Mostly guesses, bless him.'
    },
    {
      id: 'ruby', name: 'Madame Ruby', skill: 1,
      blurb: 'Runs the cloakroom and counts everything. Plays the percentages.'
    },
    {
      id: 'silas', name: 'Silas “Snake-Eyes”', skill: 2,
      blurb: 'Nobody knows where he came from. He remembers every hand you have ever played.'
    }
  ];

  /* stake in pennies -> bot for that table */
  function botForStake(stake) {
    var r = PP.rung(stake);
    if (r < 4) return BOTS[0];
    if (r < 10) return BOTS[1];
    return BOTS[2];
  }

  function rand(n) { return Math.floor(Math.random() * n); }
  function pick(arr) { return arr[rand(arr.length)]; }

  /* ================= GOLD RUSH =================
     Choose a nugget from `mine` (array of remaining values) given the
     prize on the scale (bonus + any carried pot) and the opponent's
     remaining nuggets. */
  function goldrushPick(bot, mine, theirs, prize) {
    if (bot.skill === 0) return pick(mine);

    var sorted = mine.slice().sort(function (a, b) { return a - b; });
    var lowest = sorted[0];
    var highest = sorted[sorted.length - 1];

    // closest-to-prize "matcher" bid
    var match = sorted[0];
    for (var i = 0; i < sorted.length; i++) {
      if (Math.abs(sorted[i] - prizeBase(prize)) < Math.abs(match - prizeBase(prize))) match = sorted[i];
    }

    if (bot.skill === 1) {
      // Ruby: bid roughly what the prize is worth, wobble ±1
      if (Math.random() < 0.25) {
        var idx = sorted.indexOf(match);
        var wobble = sorted[Math.max(0, Math.min(sorted.length - 1, idx + (Math.random() < 0.5 ? -1 : 1)))];
        return wobble;
      }
      return match;
    }

    // Silas: disciplined prize-matching with a hammer for carried pots.
    // (In this variant the winner recovers their own bid, so steady
    // matching beats fancy sandbagging — Silas just plays it cleanly.)
    var p = prizeBase(prize);
    if (prize >= 8) return highest;                       // fat carried pot: take it
    if (p <= 2 && Math.random() < 0.4) return lowest;     // sometimes spend the runt on scraps
    if (Math.random() < 0.1) return lowest;               // rare sandbag to stay unreadable
    return match;
  }

  /* For "match the prize" bidding, treat anything above 6 as top value. */
  function prizeBase(prize) { return Math.min(6, Math.max(1, prize)); }

  /* ================= HI-LO =================
     Simulate a full bot run. Deck ranks are 2..14.
     Returns { banked, log: [strings] } */
  function hiloRun(bot) {
    var deck = [];
    for (var s = 0; s < 4; s++) for (var r = 2; r <= 14; r++) deck.push(r);
    for (var i = deck.length - 1; i > 0; i--) {
      var j = rand(i + 1);
      var t = deck[i]; deck[i] = deck[j]; deck[j] = t;
    }

    var accuracy = [0.65, 0.85, 1.0][bot.skill];
    var lockAt   = [5, 4, 3][bot.skill];   // pending needed before spending a life to lock

    var lives = 3, pending = 0, banked = 0, pos = 0;
    var current = deck[pos++];
    var log = [];

    while (lives > 0 && pos < deck.length) {
      // lock decision: worth a life?
      var lastLife = (lives === 1);
      var shouldLock =
        (pending >= lockAt) ||
        (lastLife && pending >= 2);
      if (shouldLock && lives > 0 && pending > 0) {
        banked += pending;
        log.push('locks in ' + pending + ' card' + (pending > 1 ? 's' : ''));
        pending = 0;
        lives -= 1;
        continue;
      }

      var next = deck[pos++];
      var smart = current <= 8 ? 'higher' : 'lower';   // 8 is the true balance point of 2..14
      var guess = (Math.random() < accuracy) ? smart : (smart === 'higher' ? 'lower' : 'higher');

      if (next === current) {
        // push: no harm, no gain
      } else {
        var actual = next > current ? 'higher' : 'lower';
        if (guess === actual) {
          pending += 1;
        } else {
          lives -= 1;
          if (pending > 0) log.push('busts and drops ' + pending);
          pending = 0;
        }
      }
      current = next;
    }
    return { banked: banked, log: log };
  }

  /* ================= RO-SHAM-BO-FU =================
     Returns 'rock' | 'paper' | 'scissors'.
     history = array of the player's past throws this match (and prior matches
     this session, which is how Silas gets scary). */
  var HANDS = ['rock', 'paper', 'scissors'];
  var BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
  var COUNTER = { rock: 'paper', paper: 'scissors', scissors: 'rock' };

  function rsbPick(bot, forbidden, history) {
    var allowed = HANDS.filter(function (h) { return h !== forbidden; });

    if (bot.skill === 0) return pick(HANDS);   // Rusty forgets the forbidden hand exists

    if (bot.skill === 1) {
      // Ruby: takes the honor bonus, otherwise plays fair dice
      return Math.random() < 0.85 ? pick(allowed) : pick(HANDS);
    }

    // Silas: exploit the player's throw frequencies (recent throws weigh more)
    var w = { rock: 1, paper: 1, scissors: 1 };
    for (var i = 0; i < history.length; i++) {
      var age = history.length - 1 - i;
      w[history[i]] += Math.pow(0.85, age) * 3;
    }
    var total = w.rock + w.paper + w.scissors;
    var roll = Math.random() * total;
    var predicted = roll < w.rock ? 'rock' : (roll < w.rock + w.paper ? 'paper' : 'scissors');
    var counter = COUNTER[predicted];

    if (counter === forbidden) {
      // 3 points for the likely win vs 2 for honor: he usually takes the win
      return Math.random() < 0.6 ? counter : pick(allowed);
    }
    return Math.random() < 0.8 ? counter : pick(allowed);
  }

  PP.BOTS = BOTS;
  PP.botForStake = botForStake;
  PP.bots = {
    goldrushPick: goldrushPick,
    hiloRun: hiloRun,
    rsbPick: rsbPick,
    HANDS: HANDS,
    BEATS: BEATS
  };
})();
