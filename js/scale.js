/* Penny Parlor — the Prospector's Scale (design B from the Scale Lab).
   A cartoon balance under a big blue sky: rope-hung pans, spring-physics
   beam, nuggets that squash when they land. Gold Rush's centerpiece.

   API:
     PP.scale.init(containerEl)          build (or rebuild) the scene
     PP.scale.setBonus(value, carry)     show the round's bonus nugget
     PP.scale.weigh(you, them, done)     drop both bids, tilt, call done()
     PP.scale.pulseWinner(side)          'you' | 'them' celebration pulse
     PP.scale.reset()                    level the beam, clear the pans   */

var PP = window.PP || {};
window.PP = PP;

(function () {
  var SVGNS = 'http://www.w3.org/2000/svg';
  var W = 340, H = 240, PIVOT = { x: 170, y: 62 }, HALF = 100, HANG = 46;

  var CFG = {
    sky: ['#7ec8e3', '#cfeef7'],
    post: '#8a5a2b', postDark: '#5f3c18',
    beam: '#a8703a', beamEdge: '#5f3c18',
    pan: '#e8ac3a', panEdge: '#6b4a12', rope: '#b08050',
    maxTilt: 16, tiltPer: 4.0,
    spring: { k: 22, c: 2.6 },
    dropMs: 420
  };

  function mk(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function nowMs() {
    return (window.performance && performance.now) ? performance.now() : Date.now();
  }

  var NUGGET =
    '<path d="M50 7 L80 16 L93 48 L79 84 L44 93 L14 75 L7 38 Z" fill="#e8ac3a" stroke="#6b4a12" stroke-width="7" stroke-linejoin="round"/>' +
    '<polygon points="42,44 64,38 68,56 46,62" fill="#f0bd50"/>' +
    '<polygon points="30,20 52,15 42,34 24,36" fill="#f7cf6f"/>' +
    '<polygon points="68,62 84,50 76,80 54,86" fill="#c58a22"/>' +
    '<path d="M70 14 L73 22 L81 25 L73 28 L70 36 L67 28 L59 25 L67 22 Z" fill="#fffbe8"/>';

  function nuggetGroup(fontSize) {
    var g = mk('g');
    g.innerHTML = NUGGET +
      '<text x="50" y="66" text-anchor="middle" font-family="Georgia" font-size="' + (fontSize || 42) +
      '" font-weight="bold" fill="#4a2e05"></text>';
    return g;
  }

  /* ---- module state ---- */
  var V = null;                 // built view elements
  var angle = 0, vel = 0, target = 0;
  var pendingTilt = 0, landCount = 0;
  var lastT = null, rafId = null;
  var epoch = 0;                // bumped on every init/reset; stale timers check it

  function init(container) {
    container.innerHTML = '';
    epoch += 1;
    angle = 0; vel = 0; target = 0; lastT = null;

    var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.setAttribute('aria-label', 'The prospector’s scale');
    container.appendChild(svg);

    /* big sky, hills, sun, ground */
    var defs = mk('defs');
    defs.innerHTML = '<linearGradient id="pp-sky" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + CFG.sky[0] + '"/><stop offset="1" stop-color="' + CFG.sky[1] + '"/></linearGradient>';
    svg.appendChild(defs);
    svg.appendChild(mk('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#pp-sky)' }));
    svg.appendChild(mk('path', { d: 'M0 175 Q60 130 130 168 T340 160 L340 240 L0 240 Z', fill: '#8fbf6a' }));
    svg.appendChild(mk('path', { d: 'M0 190 Q100 150 200 185 T340 180 L340 240 L0 240 Z', fill: '#6da34f' }));
    svg.appendChild(mk('circle', { cx: 300, cy: 36, r: 18, fill: '#ffd95e', stroke: '#e8ac3a', 'stroke-width': 3 }));
    svg.appendChild(mk('rect', { x: 0, y: 208, width: W, height: 32, fill: '#c98f4e' }));
    svg.appendChild(mk('rect', { x: 0, y: 206, width: W, height: 3, fill: '#9a6a33' }));

    /* post + plinth */
    svg.appendChild(mk('path', {
      d: 'M' + (PIVOT.x - 9) + ' ' + PIVOT.y + ' L' + (PIVOT.x + 9) + ' ' + PIVOT.y +
         ' L' + (PIVOT.x + 20) + ' 206 L' + (PIVOT.x - 20) + ' 206 Z',
      fill: CFG.post, stroke: CFG.postDark, 'stroke-width': 3, 'stroke-linejoin': 'round'
    }));
    svg.appendChild(mk('rect', { x: PIVOT.x - 42, y: 198, width: 84, height: 12, rx: 4, fill: CFG.post, stroke: CFG.postDark, 'stroke-width': 3 }));

    /* side labels on the ground */
    svg.appendChild(mkLabel(58, 232, 'YOU'));
    var themLabel = mkLabel(W - 58, 232, 'THEM');
    svg.appendChild(themLabel);

    /* beam */
    var beam = mk('g');
    beam.appendChild(mk('rect', {
      x: PIVOT.x - HALF, y: PIVOT.y - 5, width: HALF * 2, height: 10, rx: 5,
      fill: CFG.beam, stroke: CFG.beamEdge, 'stroke-width': 3
    }));
    beam.appendChild(mk('circle', { cx: PIVOT.x, cy: PIVOT.y, r: 8, fill: CFG.beam, stroke: CFG.beamEdge, 'stroke-width': 3 }));
    svg.appendChild(beam);

    /* bonus nugget hovering over the pivot, with a soft halo */
    var bonusHalo = mk('circle', { cx: PIVOT.x, cy: 28, r: 22, fill: 'rgba(255, 233, 168, 0.55)' });
    svg.appendChild(bonusHalo);
    var bonus = nuggetGroup(46);
    bonus.setAttribute('display', 'none');
    svg.appendChild(bonus);
    var carryText = mk('text', {
      x: PIVOT.x + 26, y: 24, 'font-family': 'Georgia', 'font-size': 13,
      'font-weight': 'bold', fill: '#8a5a14'
    });
    svg.appendChild(carryText);

    V = {
      svg: svg, beam: beam,
      bonus: bonus, bonusText: bonus.querySelector('text'), bonusHalo: bonusHalo, carryText: carryText,
      left: makeSide(svg), right: makeSide(svg)
    };

    if (window.requestAnimationFrame) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(frame);
    }
  }

  function mkLabel(x, y, text) {
    var t = mk('text', {
      x: x, y: y, 'text-anchor': 'middle', 'font-family': 'Georgia',
      'font-size': 13, 'font-weight': 'bold', 'letter-spacing': 2, fill: '#5f3c18'
    });
    t.textContent = text;
    return t;
  }

  function makeSide(svg) {
    var g = mk('g');
    var r1 = mk('line', { stroke: CFG.rope, 'stroke-width': 4, 'stroke-linecap': 'round' });
    var r2 = mk('line', { stroke: CFG.rope, 'stroke-width': 4, 'stroke-linecap': 'round' });
    g.appendChild(r1); g.appendChild(r2);
    var pan = mk('path', { fill: CFG.pan, stroke: CFG.panEdge, 'stroke-width': 3, 'stroke-linejoin': 'round' });
    g.appendChild(pan);
    var nug = nuggetGroup(42);
    nug.setAttribute('display', 'none');
    g.appendChild(nug);
    svg.appendChild(g);
    return { r1: r1, r2: r2, pan: pan, nug: nug, text: nug.querySelector('text'), dropStart: undefined, landed: false, pulseAt: 0 };
  }

  /* ---- per-frame layout ---- */

  function layoutSide(side, sign, now) {
    var rad = angle * Math.PI / 180;
    var ex = PIVOT.x + Math.cos(rad) * HALF * sign;
    var ey = PIVOT.y + Math.sin(rad) * HALF * sign;
    var px = ex, py = ey + HANG;

    side.r1.setAttribute('x1', ex); side.r1.setAttribute('y1', ey);
    side.r1.setAttribute('x2', px - 16); side.r1.setAttribute('y2', py);
    side.r2.setAttribute('x1', ex); side.r2.setAttribute('y1', ey);
    side.r2.setAttribute('x2', px + 16); side.r2.setAttribute('y2', py);
    side.pan.setAttribute('d', 'M' + (px - 30) + ' ' + py + ' Q' + px + ' ' + (py + 20) + ' ' + (px + 30) + ' ' + py + ' Z');

    if (side.dropStart === undefined) {
      side.nug.setAttribute('display', 'none');
      return;
    }
    var sc = 0.38;
    if (side.pulseAt && now < side.pulseAt + 700) {
      sc *= 1 + 0.16 * Math.abs(Math.sin((now - side.pulseAt) / 700 * Math.PI * 2));
    }
    var t = Math.min(1, Math.max(0, (now - side.dropStart) / CFG.dropMs));
    var yFrom = -40, yTo = py - 76 * 0.38 + 2;
    var y = yFrom + (yTo - yFrom) * t * t;
    var squash = 1;
    if (t >= 1) {
      var st = Math.min(1, (now - side.dropStart - CFG.dropMs) / 160);
      squash = 1 - 0.22 * Math.sin(st * Math.PI);
      if (!side.landed) {
        side.landed = true;
        landCount += 1;
        PP.sound.play('coin');
        if (landCount === 2) target = pendingTilt;
      }
    }
    side.nug.setAttribute('display', '');
    side.nug.setAttribute('transform',
      'translate(' + (px - 50 * sc) + ' ' + y + ') scale(' + sc + ' ' + (sc * squash) + ')');
  }

  function frame(now) {
    if (!V) return;
    if (lastT === null) lastT = now;
    var dt = Math.min(0.02, (now - lastT) / 1000);   // capped step keeps the spring stable
    lastT = now;
    var acc = -CFG.spring.k * (angle - target) - CFG.spring.c * vel;
    vel += acc * dt * 10;
    angle += vel * dt * 10;
    V.beam.setAttribute('transform', 'rotate(' + angle + ' ' + PIVOT.x + ' ' + PIVOT.y + ')');
    layoutSide(V.left, -1, now);
    layoutSide(V.right, 1, now);

    /* bonus nugget wobbles gently over the pivot */
    var wob = Math.sin(now / 480) * 5;
    V.bonus.setAttribute('transform',
      'translate(' + (PIVOT.x - 50 * 0.34) + ' 11) scale(0.34) rotate(' + wob + ' 50 50)');

    rafId = requestAnimationFrame(frame);
  }

  /* ---- public API ---- */

  function setBonus(value, carry) {
    if (!V) return;
    V.bonus.setAttribute('display', '');
    V.bonusText.textContent = value;
    V.carryText.textContent = carry > 0 ? '+' + carry : '';
    V.bonusHalo.setAttribute('r', carry > 0 ? 26 : 22);
  }

  function weigh(you, them, done) {
    if (!V) { if (done) setTimeout(done, 0); return; }
    target = 0; angle = 0; vel = 0; landCount = 0;
    V.left.dropStart = undefined; V.right.dropStart = undefined;
    V.left.landed = false; V.right.landed = false;
    V.left.pulseAt = 0; V.right.pulseAt = 0;

    V.left.text.textContent = you;
    V.right.text.textContent = them;
    var t0 = nowMs();
    V.left.dropStart = t0 + 60;
    V.right.dropStart = t0 + 160;

    var diff = you - them;   // negative rotation drops the left (your) end
    pendingTilt = Math.max(-CFG.maxTilt, Math.min(CFG.maxTilt, -diff * CFG.tiltPer));

    var myEpoch = epoch;
    setTimeout(function () {
      if (epoch === myEpoch && done) done();
    }, CFG.dropMs + 1250);
  }

  function pulseWinner(side) {
    if (!V) return;
    var s = side === 'you' ? V.left : V.right;
    s.pulseAt = nowMs();
  }

  function reset() {
    if (!V) return;
    epoch += 1;
    target = 0;
    landCount = 0;
    V.left.dropStart = undefined; V.right.dropStart = undefined;
    V.left.landed = false; V.right.landed = false;
    V.left.pulseAt = 0; V.right.pulseAt = 0;
  }

  PP.scale = { init: init, setBonus: setBonus, weigh: weigh, pulseWinner: pulseWinner, reset: reset };
})();
