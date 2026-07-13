/* Penny Parlor — Gold Rush: the canyon scene.
   A desert-dusk diorama modeled on the original Moola Gold Rush:
   sunset sky over dark mesas, a broad mine mesa with a timbered entrance
   and Gold Rush! banner, an ore cart at the mouth, and a great wooden
   plank scale on an A-frame trestle with You/Them lbs signposts.
   Your nuggets wait in a leather pouch in the foreground.

   API:
     PP.goldscene.init(container, { onBid })   build the scene
     PP.goldscene.setRound(o)                  o = { bonus, carry, mine, theirs, you, them }
     PP.goldscene.playRound(my, their, result, done)
                                               result = { winner: 'you'|'them'|'tie', youTotal, themTotal }
     PP.goldscene.remaining()                  pouch values still playable
     PP.goldscene.bid(value)                   programmatic bid (same path as a pouch click)   */

var PP = window.PP || {};
window.PP = PP;

(function () {
  var SVGNS = 'http://www.w3.org/2000/svg';
  var W = 760, H = 480;
  var PIVOT = { x: 380, y: 316 }, PLANK_HALF = 240, LAND = 200;
  var MAX_TILT = 8, TILT_PER = 2.2;
  var SPRING = { k: 22, c: 2.6 };
  var PERCH = { you: { x: 175, y: 244 }, them: { x: 585, y: 244 } };

  var NUGGET =
    '<path d="M50 7 L80 16 L93 48 L79 84 L44 93 L14 75 L7 38 Z" fill="#e8ac3a" stroke="#6b4a12" stroke-width="7" stroke-linejoin="round"/>' +
    '<polygon points="42,44 64,38 68,56 46,62" fill="#f0bd50"/>' +
    '<polygon points="30,20 52,15 42,34 24,36" fill="#f7cf6f"/>' +
    '<polygon points="68,62 84,50 76,80 54,86" fill="#c58a22"/>' +
    '<path d="M70 14 L73 22 L81 25 L73 28 L70 36 L67 28 L59 25 L67 22 Z" fill="#fffbe8"/>';

  function mk(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function nug(fontSize) {
    var g = mk('g');
    g.innerHTML = NUGGET +
      '<text x="50" y="67" text-anchor="middle" font-family="Georgia" font-size="' + (fontSize || 44) +
      '" font-weight="bold" fill="#4a2e05"></text>';
    return g;
  }

  function nowMs() {
    return (window.performance && performance.now) ? performance.now() : Date.now();
  }

  var hasRaf = typeof window !== 'undefined' && !!window.requestAnimationFrame;

  /* ---------------- module state ---------------- */

  var V = null;
  var epoch = 0;
  var onBidCb = null;
  var pouchEnabled = false;
  var pouchVals = [];
  var angle = 0, vel = 0, target = 0;
  var anims = [];
  var lastT = null, rafId = null;
  var riders = [];        // nuggets riding the plank: {g, offset, scale, pulseAt}
  var bonusState = null;

  /* t0 is stamped from the frame callback's own clock on the first frame,
     so tweens stay sane even if performance.now and rAF disagree (headless) */
  function animate(dur, apply, done) {
    if (!hasRaf) { setTimeout(function () { if (done) done(); }, 0); return; }
    anims.push({ t0: null, dur: dur, apply: apply, done: done });
  }

  function easeOut(k) { return k * (2 - k); }

  function chain(steps) {
    var myEpoch = epoch;
    var at = 0;
    steps.forEach(function (step) {
      at += step[0];
      setTimeout(function () { if (epoch === myEpoch) step[1](); }, at);
    });
  }

  /* ---------------- scene construction ---------------- */

  function init(container, opts) {
    epoch += 1;
    onBidCb = (opts && opts.onBid) || null;
    angle = 0; vel = 0; target = 0; lastT = null;
    anims = []; riders = []; bonusState = null;
    container.innerHTML = '';

    var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, 'aria-label': 'Gold Rush canyon' });
    container.appendChild(svg);

    /* ================= SKY ================= */
    var defs = mk('defs');
    defs.innerHTML =
      '<linearGradient id="gr-sky" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#2e1a3e"/><stop offset="0.4" stop-color="#7c2d3e"/>' +
      '<stop offset="0.75" stop-color="#c3502e"/><stop offset="1" stop-color="#e8823a"/></linearGradient>' +
      '<linearGradient id="gr-sand" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#d89a5c"/><stop offset="1" stop-color="#c08147"/></linearGradient>';
    svg.appendChild(defs);
    svg.appendChild(mk('rect', { x: 0, y: 0, width: W, height: 272, fill: 'url(#gr-sky)' }));
    svg.appendChild(mk('circle', { cx: 618, cy: 92, r: 34, fill: '#f0c58a' }));
    svg.appendChild(mk('circle', { cx: 618, cy: 92, r: 48, fill: '#f0c58a', opacity: 0.22 }));

    /* distant mesa silhouettes on the horizon */
    svg.appendChild(mk('path', {
      d: 'M0 244 L60 244 L74 216 L128 216 L142 244 L240 244 L240 272 L0 272 Z', fill: '#511822'
    }));
    svg.appendChild(mk('path', {
      d: 'M470 248 L512 248 L524 222 L568 222 L580 248 L760 248 L760 272 L470 272 Z', fill: '#511822'
    }));

    /* big soft canyon walls framing left and right — kept clear of the center */
    svg.appendChild(mk('path', {
      d: 'M0 96 Q54 92 84 128 Q120 142 118 190 Q140 214 126 272 L0 272 Z',
      fill: '#922b1e'
    }));
    svg.appendChild(mk('path', { d: 'M0 130 Q40 130 58 162 Q80 176 74 220 L0 232 Z', fill: '#a83a26' }));
    svg.appendChild(mk('path', {
      d: 'M760 88 Q706 86 678 124 Q642 138 646 188 Q622 212 636 272 L760 272 Z',
      fill: '#922b1e'
    }));
    svg.appendChild(mk('path', { d: 'M760 124 Q722 124 704 158 Q684 172 690 218 L760 228 Z', fill: '#a83a26' }));
    /* one small cactus up on the left wall, against the sky */
    svg.appendChild(mk('path', {
      d: 'M56 96 L56 66 M56 78 Q44 78 44 68 M56 84 Q68 84 68 72',
      fill: 'none', stroke: '#3f6b33', 'stroke-width': 7, 'stroke-linecap': 'round'
    }));

    /* ================= THE MINE MESA ================= */
    /* broad flat-topped mesa, not a dome: reads as ground, not a head */
    svg.appendChild(mk('path', {
      d: 'M240 272 L252 176 Q256 148 290 144 L470 144 Q504 148 508 176 L520 272 Z',
      fill: '#8f2a1c'
    }));
    svg.appendChild(mk('path', { d: 'M262 272 L272 186 Q276 164 300 160 L318 160 Q300 176 296 210 L290 272 Z', fill: '#a83a26' }));

    /* timbered entrance */
    svg.appendChild(mk('rect', { x: 336, y: 168, width: 88, height: 88, fill: '#160b06' }));
    svg.appendChild(mk('ellipse', { cx: 380, cy: 254, rx: 34, ry: 7, fill: '#f0c368', opacity: 0.15 }));
    svg.appendChild(mk('rect', { x: 326, y: 168, width: 13, height: 92, fill: '#9a6a33', stroke: '#5f3c18', 'stroke-width': 3 }));
    svg.appendChild(mk('rect', { x: 421, y: 168, width: 13, height: 92, fill: '#9a6a33', stroke: '#5f3c18', 'stroke-width': 3 }));
    svg.appendChild(mk('rect', { x: 318, y: 154, width: 124, height: 16, rx: 3, fill: '#9a6a33', stroke: '#5f3c18', 'stroke-width': 3 }));

    /* banner arched over the mesa top */
    var banner = mk('g');
    banner.appendChild(mk('path', {
      d: 'M300 134 Q380 108 460 134 L454 106 Q380 82 306 106 Z',
      fill: '#8a5a2b', stroke: '#5f3c18', 'stroke-width': 3, 'stroke-linejoin': 'round'
    }));
    var bt = mk('text', {
      x: 380, y: 122, 'text-anchor': 'middle', 'font-family': 'Georgia', 'font-size': 21,
      'font-weight': 'bold', fill: '#f0c368', stroke: '#5f3c18', 'stroke-width': 0.8
    });
    bt.textContent = 'Gold Rush!';
    banner.appendChild(bt);
    svg.appendChild(banner);

    /* ore cart at the mine mouth, sitting on rails on the ground */
    svg.appendChild(mk('path', { d: 'M340 268 L420 268', stroke: '#5f3c18', 'stroke-width': 4 }));
    svg.appendChild(mk('path', { d: 'M348 268 L348 262 M368 268 L368 262 M392 268 L392 262 M412 268 L412 262', stroke: '#5f3c18', 'stroke-width': 3 }));
    var cart = mk('g');
    cart.appendChild(mk('path', { d: 'M350 232 L410 232 L403 258 L357 258 Z', fill: '#7a4a26', stroke: '#4a2c12', 'stroke-width': 3, 'stroke-linejoin': 'round' }));
    cart.appendChild(mk('circle', { cx: 364, cy: 261, r: 6, fill: '#3a2415', stroke: '#160b06', 'stroke-width': 2 }));
    cart.appendChild(mk('circle', { cx: 396, cy: 261, r: 6, fill: '#3a2415', stroke: '#160b06', 'stroke-width': 2 }));
    cart.appendChild(mk('path', { d: 'M354 232 Q364 216 376 228 Q382 212 394 226 Q404 216 406 232 Z', fill: '#e8ac3a', stroke: '#6b4a12', 'stroke-width': 2.5 }));
    cart.appendChild(mk('path', { d: 'M372 219 L374 224 L379 225 L374 227 L372 232 L370 227 L365 225 L370 224 Z', fill: '#fffbe8' }));
    svg.appendChild(cart);

    /* ================= MID-GROUND FLOOR ================= */
    svg.appendChild(mk('rect', { x: 0, y: 272, width: W, height: 112, fill: '#7d2418' }));
    svg.appendChild(mk('path', { d: 'M0 272 Q190 264 380 272 T760 272 L760 284 L0 284 Z', fill: '#8f2a1c' }));

    /* ================= PERCH ROCKS for the ? bids ================= */
    /* low, wide outcrops well away from the mine so they read as their own rocks */
    svg.appendChild(mk('path', {
      d: 'M136 272 Q140 240 175 236 Q212 240 216 272 Z',
      fill: '#6e1e16'
    }));
    svg.appendChild(mk('path', {
      d: 'M546 272 Q550 240 585 236 Q620 240 624 272 Z',
      fill: '#6e1e16'
    }));
    var perchYou = nug(46);
    var perchThem = nug(46);
    perchYou.setAttribute('display', 'none');
    perchThem.setAttribute('display', 'none');
    svg.appendChild(perchYou);
    svg.appendChild(perchThem);

    /* ================= TRESTLE + PLANK ================= */
    svg.appendChild(mk('path', {
      d: 'M380 320 L354 376 M380 320 L406 376 M362 358 L398 358',
      stroke: '#5f3c18', 'stroke-width': 7, 'stroke-linecap': 'round', fill: 'none'
    }));
    var plank = mk('g');
    plank.appendChild(mk('rect', {
      x: PIVOT.x - PLANK_HALF, y: PIVOT.y - 10, width: PLANK_HALF * 2, height: 20, rx: 8,
      fill: '#c08850', stroke: '#5f3c18', 'stroke-width': 4
    }));
    plank.appendChild(mk('path', {
      d: 'M' + (PIVOT.x - PLANK_HALF + 22) + ' ' + (PIVOT.y - 3) + ' L' + (PIVOT.x - 46) + ' ' + (PIVOT.y - 3) +
      ' M' + (PIVOT.x + 46) + ' ' + (PIVOT.y - 3) + ' L' + (PIVOT.x + PLANK_HALF - 22) + ' ' + (PIVOT.y - 3) +
      ' M' + (PIVOT.x - PLANK_HALF + 40) + ' ' + (PIVOT.y + 4) + ' L' + (PIVOT.x - 80) + ' ' + (PIVOT.y + 4) +
      ' M' + (PIVOT.x + 80) + ' ' + (PIVOT.y + 4) + ' L' + (PIVOT.x + PLANK_HALF - 40) + ' ' + (PIVOT.y + 4),
      stroke: '#9a6a33', 'stroke-width': 2.5
    }));
    svg.appendChild(plank);

    /* ================= SIGNPOSTS ================= */
    function signpost(cx, label) {
      var g = mk('g');
      g.appendChild(mk('rect', { x: cx - 5, y: 332, width: 10, height: 44, fill: '#8a5a2b', stroke: '#5f3c18', 'stroke-width': 2.5 }));
      g.appendChild(mk('rect', { x: cx - 48, y: 284, width: 96, height: 50, rx: 5, fill: '#c8935a', stroke: '#5f3c18', 'stroke-width': 3 }));
      var t1 = mk('text', { x: cx, y: 305, 'text-anchor': 'middle', 'font-family': 'Georgia', 'font-size': 15, 'font-weight': 'bold', fill: '#4a2405' });
      t1.textContent = label;
      var t2 = mk('text', { x: cx, y: 326, 'text-anchor': 'middle', 'font-family': 'Georgia', 'font-size': 17, 'font-weight': 'bold', fill: '#4a2405' });
      t2.textContent = '0 lbs';
      g.appendChild(t1); g.appendChild(t2);
      svg.appendChild(g);
      return t2;
    }
    var lbsYou = signpost(70, 'You:');
    var lbsThem = signpost(690, 'Them:');

    /* ================= FOREGROUND SAND ================= */
    svg.appendChild(mk('path', { d: 'M0 384 Q190 372 380 382 T760 380 L760 480 L0 480 Z', fill: 'url(#gr-sand)' }));
    svg.appendChild(mk('ellipse', { cx: 470, cy: 414, rx: 56, ry: 7, fill: '#e6b678', opacity: 0.7 }));
    svg.appendChild(mk('ellipse', { cx: 150, cy: 396, rx: 36, ry: 5, fill: '#e6b678', opacity: 0.7 }));
    svg.appendChild(mk('ellipse', { cx: 420, cy: 442, rx: 7, ry: 4, fill: '#a06c3c' }));
    svg.appendChild(mk('ellipse', { cx: 444, cy: 452, rx: 5, ry: 3, fill: '#a06c3c' }));

    /* ================= PROPS (foreground, clear of signs and pouches) ================= */
    /* barrel + agave, mid-ground far left, tucked below the You sign */
    svg.appendChild(mk('rect', { x: 10, y: 402, width: 44, height: 50, rx: 8, fill: '#8a5a2b', stroke: '#5f3c18', 'stroke-width': 3 }));
    svg.appendChild(mk('path', { d: 'M10 418 L54 418 M10 438 L54 438', stroke: '#5f3c18', 'stroke-width': 2.5 }));
    svg.appendChild(mk('path', {
      d: 'M32 402 L20 378 L29 398 L32 372 L36 398 L45 380 L35 402 Z',
      fill: '#6da34f', stroke: '#3f7a33', 'stroke-width': 2, 'stroke-linejoin': 'round'
    }));
    /* TNT crate + cow skull, mid-ground far right beyond the Them sign */
    svg.appendChild(mk('rect', { x: 700, y: 398, width: 54, height: 44, rx: 4, fill: '#a03325', stroke: '#4a1510', 'stroke-width': 3 }));
    var tnt = mk('text', { x: 727, y: 426, 'text-anchor': 'middle', 'font-family': 'Georgia', 'font-size': 14, 'font-weight': 'bold', fill: '#f3e6c8' });
    tnt.textContent = 'TNT';
    svg.appendChild(tnt);
    svg.appendChild(mk('path', {
      d: 'M714 394 Q710 382 720 380 Q718 372 728 372 Q738 372 736 380 Q746 382 742 394 Q736 402 728 402 Q720 402 714 394 Z',
      fill: '#f3e6c8', stroke: '#b8a888', 'stroke-width': 2
    }));
    svg.appendChild(mk('circle', { cx: 723, cy: 386, r: 2.4, fill: '#4a2405' }));
    svg.appendChild(mk('circle', { cx: 733, cy: 386, r: 2.4, fill: '#4a2405' }));
    /* gecko sunning on the open sand, mid-right (top view: body, curled tail, four legs) */
    var lizard = mk('g');
    lizard.appendChild(mk('path', {
      d: 'M497 446 Q514 442 524 450 Q532 458 526 462 Q520 464 518 458 Q516 452 506 452',
      fill: 'none', stroke: '#e8823a', 'stroke-width': 6, 'stroke-linecap': 'round'
    }));
    lizard.appendChild(mk('ellipse', { cx: 478, cy: 448, rx: 22, ry: 10, fill: '#e8823a', stroke: '#c05f1e', 'stroke-width': 2.5 }));
    lizard.appendChild(mk('ellipse', { cx: 452, cy: 448, rx: 9, ry: 7, fill: '#e8823a', stroke: '#c05f1e', 'stroke-width': 2.5 }));
    lizard.appendChild(mk('circle', { cx: 449, cy: 444, r: 1.8, fill: '#4a2405' }));
    lizard.appendChild(mk('circle', { cx: 449, cy: 452, r: 1.8, fill: '#4a2405' }));
    lizard.appendChild(mk('path', {
      d: 'M466 440 L458 432 M490 440 L496 432 M466 456 L458 464 M490 456 L496 464',
      stroke: '#c05f1e', 'stroke-width': 4, 'stroke-linecap': 'round'
    }));
    svg.appendChild(lizard);

    /* ================= YOUR POUCH ================= */
    svg.appendChild(mk('path', {
      d: 'M62 400 Q210 388 364 396 Q380 434 366 470 Q210 480 68 472 Q50 436 62 400 Z',
      fill: '#c08850', stroke: '#7a4a26', 'stroke-width': 4, 'stroke-linejoin': 'round'
    }));
    svg.appendChild(mk('path', {
      d: 'M74 410 Q210 398 352 406 Q364 436 354 460 Q210 470 80 462 Q66 436 74 410 Z',
      fill: 'none', stroke: '#7a4a26', 'stroke-width': 2, 'stroke-dasharray': '6 5'
    }));
    var pouchSlots = [];
    for (var i = 0; i < 6; i++) {
      var sx = 106 + i * 45, sy = 434;
      svg.appendChild(mk('ellipse', { cx: sx, cy: sy + 12, rx: 23, ry: 10, fill: '#a06c3c' }));
      var slot = nug(48);
      slot.setAttribute('transform', 'translate(' + (sx - 22) + ' ' + (sy - 32) + ') scale(0.44)');
      slot.setAttribute('cursor', 'pointer');
      slot.querySelector('text').textContent = i + 1;
      (function (val, s) {
        s.addEventListener('click', function () { bid(val); });
      })(i + 1, slot);
      svg.appendChild(slot);
      pouchSlots.push(slot);
    }

    /* ================= THEIR MINI POUCH ================= */
    svg.appendChild(mk('path', {
      d: 'M556 452 Q650 444 744 452 Q752 466 744 476 Q650 482 558 476 Q548 464 556 452 Z',
      fill: '#c08850', stroke: '#7a4a26', 'stroke-width': 3, 'stroke-linejoin': 'round'
    }));
    var theirLabel = mk('text', { x: 649, y: 446, 'text-anchor': 'middle', 'font-family': 'Georgia', 'font-size': 11, 'font-weight': 'bold', 'letter-spacing': 1.5, fill: '#f3e6c8', opacity: 0.85 });
    theirLabel.textContent = 'THEIR POUCH';
    svg.appendChild(theirLabel);
    var theirSlots = [];
    for (var j = 0; j < 6; j++) {
      var mini = nug(52);
      mini.setAttribute('transform', 'translate(' + (566 + j * 29) + ' 450) scale(0.27)');
      mini.querySelector('text').textContent = j + 1;
      svg.appendChild(mini);
      theirSlots.push(mini);
    }

    /* ================= BONUS + CARRY TAG ================= */
    var bonus = nug(48);
    bonus.setAttribute('display', 'none');
    svg.appendChild(bonus);
    var carryTag = mk('text', { x: PIVOT.x + 24, y: 296, 'font-family': 'Georgia', 'font-size': 16, 'font-weight': 'bold', fill: '#f0c368', stroke: '#5f3c18', 'stroke-width': 0.6 });
    svg.appendChild(carryTag);

    V = {
      svg: svg, plank: plank,
      perchYou: perchYou, perchThem: perchThem,
      perchYouText: perchYou.querySelector('text'), perchThemText: perchThem.querySelector('text'),
      lbsYou: lbsYou, lbsThem: lbsThem,
      pouchSlots: pouchSlots, theirSlots: theirSlots,
      bonus: bonus, bonusText: bonus.querySelector('text'), carryTag: carryTag
    };

    if (hasRaf) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(frame);
    }
  }

  /* ---------------- geometry ---------------- */

  function plankPoint(offset) {
    var rad = angle * Math.PI / 180;
    return {
      x: PIVOT.x + Math.cos(rad) * offset,
      y: PIVOT.y + Math.sin(rad) * offset
    };
  }

  function placeRider(r, now) {
    var p = plankPoint(r.offset);
    var sc = r.scale;
    if (r.pulseAt === -1) r.pulseAt = now;   // -1: start the pulse on the next frame's clock
    if (r.pulseAt && now - r.pulseAt < 700) {
      sc *= 1 + 0.16 * Math.abs(Math.sin((now - r.pulseAt) / 700 * Math.PI * 2));
    }
    r.g.setAttribute('transform',
      'translate(' + (p.x - 50 * sc) + ' ' + (p.y - 10 - 100 * sc) + ') scale(' + sc + ')');
  }

  function perchTransform(which) {
    var p = PERCH[which];
    return 'translate(' + (p.x - 21) + ' ' + (p.y - 46) + ') scale(0.42)';
  }

  /* ---------------- frame loop ---------------- */

  function frame(now) {
    if (!V) return;
    if (lastT === null) lastT = now;
    var dt = Math.min(0.02, (now - lastT) / 1000);
    lastT = now;
    var acc = -SPRING.k * (angle - target) - SPRING.c * vel;
    vel += acc * dt * 10;
    angle += vel * dt * 10;
    V.plank.setAttribute('transform', 'rotate(' + angle + ' ' + PIVOT.x + ' ' + PIVOT.y + ')');

    for (var i = 0; i < riders.length; i++) placeRider(riders[i], now);

    if (bonusState) {
      var wob = Math.sin(now / 480) * 4;
      var p = plankPoint(0);
      V.bonus.setAttribute('transform',
        'translate(' + (p.x - 50 * 0.36) + ' ' + (p.y - 10 - 100 * 0.36) + ') scale(0.36) rotate(' + wob + ' 50 100)');
    }

    for (var a = anims.length - 1; a >= 0; a--) {
      var tw = anims[a];
      if (tw.t0 === null) tw.t0 = now;
      var k = Math.min(1, (now - tw.t0) / tw.dur);
      tw.apply(easeOut(k));
      if (k >= 1) {
        anims.splice(a, 1);
        if (tw.done) tw.done();
      }
    }

    rafId = requestAnimationFrame(frame);
  }

  /* ---------------- rounds ---------------- */

  function setRound(o) {
    if (!V) return;
    riders = [];
    target = 0;

    pouchVals = o.mine.slice();
    V.pouchSlots.forEach(function (slot, idx) {
      var have = o.mine.indexOf(idx + 1) !== -1;
      slot.setAttribute('opacity', have ? 1 : 0.25);
      slot.setAttribute('cursor', have ? 'pointer' : 'default');
    });
    V.theirSlots.forEach(function (mini, idx) {
      mini.setAttribute('opacity', o.theirs.indexOf(idx + 1) !== -1 ? 1 : 0.25);
    });

    V.lbsYou.textContent = o.you + ' lbs';
    V.lbsThem.textContent = o.them + ' lbs';

    V.perchYouText.textContent = '?';
    V.perchThemText.textContent = '?';
    V.perchYou.setAttribute('display', '');
    V.perchThem.setAttribute('display', '');
    V.perchYou.setAttribute('transform', perchTransform('you'));
    V.perchThem.setAttribute('transform', perchTransform('them'));

    bonusState = { value: o.bonus };
    V.bonus.setAttribute('display', '');
    V.bonusText.textContent = o.bonus;
    V.carryTag.textContent = o.carry > 0 ? '+' + o.carry : '';

    pouchEnabled = true;
  }

  function bid(value) {
    if (!pouchEnabled || !onBidCb) return;
    if (pouchVals.indexOf(value) === -1) return;
    pouchEnabled = false;
    onBidCb(value);
  }

  function arcTo(g, from, to, scale, dur, done) {
    animate(dur, function (k) {
      var x = from.x + (to.x - from.x) * k;
      var y = from.y + (to.y - from.y) * k - 60 * Math.sin(k * Math.PI);
      g.setAttribute('transform', 'translate(' + (x - 50 * scale) + ' ' + (y - 100 * scale) + ') scale(' + scale + ')');
    }, done);
  }

  function playRound(my, their, result, done) {
    if (!V) { if (done) setTimeout(done, 0); return; }
    var myEpoch = epoch;
    pouchEnabled = false;

    var spent = V.pouchSlots[my - 1];
    spent.setAttribute('opacity', 0.25);
    spent.setAttribute('cursor', 'default');

    var landed = 0;
    function onLand() {
      landed += 1;
      PP.sound.play('coin');
      if (landed === 2) {
        target = Math.max(-MAX_TILT, Math.min(MAX_TILT, -(my - their) * TILT_PER));
      }
    }

    chain([
      [420, function () {
        PP.sound.play('flip');
        V.perchYouText.textContent = my;
        V.perchThemText.textContent = their;
      }],
      [420, function () {
        var pl = plankPoint(-LAND), pr = plankPoint(LAND);
        arcTo(V.perchYou, { x: PERCH.you.x, y: PERCH.you.y }, { x: pl.x, y: pl.y - 10 }, 0.38, 480, function () {
          if (epoch !== myEpoch) return;
          riders.push({ g: V.perchYou, offset: -LAND, scale: 0.38, pulseAt: 0 });
          onLand();
        });
        arcTo(V.perchThem, { x: PERCH.them.x, y: PERCH.them.y }, { x: pr.x, y: pr.y - 10 }, 0.38, 480, function () {
          if (epoch !== myEpoch) return;
          riders.push({ g: V.perchThem, offset: LAND, scale: 0.38, pulseAt: 0 });
          onLand();
        });
      }],
      [1550, function () {
        V.lbsYou.textContent = result.youTotal + ' lbs';
        V.lbsThem.textContent = result.themTotal + ' lbs';
        if (result.winner === 'tie') {
          animate(360, function (k) {
            V.perchYou.setAttribute('opacity', 1 - k);
            V.perchThem.setAttribute('opacity', 1 - k);
          }, function () { clearBids(false); });
        } else {
          var winRider = null;
          for (var i = 0; i < riders.length; i++) {
            if ((result.winner === 'you') === (riders[i].offset < 0)) winRider = riders[i];
          }
          if (winRider) winRider.pulseAt = -1;
          setTimeout(function () {
            if (epoch !== myEpoch) return;
            animate(400, function (k) {
              V.perchYou.setAttribute('opacity', 1 - k);
              V.perchThem.setAttribute('opacity', 1 - k);
              V.bonus.setAttribute('opacity', 1 - k);
            }, function () { clearBids(true); });
          }, 650);
        }
      }],
      [1250, function () { if (done) done(); }]
    ]);
  }

  function clearBids(takeBonus) {
    riders = [];
    V.perchYou.setAttribute('display', 'none');
    V.perchThem.setAttribute('display', 'none');
    V.perchYou.setAttribute('opacity', 1);
    V.perchThem.setAttribute('opacity', 1);
    if (takeBonus) {
      bonusState = null;
      V.bonus.setAttribute('display', 'none');
    }
    V.bonus.setAttribute('opacity', 1);
    target = 0;
  }

  /* Static pose for screenshots/dev: both bids sitting on the tilted plank,
     no animation clocks involved. */
  function pose(my, their) {
    if (!V) return;
    pouchEnabled = false;
    V.pouchSlots[my - 1].setAttribute('opacity', 0.25);
    angle = Math.max(-MAX_TILT, Math.min(MAX_TILT, -(my - their) * TILT_PER));
    vel = 0; target = angle;
    V.plank.setAttribute('transform', 'rotate(' + angle + ' ' + PIVOT.x + ' ' + PIVOT.y + ')');
    V.perchYouText.textContent = my;
    V.perchThemText.textContent = their;
    V.perchYou.setAttribute('display', '');
    V.perchThem.setAttribute('display', '');
    riders = [
      { g: V.perchYou, offset: -LAND, scale: 0.38, pulseAt: 0 },
      { g: V.perchThem, offset: LAND, scale: 0.38, pulseAt: 0 }
    ];
    riders.forEach(function (r) { placeRider(r, 0); });
    if (bonusState) {
      var p = plankPoint(0);
      V.bonus.setAttribute('transform',
        'translate(' + (p.x - 50 * 0.36) + ' ' + (p.y - 10 - 100 * 0.36) + ') scale(0.36)');
    }
  }

  PP.goldscene = {
    init: init,
    setRound: setRound,
    playRound: playRound,
    pose: pose,
    bid: bid,
    remaining: function () { return pouchVals.slice(); }
  };
})();
