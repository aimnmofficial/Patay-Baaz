/* Pattay Baaz sounds: everything is made live with WebAudio (no audio files), plus funny spoken lines via the phone's own voices. */
(function (root) {
let AC = null, master = null, noiseBuf = null, mode = 2, lastVoice = 0, voices = [];
try { const m = localStorage.getItem('pb_mode'); if (m != null) mode = +m; } catch (e) {}
const ctx = () => {
  if (!AC) {
    try {
      AC = new (root.AudioContext || root.webkitAudioContext)(); master = AC.createGain(); master.gain.value = .9;
      const comp = AC.createDynamicsCompressor(); master.connect(comp); comp.connect(AC.destination);
      noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { AC = null; }
  }
  if (AC && AC.state == 'suspended') AC.resume();
  return AC;
};
const on = () => mode > 0 && ctx();
function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function tone(f, t, d, o) {
  o = o || {}; const A = AC, os = A.createOscillator(), g = A.createGain(); os.type = o.type || 'triangle'; os.frequency.setValueAtTime(f, t);
  if (o.to) os.frequency.exponentialRampToValueAtTime(o.to, t + d);
  let n = os; if (o.lp) { const fl = A.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; os.connect(fl); n = fl; }
  if (o.vib) { const l = A.createOscillator(), lg = A.createGain(); l.frequency.value = 6; lg.gain.value = o.vib; l.connect(lg); lg.connect(os.frequency); l.start(t); l.stop(t + d + .1); }
  n.connect(g); g.connect(master); env(g, t, o.a || .01, o.v || .2, d); os.start(t); os.stop(t + d + .15);
}
function noise(t, d, o) {
  o = o || {}; const A = AC, s = A.createBufferSource(), f = A.createBiquadFilter(), g = A.createGain(); s.buffer = noiseBuf; s.loop = true;
  f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 2000, t); if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + d); f.Q.value = o.q || 1;
  s.connect(f); f.connect(g); g.connect(master); env(g, t, o.a || .005, o.v || .25, d); s.start(t, Math.random() * .5); s.stop(t + d + .1);
}

const S = {
  get mode() { return mode; },
  setMode(m) { mode = m; try { localStorage.setItem('pb_mode', m); } catch (e) {} if (m < 2 && root.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) {} if (m) ctx(); },
  unlock() { ctx(); },
  shuffle() {
    if (!on()) return; const t = AC.currentTime;
    for (let i = 0; i < 16; i++) noise(t + i * .045 + Math.random() * .02, .05, { f: 2600 + Math.random() * 2200, q: 1.5, v: .1 + Math.random() * .1 });
    for (let i = 0; i < 12; i++) noise(t + .85 + i * .035 + Math.random() * .02, .045, { f: 2000 + Math.random() * 2500, q: 1.5, v: .09 + Math.random() * .09 });
    noise(t + 1.45, .12, { f: 900, q: .8, v: .25 }); tone(150, t + 1.45, .1, { to: 70, v: .25 });
  },
  slap() { if (!on()) return; const t = AC.currentTime; noise(t, .07, { type: 'highpass', f: 1800, v: .28 }); tone(190, t, .09, { to: 80, v: .3 }); },
  swoosh() { if (!on()) return; const t = AC.currentTime; noise(t, .32, { f: 500, to: 3200, q: .7, v: .3, a: .08 }); },
  pickup() { if (!on()) return; const t = AC.currentTime; noise(t, .35, { f: 3000, to: 400, q: .7, v: .3, a: .05 }); for (let i = 0; i < 4; i++) tone(260 - i * 30, t + i * .07, .08, { type: 'square', v: .06, lp: 800 }); },
  pass() { if (!on()) return; tone(220, AC.currentTime, .12, { to: 150, v: .12 }); },
  ding() { if (!on()) return; const t = AC.currentTime; tone(880, t, .25, { v: .12 }); tone(1320, t + .09, .3, { v: .09 }); },
  lock() { if (!on()) return; const t = AC.currentTime; noise(t, .05, { type: 'highpass', f: 4000, v: .3 }); tone(1200, t, .5, { type: 'sine', v: .2 }); tone(1790, t + .02, .4, { type: 'sine', v: .12 }); tone(2400, t + .04, .3, { type: 'sine', v: .07 }); },
  gasp() { if (!on()) return; const t = AC.currentTime; noise(t, .4, { f: 700, to: 2600, q: 2, v: .25, a: .12 }); },
  boing() { if (!on()) return; const t = AC.currentTime; tone(180, t, .5, { to: 520, v: .2, vib: 60, type: 'sine' }); },
  thulla() {
    if (!on()) return; const t = AC.currentTime;
    [[110, 0], [98, .26], [82, .52]].forEach(([f, d]) => { tone(f, t + d, .3, { type: 'sawtooth', v: .3, lp: 700 }); tone(f * 2, t + d, .25, { type: 'square', v: .08, lp: 900 }); noise(t + d, .08, { f: 300, v: .25 }); });
    tone(1100, t + .85, 1, { to: 120, v: .22, type: 'sine', vib: 30 });
  },
  laugh(n) {
    if (!on()) return; const t = AC.currentTime; n = n || 5;
    for (let i = 0; i < n; i++) {
      const s = t + i * .15, f0 = 330 - i * 18 + Math.random() * 20;
      tone(f0, s, .11, { type: 'sawtooth', v: .22 - i * .015, lp: 1400, a: .015, to: f0 * .85 }); noise(s, .09, { f: 1100, q: 3, v: .1 });
    }
  },
  evil() { if (!on()) return; const t = AC.currentTime; [[196, 0], [185, .2], [147, .4]].forEach(([f, d]) => tone(f, t + d, .3, { type: 'sawtooth', v: .2, lp: 900, vib: 4 })); this.laugh(4); },
  tick(urgent) { if (!on()) return; const t = AC.currentTime; tone(urgent ? 1500 : 1000, t, .05, { type: 'square', v: urgent ? .12 : .07 }); },
  dhol(bars) {
    if (!on()) return; const t = AC.currentTime, b = .2, pat = [['d', 0], ['t', 1], ['t', 2], ['d', 3], ['d', 4], ['t', 5], ['d', 6], ['t', 7]];
    for (let k = 0; k < (bars || 2); k++) pat.forEach(([ty, i]) => {
      const s0 = t + (k * 8 + i) * b;
      if (ty == 'd') { tone(95, s0, .22, { to: 48, type: 'sine', v: .6 }); noise(s0, .05, { f: 220, q: .8, v: .25 }); }
      else { noise(s0, .06, { f: 3200, q: 2, v: .22 }); tone(420, s0, .05, { to: 300, type: 'triangle', v: .08 }); }
    });
    const e = t + bars * 8 * b; tone(95, e, .4, { to: 45, type: 'sine', v: .7 }); noise(e, .12, { f: 3000, q: 1.5, v: .3 });
  },
  cheer() { if (!on()) return; const t = AC.currentTime; [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * .09, .25, { v: .16 })); },
  win() { if (!on()) return; const t = AC.currentTime; [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * .11, .3, { v: .18 })); [523, 659, 784].forEach(f => tone(f, t + .85, 1, { v: .13, type: 'sine' })); },
  lose() { if (!on()) return; const t = AC.currentTime; [[233, 0, .32], [220, .34, .32], [208, .68, .32], [196, 1.02, 1]].forEach(([f, d, l], i) => tone(f, t + d, l, { type: 'sawtooth', v: .2, lp: 900, vib: i == 3 ? 12 : 0, a: .03 })); },
  voice(key) {
    if (mode < 2 || !root.speechSynthesis) return; const L = LINES[key]; if (!L) return;
    const now = Date.now(); if (now - lastVoice < 1800 && !/hurry|late/.test(key)) return; lastVoice = now;
    const line = L[Math.floor(Math.random() * L.length)];
    try {
      if (!voices.length) voices = speechSynthesis.getVoices();
      const pick = p => voices.find(v => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith(p));
      const ur = pick('ur'), hi = pick('hi');
      const u = new SpeechSynthesisUtterance(ur ? line.ur : hi ? line.hi : line.rm);
      const v = ur || hi || pick('en-in') || null; if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'hi-IN';
      u.rate = 1.05; u.pitch = 1.25; u.volume = 1; speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) {}
  }
};
const LINES = {
  thulla: [{ ur: 'ٹھُلّا لگ گیا! سارے پتے اٹھا لو!', hi: 'ठुल्ला लग गया! सारे पत्ते उठा लो!', rm: 'Thulla lag gaya! Saray patay utha lo!' }, { ur: 'ہائے ہائے! ٹھُلّا!', hi: 'हाय हाय! ठुल्ला!', rm: 'Haye haye! Thulla!' }, { ur: 'لو بھئی، اٹھاؤ سب کچھ!', hi: 'लो भई, उठाओ सब कुछ!', rm: 'Lo bhai, uthao sab kuch!' }],
  bach: [{ ur: 'بچ گئے! مبارک ہو!', hi: 'बच गए! मुबारक हो!', rm: 'Bach gaye! Mubarak ho!' }, { ur: 'واہ بھئی واہ، نکل گئے!', hi: 'वाह भई वाह, निकल गए!', rm: 'Wah bhai wah, nikal gaye!' }],
  daketi: [{ ur: 'ڈاکہ! ڈکیتی ہو گئی!', hi: 'डाका! डकैती हो गई!', rm: 'Daaka! Daketi ho gayi!' }, { ur: 'ہاتھ اوپر! سب لوٹ لیا!', hi: 'हाथ ऊपर! सब लूट लिया!', rm: 'Haath upar! Sab loot liya!' }],
  lock: [{ ur: 'تالا لگ گیا!', hi: 'ताला लग गया!', rm: 'Taala lag gaya!' }],
  pakra: [{ ur: 'جھوٹ پکڑا گیا!', hi: 'झूठ पकड़ा गया!', rm: 'Jhoot pakra gaya!' }, { ur: 'ہاہا! چوری پکڑی گئی!', hi: 'हाहा! चोरी पकड़ी गई!', rm: 'Haha! Chori pakri gayi!' }],
  sach: [{ ur: 'سچ تھا بھائی! اب اٹھاؤ!', hi: 'सच था भाई! अब उठाओ!', rm: 'Sach tha bhai! Ab uthao!' }],
  sar: [{ ur: 'ساری سر اٹھا لی!', hi: 'सारी सर उठा ली!', rm: 'Saari sar utha li!' }, { ur: 'واہ! کیا بات ہے!', hi: 'वाह! क्या बात है!', rm: 'Wah! Kya baat hai!' }],
  win: [{ ur: 'واہ واہ! جیت گئے!', hi: 'वाह वाह! जीत गए!', rm: 'Wah wah! Jeet gaye!' }, { ur: 'شاباش! کیا کھیلا ہے!', hi: 'शाबाश! क्या खेला है!', rm: 'Shabash! Kya khela hai!' }],
  lose: [{ ur: 'اوئے ہوئے! ہار گئے!', hi: 'ओए होए! हार गए!', rm: 'Oye hoye! Haar gaye!' }, { ur: 'ہاہاہا! اگلی بار دیکھ لینا!', hi: 'हा हा हा! अगली बार देख लेना!', rm: 'Hahaha! Agli baar dekh lena!' }],
  kot: [{ ur: 'کوٹ ہو گیا!', hi: 'कोट हो गया!', rm: 'Kot ho gaya!' }],
  goan: [{ ur: 'گاؤں کوٹ! ہائے ہائے!', hi: 'गाँव कोट! हाय हाय!', rm: 'Gaon kot! Haye haye!' }],
  president: [{ ur: 'پریزیڈنٹ صاحب آ گئے!', hi: 'प्रेसिडेंट साहब आ गए!', rm: 'President sahab aa gaye!' }],
  hurry: [{ ur: 'جلدی کرو بھائی! سب انتظار کر رہے ہیں!', hi: 'जल्दी करो भाई! सब इंतज़ार कर रहे हैं!', rm: 'Jaldi karo bhai! Sab intezar kar rahe hain!' }, { ur: 'ارے بھئی! پتہ پھینکو!', hi: 'अरे भई! पत्ता फेंको!', rm: 'Arey bhai! Patta phenko!' }, { ur: 'کیا سوچ رہے ہو؟ جلدی کرو!', hi: 'क्या सोच रहे हो? जल्दी करो!', rm: 'Kya soch rahe ho? Jaldi karo!' }],
  hurry2: [{ ur: 'وقت ختم ہو رہا ہے! جلدی جلدی!', hi: 'वक़्त ख़त्म हो रहा है! जल्दी जल्दी!', rm: 'Waqt khatam ho raha hai! Jaldi jaldi!' }],
  late: [{ ur: 'اب تو حد ہو گئی، جلدی کرو!', hi: 'अब तो हद हो गई, जल्दी करो!', rm: 'Ab to had ho gayi, jaldi karo!' }],
  aakhri: [{ ur: 'سب کی آخری باری!', hi: 'सब की आखिरी बारी!', rm: 'Sab ki aakhri baari!' }]
};
if (root.speechSynthesis) try { voices = speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => { voices = speechSynthesis.getVoices(); }; } catch (e) {}
root.SFX = S;
})(window);
