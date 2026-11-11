(function () {
const { SUITS, rl, Games } = window.PB;
const $ = id => document.getElementById(id);
const BOTS = ['Chacha', 'Bubbly', 'Pappu', 'Guddu', 'Sheeda'];
const INFO = {
  rung: { name: 'Rung', tag: 'Court Piece, double sar', icon: '♠', col: '#f4c542', players: [4, 3], def: 4,
    rules: ['4 player: 2 teams, partner saamne. 3 player: sab alag, ek 2 deck se nikalta hai.', 'Pehle 5 patte, phir rung chuno (ya "aakhri patta").', 'Suit follow karna zaroori. Rung sab se upar.', 'Sar beech mein jama hoti hain. Jo player 2 hath lagatar khud jeete (5wen hath se, 3 player mein 7wen se) wo saari utha leta hai.', 'Ace se jeet kar agle hath phir Ace phenko to wo 2 ginta hai (aakhri hath ke ilawa).', '7 sar = jeet (3 player mein 9). 13-0 = Kot.'] },
  band: { name: 'Band Rung', tag: 'Rung chupa hua', icon: '♥', col: '#ff6b6b', players: [4], def: 4,
    rules: ['Saare 13 patte baant diye jate hain, rung koi nahi.', 'Jis ke paas chalti suit na ho, wo jo patta phenke us ki suit rung ban jati hai.', 'Rung rakhne ke baad hi sar uthai ja sakti hai: senior ho kar agla hath bhi khud jeeto.', 'Baqi sab Rung jaisa: Ace rule, 7 sar jeet, 13-0 kot.'] },
  president: { name: 'President', tag: 'Haarne wala Gandu', icon: '♦', col: '#4dd0e1', players: [3, 4, 5, 6], def: 4,
    rules: ['2 sab se bara, phir A, K ... 3 sab se chhota.', '1 se 4 same patte phenko. Agla utne hi patte, barabar ya bare, ya pass.', 'Sab pass kar dein to pile saaf, aakhri phenkne wala nayi chaal chalta hai.', 'Pehle khatam = President. Aakhri = Gandu.', 'Agle round: Gandu apna sab se bara patta President ko deta hai, President marzi ka ek patta wapas. Gandu pehle khelta hai.'] },
  thulla: { name: 'Thulla', tag: 'Bhaago, warna uthao', icon: '♣', col: '#81c784', players: [3, 4, 5, 6], def: 4,
    rules: ['Hukm ka ikka wala shuru karta hai. Pehle hath mein thulla nahi.', 'Suit follow karo. Sab follow karein to patte discard, bara patta agli chaal.', 'Suit na ho to koi bhi patta maro: THULLA. Chalti suit ka sab se bara patta wala sab uthata hai.', 'Jis ke patte khatam wo bach gaya. Aakhri bacha hua haar gaya.'] },
  bluff: { name: 'Bluff', tag: 'Jhoot bolo, pakre mat jao', icon: '♠', col: '#ba68c8', players: [3, 4, 5, 6], def: 4,
    rules: ['Patte ulte phenko aur rank bolo, jaise "2 × A". Sach ya jhoot, aap ki marzi.', 'Agle usi rank par 1 se 4 patte aur phenkte hain, ya pass.', 'Koi bhi CHECK bol sakta hai. Jhoot nikla to phenkne wala pile uthata hai, sach nikla to check wala.', 'Jo sacha sabit ho us ki agli baari. Sab pass kar dein to pile saaf.', 'Jis ke patte pehle khatam wo jeeta.'] },
  daketi: { name: 'Daketi', tag: 'Match karo, chura lo', icon: '♦', col: '#ffb74d', players: [2, 3, 4], def: 4,
    rules: ['Har baari 1 patta deck se. Haath ka patta same rank se match karo: market, opponents ya apni collection.', 'Match par us rank ke saare khule patte (market + sab opponents) aap ke. Phir ek aur patta uthao.', 'Match na ho to ek patta market mein phenko.', '4 same rank = LOCK, koi nahi chura sakta.', '2-10: 5 pts, J Q K: 10, A: 20. Deck khatam par sab ki ek aakhri baari.'] }
};
let G, S, opts, gid, me = 0, runTok = 0, sel = new Set(), ui = { opt: null }, H = null, inputRes = null, spd = 1, lastFid = -1, tEls = new Map(), hEls = new Map(), snd = true, AC;
let online = false, ws = null, room = null, wantRoom = null, retry = 0, pendT = null, overT = null;
const LS = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} } };
snd = LS.get('pb_snd') !== '0'; spd = +LS.get('pb_spd') || 1;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = t => String(t).replace(/[<>&"]/g, '');
function beep(f, d, v) { if (!snd) return; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const o = AC.createOscillator(), g = AC.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.value = v || .06; o.connect(g); g.connect(AC.destination); o.start(); g.gain.exponentialRampToValueAtTime(.001, AC.currentTime + d); o.stop(AC.currentTime + d); } catch (e) {} }
function toast(t) { const e = $('toast'); e.textContent = t; e.classList.remove('go'); void e.offsetWidth; e.classList.add('go'); }
function show(id) { ['home', 'game', 'lobby'].forEach(x => $(x).hidden = x != id); }

/* ---------- home + solo setup ---------- */
function home() {
  runTok++; online = false; show('home'); closeModal();
  $('tiles').innerHTML = Object.keys(INFO).map(k => { const i = INFO[k]; return `<button class="tile" data-g="${k}" style="--c:${i.col}"><span class="ti">${i.icon}︎</span><span class="tn">${i.name}</span><span class="tt">${i.tag}</span><span class="tp">${i.players.length > 1 ? Math.min(...i.players) + '-' + Math.max(...i.players) : i.players[0]} players</span></button>`; }).join('');
}
function setup(k) {
  const i = INFO[k]; let n = i.def;
  const draw = () => modal(`<h2 style="color:${i.col}">${i.name}</h2><p class="sub">${i.tag} · bots ke saath practice</p>
    <div class="lab">Kitne players (aap + bots)</div><div class="chips">${i.players.map(p => `<button class="chip ${p == n ? 'on' : ''}" data-n="${p}">${p}</button>`).join('')}</div>
    <div class="lab">Bot ki speed</div><div class="chips"><button class="chip ${spd == 1 ? 'on' : ''}" data-s="1">Normal</button><button class="chip ${spd != 1 ? 'on' : ''}" data-s="0.55">Tez</button></div>
    <ul class="rules">${i.rules.map(r => '<li>' + r + '</li>').join('')}</ul>
    <button class="big" id="go">Khelo</button>`, e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.n) { n = +t.dataset.n; draw(); } else if (t.dataset.s) { spd = +t.dataset.s; LS.set('pb_spd', spd); draw(); } else if (t.id == 'go') { closeModal(); start(k, n); }
    });
  draw();
}
function modal(html, onclick) { const m = $('modal'); m.innerHTML = '<div class="sheet"><button class="x" id="mx">✕</button>' + html + '</div>'; m.hidden = false; m.onclick = e => { if (e.target === m || e.target.id == 'mx') return closeModal(); onclick && onclick(e); }; }
function closeModal() { $('modal').hidden = true; $('modal').innerHTML = ''; }
function resetTable() { sel.clear(); ui.opt = null; lastFid = -1; tEls.forEach(e => e.remove()); tEls.clear(); hEls.forEach(e => e.remove()); hEls.clear(); $('over').hidden = true; }

/* ---------- solo loop ---------- */
function start(k, n, prev) {
  online = false; me = 0; gid = k; G = Games[k]; opts = { n, band: k == 'band', names: ['Aap'].concat(BOTS.slice(0, n - 1)), humans: [0] };
  S = G.create(opts, prev || null);
  resetTable(); show('game'); $('gname').textContent = INFO[k].name;
  loop(++runTok);
}
async function loop(tok) {
  while (tok === runTok) {
    render();
    if (S.over) { await sleep(700); if (tok === runTok) showOver(); return; }
    if (S.pend) {
      const a = await waitPend(S.pend); inputRes = null; if (tok !== runTok) return;
      if (a) G.act(S, 0, a); else G.resolve(S); continue;
    }
    const p = S.turn; let a;
    if (p === 0) { beep(660, .12, .04); a = await new Promise(r => inputRes = r); inputRes = null; }
    else { await sleep((650 + Math.random() * 450) * spd); if (tok !== runTok) return; a = G.bot(S, p); }
    if (tok !== runTok) return;
    G.act(S, p, a); sel.clear(); ui.opt = null; beep(a.t == 'pass' ? 200 : 340, .07);
  }
}
function waitPend(pd) {
  return new Promise(res => {
    let done = false; const ms = pd.ms * (spd == 1 ? 1 : .7), coll = ['trick', 'pickup', 'discard'].includes(pd.kind);
    inputRes = a => { if (!done) { done = true; res(a); } };
    if (coll) setTimeout(() => { if (!done) collect(pd); }, Math.max(0, ms - 430));
    setTimeout(() => { if (!done) { done = true; res(null); } }, ms);
  });
}
function submit(a) {
  if (!a) return;
  if (online) { wsSend({ t: 'act', a }); sel.clear(); ui.opt = null; H = null; $('btns').innerHTML = ''; return; }
  if (inputRes) { const r = inputRes; inputRes = null; r(a); }
}

/* ---------- online ---------- */
function wsSend(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }
function connect(first) {
  if (!/^https?:$/.test(location.protocol)) return toast('Online sirf hosted link par chalta hai');
  let sock;
  try { sock = new WebSocket((location.protocol == 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); } catch (e) { return toast('Online sirf hosted link par chalta hai'); }
  ws = sock; let opened = false;
  sock.onopen = () => { opened = true; retry = 0; first && first(); };
  sock.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } onMsg(m); };
  sock.onclose = () => {
    if (ws !== sock) return; ws = null;
    if (!opened) return toast('Server se rabta nahi hua. Yeh link online mode support nahi karta ya server so raha hai, dobara koshish karein.');
    if (wantRoom && retry < 20) { retry++; toast('Rabta toot gaya, dobara jor raha hun…'); setTimeout(() => connect(() => wsSend({ t: 'join', code: wantRoom, token: LS.get('pb_tok'), name: LS.get('pb_name') })), 1200); }
  };
}
function leaveRoom() { wantRoom = null; LS.set('pb_room', null); wsSend({ t: 'leave' }); const s = ws; ws = null; if (s) try { s.close(); } catch (e) {} room = null; clearTimeout(pendT); clearTimeout(overT); home(); }
function onMsg(m) {
  if (m.t == 'err') { toast(m.m); if (!room) { wantRoom = null; LS.set('pb_room', null); } return; }
  if (m.t == 'room') {
    room = m; wantRoom = m.code; LS.set('pb_room', m.code); LS.set('pb_tok', m.token); closeModal();
    if (m.phase == 'lobby') { online = true; runTok++; clearTimeout(pendT); clearTimeout(overT); S = null; renderLobby(); show('lobby'); }
    return;
  }
  if (m.t == 'state') {
    const fresh = !online || $('game').hidden || !S || S.g !== m.s.g;
    online = true; runTok++; me = m.me; S = m.s; gid = S.g; G = Games[gid]; opts = { n: S.n };
    if (fresh) { resetTable(); show('game'); $('gname').textContent = INFO[gid].name + ' · ' + room.code; }
    clearTimeout(pendT); clearTimeout(overT);
    if (!S.over) $('over').hidden = true;
    render();
    if (S.turn === me && !S.pend && !S.over) beep(660, .12, .04);
    if (S.pend && ['trick', 'pickup', 'discard'].includes(S.pend.kind)) { const pd = S.pend; pendT = setTimeout(() => collect(pd), Math.max(0, pd.ms - 430)); }
    if (S.over) overT = setTimeout(showOver, 700);
  }
}
function onlineSheet() {
  const nm = esc(LS.get('pb_name') || ''), pre = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
  modal(`<h2 style="color:#ffd866">Doston ke saath</h2><p class="sub">Har dost apne phone se. Khaali seat par bot.</p>
    <div class="lab">Aap ka naam</div><input id="nm" maxlength="12" placeholder="Naam" value="${nm}">
    <button class="big" id="mk">Naya room banao</button>
    <div class="lab" style="margin-top:16px">Ya dost ka room code daalo</div>
    <div class="row"><input id="cd" maxlength="4" placeholder="CODE" value="${esc(pre)}" style="text-transform:uppercase;letter-spacing:6px;text-align:center"><button class="big" id="jn" style="margin:0;width:44%">Join</button></div>`, e => {
      const id = e.target.id; if (id != 'mk' && id != 'jn') return;
      const name = $('nm').value.trim(); if (!name) return toast('Pehle naam likhein');
      LS.set('pb_name', name);
      if (id == 'mk') connect(() => wsSend({ t: 'create', name }));
      else { const code = $('cd').value.trim().toUpperCase(); if (code.length != 4) return toast('4 letter ka code daalein'); connect(() => wsSend({ t: 'join', code, name, token: LS.get('pb_tok') })); }
    });
}
function renderLobby() {
  const r = room, i = INFO[r.game], link = location.origin + location.pathname + '?room=' + r.code;
  let seats = '';
  for (let k = 0; k < r.n; k++) { const p = r.players[k], team = (r.game == 'rung' || r.game == 'band') && r.n == 4 ? '<em class="tm t' + (k % 2) + '">Team ' + 'AB'[k % 2] + '</em>' : ''; seats += `<div class="ls ${p ? '' : 'bot'}"><span class="av">${p ? esc(p.name[0]) : '🤖'}</span><span>${p ? esc(p.name) + (k == r.you ? ' (aap)' : '') + (k == 0 ? ' · host' : '') + (p.on ? '' : ' · offline') : 'Bot'}</span>${team}</div>`; }
  $('lobby').innerHTML = `<header><button id="lback">←</button><div class="hd"><div id="gname2">Room</div></div></header>
    <div class="lwrap"><div class="code">${r.code}</div><p class="sub" style="text-align:center">Doston ko yeh code ya link bhejein</p>
    <button class="ghost" id="cplink" style="margin:0 0 8px">Link copy karo</button>
    <div class="lab">Players (${r.players.length}/${r.n})</div>${seats}
    ${r.host ? `<div class="lab">Game</div><div class="chips">${Object.keys(INFO).map(k => `<button class="chip ${k == r.game ? 'on' : ''}" data-g="${k}">${INFO[k].name}</button>`).join('')}</div>
      <div class="lab">Kitne players (khaali seat par bot)</div><div class="chips">${i.players.slice().sort().map(p => `<button class="chip ${p == r.n ? 'on' : ''}" data-n="${p}" ${p < r.players.length ? 'disabled' : ''}>${p}</button>`).join('')}</div>
      ${r.players.length > 2 ? '<button class="ghost" id="shuf">Seats badlo (teams shuffle)</button>' : ''}
      <button class="big" id="lgo">${i.name} shuru karo</button>` : `<p class="wait">Game: <b style="color:${i.col}">${i.name}</b> · Host shuru kare ga, intezar karein…</p>`}
    </div>`;
  $('lobby').onclick = e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.id == 'lback') return leaveRoom();
    if (t.id == 'cplink') { try { navigator.clipboard.writeText(link).then(() => toast('Link copy ho gaya'), () => toast(link)); } catch (x) { toast(link); } return; }
    if (t.dataset.g) return wsSend({ t: 'cfg', game: t.dataset.g, n: r.n });
    if (t.dataset.n) return wsSend({ t: 'cfg', game: r.game, n: +t.dataset.n });
    if (t.id == 'shuf') return wsSend({ t: 'shuffle', rot: 1 });
    if (t.id == 'lgo') return wsSend({ t: 'start' });
  };
}

/* ---------- rendering ---------- */
const dir = p => { const a = 2 * Math.PI * ((p - me + S.n) % S.n) / S.n; return [Math.sin(a), Math.cos(a)]; };
function cardEl(c, down) { const d = document.createElement('div'); d.className = 'card' + (down ? ' back' : (c.s == 1 || c.s == 2 ? ' red' : '')); if (!down) d.innerHTML = `<i>${rl(c.r)}<br>${SUITS[c.s]}</i><b>${SUITS[c.s]}</b>`; return d; }
function render() {
  const n = S.n, my = S.turn === me && !S.pend && !S.over, hand = S.hands[me];
  $('status').textContent = G.status(S, me);
  let h = '';
  for (let k = 1; k < n; k++) {
    const p = (me + k) % n, [sx, sy] = dir(p);
    h += `<div class="seat ${S.turn === p ? 'turn' : ''} ${S.out[p] ? 'outp' : ''}" style="left:${50 + 39 * sx}%;top:${49 + 37 * sy}%"><div class="av">${esc(S.names[p][0])}<span class="cnt">${S.hands[p].length}</span></div><div class="nm">${esc(S.names[p])}${S.turn === p ? ' · BAARI' : ''}</div><div class="inf">${G.seatInfo(S, p, me) || ''}</div></div>`;
  }
  $('seats').innerHTML = h;
  const tb = $('table'), tw = tb.clientWidth, th = tb.clientHeight, ct = $('center'), keys = new Set();
  ct.className = S.tableMode + (S.table.length > 8 ? ' many' : '');
  S.table.forEach((it, i) => {
    const k = it.c.id + (it.down ? 'd' : 'u'); keys.add(k); let el = tEls.get(k);
    if (!el) {
      el = cardEl(it.c, it.down); el.classList.add('tc'); if (it.low) el.classList.add('low');
      const [sx, sy] = it.p != null ? dir(it.p) : [0, 0];
      el.style.setProperty('--dx', sx * tw * .34 + 'px'); el.style.setProperty('--dy', sy * th * .32 + 'px');
      if (tEls.has(it.c.id + (it.down ? 'u' : 'd'))) el.classList.add('flip'); else if (it.p == null) el.classList.add('pop');
      ct.appendChild(el); tEls.set(k, el);
    }
    if (S.tableMode == 'trick') { const [sx, sy] = dir(it.p); el.style.left = 50 + 17 * sx + '%'; el.style.top = 46 + 16 * sy + '%'; el.style.zIndex = i; el.style.order = ''; }
    else { el.style.left = el.style.top = ''; el.style.order = i; }
  });
  for (const [k, el] of tEls) if (!keys.has(k)) { el.remove(); tEls.delete(k); }
  const bd = $('badge');
  if (gid == 'rung' || gid == 'band') {
    const t = S.trump, red = t == 1 || t == 2;
    bd.hidden = false;
    bd.innerHTML = t == null
      ? '<small>RUNG</small><div class="bs q">?</div><small>' + (S.band ? 'abhi band hai' : (S.caller != null ? esc(S.names[S.caller]) + ' chun raha hai' : 'faisla ho raha hai')) + '</small>'
      : '<small>RUNG</small><div class="bs ' + (red ? 'red' : '') + '">' + SUITS[t] + '</div><small>' + (S.caller === me ? 'Aap ne rakha' : esc(S.names[S.caller]) + ' ne rakha') + '</small>';
    $('hno').hidden = false; $('hno').textContent = 'Hath ' + Math.min(S.trickNo, S.T) + '/' + S.T;
  } else { bd.hidden = true; $('hno').hidden = true; }
  if (S.fid !== lastFid) { lastFid = S.fid; if (S.flash) { const f = $('flash'); f.textContent = S.flash; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); beep(880, .18, .05); } }
  const selC = hand.filter(c => sel.has(c.id));
  H = my ? G.human(S, selC, ui.opt, me) : null;
  let btns = H ? H.btns : [];
  if (S.pend && S.pend.kind == 'window' && S.last && S.last.p !== me) btns = [{ l: 'CHECK!', cls: 'warn', a: { t: 'check' } }];
  const who = S.over ? '' : my ? '👉 AAP KI BAARI' : S.turn >= 0 ? 'Baari: ' + esc(S.names[S.turn]) : '';
  $('msg').innerHTML = (S.msg ? '<span>' + esc(S.msg) + '</span>' : '') + (who ? '<span class="' + (my ? 'you' : '') + '">' + who + '</span>' : '');
  $('hint').textContent = H ? H.hint || '' : (S.out[me] ? 'Aap nikal gaye, ab tamasha dekho' : '');
  $('meinf').innerHTML = (online ? '<b>' + esc(S.names[me]) + '</b> ' : '') + (G.seatInfo(S, me, me) || '').replace(/^Rung/, 'Rung aap ne rakha');
  $('game').classList.toggle('myturn', my);
  $('strip').innerHTML = H && H.strip ? H.strip.map(o => `<button class="chip ${o.on ? 'on' : ''}" data-v="${o.v}">${o.l}</button>`).join('') : '';
  const bb = $('btns'); bb.innerHTML = '';
  btns.forEach(b => { const e = document.createElement('button'); e.className = 'btn ' + (b.p ? 'pri ' : '') + (b.cls || ''); e.textContent = b.l; e.disabled = !!b.d; e.onclick = () => submit(b.a); bb.appendChild(e); });
  renderHand();
}
function renderHand() {
  const hd = $('hand'), cards = S.hands[me], n = cards.length, W = hd.clientWidth, cw = W < 380 ? 52 : 60, chh = cw * 1.42;
  const rows = Math.max(1, Math.ceil(n / 13)), per = Math.ceil(n / rows), rowGap = chh * .5, keys = new Set();
  hd.style.height = (n ? chh + (rows - 1) * rowGap + 18 : 30) + 'px'; hd.style.setProperty('--cw', cw + 'px');
  cards.forEach((c, i) => {
    keys.add(c.id); let el = hEls.get(c.id);
    if (!el) { el = cardEl(c); el.classList.add('hc', 'deal'); el.style.animationDelay = Math.min(i * 28, 500) + 'ms'; el.onclick = () => tapCard(c.id); hd.appendChild(el); hEls.set(c.id, el); }
    const r = Math.floor(i / per), j = i % per, m = Math.min(per, n - r * per), sp = m > 1 ? Math.min(cw + 6, (W - 10 - cw) / (m - 1)) : 0, x0 = (W - (cw + sp * (m - 1))) / 2;
    el.style.left = x0 + j * sp + 'px'; el.style.top = 16 + r * rowGap + 'px'; el.style.zIndex = i;
    el.classList.toggle('sel', sel.has(c.id));
    el.classList.toggle('dim', !!(H && H.legal && !H.legal.has(c.id)));
    el.classList.toggle('glow', !!(H && H.legal && H.legal.size && H.legal.has(c.id) && gid == 'daketi'));
    el.classList.toggle('new', S.drawn === c.id && (online || S.drawnBy === me));
    el.classList.toggle('low', !!(H && H.lowIds && H.lowIds.has(c.id)));
  });
  for (const [k, el] of hEls) if (!keys.has(k)) { el.remove(); hEls.delete(k); }
}
function tapCard(id) {
  if (!H) return;
  if (H.legal && !H.legal.has(id)) { const e = hEls.get(id); e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake'); return; }
  if (H.single) { if (sel.has(id)) { const c = S.hands[me].filter(x => sel.has(x.id)); const b = G.human(S, c, ui.opt, me).btns.find(b => b.p && !b.d); if (b) return submit(b.a); } sel.clear(); sel.add(id); }
  else if (sel.has(id)) sel.delete(id); else if (sel.size < 4) sel.add(id);
  ui.opt = null; beep(520, .04, .03); render();
}
function collect(pd) {
  const tb = $('table'), [sx, sy] = pd.kind == 'discard' ? [0, 0] : dir(pd.w);
  tEls.forEach(el => { el.style.transition = 'transform .42s ease-in, opacity .42s'; el.style.transform = `translate(${sx * tb.clientWidth * .36}px,${sy * tb.clientHeight * .34}px) scale(.35) rotate(${pd.kind == 'discard' ? 0 : 25}deg)`; el.style.opacity = 0; });
  beep(pd.kind == 'pickup' ? 150 : 440, .15);
}
function showOver() {
  if (!S || !S.over) return;
  const o = S.over, win = o.winners.includes(me), title = (o.top === me && o.titleTop) || (win ? o.titleWin : o.titleLose), canNext = o.next;
  $('over').hidden = false;
  $('over').innerHTML = `<div class="ocard ${win ? 'win' : 'lose'}"><div class="oemo">${win ? '🏆' : '😵'}</div><h2>${esc(title)}</h2>${o.lines.map(l => '<p>' + esc(l) + '</p>').join('')}${o.log ? '<details class="log"><summary>Har hath ka hisaab dekho</summary>' + o.log.map(l => '<div>' + l + '</div>').join('') + '</details>' : ''}<button class="big" id="again">${canNext ? 'Agla round' : 'Dobara khelo'}</button><button class="ghost" id="tohome">${online ? (room && room.host ? 'Lobby (game badlo)' : 'Room chhor do') : 'Home'}</button></div>` + (win ? Array.from({ length: 36 }, (_, i) => `<i class="conf" style="left:${Math.random() * 100}%;background:hsl(${i * 37},90%,60%);animation-delay:${Math.random() * .8}s;animation-duration:${1.8 + Math.random() * 1.6}s"></i>`).join('') : '');
  beep(win ? 784 : 180, .4, .07);
  $('again').onclick = () => online ? wsSend({ t: 'next' }) : start(gid, opts.n, canNext ? S : null);
  $('tohome').onclick = () => online ? (room && room.host ? wsSend({ t: 'lobby' }) : leaveRoom()) : home();
}

/* ---------- events ---------- */
$('tiles').onclick = e => { const t = e.target.closest('.tile'); if (t) setup(t.dataset.g); };
$('onl').onclick = onlineSheet;
$('back').onclick = () => modal('<h2>Game chhor dein?</h2><p class="sub">' + (online ? 'Aap room se nikal jayenge, aap ki jagah bot khele ga.' : 'Yeh round khatam ho jaye ga.') + '</p><button class="big" id="yes">Haan, Home</button>', e => { if (e.target.id == 'yes') online ? leaveRoom() : home(); });
$('help').onclick = () => modal(`<h2 style="color:${INFO[gid].col}">${INFO[gid].name}: rules</h2><ul class="rules">${INFO[gid].rules.map(r => '<li>' + r + '</li>').join('')}</ul>${S.log && S.log.length ? '<h2 style="font-size:19px">Ab tak ke hath</h2><div class="log open">' + S.log.map(l => '<div>' + l + '</div>').join('') + '</div>' : ''}`);
$('snd').onclick = () => { snd = !snd; LS.set('pb_snd', snd ? '1' : '0'); $('snd').textContent = snd ? '🔊' : '🔇'; };
$('snd').textContent = snd ? '🔊' : '🔇';
$('strip').onclick = e => { const t = e.target.closest('.chip'); if (t) { ui.opt = +t.dataset.v; render(); } };
let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (S && !$('game').hidden) render(); }, 120); });
home();
const qRoom = (new URLSearchParams(location.search).get('room') || '').toUpperCase(), saved = LS.get('pb_room');
if (/^https?:$/.test(location.protocol) && LS.get('pb_name')) {
  if (saved && LS.get('pb_tok') && (!qRoom || qRoom == saved)) { wantRoom = saved; connect(() => wsSend({ t: 'join', code: saved, token: LS.get('pb_tok'), name: LS.get('pb_name') })); }
  else if (qRoom) onlineSheet();
} else if (qRoom) onlineSheet();
})();
