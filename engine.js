/* Pattay Baaz rules engine. Pure logic, no DOM: runs in browser now, on a Node server later. */
(function (root) {
const SUITS = ['♠︎', '♥︎', '♦︎', '♣︎'];
const rl = r => ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' })[r] || '' + r;
const cn = c => rl(c.r) + SUITS[c.s];
const CR = root.crypto || require('crypto').webcrypto;
function rnd(n) { if (n <= 1) return 0; const u = new Uint32Array(1), lim = Math.floor(4294967296 / n) * n; do CR.getRandomValues(u); while (u[0] >= lim); return u[0] % n; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function newDeck() { const d = []; for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push({ r, s, id: s * 13 + r - 2 }); return d; }
const SO = [0, 1, 3, 2];
const bySuit = (a, b) => SO[a.s] - SO[b.s] || b.r - a.r;
const byRank = (a, b) => b.r - a.r || SO[a.s] - SO[b.s];
const take = (h, id) => h.splice(h.findIndex(c => c.id === id), 1)[0];
const nextAct = (s, p) => { do p = (p + 1) % s.n; while (s.out[p]); return p; };
const flash = (s, t) => { s.flash = t; s.fid = (s.fid || 0) + 1; };
const active = s => s.out.filter(x => !x).length;
const base = (g, o) => ({ g, n: o.n, names: o.names, hands: Array.from({ length: o.n }, () => []), table: [], tableMode: 'trick', out: Array(o.n).fill(false), turn: -1, msg: '', flash: null, fid: 0, over: null, pend: null });
const dealAll = (s, sorter) => { const d = shuffle(newDeck()), st = rnd(s.n); for (let p = 0; p < s.n; p++) s.hands[p] = []; d.forEach((c, i) => s.hands[(st + i) % s.n].push(c)); s.hands.forEach(h => h.sort(sorter)); };
const lo = (a, f) => a.reduce((m, c) => f(c) < f(m) ? c : m);
const hi = (a, f) => a.reduce((m, c) => f(c) > f(m) ? c : m);

/* ---------------- RUNG (4P teams, 3P solo) and BAND RUNG ---------------- */
const Rung = {
  create(o, prev) {
    const s = base(o.band ? 'band' : 'rung', o);
    s.band = !!o.band; s.T = s.n == 4 ? 13 : 17; s.minPick = s.n == 4 ? 5 : 7; s.lim = s.n == 4 ? 6 : 9;
    s.trump = null; s.sar = Array(s.n == 4 ? 2 : 3).fill(0); s.pile = 0; s.trickNo = 1; s.senior = null; s.aceWinner = null; s.caller = null; s.phase = 'draw';
    s.match = prev ? prev.match : { wins: s.sar.map(() => 0), round: 0, ptr: [0, 0], last: null };
    const m = s.match; m.round++;
    let d = shuffle(newDeck());
    if (s.n == 3) { const x = d.filter(c => c.r == 2)[rnd(4)]; d = d.filter(c => c !== x); s.removed = x; }
    s.deck = d;
    if (m.last == null) {
      if (s.band) { const w = rnd(s.n); m.ptr[w % 2] = (w >> 1) + 1; this.deal(s, w); }
      else {
        let pick, mx;
        do { pick = shuffle(newDeck()).slice(0, s.n); mx = Math.max(...pick.map(x => x.r)); } while (pick.filter(c => c.r == mx).length > 1);
        const w = pick.findIndex(c => c.r == mx);
        s.table = pick.map((c, p) => ({ c, p }));
        s.msg = 'Sab se bara patta ' + s.names[w] + ' ka: rung wohi rakhe ga';
        s.pend = { ms: 2400, kind: 'draw', w };
      }
    } else {
      let w;
      if (s.n == 4) { const t = m.last; w = [t, t + 2][m.ptr[t] % 2]; m.ptr[t]++; } else w = m.last;
      this.deal(s, w);
    }
    return s;
  },
  deal(s, w) {
    s.table = []; s.msg = ''; const d = s.deck;
    if (s.band) { for (let p = 0; p < s.n; p++) s.hands[p] = d.slice(p * s.T, (p + 1) * s.T).sort(bySuit); s.phase = 'play'; s.turn = w; }
    else { s.caller = w; for (let p = 0; p < s.n; p++) s.hands[p] = d.slice(p * 5, p * 5 + 5).sort(bySuit); s.rest = d.slice(s.n * 5); s.phase = 'pick'; s.turn = w; }
    if (s.removed) flash(s, cn(s.removed) + ' deck se nikal diya gaya');
  },
  legal(s, p) { const h = s.hands[p]; if (!s.table.length) return h.slice(); const led = s.table[0].c.s, f = h.filter(c => c.s === led); return f.length ? f : h.slice(); },
  best(s) { let b = s.table[0]; for (const x of s.table.slice(1)) { if (x.c.s === b.c.s ? x.e > b.e : x.c.s === s.trump) b = x; } return b; },
  act(s, p, a) {
    if (s.phase == 'pick') {
      const k = s.T - 5; let tr, hs, tries = 0;
      do { shuffle(s.rest); hs = s.hands.map((h, i) => h.concat(s.rest.slice(i * k, (i + 1) * k))); tr = a.t == 'last' ? hs[p][s.T - 1].s : a.s; }
      while (++tries < 3000 && hs.some(h => h.filter(c => c.s == tr).length > s.lim));
      s.hands = hs.map(h => h.sort(bySuit)); s.trump = tr; s.phase = 'play'; s.turn = p;
      flash(s, s.names[p] + ' ne rung rakha: ' + SUITS[tr]); return;
    }
    const c = take(s.hands[p], a.c), led = s.table.length ? s.table[0].c.s : null;
    if (s.band && s.trump == null && led != null && c.s !== led) { s.trump = c.s; s.caller = p; flash(s, s.names[p] + ' ne rung rakha: ' + SUITS[c.s]); }
    const e = (c.r == 14 && s.aceWinner === p && s.trickNo < s.T) ? 2 : c.r;
    s.table.push({ c, p, e, low: e != c.r });
    if (e != c.r) flash(s, 'Ace rule: ' + s.names[p] + ' ka yeh Ace 2 gina jaye ga');
    if (s.table.length == s.n) { const w = this.best(s).p; s.turn = -1; s.msg = s.names[w] + ' ne yeh hath jeeta'; s.pend = { ms: 1500, kind: 'trick', w }; }
    else s.turn = (p + 1) % s.n;
  },
  resolve(s) {
    const pd = s.pend; s.pend = null;
    if (pd.kind == 'draw') { if (s.n == 4) s.match.ptr[pd.w % 2] = (pd.w >> 1) + 1; this.deal(s, pd.w); return; }
    const w = pd.w, we = s.table.find(x => x.p == w), tm = s.n == 4 ? w % 2 : w; s.msg = '';
    s.aceWinner = (we.c.r == 14 && we.e == 14) ? w : null;
    const cards = s.table.map(x => s.names[x.p] + ' ' + cn(x.c) + (x.e != x.c.r ? '(=2)' : '')).join(', ');
    s.table = []; s.pile++;
    const can = !s.band || s.trump != null, who = s.names[w];
    let note = '';
    if (s.trickNo == s.T) { note = 'AAKHRI HATH: bachi hui ' + s.pile + ' sar ' + who + ' ko mili'; flash(s, 'Aakhri hath ' + s.names[w] + ' ne jeeta: bachi hui ' + s.pile + ' sar us ki'); s.sar[tm] += s.pile; s.pile = 0; s.senior = null; }
    else if (can && s.senior === w && s.trickNo >= s.minPick && we.c.r != 14) { note = who + ' ne lagatar 2 hath jeet kar ' + s.pile + ' sar uthai'; flash(s, s.names[w] + ' ne ' + s.pile + ' sar utha li!'); s.sar[tm] += s.pile; s.pile = 0; s.senior = null; }
    else { const aceHold = can && s.senior === w && s.trickNo >= s.minPick; s.senior = can ? w : null; note = aceHold ? who + ' ne Ace phenka: Ace se sar nahi uthti, wo sirf senior rehta hai, beech mein ' + s.pile + ' sar' : can ? who + ' senior, beech mein ' + s.pile + ' sar' : 'rung abhi band, beech mein ' + s.pile + ' sar'; }
    (s.log = s.log || []).push('<b>Hath ' + s.trickNo + ':</b> ' + cards + '. Jeeta: ' + s.names[w] + '. ' + note + '. <i>Sar ' + s.sar.join(' - ') + '</i>');
    s.trickNo++;
    const mx = Math.max(...s.sar), mn = Math.min(...s.sar);
    if (s.trickNo > s.T || (s.n == 4 && mx >= 7 && mn >= 1)) return this.finish(s);
    s.turn = w;
  },
  finish(s) {
    const m = s.match, wt = s.sar.indexOf(Math.max(...s.sar)), ct = s.caller == null ? null : (s.n == 4 ? s.caller % 2 : s.caller);
    let kot = '';
    if (s.sar[wt] == s.T) kot = (ct != null && ct !== wt) ? 'GOAN KOT! Rung wali team 13-0 se haari' : 'POORA KOT!';
    else if (s.n == 3 && ct != null && s.sar[ct] == 0) kot = 'GOAN KOT! Rung rakhne wala ek sar bhi na le saka';
    m.wins[wt]++; m.last = wt;
    const tn = t => s.n == 4 ? s.names[t] + ' + ' + s.names[t + 2] : s.names[t];
    s.turn = -1;
    s.over = { winners: s.n == 4 ? [wt, wt + 2] : [wt], titleWin: 'Jeet gaye!', titleLose: 'Haar gaye!', next: true, log: s.log,
      lines: ['Jeet: ' + tn(wt), 'Sar: ' + s.sar.map((v, t) => tn(t) + ' ' + v).join('  |  '), kot || 'Sada jeet', 'Match (rounds jeete): ' + m.wins.join(' - ')] };
  },
  bot(s, p) {
    const h = s.hands[p];
    if (s.phase == 'pick') { const cnt = [0, 0, 0, 0]; h.forEach(c => cnt[c.s] += 10 + c.r / 10); return { t: 'trump', s: cnt.indexOf(Math.max(...cnt)) }; }
    const L = this.legal(s, p), ev = c => (c.r == 14 && s.aceWinner === p && s.trickNo < s.T) ? 2 : c.r, isT = c => c.s === s.trump;
    const P = c => ({ t: 'play', c: c.id });
    const nonT = L.filter(c => !isT(c));
    if (!s.table.length) {
      const want = s.senior === p && s.trickNo >= s.minPick, tr = L.filter(isT);
      if (want) { const pk = L.filter(c => c.r != 14); if (pk.length) { const t2 = pk.filter(isT); return P(hi(t2.length ? t2 : pk, ev)); } return P(hi(L, ev)); }
      const pool = nonT.length ? nonT : L, b = hi(pool, ev); return P(ev(b) >= 13 || Math.random() < .4 ? b : lo(pool, ev));
    }
    const led = s.table[0].c.s, cur = this.best(s), pw = s.n == 4 && cur.p % 2 == p % 2, last = s.table.length == s.n - 1;
    if (L[0].s === led) {
      if (pw && (last || cur.e >= 12 || cur.p === s.senior)) return P(lo(L, ev));
      if (isT(cur.c) && led !== s.trump) return P(lo(L, ev));
      const win = L.filter(c => ev(c) > cur.e);
      if (!win.length) return P(lo(L, ev));
      return P(last ? lo(win, ev) : hi(win, ev));
    }
    if (s.band && s.trump == null) { const cnt = [0, 0, 0, 0]; L.forEach(c => cnt[c.s]++); const bs = cnt.indexOf(Math.max(...cnt)); return P(lo(L.filter(c => c.s == bs), ev)); }
    if (pw) return P(lo(nonT.length ? nonT : L, ev));
    let tr = L.filter(isT); if (isT(cur.c)) tr = tr.filter(c => ev(c) > cur.e);
    if (tr.length) return P(lo(tr, ev));
    return P(lo(nonT.length ? nonT : L, ev));
  },
  ok(s, p, a) {
    if (s.phase == 'pick') return a.t == 'last' || (a.t == 'trump' && [0, 1, 2, 3].includes(a.s));
    return s.phase == 'play' && a.t == 'play' && this.legal(s, p).some(c => c.id === a.c);
  },
  human(s, sel, opt, me) {
    if (s.phase == 'pick') return { hint: 'Apne 5 patte dekh kar rung chuno', btns: [0, 1, 2, 3].map(x => ({ l: SUITS[x], a: { t: 'trump', s: x }, cls: x == 1 || x == 2 ? 'red' : 'blk' })).concat([{ l: 'Aakhri patta', a: { t: 'last' } }]) };
    const L = new Set(this.legal(s, me).map(c => c.id));
    const lowAce = s.aceWinner === me && s.trickNo < s.T && s.hands[me].some(c => c.r == 14);
    return { single: true, legal: L, lowIds: lowAce ? new Set(s.hands[me].filter(c => c.r == 14).map(c => c.id)) : null, hint: lowAce ? 'Dhyan: pichla hath aap ne Ace se jeeta, is hath aap ka Ace 2 gina jaye ga' : (s.table.length ? 'Suit follow karo' : 'Aap ki chaal'), btns: [{ l: 'Phenko', p: 1, d: sel.length != 1 || !L.has(sel[0].id), a: sel.length ? { t: 'play', c: sel[0].id } : null }] };
  },
  status(s, me) { const t = s.trump == null ? (s.band ? 'band' : '?') : SUITS[s.trump], mt = me % 2; return 'Rung ' + t + '  ·  Sar ' + (s.n == 4 ? 'Hum ' + s.sar[mt] + ' : ' + s.sar[1 - mt] + ' Woh' : s.sar.join(' / ')) + '  ·  Beech ' + s.pile; },
  seatInfo(s, p, me) { const a = []; if (s.n == 4 && p == (me + 2) % 4) a.push('Partner'); if (s.n == 3) a.push('Sar ' + s.sar[p]); if (s.caller === p) a.push('Rung'); if (s.senior === p) a.push('<u>Senior</u>'); return a.join(' · '); }
};

/* ---------------- THULLA ---------------- */
const Thulla = {
  create(o) {
    const s = base('thulla', o); dealAll(s, bySuit); s.first = true; s.safe = []; s.trickN = s.n;
    s.turn = s.hands.findIndex(h => h.some(c => c.id === 12));
    flash(s, s.names[s.turn] + ' ke paas hukm ka ikka hai'); return s;
  },
  legal(s, p) { const h = s.hands[p]; if (!s.table.length) return s.first ? h.filter(c => c.id === 12) : h.slice(); const led = s.table[0].c.s, f = h.filter(c => c.s === led); return f.length ? f : h.slice(); },
  top(s) { const led = s.table[0].c.s; return hi(s.table.filter(x => x.c.s === led), x => x.c.r).p; },
  act(s, p, a) {
    const c = take(s.hands[p], a.c), led = s.table.length ? s.table[0].c.s : null;
    s.table.push({ c, p });
    if (!s.first && led != null && c.s !== led) { const w = this.top(s); flash(s, 'THULLA! ' + s.names[w] + ' sab uthaye ga'); s.turn = -1; s.pend = { ms: 1700, kind: 'pickup', w }; }
    else if (s.table.length == s.trickN) { s.turn = -1; s.pend = { ms: 1200, kind: 'discard', w: this.top(s) }; }
    else s.turn = nextAct(s, p);
  },
  resolve(s) {
    const pd = s.pend, w = pd.w; s.pend = null;
    if (pd.kind == 'pickup') { s.hands[w].push(...s.table.map(x => x.c)); s.hands[w].sort(bySuit); }
    s.table = []; s.first = false;
    for (let p = 0; p < s.n; p++) if (!s.out[p] && !s.hands[p].length) { s.out[p] = true; s.safe.push(p); flash(s, s.names[p] + ' bach gaya!'); }
    const act = [...Array(s.n).keys()].filter(p => !s.out[p]);
    if (act.length <= 1) {
      const loser = act.length ? act[0] : w; s.turn = -1;
      s.over = { winners: [...Array(s.n).keys()].filter(p => p !== loser), titleWin: 'Bach gaye!', titleLose: 'Thulla lag gaya!', lines: [s.names[loser] + ' haar gaya', 'Bachne ki tarteeb: ' + s.safe.filter(p => p !== loser).map(p => s.names[p]).join(', ')] };
      return;
    }
    s.trickN = act.length; s.turn = s.out[w] ? nextAct(s, w) : w;
  },
  bot(s, p) {
    const L = this.legal(s, p), f = c => c.r, P = c => ({ t: 'play', c: c.id });
    if (!s.table.length) return P(lo(L, f));
    const led = s.table[0].c.s;
    if (L[0].s !== led) return P(hi(L, f));
    const top = Math.max(...s.table.filter(x => x.c.s === led).map(x => x.c.r)), low = L.filter(c => c.r < top);
    if (low.length) return P(hi(low, f));
    return P(s.table.length == s.trickN - 1 ? hi(L, f) : lo(L, f));
  },
  ok(s, p, a) { return a.t == 'play' && this.legal(s, p).some(c => c.id === a.c); },
  human(s, sel, opt, me) {
    const L = new Set(this.legal(s, me).map(c => c.id));
    return { single: true, legal: L, hint: s.first && !s.table.length ? 'Hukm ka ikka phenko' : (s.table.length ? 'Suit follow karo, warna thulla maro' : 'Aap ki chaal'), btns: [{ l: 'Phenko', p: 1, d: sel.length != 1 || !L.has(sel[0].id), a: sel.length ? { t: 'play', c: sel[0].id } : null }] };
  },
  status(s) { return 'Thulla  ·  Bach gaye: ' + (s.safe.length ? s.safe.map(p => s.names[p]).join(', ') : 'koi nahi'); },
  seatInfo(s, p) { return s.out[p] ? 'Bach gaya' : ''; }
};

/* ---------------- PRESIDENT (loser = Gandu) ---------------- */
const pv = c => c.r == 2 ? 15 : c.r;
const byPV = (a, b) => pv(b) - pv(a) || SO[a.s] - SO[b.s];
const President = {
  create(o, prev) {
    const s = base('president', o); s.tableMode = 'row'; dealAll(s, byPV); s.order = []; s.pile = null; s.passes = 0; s.round = (prev ? prev.round : 0) + 1; s.phase = 'play';
    if (prev && prev.order.length == s.n) {
      const pr = prev.order[0], ga = prev.order[s.n - 1]; s.pr = pr; s.ga = ga;
      const c = s.hands[ga].shift(); s.hands[pr].push(c); s.hands[pr].sort(byPV); s.drawn = c.id; s.drawnBy = pr;
      flash(s, s.names[ga] + ' (Gandu) ne ' + cn(c) + ' President ko diya'); s.phase = 'give'; s.turn = pr;
    } else { s.turn = rnd(s.n); flash(s, 'Spinner: ' + s.names[s.turn] + ' shuru kare ga'); }
    return s;
  },
  valid(s, cs) { return cs.length >= 1 && cs.length <= 4 && cs.every(c => c.r == cs[0].r) && (!s.pile || (cs.length == s.pile.n && pv(cs[0]) >= s.pile.v)); },
  act(s, p, a) {
    if (a.t == 'give') { const c = take(s.hands[p], a.c); s.hands[s.ga].push(c); s.hands[s.ga].sort(byPV); s.drawn = c.id; s.drawnBy = s.ga; s.phase = 'play'; s.turn = s.ga; flash(s, 'President ne ek patta Gandu ko diya. ' + s.names[s.ga] + ' ki baari'); return; }
    if (a.t == 'pass') {
      s.passes++; const nx = nextAct(s, p), by = s.pile.by;
      if (nx === by || (s.out[by] && s.passes >= active(s))) { s.pile = null; s.table = []; s.passes = 0; s.turn = s.out[by] ? nextAct(s, by) : by; s.msg = 'Pile saaf, nayi chaal'; }
      else s.turn = nx; return;
    }
    const cs = a.cs.map(id => take(s.hands[p], id));
    s.pile = { n: cs.length, v: pv(cs[0]), by: p }; s.table = cs.map(c => ({ c, p })); s.passes = 0; s.msg = '';
    if (!s.hands[p].length) {
      s.out[p] = true; s.order.push(p); flash(s, s.names[p] + (s.order.length == 1 ? ' President ban gaya!' : ' nikal gaya'));
      if (active(s) == 1) {
        const g = s.out.indexOf(false); s.order.push(g); s.turn = -1;
        s.over = { winners: s.order.slice(0, -1), top: s.order[0], titleTop: 'Aap President!', titleWin: 'Bach gaye!', titleLose: 'Aap Gandu ban gaye!', next: true, lines: s.order.map((q, i) => (i + 1) + '. ' + s.names[q] + (i == 0 ? ' (President)' : i == s.n - 1 ? ' (Gandu)' : '')) };
        return;
      }
    }
    s.turn = nextAct(s, p);
  },
  resolve() {},
  groups(h) { const g = {}; h.forEach(c => (g[pv(c)] = g[pv(c)] || []).push(c)); return Object.values(g).sort((a, b) => pv(a[0]) - pv(b[0])); },
  bot(s, p) {
    const h = s.hands[p], G = this.groups(h);
    if (s.phase == 'give') return { t: 'give', c: G[0][0].id };
    if (!s.pile) return { t: 'play', cs: G[0].map(c => c.id) };
    const ok = G.filter(g => g.length >= s.pile.n && pv(g[0]) >= s.pile.v);
    if (!ok.length) return { t: 'pass' };
    const g = ok.find(x => x.length == s.pile.n) || ok[0];
    if (pv(g[0]) == 15 && h.length > 3 && Math.random() < .4) return { t: 'pass' };
    return { t: 'play', cs: g.slice(0, s.pile.n).map(c => c.id) };
  },
  ok(s, p, a) {
    const h = s.hands[p];
    if (s.phase == 'give') return a.t == 'give' && h.some(c => c.id === a.c);
    if (a.t == 'pass') return !!s.pile;
    if (a.t != 'play' || !Array.isArray(a.cs) || new Set(a.cs).size != a.cs.length) return false;
    const cs = a.cs.map(id => h.find(c => c.id === id)); return cs.every(Boolean) && this.valid(s, cs);
  },
  human(s, sel, opt, me) {
    if (s.phase == 'give') return { single: true, hint: 'Aap President hain: Gandu ko apni marzi ka ek patta do', btns: [{ l: 'Gandu ko do', p: 1, d: sel.length != 1, a: sel.length ? { t: 'give', c: sel[0].id } : null }] };
    return { hint: s.pile ? s.pile.n + ' patte, ' + rl(s.pile.v == 15 ? 2 : s.pile.v) + ' ya us se bare. Ya pass.' : 'Nayi chaal: 1 se 4 same patte', btns: [{ l: 'Phenko', p: 1, d: !this.valid(s, sel), a: { t: 'play', cs: sel.map(c => c.id) } }, { l: 'Pass', d: !s.pile, a: { t: 'pass' } }] };
  },
  status(s) { return 'President  ·  Round ' + s.round + (s.pile ? '  ·  Pile: ' + s.pile.n + ' × ' + rl(s.pile.v == 15 ? 2 : s.pile.v) + ' (' + s.names[s.pile.by] + ')' : '  ·  Nayi chaal'); },
  seatInfo(s, p) { const i = s.order.indexOf(p); return i == 0 ? 'President' : i > 0 ? 'Nikal gaya #' + (i + 1) : ''; }
};

/* ---------------- BLUFF ---------------- */
const Bluff = {
  create(o) { const s = base('bluff', o); s.tableMode = 'row'; s.humans = o.humans || [0]; dealAll(s, byRank); s.pile = []; s.last = null; s.claim = null; s.turn = rnd(s.n); flash(s, 'Spinner: ' + s.names[s.turn] + ' shuru kare ga'); return s; },
  win(s, p) { s.turn = -1; s.over = { winners: [p], titleWin: 'Jeet gaye!', titleLose: s.names[p] + ' jeet gaya', lines: [s.names[p] + ' ke patte sab se pehle khatam'] }; },
  act(s, p, a) {
    const L = s.last;
    if (a.t == 'check') {
      s.pend = null; const truth = L.cs.every(c => c.r == s.claim); s.table = L.cs.map(c => ({ c, p: L.p })); s.turn = -1;
      flash(s, s.names[p] + ': CHECK! ' + (truth ? 'Sach tha, ' + s.names[p] : 'Bluff pakra gaya, ' + s.names[L.p]) + ' pile uthaye ga');
      s.pend = { ms: 2600, kind: 'reveal', truth, checker: p }; return;
    }
    if (a.t == 'pass') {
      const nx = (p + 1) % s.n;
      if (nx === L.p) { s.pile = []; s.last = null; s.claim = null; s.table = []; s.turn = nx; s.msg = 'Sab ne pass kiya, pile saaf'; } else s.turn = nx; return;
    }
    const cs = a.cs.map(id => take(s.hands[p], id)); if (!L) s.claim = a.rank;
    s.pile.push(...cs); s.last = { p, cs }; s.table = cs.map(c => ({ c, p, down: true }));
    s.msg = s.names[p] + ': "' + cs.length + ' × ' + rl(s.claim) + '"'; s.turn = -1; s.pend = { ms: 1900, kind: 'window' };
  },
  resolve(s) {
    const pd = s.pend, L = s.last; s.pend = null;
    if (pd.kind == 'window') {
      const bots = shuffle([...Array(s.n).keys()].filter(q => q !== L.p && !s.humans.includes(q)));
      for (const b of bots) {
        const own = s.hands[b].filter(c => c.r == s.claim).length; let pr = .04;
        if (own + L.cs.length > 4) pr = 1; else { if (!s.hands[L.p].length) pr = .65; else if (own + s.pile.length > 4) pr = .3; if (b == (L.p + 1) % s.n && !own) pr += .1; }
        if (Math.random() < pr) return this.act(s, b, { t: 'check' });
      }
      if (!s.hands[L.p].length) return this.win(s, L.p);
      s.turn = (L.p + 1) % s.n; return;
    }
    const loser = pd.truth ? pd.checker : L.p, lead = pd.truth ? L.p : pd.checker;
    s.hands[loser].push(...s.pile); s.hands[loser].sort(byRank); s.pile = []; s.table = []; s.last = null; s.claim = null; s.msg = '';
    if (pd.truth && !s.hands[L.p].length) return this.win(s, L.p);
    s.turn = lead;
  },
  bot(s, p) {
    const h = s.hands[p], g = {}; h.forEach(c => (g[c.r] = g[c.r] || []).push(c));
    if (!s.last) {
      if (Math.random() < .18 && h.length > 3) return { t: 'play', cs: [h[rnd(h.length)].id], rank: h[rnd(h.length)].r };
      const b = Object.values(g).sort((a, b) => b.length - a.length || a[0].r - b[0].r)[0]; return { t: 'play', cs: b.map(c => c.id), rank: b[0].r };
    }
    const have = g[s.claim] || [];
    if (have.length) return { t: 'play', cs: have.map(c => c.id) };
    if (Math.random() < .5) return { t: 'pass' };
    const junk = Object.values(g).sort((a, b) => a.length - b.length)[0]; return { t: 'play', cs: [junk[0].id] };
  },
  ok(s, p, a) {
    const L = s.last, h = s.hands[p];
    if (a.t == 'check') return !!L && L.p !== p;
    if (a.t == 'pass') return !!L;
    if (a.t != 'play' || !Array.isArray(a.cs) || a.cs.length < 1 || a.cs.length > 4 || new Set(a.cs).size != a.cs.length) return false;
    return a.cs.every(id => h.some(c => c.id === id)) && (!!L || (Number.isInteger(a.rank) && a.rank >= 2 && a.rank <= 14));
  },
  human(s, sel, opt, me) {
    const L = s.last, rank = L ? s.claim : (opt != null ? opt : (sel[0] ? sel[0].r : null)), okSel = sel.length >= 1 && sel.length <= 4;
    const btns = [{ l: okSel ? 'Bolo: ' + sel.length + ' × ' + rl(rank) : 'Patte chuno', p: 1, d: !okSel, a: { t: 'play', cs: sel.map(c => c.id), rank } }];
    if (L) { btns.push({ l: 'Pass', a: { t: 'pass' } }); if (L.p !== me) btns.push({ l: 'Check!', cls: 'warn', a: { t: 'check' } }); }
    const strip = (!L && okSel) ? [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2].map(r => ({ l: rl(r), v: r, on: r == rank })) : null;
    return { hint: L ? 'Rank ' + rl(s.claim) + ' chal raha hai: 1 se 4 patte ulte phenko, pass ya check' : 'Nayi chaal: patte chuno, phir jo rank bolna hai wo chuno', btns, strip };
  },
  status(s) { return 'Bluff  ·  Pile ' + s.pile.length + (s.claim ? '  ·  Rank ' + rl(s.claim) : ''); },
  seatInfo() { return ''; }
};

/* ---------------- DAKETI ---------------- */
const pts = c => c.r == 14 ? 20 : c.r >= 11 ? 10 : 5;
const Daketi = {
  create(o) {
    const s = base('daketi', o); s.tableMode = 'row'; s.deck = shuffle(newDeck()); s.market = s.deck.splice(0, 4); s.table = s.market.map(c => ({ c })); s.col = []; s.lock = []; s.final = null;
    for (let p = 0; p < s.n; p++) { s.hands[p] = s.deck.splice(0, 4).sort(byRank); s.col[p] = []; s.lock[p] = {}; }
    this.begin(s, rnd(s.n)); return s;
  },
  begin(s, p) { s.turn = p; s.drawn = null; if (s.final == null) this.draw(s, p); },
  draw(s, p) { const c = s.deck.pop(); s.hands[p].push(c); s.hands[p].sort(byRank); s.drawn = c.id; s.drawnBy = p; },
  matches(s, p) { const R = new Set(s.market.map(c => c.r)); s.col.forEach((cl, q) => cl.forEach(c => { if (!s.lock[q][c.r]) R.add(c.r); })); return s.hands[p].filter(c => R.has(c.r)); },
  score(s, p) { return s.col[p].reduce((t, c) => t + pts(c), 0); },
  act(s, p, a) {
    s.msg = '';
    if (a.t == 'cap') {
      const c = take(s.hands[p], a.c), got = [c], vic = [];
      s.market = s.market.filter(x => x.r == c.r ? (got.push(x), false) : true);
      for (let q = 0; q < s.n; q++) if (q != p && !s.lock[q][c.r]) s.col[q] = s.col[q].filter(x => x.r == c.r ? (got.push(x), vic.includes(q) || vic.push(q), false) : true);
      s.col[p].push(...got);
      if (s.col[p].filter(x => x.r == c.r).length == 4) { s.lock[p][c.r] = true; flash(s, 'LOCK! ' + s.names[p] + ' ke chaaron ' + rl(c.r)); }
      else if (vic.length) flash(s, 'DAKETI! ' + s.names[p] + ' ne ' + vic.map(q => s.names[q]).join(', ') + ' ke ' + rl(c.r) + ' chura liye');
      else s.msg = s.names[p] + ' ne ' + rl(c.r) + ' utha liya';
      s.table = s.market.map(c => ({ c }));
      if (s.final != null || !s.deck.length) return this.end(s, p);
      this.draw(s, p); return;
    }
    if (a.t == 'disc') { const c = take(s.hands[p], a.c); s.market.push(c); s.table = s.market.map(c => ({ c, p: c === s.market[s.market.length - 1] ? p : undefined })); }
    this.end(s, p);
  },
  end(s, p) {
    if (s.final != null) { if (--s.final == 0) return this.finish(s); }
    else if (!s.deck.length) { s.final = s.n; flash(s, 'Deck khatam! Sab ki ek aakhri baari'); }
    this.begin(s, (p + 1) % s.n);
  },
  finish(s) {
    const sc = s.hands.map((_, p) => this.score(s, p)), mx = Math.max(...sc); s.turn = -1;
    s.over = { winners: sc.map((v, p) => v == mx ? p : -1).filter(p => p >= 0), titleWin: 'Jeet gaye!', titleLose: 'Haar gaye!', lines: sc.map((v, p) => s.names[p] + ': ' + v + ' points' + (v == mx ? ' (winner)' : '')) };
  },
  resolve() {},
  gain(s, p, c) { let t = pts(c); s.market.forEach(x => { if (x.r == c.r) t += pts(x); }); s.col.forEach((cl, q) => { if (q != p && !s.lock[q][c.r]) cl.forEach(x => { if (x.r == c.r) t += 2 * pts(x); }); }); return t; },
  bot(s, p) {
    const m = this.matches(s, p);
    if (m.length) return { t: 'cap', c: hi(m, c => this.gain(s, p, c)).id };
    if (s.final != null) return { t: 'pass' };
    const h = s.hands[p], cnt = c => h.filter(x => x.r == c.r).length;
    return { t: 'disc', c: lo(h, c => pts(c) * 10 + cnt(c) * 30 + Math.random()).id };
  },
  ok(s, p, a) {
    const m = this.matches(s, p);
    if (a.t == 'cap') return m.some(c => c.id === a.c);
    if (a.t == 'disc') return s.final == null && s.hands[p].some(c => c.id === a.c);
    return a.t == 'pass' && s.final != null;
  },
  human(s, sel, opt, me) {
    const m = this.matches(s, me), fin = s.final != null, L = new Set(m.map(c => c.id)), one = sel.length == 1;
    const cap = { l: 'Match / Daketi', p: 1, d: !one || !L.has(sel[0].id), a: sel.length ? { t: 'cap', c: sel[0].id } : null };
    if (fin) return { single: true, legal: L, hint: m.length ? 'Aakhri baari: match lo ya pass karo (sirf ek match)' : 'Aakhri baari: koi match nahi', btns: m.length ? [cap, { l: 'Pass', a: { t: 'pass' } }] : [{ l: 'Pass', p: 1, a: { t: 'pass' } }] };
    const dsc = { l: 'Market mein phenko', p: m.length ? 0 : 1, d: !one, a: sel.length ? { t: 'disc', c: sel[0].id } : null };
    if (m.length) return { single: true, legal: L, hint: 'Match hai (chamakta patta): daketi maro, ya koi bhi patta phenk kar bacha lo', btns: [cap, dsc] };
    return { single: true, hint: 'Koi match nahi: ek patta market mein phenko', btns: [dsc] };
  },
  status(s) { return 'Daketi  ·  Deck ' + s.deck.length + (s.final != null ? '  ·  Aakhri baari' : ''); },
  seatInfo(s, p) {
    const cl = s.col[p], g = {}; cl.forEach(c => g[c.r] = (g[c.r] || 0) + 1);
    if (!cl.length) return '<b>0 patte · 0 pts</b>';
    const top = cl[cl.length - 1];
    const chips = Object.keys(g).sort((a, b) => b - a).map(r => '<em class="' + (s.lock[p][r] ? 'lk' : '') + '">' + rl(+r) + (s.lock[p][r] ? ' 🔒' : '×' + g[r]) + '</em>').join('');
    return '<span class="mini' + (top.s == 1 || top.s == 2 ? ' red' : '') + '">' + rl(top.r) + SUITS[top.s] + '<s>' + (s.lock[p][top.r] ? '🔒' : '×' + g[top.r]) + '</s></span><b class="dk">' + cl.length + ' patte · ' + this.score(s, p) + ' pts</b>' + chips;
  }
};

root.PB = { SUITS, rl, cn, Games: { rung: Rung, band: Rung, thulla: Thulla, president: President, bluff: Bluff, daketi: Daketi } };
})(typeof window !== 'undefined' ? window : globalThis);
