// NEON GRID authoritative game core. Transport independent:
// the Cloudflare Durable Object runs it for online play, the browser runs it locally for solo practice and the menu backdrop.
import * as SH from './shared.js';
import { buildNav, botInput, newBotAI } from './bot.js';

const HZ = 20, DT = 1 / HZ, MAX_MSG_BYTES = 2048, MAX_MSGS_PER_SEC = 45;

export class GameCore {
  constructor(opts = {}) {
    this.o = Object.assign({
      maxPlayers: SH.MAX_PLAYERS, fillTo: SH.MATCH.fillTo, diff: 'normal', time: SH.MATCH.time,
      scores: { ffa: SH.MODES.ffa.score, koth: SH.MODES.koth.score }, modes: ['ffa', 'koth'], arenas: SH.ARENA_ORDER,
      queue: true, idleTimeout: 15, oneShot: false, attract: false, countdown: SH.MATCH.countdown, results: SH.MATCH.results,
      minPlayers: SH.MATCH.minPlayers, now: () => Date.now() / 1000, onMatchEnd: null
    }, opts);
    this.layouts = {};  // arena -> { C, nav }, built on first use
    this.conns = new Map(); this.queue = []; this.bots = []; this.nextId = 1;
    this.match = { state: 'waiting', t: 0, id: 0, tick: 0, mode: this.o.modes[0], arena: this.o.arenas[Math.floor(Math.random() * this.o.arenas.length)] };
    this.useArena(this.match.arena);
    this.spawnState = SH.SPAWNS.map(() => ({ uses: 0, last: -99 }));
    this.pickups = SH.PICKUPS.map(p => Object.assign({ on: true, at: 0 }, p));
    this.zone = { owner: 0, contested: 0, acc: 0 };
    this.events = []; this.lastQ = 0; this.lastPing = 0;
  }
  clock() { return this.o.now(); }

  /* ---------------- connections ---------------- */
  connect(tr, spectator = false) {
    const now = this.clock();
    const c = { tr, id: this.nextId++, name: '', where: spectator ? 'spec' : 'new', last: now, win: 0, winT: now, bucket: 30, bt: now, rtt: 0, offerT: 0, p: null, sayT: 0 };
    this.conns.set(c.id, c);
    if (spectator) { this.syncBots(); this.send(c, { t: 'spec', roster: this.roster(), m: this.matchInfo() }); }
    return c;
  }
  disconnect(c) {
    if (!this.conns.has(c.id)) return;
    this.conns.delete(c.id); this.removeFromQueue(c);
    if (c.where === 'arena') this.leaveArena(c);
    c.where = 'gone'; this.fillSlots(); this.sendQueue(); this.syncBots();
  }
  send(c, obj) { try { c.tr.send(typeof obj === 'string' ? obj : JSON.stringify(obj)); } catch (e) { } }
  humans() { return [...this.conns.values()].filter(c => c.where === 'arena'); }
  slotsUsed() { let n = 0; for (const c of this.conns.values()) if (c.where === 'arena' || c.where === 'pending') n++; return n; }
  players() { return [...this.humans().map(c => c.p).filter(Boolean), ...this.bots]; }
  status() { return { state: this.match.state, mode: this.match.mode, arena: this.match.arena, timeLeft: Math.ceil(this.match.t), humans: this.humans().length, bots: this.bots.length, max: this.o.maxPlayers, queue: this.queue.length }; }

  message(c, data) {
    if (typeof data !== 'string' || data.length > MAX_MSG_BYTES) return;
    const now = this.clock(); c.last = now;
    if (now - c.winT >= 1) { c.winT = now; c.win = 0; }
    if (++c.win > MAX_MSGS_PER_SEC) return;
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    switch (m.t) {
      case 'hello':
        if (c.where !== 'new') return;
        if (m.ver !== SH.VERSION) { this.send(c, { t: 'err', code: 'version', ver: SH.VERSION }); try { c.tr.close(1008, 'version'); } catch (e) { } return; }
        c.name = SH.sanitizeName(m.name);
        this.send(c, { t: 'welcome', id: c.id, ver: SH.VERSION, max: this.o.maxPlayers });
        this.admit(c); break;
      case 'in': this.onInput(c, m.i); break;
      case 'accept': if (c.where === 'pending') this.enterArena(c); break;
      case 'decline': if (c.where === 'pending' || c.where === 'queue') { this.removeFromQueue(c); c.where = 'idle'; this.send(c, { t: 'left' }); this.fillSlots(); } break;
      case 'leave': if (c.where === 'arena') { this.leaveArena(c); c.where = 'idle'; this.send(c, { t: 'left' }); this.fillSlots(); this.syncBots(); } break;
      case 'join': if (c.where === 'idle') this.admit(c); break;
      case 'say': if (c.where === 'arena' && now - c.sayT > 1.5 && Number.isInteger(m.i) && m.i >= 0 && m.i < SH.QUICK_CHAT.length) { c.sayT = now; this.events.push({ k: 'say', a: c.id, i: m.i }); } break;
      case 'po': if (Number.isFinite(m.c)) c.rtt = Math.max(0, Math.min(5000, Math.round(now * 1000 - m.c))); break;
    }
  }
  admit(c) {
    const free = this.slotsUsed() < this.o.maxPlayers && this.match.state !== 'results' && !this.queue.length;
    if (free || !this.o.queue) { this.enterArena(c); return; }
    if (this.queue.length >= SH.MAX_QUEUE) { this.send(c, { t: 'err', code: 'queuefull' }); c.where = 'idle'; return; }
    c.where = 'queue'; this.queue.push(c); this.sendQueue();
  }
  removeFromQueue(c) { const i = this.queue.indexOf(c); if (i >= 0) this.queue.splice(i, 1); }
  offer(c) { c.where = 'pending'; c.offerT = this.clock() + SH.MATCH.offerSec; this.send(c, { t: 'offer', sec: SH.MATCH.offerSec }); }
  pickColor() { const used = new Set(this.players().map(p => p.color)); return SH.PLAYER_COLORS.find(col => !used.has(col)) ?? SH.PLAYER_COLORS[0]; }
  enterArena(c) {
    this.removeFromQueue(c);
    this.syncBots(1);                                  // make room before taking a colour
    c.where = 'arena'; c.p = SH.newPlayer(c.id, c.name, this.pickColor());
    c.bucket = 30; c.bt = this.clock();
    if (this.match.state !== 'results') this.spawn(c.p);
    this.send(c, { t: 'enter', id: c.id, roster: this.roster(), m: this.matchInfo(), you: { pos: c.p.pos, yaw: c.p.yaw, alive: c.p.alive } });
    this.events.push({ k: 'ros', l: this.roster() }, { k: 'join', id: c.id });
  }
  leaveArena(c) { c.where = 'idle'; c.p = null; this.events.push({ k: 'ros', l: this.roster() }, { k: 'part', id: c.id }); }
  fillSlots() {
    if (this.match.state === 'results' || !this.o.queue) return;
    while (this.slotsUsed() < this.o.maxPlayers && this.queue.length) this.offer(this.queue.shift());
    this.sendQueue();
  }
  /** Keep the arena topped up with bots; bots give their seat to arriving humans. */
  syncBots(extraHumans = 0) {
    const h = this.humans().length + extraHumans;
    const want = this.o.attract ? this.o.fillTo : (h > 0 ? Math.max(0, Math.min(this.o.fillTo, this.o.maxPlayers) - h) : 0);
    let changed = false;
    while (this.bots.length < want) {
      const used = new Set(this.bots.map(b => b.name)); const name = SH.BOT_NAMES.find(n => !used.has(n)) || 'BOT';
      const b = SH.newPlayer(this.nextId++, name, this.pickColor()); b.bot = true; b.ai = newBotAI();
      this.bots.push(b); if (this.match.state !== 'results') this.spawn(b); changed = true;
      this.events.push({ k: 'join', id: b.id });
    }
    while (this.bots.length > want) {
      const i = this.bots.reduce((bi, b, k, arr) => (!b.alive && arr[bi].alive) || b.score < arr[bi].score ? k : bi, 0);
      const [b] = this.bots.splice(i, 1); this.events.push({ k: 'part', id: b.id }); changed = true;
    }
    if (changed) this.events.push({ k: 'ros', l: this.roster() });
    if (h === 0 && !this.o.attract && this.match.state !== 'waiting') { this.match.state = 'waiting'; this.match.t = 0; }   // empty arena: next visitor starts fresh
  }
  roster() { return [...this.humans().filter(c => c.p).map(c => ({ id: c.id, name: c.name, color: c.p.color })), ...this.bots.map(b => ({ id: b.id, name: b.name, color: b.color, bot: 1 }))]; }
  matchInfo() { const M = this.match; return { s: M.state, t: Math.max(0, Math.round(M.t * 10) / 10), id: M.id, mode: M.mode, arena: M.arena, limit: this.o.scores[M.mode] }; }

  /* ---------------- gameplay ---------------- */
  onInput(c, list) {
    if (c.where !== 'arena' || !Array.isArray(list) || !c.p) return;
    const now = this.clock();
    c.bucket = Math.min(30, c.bucket + (now - c.bt) * 60); c.bt = now;
    for (const raw of list.slice(0, 8)) {
      const inp = SH.sanitizeInput(raw); if (!inp || inp.s <= c.p.ack) continue;
      if (c.bucket < 1) { c.p.ack = inp.s; continue; }
      c.bucket -= 1;
      const fired = SH.stepPlayer(c.p, inp, SH.TICK, this.C, SH.canFire(this.match.state));
      c.p.ack = inp.s;
      if (fired) this.shoot(c.p, .125 + c.rtt / 2000);
    }
    this.record(c.p, now);
  }
  record(p, now) { const h = p.hist; h.push([now, p.pos.x, p.pos.y, p.pos.z]); while (h.length > 2 && now - h[0][0] > 1) h.shift(); }
  posAt(p, t) {
    const h = p.hist; if (!h.length || t >= h[h.length - 1][0]) return p.pos;
    if (t <= h[0][0]) return { x: h[0][1], y: h[0][2], z: h[0][3] };
    for (let i = h.length - 1; i > 0; i--) if (h[i - 1][0] <= t) { const a = h[i - 1], b = h[i], k = (t - a[0]) / ((b[0] - a[0]) || 1);
      return { x: a[1] + (b[1] - a[1]) * k, y: a[2] + (b[2] - a[2]) * k, z: a[3] + (b[3] - a[3]) * k }; }
    return p.pos;
  }
  /** Lag compensated: targets are moved back to where the shooter saw them. */
  shoot(a, rewind = 0) {
    const w = SH.WEAPONS[a.wi], o = SH.eye(a), t0 = this.clock() - Math.min(.3, Math.max(0, rewind));
    const ghosts = this.players().filter(p => p !== a && p.alive).map(p => ({ ref: p, alive: true, pos: rewind > 0 ? this.posAt(p, t0) : p.pos }));
    const dmg = new Map(), ends = [];
    for (const d of SH.shotDirs(a)) {
      const r = SH.traceShot(this.C, ghosts, null, o, d, w.range), hit = r.hit ? r.hit.ref : null;
      const e = [SH.r3(o.x + d.x * r.t), SH.r3(o.y + d.y * r.t), SH.r3(o.z + d.z * r.t), hit ? hit.id : 0];
      if (r.n) e.push(r.n.x, r.n.y, r.n.z);
      ends.push(e); if (hit) dmg.set(hit, (dmg.get(hit) || 0) + SH.dmgAt(w, r.t));
    }
    a.shots++; if (dmg.size) a.hits++;
    this.events.push({ k: 'sh', a: a.id, w: a.wi, e: ends });
    for (const b of this.bots) if (b !== a && b.alive && !b.ai.target && Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z) < 26) { b.ai.hurtBy = a; b.ai.hurtT = 1.2; }
    for (const [t, d] of dmg) this.damage(t, d, a, a.wi);
  }
  damage(t, d, a, wi) {
    if (!t.alive) return;
    if (t.protect > 0) { this.events.push({ k: 'hit', a: a.id, v: t.id, d: 0 }); return; }
    t.shield -= d; if (t.bot) { t.ai.hurtBy = a; t.ai.hurtT = 2.5; }
    const kill = t.shield <= 0;
    this.events.push({ k: 'hit', a: a.id, v: t.id, d, kill: kill ? 1 : 0 });
    if (!kill) return;
    t.shield = 0; t.alive = false; t.respawnT = SH.P.respawn; t.streak = 0;
    const live = this.match.state === 'playing';
    if (live) { t.deaths++; if (a !== t) { a.kills++; a.streak++; a.best = Math.max(a.best, a.streak); if (this.match.mode === 'ffa') a.score++; } }
    this.events.push({ k: 'kill', a: a.id, v: t.id, w: wi, s: live ? a.streak : 0 });
    if (live && this.match.mode === 'ffa' && a.score >= this.o.scores.ffa) this.endMatch('score');
  }
  spawn(p) { const i = SH.pickSpawn(this.C, p, this.players(), this.spawnState, this.clock()); SH.placeAt(p, i, this.spawnState, this.clock()); this.events.push({ k: 'sp', id: p.id }); }

  pickArena() {
    const A = this.o.arenas, rest = A.length > 1 ? A.filter(a => a !== this.match.arena) : A;
    return rest[Math.floor(Math.random() * rest.length)];
  }
  /** Arenas have different solid boxes: swap colliders + bot nav graph. */
  useArena(a) {
    if (!this.layouts[a]) { const C = SH.buildColliders(SH.buildMap(a)); this.layouts[a] = { C, nav: buildNav(C, a) }; }
    this.C = this.layouts[a].C; this.nav = this.layouts[a].nav;
  }
  startCountdown() { this.match.state = 'countdown'; this.match.t = this.o.countdown; this.match.mode = this.o.modes[this.match.id % this.o.modes.length];
    // every match draws a random arena, never the same one twice in a row; a restarted countdown for the same match keeps its draw
    if (this.arenaFor !== this.match.id) { this.arenaFor = this.match.id; this.nextArena = this.match.id ? this.pickArena() : this.match.arena; }
    const arena = this.nextArena;
    if (arena !== this.match.arena) {
      this.match.arena = arena; this.useArena(arena);
      // the new layout may put a crate where someone is standing: move everyone to a spawn point of the new map
      for (const p of this.players()) { p.ai && (p.ai.path = []); if (p.alive) this.spawn(p); }
    }
    this.events.push({ k: 'm', m: this.matchInfo() }); }
  startMatch() {
    const M = this.match; M.state = 'playing'; M.t = this.o.time; M.id++;
    this.spawnState.forEach(s => { s.uses = 0; s.last = -99; });
    this.pickups.forEach(p => { p.on = true; p.at = 0; }); this.zone = { owner: 0, contested: 0, acc: 0 };
    for (const p of this.players()) { Object.assign(p, { score: 0, deaths: 0, kills: 0, shots: 0, hits: 0, streak: 0, best: 0, hold: 0 }); this.spawn(p); }
    this.events.push({ k: 'm', m: this.matchInfo() });
  }
  endMatch(reason) {
    if (this.match.state !== 'playing') return;
    this.match.state = 'results'; this.match.t = this.o.oneShot ? 0 : this.o.results;
    const rank = SH.rankPlayers(this.players()).map(p => ({ id: p.id, name: p.name, color: p.color, bot: p.bot ? 1 : 0, score: p.score, deaths: p.deaths,
      kills: p.kills, shots: p.shots, hits: p.hits, best: p.best, hold: Math.round(p.hold) }));
    const res = { k: 'res', reason, matchId: this.match.id, mode: this.match.mode, rank };
    this.events.push({ k: 'm', m: this.matchInfo() }, res);
    if (this.o.onMatchEnd) { try { this.o.onMatchEnd(res); } catch (e) { } }
  }
  rotate() {
    const played = SH.rankPlayers(this.humans().map(c => c.p)).map(p => this.conns.get(p.id)).filter(Boolean);
    const pending = [...this.conns.values()].filter(c => c.where === 'pending');
    const order = [...pending, ...this.queue.slice(), ...played], keep = new Set(order.slice(0, this.o.maxPlayers));
    this.queue = [];
    for (const c of order) {
      if (keep.has(c)) { if (c.where === 'queue') this.offer(c); }
      else { if (c.where === 'arena') { this.leaveArena(c); this.send(c, { t: 'rotated' }); } c.where = 'queue'; this.queue.push(c); }
    }
    this.match.state = 'waiting'; this.match.t = 0;
    this.syncBots();
    for (const p of this.players()) this.spawn(p);
    this.events.push({ k: 'm', m: this.matchInfo() }); this.sendQueue();
  }

  /* ---------------- loop: call 20 times per second ---------------- */
  tick() {
    const now = this.clock(), M = this.match; M.tick++;
    for (const c of [...this.conns.values()]) {
      if (now - c.last > this.o.idleTimeout) { try { c.tr.close(1001, 'timeout'); } catch (e) { } this.disconnect(c); continue; }
      if (c.where === 'pending' && now > c.offerT) { c.where = 'queue'; this.queue.push(c); this.send(c, { t: 'missed' }); this.fillSlots(); }
    }
    const humans = this.humans().length, n = humans + this.bots.length;
    if (M.state === 'waiting') { if (!this.o.attract && humans >= 1 && n >= this.o.minPlayers) this.startCountdown(); }
    else if (M.state === 'countdown') { M.t -= DT; if (humans < 1 || n < this.o.minPlayers) { M.state = 'waiting'; this.events.push({ k: 'm', m: this.matchInfo() }); } else if (M.t <= 0) this.startMatch(); }
    else if (M.state === 'playing') { M.t -= DT; if (M.t <= 0) { M.t = 0; this.endMatch('time'); } else if (humans < 1 || n < this.o.minPlayers) this.endMatch('players'); }
    else if (M.state === 'results') { if (!this.o.oneShot) { M.t -= DT; if (M.t <= 0) this.rotate(); } }
    const live = M.state !== 'results';
    // bots: 3 physics steps per server tick
    if (this.bots.length) {
      const X = { C: this.C, nav: this.nav, players: this.players(), diff: this.o.diff, frozen: M.state === 'countdown' || !live, mode: M.state === 'waiting' ? 'ffa' : M.mode, pickups: this.pickups };
      for (let k = 0; k < 3; k++) for (const b of this.bots) {
        const fired = SH.stepPlayer(b, botInput(b, X, SH.TICK), SH.TICK, this.C, SH.canFire(M.state));
        if (fired) this.shoot(b, 0);
      }
    }
    for (const p of this.players()) {
      if (live && !p.alive) { p.respawnT -= DT; if (p.respawnT <= 0) this.spawn(p); }
      else if (p.alive && p.pos.y < -12) { p.alive = false; p.respawnT = SH.P.respawn; }
      if (p.bot) this.record(p, now);
    }
    if (live) this.tickPickups(now);
    if (M.state === 'playing' && M.mode === 'koth') this.tickZone();
    else { this.zone.owner = 0; this.zone.contested = 0; }
    // snapshot (20 Hz)
    const viewers = [...this.conns.values()].filter(c => c.where === 'arena' || c.where === 'spec');
    if (viewers.length) {
      const rtt = new Map(this.humans().map(c => [c.id, c.rtt]));
      const snap = JSON.stringify({ t: 's', tk: M.tick, m: this.matchInfo(), pl: this.players().map(p => SH.packPlayer(p, rtt.get(p.id) || 0)),
        pk: this.pickups.map(p => p.on ? 1 : 0), z: [this.zone.owner, this.zone.contested], ev: this.events });
      for (const c of viewers) this.send(c, snap);
    }
    this.events = [];
    if (now - this.lastQ > 1) { this.lastQ = now; this.sendQueue(); }
    if (now - this.lastPing > 2) { this.lastPing = now; const msg = JSON.stringify({ t: 'pi', c: Math.round(now * 1000) }); for (const c of this.conns.values()) if (c.where !== 'spec') this.send(c, msg); }
  }
  tickPickups(now) {
    this.pickups.forEach((pk, i) => {
      if (!pk.on) { if (now >= pk.at) { pk.on = true; this.events.push({ k: 'pk', i, on: 1 }); } return; }
      for (const p of this.players()) {
        if (!p.alive || Math.hypot(p.pos.x - pk.x, p.pos.z - pk.z) > 1.1 || Math.abs(p.pos.y - pk.y) > 1.2) continue;
        if (pk.type === 'shield') { if (p.shield >= SH.P.shield) continue; p.shield = Math.min(SH.P.shield, p.shield + SH.PICKUP_TYPES.shield.amount); }
        else p.boostT = SH.PICKUP_TYPES.boost.time;
        pk.on = false; pk.at = now + SH.PICKUP_TYPES[pk.type].respawn;
        this.events.push({ k: 'pk', i, on: 0, a: p.id }); break;
      }
    });
  }
  tickZone() {
    const occ = this.players().filter(p => SH.inZone(p)), Z = this.zone;
    if (occ.length === 1) {
      const p = occ[0]; if (Z.owner !== p.id) Z.acc = 0; Z.owner = p.id; Z.contested = 0; Z.acc += DT; p.hold += DT;
      while (Z.acc >= 1) { Z.acc -= 1; p.score++; }
      if (p.score >= this.o.scores.koth) this.endMatch('score');
    } else { Z.owner = 0; Z.contested = occ.length > 1 ? 1 : 0; }
  }
  sendQueue() {
    const info = this.matchInfo(), inArena = this.slotsUsed();
    this.queue.forEach((c, i) => this.send(c, { t: 'q', pos: i + 1, total: this.queue.length, arena: inArena, max: this.o.maxPlayers, m: info }));
  }
}
