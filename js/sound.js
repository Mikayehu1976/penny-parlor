/* Penny Parlor — parlor sounds, synthesized with WebAudio.
   No audio files: every clink, thud, and jingle is generated on the fly.
   The context starts on the first user gesture (browser autoplay rules). */

var PP = window.PP || {};
window.PP = PP;

(function () {
  var MUTE_KEY = 'pennyParlor.muted';
  var muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { /* ignore */ }

  var ctx = null;

  function ac() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* one oscillator note with its own gain envelope */
  function tone(type, freq, start, dur, peak, endFreq) {
    var a = ac();
    if (!a) return;
    var t0 = a.currentTime + start;
    var osc = a.createOscillator();
    var g = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /* short burst of filtered noise (card flips, whooshes) */
  function noise(start, dur, peak, filterFreq) {
    var a = ac();
    if (!a) return;
    var t0 = a.currentTime + start;
    var len = Math.max(1, Math.floor(a.sampleRate * dur));
    var buf = a.createBuffer(1, len, a.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = a.createBufferSource();
    src.buffer = buf;
    var f = a.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = filterFreq;
    f.Q.value = 0.9;
    var g = a.createGain();
    g.gain.setValueAtTime(peak, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(a.destination);
    src.start(t0);
  }

  var FX = {
    click: function () {
      tone('square', 900, 0, 0.05, 0.06);
    },
    coin: function () {
      // two bright detuned partials: a coin dropped on marble
      tone('sine', 2450, 0, 0.16, 0.10);
      tone('sine', 3620, 0.012, 0.13, 0.07);
    },
    coinBig: function () {
      tone('sine', 1900, 0, 0.2, 0.12);
      tone('sine', 2450, 0.05, 0.18, 0.10);
      tone('sine', 3100, 0.10, 0.16, 0.08);
    },
    flip: function () {
      noise(0, 0.09, 0.18, 2400);
    },
    shake: function () {
      noise(0, 0.12, 0.10, 700);
    },
    lock: function () {
      tone('triangle', 220, 0, 0.10, 0.16, 130);
      tone('square', 1300, 0.05, 0.05, 0.05);
    },
    lifeLost: function () {
      tone('triangle', 420, 0, 0.22, 0.12, 210);
    },
    win: function () {
      // a happy little parlor-piano arpeggio
      tone('triangle', 523.25, 0.00, 0.18, 0.12);   // C5
      tone('triangle', 659.25, 0.11, 0.18, 0.12);   // E5
      tone('triangle', 783.99, 0.22, 0.20, 0.12);   // G5
      tone('triangle', 1046.5, 0.33, 0.38, 0.13);   // C6
      tone('sine',     1046.5, 0.33, 0.38, 0.05);
    },
    lose: function () {
      tone('triangle', 200, 0, 0.30, 0.12, 110);
      tone('triangle', 150, 0.16, 0.35, 0.10, 82);
    },
    push: function () {
      tone('triangle', 392, 0, 0.16, 0.09);
      tone('triangle', 349.23, 0.14, 0.22, 0.09);
    },
    honor: function () {
      tone('sine', 1318.5, 0, 0.25, 0.09);          // E6
      tone('sine', 1760.0, 0.12, 0.35, 0.09);       // A6
    }
  };

  PP.sound = {
    play: function (name) {
      if (muted || !FX[name]) return;
      try { FX[name](); } catch (e) { /* audio is never worth crashing over */ }
    },
    toggleMute: function () {
      muted = !muted;
      try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { /* ignore */ }
      return muted;
    },
    isMuted: function () { return muted; }
  };
})();
