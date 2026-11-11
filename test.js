require('./engine.js');
const { Games } = globalThis.PB;
const cfg = [['rung', 4, {}], ['rung', 3, {}], ['band', 4, { band: true }], ['thulla', 3, {}], ['thulla', 4, {}], ['thulla', 6, {}], ['president', 3, {}], ['president', 5, {}], ['bluff', 3, {}], ['bluff', 6, {}], ['daketi', 2, {}], ['daketi', 4, {}]];
const count = s => {
  let t = s.hands.reduce((a, h) => a + h.length, 0);
  return t;
};
for (const [g, n, extra] of cfg) {
  const G = Games[g]; let steps = 0, games = 0, maxSteps = 0, wins0 = 0, kots = 0, prev = null;
  for (let i = 0; i < 1500; i++) {
    const o = Object.assign({ n, names: ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, n), humans: [] }, extra);
    let s = G.create(o, (g == 'rung' || g == 'band' || g == 'president') ? prev : null), k = 0;
    while (!s.over) {
      if (++k > 20000) throw new Error(g + ' stuck n=' + n + ' turn=' + s.turn);
      if (s.pend) { G.resolve(s); continue; }
      const p = s.turn; if (p < 0 || p >= n) throw new Error(g + ' bad turn ' + p);
      const a = G.bot(s, p);
      if (a.t == 'play' && a.c != null && G.legal) { if (!G.legal(s, p).some(c => c.id === a.c)) throw new Error(g + ' illegal'); }
      if (g == 'president' && a.t == 'play' && !G.valid(s, a.cs.map(id => s.hands[p].find(c => c.id === id)))) throw new Error('pres invalid');
      if (!G.ok(s, p, a)) throw new Error(g + ' ok() rejected bot move ' + JSON.stringify(a)); G.act(s, p, a);
      if (g == 'daketi') { const t = count(s) + s.deck.length + s.market.length + s.col.reduce((a, c) => a + c.length, 0); if (t != 52) throw new Error('daketi cards ' + t); }
      if (g == 'bluff' && !s.over) { const t = count(s) + s.pile.length; if (t > 52) throw new Error('bluff cards ' + t); }
    }
    if ((g == 'rung' || g == 'band')) { const tot = s.sar.reduce((a, b) => a + b, 0); if (tot + s.pile > s.T || tot < 1) throw new Error('sar total ' + tot); if (s.over.lines.join().includes('KOT')) kots++; }
    if (s.over.winners.includes(0)) wins0++; maxSteps = Math.max(maxSteps, k); steps += k; games++; prev = s;
  }
  console.log(g, 'n=' + n, 'ok', games, 'avgSteps', (steps / games) | 0, 'max', maxSteps, 'seat0 wins', wins0, kots ? 'kots ' + kots : '');
}
