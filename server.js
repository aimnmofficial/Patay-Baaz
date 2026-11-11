/* Pattay Baaz server: holds every game's real state, deals cards, validates moves, sends each phone only its own hand. */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { WebSocketServer } = require('ws');
require('./engine.js');
const { Games } = globalThis.PB;

const PORT = process.env.PORT || 3000;
const BOTS = ['Chacha', 'Bubbly', 'Pappu', 'Guddu', 'Sheeda'];
const PLAYERS = { rung: [3, 4], band: [4], president: [3, 4, 5, 6], thulla: [3, 4, 5, 6], bluff: [3, 4, 5, 6], daketi: [2, 3, 4] };
const rooms = new Map();

const INDEX = path.join(__dirname, 'public', 'index.html');
const server = http.createServer((req, res) => {
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

function view(S, me) {
  const v = Object.assign({}, S);
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
  return { t: 'room', code: room.code, token: pl.token, you: room.players.indexOf(pl), host: room.players[0] === pl, phase: room.S ? 'game' : 'lobby',
    game: room.game, n: room.n, players: room.players.map(p => ({ name: p.name, on: p.on })) };
}
function broadcast(room) {
  room.touched = Date.now();
  room.players.forEach((pl, i) => {
    send(pl.ws, roomMsg(room, pl));
    if (room.S) send(pl.ws, { t: 'state', me: i, s: view(room.S, i) });
  });
}
function step(room) {
  clearTimeout(room.timer); broadcast(room);
  const s = room.S; if (!s || s.over) return;
  if (s.pend) { room.timer = setTimeout(() => safe(room, () => room.G.resolve(s)), s.pend.ms); return; }
  const p = s.turn, pl = room.players[p];
  if (!pl || !pl.on) room.timer = setTimeout(() => safe(room, () => room.G.act(s, p, room.G.bot(s, p))), pl ? 6000 : 750 + Math.random() * 500);
}
function safe(room, fn) { try { fn(); } catch (e) { console.error('game error', room.code, e); } step(room); }
function startGame(room, prev) {
  const n = room.n, names = room.players.map(p => p.name);
  const used = new Set(names); for (const b of BOTS) { if (names.length >= n) break; if (!used.has(b)) names.push(b); }
  room.G = Games[room.game];
  room.S = room.G.create({ n, band: room.game == 'band', names, humans: room.players.map((_, i) => i) }, prev || null);
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
      room = { code: newCode(), players: [], game: 'thulla', n: 4, S: null, G: null, timer: null, touched: Date.now() };
      me = { token: crypto.randomBytes(12).toString('hex'), name: cleanName(m.name), ws, on: true };
      room.players.push(me); rooms.set(room.code, room); return broadcast(room);
    }
    if (m.t == 'join') {
      if (room) return;
      const r = rooms.get(String(m.code || '').toUpperCase().trim());
      if (!r) return err('Yeh room nahi mila. Code dobara check karein.');
      const old = r.players.find(p => p.token === m.token);
      if (old) { if (old.ws && old.ws !== ws) { try { old.ws.close(); } catch (e) {} } old.ws = ws; old.on = true; room = r; me = old; return step(room); }
      if (r.S) return err('Is room mein game chal rahi hai. Round khatam hone par host lobby mein aaye to join karein.');
      if (r.players.length >= r.n) return err('Room bhar gaya hai.');
      let name = cleanName(m.name); while (r.players.some(p => p.name === name)) name = name.slice(0, 10) + (2 + crypto.randomInt(8));
      room = r; me = { token: crypto.randomBytes(12).toString('hex'), name, ws, on: true };
      room.players.push(me); return broadcast(room);
    }
    if (!room || !me) return;
    const host = room.players[0] === me, seat = room.players.indexOf(me), s = room.S;
    if (m.t == 'cfg' && host && !s) {
      if (PLAYERS[m.game]) room.game = m.game;
      const ok = PLAYERS[room.game].filter(x => x >= room.players.length);
      if (!ok.length) { room.game = 'thulla'; }
      const ok2 = PLAYERS[room.game].filter(x => x >= room.players.length);
      room.n = ok2.includes(m.n) ? m.n : (ok2.includes(room.n) ? room.n : ok2[ok2.length > 1 && ok2.includes(4) ? ok2.indexOf(4) : 0]);
      return broadcast(room);
    }
    if (m.t == 'shuffle' && host && !s) { const rest = room.players.slice(1); for (let i = rest.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [rest[i], rest[j]] = [rest[j], rest[i]]; } if (rest.length > 1 && m.rot) rest.push(rest.shift()); room.players = [me].concat(rest); return broadcast(room); }
    if (m.t == 'start' && host && !s) { if (room.players.length > room.n) return err('Players zyada hain, player count barhayein.'); return startGame(room); }
    if (m.t == 'next' && s && s.over) return startGame(room, s.over.next ? s : null);
    if (m.t == 'lobby' && host && s && s.over) { clearTimeout(room.timer); room.S = null; return broadcast(room); }
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
    room = null; me = null;
    if (!r.players.length) { clearTimeout(r.timer); rooms.delete(r.code); return; }
    step(r);
  }
  ws.on('close', () => { if (me && me.ws === ws) drop(false); });
});

setInterval(() => { wss.clients.forEach(ws => { if (!ws.alive) return ws.terminate(); ws.alive = false; ws.ping(); }); }, 25000);
setInterval(() => { const now = Date.now(); for (const [c, r] of rooms) if (now - r.touched > 60 * 60 * 1000 && !r.players.some(p => p.on)) { clearTimeout(r.timer); rooms.delete(c); } }, 5 * 60 * 1000);
server.listen(PORT, () => console.log('Pattay Baaz on port ' + PORT));
