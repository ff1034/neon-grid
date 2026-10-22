// NEON GRID online: Worker entry + single authoritative arena (Durable Object).
import { DurableObject } from 'cloudflare:workers';
import * as SH from '../public/shared.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('需要 WebSocket 連線', { status: 426 });
      return env.ARENA.get(env.ARENA.idFromName('main')).fetch(request);
    }
    if (url.pathname === '/status') return env.ARENA.get(env.ARENA.idFromName('main')).fetch(request);
    return env.ASSETS.fetch(request);
  }
};

const HZ = 20, DT = 1 / HZ;
const MAX_MSG_BYTES = 2048, MAX_MSGS_PER_SEC = 45, IDLE_TIMEOUT = 15;

export class Arena extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.C = SH.buildColliders(SH.buildMap());
    this.conns = new Map();          // id -> conn
    this.queue = [];                 // conns waiting, in order
    this.nextId = 1;
    this.match = { state: 'waiting', t: 0, id: 0, tick: 0 };
    this.spawnState = SH.SPAWNS.map(() => ({ uses: 0, last: -99 }));
    this.events = [];
    this.timer = null;
    this.now = 0;
    this.lastQ = 0; this.lastPing = 0;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/status') {
      return Response.json({ state: this.match.state, timeLeft: Math.ceil(this.match.t), players: this.arenaConns().length, max: SH.MAX_PLAYERS, queue: this.queue.length });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.onConnect(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  /* ---------------- connections ---------------- */
  onConnect(ws) {
    if (this.conns.size >= SH.MAX_PLAYERS + SH.MAX_QUEUE + 8) { try { ws.send(JSON.stringify({ t: 'err', code: 'busy' })); ws.close(1013, 'busy'); } catch (e) { } return; }
    const c = { ws, id: this.nextId++, name: '', where: 'new', last: this.clock(), win: 0, winT: this.clock(), bucket: 30, bt: this.clock(), rtt: 0, offerT: 0, p: null, color: 0 };
    this.conns.set(c.id, c);
    ws.addEventListener('message', e => { try { this.onMessage(c, e.data); } catch (err) { /* ignore malformed */ } });
    ws.addEventListener('close', () => this.drop(c));
    ws.addEventListener('error', () => this.drop(c));
    this.ensureTimer();
  }
  clock() { return Date.now() / 1000; }
  send(c, obj) { try { c.ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj)); } catch (e) { } }
  arenaConns() { return [...this.conns.values()].filter(c => c.where === 'arena'); }
  slotsUsed() { let n = 0; for (const c of this.conns.values()) if (c.where === 'arena' || c.where === 'pending') n++; return n; }

  onMessage(c, data) {
    if (typeof data !== 'string' || data.length > MAX_MSG_BYTES) return;
    const now = this.clock(); c.last = now;
    if (now - c.winT >= 1) { c.winT = now; c.win = 0; }
    if (++c.win > MAX_MSGS_PER_SEC) return;           // flood protection
    const m = JSON.parse(data); if (!m || typeof m.t !== 'string') return;
    switch (m.t) {
      case 'hello':
        if (c.where !== 'new') return;
        if (m.ver !== SH.VERSION) { this.send(c, { t: 'err', code: 'version', ver: SH.VERSION }); c.ws.close(1008, 'version'); return; }
        c.name = SH.sanitizeName(m.name);
        this.send(c, { t: 'welcome', id: c.id, ver: SH.VERSION, max: SH.MAX_PLAYERS });
        this.admit(c);
        break;
      case 'in': this.onInput(c, m.i); break;
      case 'accept': if (c.where === 'pending') this.enterArena(c); break;
      case 'decline': if (c.where === 'pending' || c.where === 'queue') { this.removeFromQueue(c); c.where = 'idle'; this.send(c, { t: 'left' }); this.fillSlots(); } break;
      case 'leave': if (c.where === 'arena') { this.leaveArena(c); c.where = 'idle'; this.send(c, { t: 'left' }); this.fillSlots(); } break;
      case 'join': if (c.where === 'idle') this.admit(c); break;
      case 'po': if (Number.isFinite(m.c)) c.rtt = Math.max(0, Math.min(5000, Date.now() - m.c)); break;
    }
  }

  admit(c) {
    if (this.slotsUsed() < SH.MAX_PLAYERS && this.match.state !== 'results' && !this.queue.length) { this.enterArena(c); return; }
    if (this.queue.length >= SH.MAX_QUEUE) { this.send(c, { t: 'err', code: 'queuefull' }); c.where = 'idle'; return; }
    c.where = 'queue'; this.queue.push(c); this.sendQueue();
  }
  removeFromQueue(c) { const i = this.queue.indexOf(c); if (i >= 0) this.queue.splice(i, 1); }
  offer(c) { c.where = 'pending'; c.offerT = this.clock() + SH.MATCH.offerSec; this.send(c, { t: 'offer', sec: SH.MATCH.offerSec }); }

  pickColor() {
    const used = new Set(this.arenaConns().map(c => c.color));
    return SH.PLAYER_COLORS.find(col => !used.has(col)) ?? SH.PLAYER_COLORS[0];
  }
  enterArena(c) {
    this.removeFromQueue(c);
    c.where = 'arena'; c.color = this.pickColor();
    c.p = SH.newPlayer(c.id, c.name, c.color);
    c.bucket = 30; c.bt = this.clock();
    if (this.match.state !== 'results') this.spawn(c.p);
    this.send(c, { t: 'enter', id: c.id, roster: this.roster(), m: this.matchInfo(), you: this.fullState(c.p) });
    this.events.push({ k: 'ros', l: this.roster() });
    this.events.push({ k: 'join', id: c.id });
  }
  leaveArena(c) {
    c.where = 'idle'; c.p = null;
    this.events.push({ k: 'ros', l: this.roster() });
    this.events.push({ k: 'part', id: c.id });
  }
  drop(c) {
    if (!this.conns.has(c.id)) return;
    this.conns.delete(c.id); this.removeFromQueue(c);
    if (c.where === 'arena') this.leaveArena(c);
    c.where = 'gone';
    this.fillSlots(); this.sendQueue();
    if (!this.conns.size) this.stopTimer();
  }
  fillSlots() {
    if (this.match.state === 'results') return;
    while (this.slotsUsed() < SH.MAX_PLAYERS && this.queue.length) this.offer(this.queue.shift());
    this.sendQueue();
  }
  roster() { return this.arenaConns().map(c => ({ id: c.id, name: c.name, color: c.color })); }
  matchInfo() { return { s: this.match.state, t: Math.max(0, Math.round(this.match.t * 10) / 10), id: this.match.id, limit: SH.MATCH.score }; }

  /* ---------------- gameplay ---------------- */
  onInput(c, list) {
    if (c.where !== 'arena' || !Array.isArray(list) || !c.p) return;
    const now = this.clock();
    c.bucket = Math.min(30, c.bucket + (now - c.bt) * 60); c.bt = now;   // max 60 ticks/s, 0.5 s burst
    for (const raw of list.slice(0, 8)) {
      const inp = SH.sanitizeInput(raw); if (!inp || inp.s <= c.p.ack) continue;
      if (c.bucket < 1) { c.p.ack = inp.s; continue; }                 // too fast: acknowledge but ignore
      c.bucket -= 1;
      const live = this.match.state !== 'results';
      const fired = SH.stepPlayer(c.p, inp, SH.TICK, this.C, live);
      c.p.ack = inp.s;
      if (fired) this.shoot(c.p);
    }
  }
  players() { return this.arenaConns().map(c => c.p).filter(Boolean); }
  shoot(a) {
    const w = SH.WEAPONS[a.wi], o = SH.eye(a), ps = this.players(), dmg = new Map(), ends = [];
    for (const d of SH.shotDirs(a)) {
      const r = SH.traceShot(this.C, ps, a, o, d, w.range);
      const e = [SH.r3(o.x + d.x * r.t), SH.r3(o.y + d.y * r.t), SH.r3(o.z + d.z * r.t), r.hit ? r.hit.id : 0];
      if (r.n) e.push(r.n.x, r.n.y, r.n.z);
      ends.push(e);
      if (r.hit) dmg.set(r.hit, (dmg.get(r.hit) || 0) + w.dmg);
    }
    this.events.push({ k: 'sh', a: a.id, w: a.wi, e: ends });
    for (const [t, d] of dmg) this.damage(t, d, a, a.wi);
  }
  damage(t, d, a, wi) {
    if (!t.alive) return;
    if (t.protect > 0) { this.events.push({ k: 'hit', a: a.id, v: t.id, d: 0, p: 1 }); return; }
    t.shield -= d;
    const kill = t.shield <= 0;
    this.events.push({ k: 'hit', a: a.id, v: t.id, d, kill: kill ? 1 : 0 });
    if (kill) {
      t.shield = 0; t.alive = false; t.respawnT = SH.P.respawn;
      if (this.match.state === 'playing') { t.deaths++; if (a !== t) a.score++; }
      this.events.push({ k: 'kill', a: a.id, v: t.id, w: wi });
      if (this.match.state === 'playing' && a.score >= SH.MATCH.score) this.endMatch('score');
    }
  }
  spawn(p) { const i = SH.pickSpawn(this.C, p, this.players(), this.spawnState, this.clock()); SH.placeAt(p, i, this.spawnState, this.clock()); this.events.push({ k: 'sp', id: p.id }); }

  startCountdown() { this.match.state = 'countdown'; this.match.t = SH.MATCH.countdown; this.events.push({ k: 'm', m: this.matchInfo() }); }
  startMatch() {
    this.match.state = 'playing'; this.match.t = SH.MATCH.time; this.match.id++;
    this.spawnState.forEach(s => { s.uses = 0; s.last = -99; });
    for (const p of this.players()) { p.score = 0; p.deaths = 0; this.spawn(p); }
    this.events.push({ k: 'm', m: this.matchInfo() });
  }
  endMatch(reason) {
    if (this.match.state !== 'playing') return;
    this.match.state = 'results'; this.match.t = SH.MATCH.results;
    const rank = SH.rankPlayers(this.players()).map(p => ({ id: p.id, name: p.name, color: p.color, score: p.score, deaths: p.deaths }));
    this.events.push({ k: 'm', m: this.matchInfo() }, { k: 'res', reason, matchId: this.match.id, rank });
  }
  /** After results: people who waited play next; players who just played go behind them. */
  rotate() {
    const played = SH.rankPlayers(this.players()).map(p => this.conns.get(p.id)).filter(Boolean);
    const waiting = this.queue.slice();
    const pending = [...this.conns.values()].filter(c => c.where === 'pending');
    const order = [...pending, ...waiting, ...played];
    const keep = new Set(order.slice(0, SH.MAX_PLAYERS));
    this.queue = [];
    for (const c of order) {
      if (keep.has(c)) { if (c.where === 'queue') this.offer(c); }
      else {
        if (c.where === 'arena') { this.leaveArena(c); this.send(c, { t: 'rotated' }); }
        c.where = 'queue'; this.queue.push(c);
      }
    }
    this.match.state = 'waiting'; this.match.t = 0;
    for (const p of this.players()) this.spawn(p);
    this.events.push({ k: 'm', m: this.matchInfo() });
    this.sendQueue();
  }

  /* ---------------- loop ---------------- */
  ensureTimer() { if (!this.timer) this.timer = setInterval(() => { try { this.tick(); } catch (e) { } }, 1000 / HZ); }
  stopTimer() { if (this.timer) { clearInterval(this.timer); this.timer = null; } this.match = { state: 'waiting', t: 0, id: this.match.id, tick: 0 }; }

  tick() {
    const now = this.clock(), M = this.match; M.tick++;
    // timeouts
    for (const c of [...this.conns.values()]) {
      if (now - c.last > IDLE_TIMEOUT) { try { c.ws.close(1001, 'timeout'); } catch (e) { } this.drop(c); continue; }
      if (c.where === 'pending' && now > c.offerT) { c.where = 'queue'; this.queue.push(c); this.send(c, { t: 'missed' }); this.fillSlots(); }
    }
    const n = this.arenaConns().length;
    // match state machine
    if (M.state === 'waiting') { if (n >= SH.MATCH.minPlayers) this.startCountdown(); }
    else if (M.state === 'countdown') { M.t -= DT; if (n < SH.MATCH.minPlayers) { M.state = 'waiting'; this.events.push({ k: 'm', m: this.matchInfo() }); } else if (M.t <= 0) this.startMatch(); }
    else if (M.state === 'playing') { M.t -= DT; if (M.t <= 0) { M.t = 0; this.endMatch('time'); } else if (n < SH.MATCH.minPlayers) this.endMatch('players'); }
    else if (M.state === 'results') { M.t -= DT; if (M.t <= 0) this.rotate(); }
    // respawns
    if (M.state !== 'results') for (const p of this.players()) if (!p.alive) { p.respawnT -= DT; if (p.respawnT <= 0) this.spawn(p); }
    // snapshot to arena players (20 Hz). Outgoing messages are not billed.
    const arena = this.arenaConns();
    if (arena.length) {
      const snap = JSON.stringify({ t: 's', tk: M.tick, m: this.matchInfo(), pl: arena.map(c => this.packState(c)), ev: this.events });
      for (const c of arena) this.send(c, snap);
    }
    this.events = [];
    if (now - this.lastQ > 1) { this.lastQ = now; this.sendQueue(); }
    if (now - this.lastPing > 2) { this.lastPing = now; const msg = JSON.stringify({ t: 'pi', c: Date.now() }); for (const c of this.conns.values()) this.send(c, msg); }
  }
  packState(c) {
    const p = c.p, r = SH.r3;
    return [p.id, r(p.pos.x), r(p.pos.y), r(p.pos.z), r(p.vel.x), r(p.vel.y), r(p.vel.z), SH.r4(p.yaw), SH.r4(p.pitch),
      (p.onGround ? 1 : 0) | (p.alive ? 2 : 0), Math.ceil(p.shield), p.wi, r(Math.max(0, p.protect)), r(Math.max(0, p.respawnT)), p.score, p.deaths, c.rtt, p.ack,
      r(p.cd), r(p.switchT), p.ws[0].ammo, r(p.ws[0].reload), p.ws[1].ammo, r(p.ws[1].reload), r(p.airT)];
  }
  fullState(p) { return { pos: p.pos, yaw: p.yaw, alive: p.alive }; }
  sendQueue() {
    const info = this.matchInfo(), inArena = this.slotsUsed();
    this.queue.forEach((c, i) => this.send(c, { t: 'q', pos: i + 1, total: this.queue.length, arena: inArena, max: SH.MAX_PLAYERS, m: info }));
  }
}
