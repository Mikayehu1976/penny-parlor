/* Penny Parlor — Gold Rush: the canyon scene.
   A full desert-dusk diorama in the spirit of the original Moola game:
   sunset sky over dark mesas, a timbered mine entrance with a Gold Rush!
   banner, an ore cart on rails, and a great wooden plank scale spanning
   the canyon with You/Them weight signposts. Your nuggets wait in a
   leather pouch in the foreground; bids perch as "?" nuggets beside the
   mine, then flip, drop onto the plank, and tip it.

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
  var PIVOT = { x: 380, y: 319 }, PLANK_HALF = 240, LAND = 205;
  var MAX_TILT = 9, TILT_PER = 2.4;
  var SPRING = { k: 22, c: 2.6 };

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
  /* riders: nuggets currently sitting on the plank, as {g, offset, scale} */
  var riders = [];
  var bonusState = null;   // { value } when the bonus is riding the plank

  /* tween helper: works headless too (skips drawing, still calls done) */
  function animate(dur, apply, done) {
    if (!hasRaf) { setTimeout(function () { if (done) done(); }, 0); return; }
    anims.push({ t0: nowMs(), dur: dur, apply: apply, done: done });
  }

  function easeOut(k) { return k * (2 - k); }

  /* run [ [delayMs, fn], ... ] with epoch protection */
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

    /* ---- sky, sun-glow, mesas ---- */
    var defs = mk('defs');
    defs.innerHTML =
      '<linearGradient id="gr-sky" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#2e1a3e"/><stop offset="0.4" stop-color="#7c2d3e"/>' +
      '<stop offset="0.75" stop-color="#c3502e"/><stop offset="1" stop-color="#e8823a"/></linearGradient>' +
      '<linearGradient id="gr-sand" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#d89a5c"/><stop offset="1" stop-color="#c08147"/></linearGradient>';
    svg.appendChild(defs);
    svg.appendChild(mk('rect', { x: 0, y: 0, width: W, height: 270, fill: 'url(#gr-sky)' }));
    svg.appendChild(mk('circle', { cx: 615, cy: 96, r: 30, fill: '#f5b76a', opacity: 0.85 }));
    svg.appendChild(mk('circle', { cx: 615, cy: 96, r: 46, fill: '#f5b76a', opacity: 0.25 }));
    /* distant mesas */
    svg.appendChild(mk('path', { d: 'M0 236 L40 236 L52 200 L96 200 L108 236 L200 236 L200 270 L0 270 Z', fill: '#4a1520' }));
    svg.appendChild(mk('path', { d: 'M470 240 L510 240 L520 206 L560 206 L570 240 L640 240 L652 218 L688 218 L700 240 L760 240 L760 270 L470 270 Z', fill: '#4a1520' }));

    /* ---- canyon floor bands ---- */
    svg.appendChild(mk('rect', { x: 0, y: 262, width: W, height: 120, fill: '#7d2418' }));
    svg.appendChild(mk('path', { d: 'M0 262 Q190 250 380 262 T760 262 L760 276 L0 276 Z', fill: '#8f2a1c' }));

    /* ---- framing canyon walls ---- */
    svg.appendChild(mk('path', {
      d: 'M0 40 Q70 58 92 110 Q118 96 132 140 Q160 150 150 196 Q190 216 168 262 L0 262 Z',
      fill: '#922b1e', stroke: '#5e1812', 'stroke-width': 4, 'stroke-linejoin': 'round'
    }));
    svg.appendChild(mk('path', { d: 'M0 96 Q46 108 60 150 Q84 158 78 200 L0 214 Z', fill: '#a83a26' }));
    svg.appendChild(mk('path', {
      d: 'M760 30 Q700 52 684 104 Q652 96 640 146 Q610 158 622 200 Q580 220 604 262 L760 262 Z',
      fill: '#922b1e', stroke: '#5e1812', 'stroke-width': 4, 'stroke-linejoin': 'round'
    }));
    svg.appendChild(mk('path', { d: 'M760 90 Q716 104 706 148 Q684 158 692 198 L760 210 Z', fill: '#a83a26' }));

    /* ---- the mine: rock mound, timbered entrance, banner ---- */
    svg.appendChild(mk('path', {
      d: 'M262 262 Q268 170 320 128 Q380 96 440 128 Q492 170 498 262 Z',
      fill: '#922b1e', stroke: '#5e1812', 'stroke-width': 4, 'stroke-linejoin': 'round'
    }));
    svg.appendChild(mk('path', { d: 'M300 262 Q308 190 348 158 Q330 210 328 262 Z', fill: '#a83a26' }));
    /* entrance */
    svg.appendChild(mk('path', {
      d: 'M334 252 L334 176 Q380 148 426 176 L426 252 Z',
      fill: '#160b06'
    }));
    svg.appendChild(mk('ellipse', { cx: 380, cy: 250, rx: 40, ry: 8, fill: '#f0c368', opacity: 0.14 }));
    /* timber frame */
    svg.appendChild(mk('rect', { x: 326, y: 168, width: 12, height: 88, fill: '#9a6a33', stroke: '#5f3c18', 'stroke-width': 3 }));
    svg.appendChild(mk('rect', { x: 422, y: 168, width: 12, height: 88, fill: '#9a6a33', stroke: '#5f3c18', 'stroke-width': 3 }));
    svg.appendChild(mk('rect', { x: 316, y: 156, width: 128, height: 14, rx: 3, fill: '#9a6a33', stroke: '#5f3c18', 'stroke-width': 3 }));
    /* banner */
    var banner = mk('g', { transform: 'rotate(-2 380 118)' });
    banner.appendChild(mk('path', {
      d: 'M306 132 Q380 106 454 132 L448 108 Q380 84 312 108 Z',
      fill: '#8a5a2b', stroke: '#5f3c18', 'stroke-width': 3, 'stroke-linejoin': 'round'
    }));
    var bt = mk('text', {
      x: 380, y: 122, 'text-anchor': 'middle', 'font-family': 'Georgia', 'font-size': 20,
      'font-weight': 'bold', fill: '#f0c368', stroke: '#5f3c18', 'stroke-width': 0.8
    });
    bt.textContent = 'Gold Rush!';
    banner.appendChild(bt);
    svg.appendChild(banner);

    /* ---- rails + ore cart ---- */
    svg.appendChild(mk('path', { d: 'M356 252 L338 300', stroke: '#5f3c18', 'stroke-width': 4 }));
    svg.appendChild(mk('path', { d: 'M404 252 L422 300', stroke: '#5f3c18', 'stroke-width': 4 }));
    svg.appendChild(mk('path', { d: 'M350 266 L410 266 M344 282 L416 282 M340 296 L420 296', stroke: '#5f3c18', 'stroke-width': 3 }));
    var cart = mk('g');
    cart.appendChild(mk('path', { d: 'M348 226 L412 226 L404 254 L356 254 Z', fill: '#7a4a26', stroke: '#4a2c12', 'stroke-width': 3, 'stroke-linejoin': 'round' }));
    cart.appendChild(mk('circle', { cx: 362, cy: 258, r: 6, fill: '#3a2415', stroke: '#160b06', 'stroke-width': 2 }));
    cart.appendChild(mk('circle', { cx: 398, cy: 258, r: 6, fill: '#3a2415', stroke: '#160b06', 'stroke-width': 2 }));
    cart.appendChild(mk('path', { d: 'M352 226 Q362 210 374 222 Q380 206 392 220 Q402 210 408 226 Z', fill: '#e8ac3a', stroke: '#6b4a12', 'stroke-width': 2.5 }));
    cart.appendChild(mk('path', { d: 'M370 214 L372 219 L377 220 L372 222 L370 227 L368 222 L363 220 L368 219 Z', fill: '#fffbe8' }));
    svg.appendChild(cart);

    /* ---- fulcrum + plank ---- */
    svg.appendChild(mk('path', {
      d: 'M352 372 Q356 330 380 326 Q404 330 408 372 Z',
      fill: '#6e1e16', stroke: '#4a1510', 'stroke-width': 3, 'stroke-linejoin': 'round'
    }));
    var plank = mk('g');
    plank.appendChild(mk('rect', {
      x: PIVOT.x - PLANK_HALF, y: PIVOT.y - 7, width: PLANK_HALF * 2, height: 14, rx: 6,
      fill: '#a8703a', stroke: '#5f3c18', 'stroke-width': 3.5
    }));
    plank.appendChild(mk('path', {
      d: 'M' + (PIVOT.x - PLANK_HALF + 18) + ' ' + PIVOT.y + ' L' + (PIVOT.x - 40) + ' ' + PIVOT.y +
      ' M' + (PIVOT.x + 40) + ' ' + PIVOT.y + ' L' + (PIVOT.x + PLANK_HALF - 18) + ' ' + PIVOT.y,
      stroke: '#8a5a2b', 'stroke-width': 2.5
    }));
    svg.appendChild(plank);

    /* ---- perch rocks + hidden-bid nuggets ---- */
    svg.appendChild(mk('path', { d: 'M212 216 Q226 186 252 194 Q272 200 266 224 L216 226 Z', fill: '#7d2418', stroke: '#4a1510', 'stroke-width': 3 }));
    svg.appendChild(mk('path', { d: 'M494 224 Q504 190 532 194 Q552 202 546 224 L498 228 Z', fill: '#7d2418', stroke: '#4a1510', 'stroke-width': 3 }));
    var perchYou = nug(46);
    var perchThem = nug(46);
    perchYou.setAttribute('display', 'none');
    perchThem.setAttribute('display', 'none');
    svg.appendChild(perchYou);
    svg.appendChild(perchThem);

    /* ---- signposts ---- */
    function signpost(cx, label) {
      var g = mk('g');
      g.appendChild(mk('rect', { x: cx - 5, y: 300, width: 10, height: 70, fill: '#8a5a2b', stroke: '#5f3c18', 'stroke-width': 2.5 }));
      g.appendChild(mk('rect', { x: cx - 47, y: 286, width: 94, height: 46, rx: 5, fill: '#c8935a', stroke: '#5f3c18', 'stroke-width': 3 }));
      var t1 = mk('text', { x: cx, y: 305, 'text-anchor': 'middle', 'font-family': 'Georgia', 'font-size': 14, 'font-weight': 'bold', fill: '#4a2405' });
      t1.textContent = label;
      var t2 = mk('text', { x: cx, y: 325, 'text-anchor': 'middle', 'font-family': 'Georgia', 'font-size': 16, 'font-weight': 'bold', fill: '#4a2405' });
      t2.textContent = '0 lbs';
      g.appendChild(t1); g.appendChild(t2);
      svg.appendChild(g);
      return t2;
    }
    var lbsYou = signpost(92, 'You:');
    var lbsThem = signpost(668, 'Them:');

    /* ---- foreground sand ---- */
    svg.appendChild(mk('path', { d: 'M0 382 Q190 368 380 380 T760 378 L760 480 L0 480 Z', fill: 'url(#gr-sand)' }));
    svg.appendChild(mk('ellipse', { cx: 470, cy: 420, rx: 60, ry: 8, fill: '#e6b678', opacity: 0.7 }));
    svg.appendChild(mk('ellipse', { cx: 200, cy: 400, rx: 40, ry: 6, fill: '#e6b678', opacity: 0.7 }));

    /* ---- props ---- */
    /* barrel + agave, left */
    svg.appendChild(mk('rect', { x: 30, y: 322, width: 46, height: 52, rx: 8, fill: '#8a5a2b', stroke: '#5f3c18', 'stroke-width': 3 }));
    svg.appendChild(mk('path', { d: 'M30 338 L76 338 M30 358 L76 358', stroke: '#5f3c18', 'stroke-width': 2.5 }));
    svg.appendChild(mk('path', {
      d: 'M53 322 L40 296 L50 318 L53 290 L57 318 L67 298 L56 322 Z',
      fill: '#6da34f', stroke: '#3f7a33', 'stroke-width': 2, 'stroke-linejoin': 'round'
    }));
    /* cactus */
    svg.appendChild(mk('path', {
      d: 'M158 320 L158 276 Q158 266 166 266 Q174 266 174 276 L174 320 M158 292 Q144 292 144 282 Q144 274 150 274 M174 300 Q188 300 188 288 Q188 280 182 280',
      fill: 'none', stroke: '#4f8f3f', 'stroke-width': 9, 'stroke-linecap': 'round'
    }));
    /* TNT crate + skull, right */
    svg.appendChild(mk('rect', { x: 648, y: 326, width: 62, height: 46, rx: 4, fill: '#a03325', stroke: '#4a1510', 'stroke-width': 3 }));
    var tnt = mk('text', { x: 679, y: 356, 'text-anchor': 'middle', 'font-family': 'Georgia', 'font-size': 16, 'font-weight': 'bold', fill: '#f3e6c8' });
    tnt.textContent = 'TNT';
    svg.appendChild(tnt);
    svg.appendChild(mk('path', {
      d: 'M664 318 Q660 306 670 304 Q668 296 678 296 Q688 296 686 304 Q696 306 692 318 Q686 326 678 326 Q670 326 664 318 Z',
      fill: '#f3e6c8', stroke: '#b8a888', 'stroke-width': 2
    }));
    svg.appendChild(mk('circle', { cx: 673, cy: 310, r: 2.6, fill: '#4a2405' }));
    svg.appendChild(mk('circle', { cx: 683, cy: 310, r: 2.6, fill: '#4a2405' }));
    /* lizard, bottom right */
    var lizard = mk('g');
    lizard.appendChild(mk('path', {
      d: 'M600 458 Q616 448 634 454 Q652 460 664 452 Q676 444 688 450',
      fill: 'none', stroke: '#e8823a', 'stroke-width': 9, 'stroke-linecap': 'round'
    }));
    lizard.appendChild(mk('circle', { cx: 600, cy: 456, r: 7, fill: '#e8823a' }));
    lizard.appendChild(mk('circle', { cx: 597, cy: 453, r: 1.8, fill: '#4a2405' }));
    lizard.appendChild(mk('path', { d: 'M622 460 L616 470 M640 460 L636 470 M654 452 L650 462 M666 450 L662 460', stroke: '#c05f1e', 'stroke-width': 3, 'stroke-linecap': 'round' }));
    svg.appendChild(lizard);

    /* ---- your pouch ---- */
    svg.appendChild(mk('path', {
      d: 'M28 410 Q180 396 336 404 Q352 436 340 468 Q180 478 34 470 Q18 438 28 410 Z',
      fill: '#c08850', stroke: '#7a4a26', 'stroke-width': 4, 'stroke-linejoin': 'round'
    }));
    svg.appendChild(mk('path', {
      d: 'M40 418 Q180 406 326 412 Q338 438 330 460 Q180 470 44 462 Q34 438 40 418 Z',
      fill: 'none', stroke: '#7a4a26', 'stroke-width': 2, 'stroke-dasharray': '6 5'
    }));
    var pouchSlots = [];
    for (var i = 0; i < 6; i++) {
      var sx = 70 + i * 46, sy = 440;
      svg.appendChild(mk('ellipse', { cx: sx, cy: sy + 8, rx: 20, ry: 9, fill: '#a06c3c' }));
      var slot = nug(46);
      slot.setAttribute('transform', 'translate(' + (sx - 17) + ' ' + (sy - 22) + ') scale(0.34)');
      slot.setAttribute('cursor', 'pointer');
      slot.querySelector('text').textContent = i + 1;
      (function (val, s) {
        s.addEventListener('click', function () { bid(val); });
      })(i + 1, slot);
      svg.appendChild(slot);
      pouchSlots.push(slot);
    }

    /* ---- their mini pouch ---- */
    svg.appendChild(mk('path', {
      d: 'M560 444 Q645 438 732 444 Q740 460 732 472 Q645 478 562 472 Q554 458 560 444 Z',
      fill: '#c08850', stroke: '#7a4a26', 'stroke-width': 3
    }));
    var theirLabel = mk('text', { x: 646, y: 440, 'text-anchor': 'middle', 'font-family': 'Georgia', 'font-size': 10, 'font-weight': 'bold', 'letter-spacing': 1.5, fill: '#7a4a26' });
    theirLabel.textContent = 'THEIR POUCH';
    svg.appendChild(theirLabel);
    var theirSlots = [];
    for (var j = 0; j < 6; j++) {
      var mini = nug(50);
      mini.setAttribute('transform', 'translate(' + (570 + j * 27) + ' 448) scale(0.17)');
      mini.querySelector('text').textContent = j + 1;
      svg.appendChild(mini);
      theirSlots.push(mini);
    }

    /* ---- bonus nugget + carry tag (rides the plank center) ---- */
    var bonus = nug(48);
    bonus.setAttribute('display', 'none');
    svg.appendChild(bonus);
    var carryTag = mk('text', { x: PIVOT.x + 30, y: 286, 'font-family': 'Georgia', 'font-size': 15, 'font-weight': 'bold', fill: '#f0c368', stroke: '#5f3c18', 'stroke-width': 0.6 });
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
    if (r.pulseAt && now - r.pulseAt < 700) {
      sc *= 1 + 0.16 * Math.abs(Math.sin((now - r.pulseAt) / 700 * Math.PI * 2));
    }
    r.g.setAttribute('transform',
      'translate(' + (p.x - 50 * sc) + ' ' + (p.y - 9 - 100 * sc) + ') scale(' + sc + ')');
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
        'translate(' + (p.x - 50 * 0.36) + ' ' + (p.y - 9 - 100 * 0.36) + ') scale(0.36) rotate(' + wob + ' 50 100)');
    }

    /* tweens */
    for (var a = anims.length - 1; a >= 0; a--) {
      var tw = anims[a];
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

    /* pouch: show remaining, dim the spent */
    pouchVals = o.mine.slice();
    V.pouchSlots.forEach(function (slot, idx) {
      var have = o.mine.indexOf(idx + 1) !== -1;
      slot.setAttribute('opacity', have ? 1 : 0.28);
      slot.setAttribute('cursor', have ? 'pointer' : 'default');
    });
    V.theirSlots.forEach(function (mini, idx) {
      mini.setAttribute('opacity', o.theirs.indexOf(idx + 1) !== -1 ? 1 : 0.28);
    });

    V.lbsYou.textContent = o.you + ' lbs';
    V.lbsThem.textContent = o.them + ' lbs';

    /* the "?" bids take their perches */
    V.perchYouText.textContent = '?';
    V.perchThemText.textContent = '?';
    V.perchYou.setAttribute('display', '');
    V.perchThem.setAttribute('display', '');
    V.perchYou.setAttribute('transform', 'translate(' + (238 - 21) + ' 148) scale(0.42)');
    V.perchThem.setAttribute('transform', 'translate(' + (520 - 21) + ' 148) scale(0.42)');

    /* bonus drops onto the plank center */
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

    /* dim the spent pouch nugget right away */
    var spent = V.pouchSlots[my - 1];
    spent.setAttribute('opacity', 0.28);
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
      [420, function () {   /* flip both ? nuggets to their values */
        PP.sound.play('flip');
        V.perchYouText.textContent = my;
        V.perchThemText.textContent = their;
      }],
      [420, function () {   /* both bids arc down onto the plank */
        var pl = plankPoint(-LAND), pr = plankPoint(LAND);
        arcTo(V.perchYou, { x: 238, y: 190 }, { x: pl.x, y: pl.y - 9 }, 0.38, 480, function () {
          if (epoch !== myEpoch) return;
          riders.push({ g: V.perchYou, offset: -LAND, scale: 0.38, pulseAt: 0 });
          onLand();
        });
        arcTo(V.perchThem, { x: 520, y: 190 }, { x: pr.x, y: pr.y - 9 }, 0.38, 480, function () {
          if (epoch !== myEpoch) return;
          riders.push({ g: V.perchThem, offset: LAND, scale: 0.38, pulseAt: 0 });
          onLand();
        });
      }],
      [1550, function () {  /* settled: celebrate, update signposts, clear the plank */
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
          if (winRider) winRider.pulseAt = nowMs();
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

  PP.goldscene = {
    init: init,
    setRound: setRound,
    playRound: playRound,
    bid: bid,
    remaining: function () { return pouchVals.slice(); }
  };
})();
