/* Pattay Baaz server: holds every game's real state, deals cards, validates moves, sends each phone only its own hand. */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { WebSocketServer } = require('ws');
require('./engine.js');
const { Games } = globalThis.PB;

const PORT = process.env.PORT || 3000;
const TURN_MS = +process.env.TURN_MS || 30000;
const BOTS = ['Chacha', 'Bubbly', 'Pappu', 'Guddu', 'Sheeda'];
const PLAYERS = { rung: [3, 4], band: [4], president: [3, 4, 5, 6], thulla: [3, 4, 5, 6], bluff: [3, 4, 5, 6], daketi: [2, 3, 4] };
const rooms = new Map();
const TEAMGAME = room => (room.game == 'rung' || room.game == 'band') && room.n == 4;

/* global leaderboard (saved to a json file; on Render free plan it resets when the service redeploys) */
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data'), LBF = path.join(DATA, 'lb.json');
let LB = {}; try { LB = JSON.parse(fs.readFileSync(LBF, 'utf8')); } catch (e) {}
let lbT = null;
function lbAdd(name, win) {
  const k = name.toLowerCase(), e = LB[k] || (LB[k] = { name, played: 0, wins: 0 }); e.name = name; e.played++; if (win) e.wins++;
  if (!lbT) lbT = setTimeout(() => { lbT = null; try { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(LBF, JSON.stringify(LB)); } catch (x) {} }, 4000);
}
const lbTop = () => Object.values(LB).sort((a, b) => b.wins - a.wins || a.played - b.played).slice(0, 30);
const byWins = o => Object.keys(o).map(k => Object.assign({ name: k }, o[k])).sort((a, b) => b.wins - a.wins || a.played - b.played);
function record(room) {
  const s = room.S; if (!s || !s.over || s.counted) return; s.counted = true;
  const st = room.stats, W = s.over.winners; st.rounds++; st.byGame[room.game] = (st.byGame[room.game] || 0) + 1;
  room.players.forEach((pl, i) => { if (pl.bot) return; const e = st.p[pl.name] || (st.p[pl.name] = { played: 0, wins: 0 }); e.played++; const w = W.includes(i); if (w) e.wins++; lbAdd(pl.name, w); });
  if (TEAMGAME(room)) [[0, 2], [1, 3]].forEach(t => { const k = t.map(i => s.names[i]).join(' + '), e = st.pairs[k] || (st.pairs[k] = { played: 0, wins: 0 }); e.played++; if (W.includes(t[0])) e.wins++; });
}


const INDEX = path.join(__dirname, 'public', 'index.html');
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/lb')) { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-cache' }); return res.end(JSON.stringify(lbTop())); }
  if (req.url.startsWith('/sounds/')) {
    const f = path.basename(decodeURIComponent(req.url.split('?')[0]));
    if (!/^[\w-]+\.mp3$/.test(f)) { res.writeHead(404); return res.end(); }
    return fs.readFile(path.join(__dirname, 'public', 'sounds', f), (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=3600' }); res.end(b); });
  }
  if (req.url.startsWith('/health')) { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  fs.readFile(INDEX, (e, buf) => {
    if (e) { res.writeHead(500); return res.end('index missing'); }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' }); res.end(buf);
  });
});
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });

const newCode = () => { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ'; let c; do c = Array.from({ length: 4 }, () => A[crypto.randomInt(A.length)]).join(''); while (rooms.has(c)); return c; };
const cleanName = n => String(n || '').replace(/[<>&"']/g, '').trim().slice(0, 12) || 'Khiladi';
const send = (ws, m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };

function view(S, me, tl) {
  const v = Object.assign({}, S); v.tl = tl == null ? null : tl;
  v.hands = S.hands.map((h, p) => p === me ? h : { length: h.length });
  if (S.deck) v.deck = { length: S.deck.length };
  delete v.rest;
  if (S.g == 'bluff') {
    v.pile = { length: S.pile.length }; if (S.last) v.last = { p: S.last.p };
    v.table = S.table.map((it, i) => it.down ? { c: { id: 1000 + S.pile.length * 10 + i }, p: it.p, down: true } : it);
  }
  if (S.drawnBy !== me) v.drawn = null;
  return v;
}
function roomMsg(room, pl) {
  return { t: 'room', code: room.code, token: pl.token, you: room.players.indexOf(pl), host: !!pl.host, teamMode: TEAMGAME(room), phase: room.S ? 'game' : 'lobby',
    game: room.game, n: room.n, players: room.players.map(p => ({ name: p.name, on: p.on, host: !!p.host, bot: !!p.bot, team: p.team == null ? null : p.team })),
    stats: { rounds: room.stats.rounds, players: byWins(room.stats.p), pairs: byWins(room.stats.pairs), byGame: room.stats.byGame } };
}
function broadcast(room) {
  room.touched = Date.now();
  room.players.forEach((pl, i) => {
    send(pl.ws, roomMsg(room, pl));
    if (room.S) send(pl.ws, { t: 'state', me: i, s: view(room.S, i, room.tl) });
  });
}
function step(room) {
  clearTimeout(room.timer);
  const s = room.S; room.tl = null; record(room);
  let waitHuman = null;
  if (s && !s.over && !s.pend) { const pl = room.players[s.turn]; if (pl && pl.on) { waitHuman = s.turn; room.tl = TURN_MS; } }
  broadcast(room);
  if (!s || s.over) return;
  if (s.pend) { room.timer = setTimeout(() => safe(room, () => room.G.resolve(s)), s.pend.ms); return; }
  const p = s.turn, pl = room.players[p];
  if (waitHuman != null) { room.timer = setTimeout(() => safe(room, () => { if (room.S === s && !s.over && !s.pend && s.turn === p) { room.G.act(s, p, room.G.bot(s, p)); } }), TURN_MS); return; }
  room.timer = setTimeout(() => safe(room, () => room.G.act(s, p, room.G.bot(s, p))), !pl || !pl.on ? (pl && !pl.bot ? 6000 : 750 + Math.random() * 500) : 750);
}
function safe(room, fn) { try { fn(); } catch (e) { console.error('game error', room.code, e); } step(room); }
function seatTeams(room) {
  room.players = room.players.filter(p => !p.bot);
  if (!TEAMGAME(room)) return;
  const H = room.players, A = H.filter(p => p.team === 0), B = H.filter(p => p.team === 1);
  H.filter(p => p.team !== 0 && p.team !== 1).forEach(p => (A.length < 2 && (A.length <= B.length || B.length >= 2) ? A : B).push(p));
  while (A.length > 2) B.push(A.pop());
  const used = new Set(H.map(p => p.name)), bot = () => { const n = BOTS.find(x => !used.has(x)) || 'Bot' + used.size; used.add(n); return { bot: true, on: false, ws: null, token: '', name: n, host: false }; };
  const out = [A[0] || bot(), B[0] || bot(), A[1] || bot(), B[1] || bot()];
  out.forEach((p, i) => { if (!p.bot) p.team = i % 2; });
  room.players = out;
}
function startGame(room, prev) {
  if (!room.S) seatTeams(room);
  const n = room.n, names = room.players.map(p => p.name);
  const used = new Set(names); for (const b of BOTS) { if (names.length >= n) break; if (!used.has(b)) names.push(b); }
  room.G = Games[room.game];
  room.S = room.G.create({ n, band: room.game == 'band', names, humans: room.players.map((p, i) => p.bot ? -1 : i).filter(i => i >= 0) }, prev || null);
  step(room);
}

wss.on('connection', ws => {
  let room = null, me = null;
  ws.alive = true; ws.on('pong', () => ws.alive = true);
  const err = m => send(ws, { t: 'err', m });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t != 'string') return;
    if (m.t == 'create') {
      if (room) return;
      room = { code: newCode(), players: [], game: 'thulla', n: 4, S: null, G: null, timer: null, touched: Date.now(), stats: { rounds: 0, p: {}, pairs: {}, byGame: {} } };
      me = { token: crypto.randomBytes(12).toString('hex'), name: cleanName(m.name), ws, on: true, host: true, team: null };
      room.players.push(me); rooms.set(room.code, room); return broadcast(room);
    }
    if (m.t == 'join') {
      if (room) return;
      const r = rooms.get(String(m.code || '').toUpperCase().trim());
      if (!r) return err('Yeh room nahi mila. Code dobara check karein.');
      const nm = cleanName(m.name).toLowerCase();
      const old = r.players.find(p => !p.bot && (p.token === m.token || (r.S && !p.on && p.name.toLowerCase() === nm)));
      if (old) {
        if (!r.players.some(p => p.host && p.on && p !== old)) { r.players.forEach(p => p.host = false); old.host = true; } if (old.ws && old.ws !== ws) { try { old.ws.close(); } catch (e) {} } old.ws = ws; old.on = true; room = r; me = old; return step(room); }
      if (r.S) return err('Is room mein game chal rahi hai. Wapas aana ho to wohi naam likhein jo pehle tha (aur wo abhi online na ho).');
      if (r.players.length >= r.n) return err('Room bhar gaya hai.');
      let name = cleanName(m.name); while (r.players.some(p => p.name === name)) name = name.slice(0, 10) + (2 + crypto.randomInt(8));
      room = r; me = { token: crypto.randomBytes(12).toString('hex'), name, ws, on: true, host: false, team: null };
      room.players.push(me); return broadcast(room);
    }
    if (!room || !me) return;
    const host = !!me.host, seat = room.players.indexOf(me), s = room.S;
    if (m.t == 'cfg' && host && !s) {
      if (PLAYERS[m.game]) room.game = m.game;
      const ok = PLAYERS[room.game].filter(x => x >= room.players.length);
      if (!ok.length) { room.game = 'thulla'; }
      const ok2 = PLAYERS[room.game].filter(x => x >= room.players.length);
      room.n = ok2.includes(m.n) ? m.n : (ok2.includes(room.n) ? room.n : ok2[ok2.length > 1 && ok2.includes(4) ? ok2.indexOf(4) : 0]);
      return broadcast(room);
    }
    if (m.t == 'team' && !s && TEAMGAME(room)) {
      const t = m.team === 0 || m.team === 1 ? m.team : null;
      if (t != null && room.players.filter(p => p !== me && p.team === t).length >= 2) return err('Yeh team bhar gayi hai (2 players).');
      me.team = t; return broadcast(room);
    }
    if (m.t == 'shuffle' && host && !s) {
      const hs = room.players.filter(p => !p.bot);
      for (let i = hs.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [hs[i], hs[j]] = [hs[j], hs[i]]; }
      if (TEAMGAME(room)) hs.forEach((p, i) => p.team = i % 2);
      else { const rest = hs.filter(p => p !== me); room.players = [me].concat(rest); }
      return broadcast(room);
    }
    if (m.t == 'start' && host && !s) { if (room.players.length > room.n) return err('Players zyada hain, player count barhayein.'); return startGame(room); }
    if (m.t == 'next' && s && s.over) return startGame(room, s.over.next ? s : null);
    if (m.t == 'lobby' && host && s && s.over) { clearTimeout(room.timer); room.S = null; room.players = room.players.filter(p => !p.bot); return broadcast(room); }
    if (m.t == 'leave') { drop(true); return; }
    if (m.t == 'act' && s && !s.over && m.a && typeof m.a == 'object') {
      const a = m.a, G = room.G;
      try {
        if (s.pend) { if (s.g == 'bluff' && s.pend.kind == 'window' && a.t == 'check' && G.ok(s, seat, a)) { clearTimeout(room.timer); G.act(s, seat, a); step(room); } return; }
        if (s.turn !== seat || !G.ok(s, seat, a)) return err('Yeh chaal abhi nahi chal sakti.');
        G.act(s, seat, a);
      } catch (e) { console.error('act error', e); }
      step(room);
    }
  });
  function drop(leave) {
    if (!room || !me) return;
    const r = room; me.on = false; me.ws = null;
    if (leave && !r.S) { r.players = r.players.filter(p => p !== me); }
    if (me.host) { const nh = r.players.find(p => !p.bot && p.on && p !== me); if (nh) { me.host = false; nh.host = true; } }
    room = null; me = null;
    if (!r.players.filter(p => !p.bot).length) { clearTimeout(r.timer); rooms.delete(r.code); return; }
    step(r);
  }
  ws.on('close', () => { if (me && me.ws === ws) drop(false); });
});

setInterval(() => { wss.clients.forEach(ws => { if (!ws.alive) return ws.terminate(); ws.alive = false; ws.ping(); }); }, 25000);
setInterval(() => { const now = Date.now(); for (const [c, r] of rooms) if (now - r.touched > 60 * 60 * 1000 && !r.players.some(p => p.on)) { clearTimeout(r.timer); rooms.delete(c); } }, 5 * 60 * 1000);
server.listen(PORT, () => console.log('Pattay Baaz on port ' + PORT));
