// NEON GRID online: Worker entry + one authoritative arena (Durable Object) + leaderboard (SQLite in the same object).
import { DurableObject } from 'cloudflare:workers';
import { GameCore } from '../public/core.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('需要 WebSocket 連線', { status: 426 });
      return env.ARENA.get(env.ARENA.idFromName('main')).fetch(request);
    }
    if (url.pathname === '/status' || url.pathname === '/leaderboard') return env.ARENA.get(env.ARENA.idFromName('main')).fetch(request);
    return env.ASSETS.fetch(request);
  }
};

const taipeiDay = (offsetDays = 0) => new Date(Date.now() + 8 * 3600e3 + offsetDays * 864e5).toISOString().slice(0, 10);

export class Arena extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.core = new GameCore({ onMatchEnd: res => this.saveResults(res) });
    this.timer = null;
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS stats(name TEXT PRIMARY KEY, kills INTEGER DEFAULT 0, deaths INTEGER DEFAULT 0, wins INTEGER DEFAULT 0, matches INTEGER DEFAULT 0, best INTEGER DEFAULT 0, updated INTEGER DEFAULT 0)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS daily(day TEXT, name TEXT, kills INTEGER DEFAULT 0, wins INTEGER DEFAULT 0, matches INTEGER DEFAULT 0, PRIMARY KEY(day, name))`);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const json = o => Response.json(o, { headers: { 'cache-control': 'no-store' } });
    if (url.pathname === '/status') return json(this.core.status());
    if (url.pathname === '/leaderboard') {
      const day = taipeiDay();
      const all = this.sql.exec(`SELECT name, kills, deaths, wins, matches, best FROM stats ORDER BY kills DESC, wins DESC LIMIT 10`).toArray();
      const today = this.sql.exec(`SELECT name, kills, wins, matches FROM daily WHERE day = ? ORDER BY kills DESC, wins DESC LIMIT 10`, day).toArray();
      return json({ day, all, today });
    }
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('not found', { status: 404 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    const c = this.core.connect({ send: s => server.send(s), close: (code, reason) => server.close(code, reason) });
    server.addEventListener('message', e => { try { this.core.message(c, e.data); } catch (err) { } });
    const gone = () => { this.core.disconnect(c); if (!this.core.conns.size) this.stop(); };
    server.addEventListener('close', gone);
    server.addEventListener('error', gone);
    if (!this.timer) this.timer = setInterval(() => { try { this.core.tick(); } catch (err) { } }, 50);
    return new Response(null, { status: 101, webSocket: client });
  }
  stop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }

  /** Only real players are recorded; the nickname is the identity (friends-scale leaderboard). */
  saveResults(res) {
    const humans = res.rank.filter(r => !r.bot);
    if (!humans.length || res.reason === 'players') return;
    const top = res.rank[0], day = taipeiDay(), now = Date.now();
    for (const r of humans) {
      const win = (r.score === top.score && r.deaths === top.deaths) ? 1 : 0;
      this.sql.exec(`INSERT INTO stats(name, kills, deaths, wins, matches, best, updated) VALUES(?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(name) DO UPDATE SET kills = kills + excluded.kills, deaths = deaths + excluded.deaths, wins = wins + excluded.wins,
        matches = matches + 1, best = MAX(best, excluded.best), updated = excluded.updated`, r.name, r.kills, r.deaths, win, r.best, now);
      this.sql.exec(`INSERT INTO daily(day, name, kills, wins, matches) VALUES(?, ?, ?, ?, 1)
        ON CONFLICT(day, name) DO UPDATE SET kills = kills + excluded.kills, wins = wins + excluded.wins, matches = matches + 1`, day, r.name, r.kills, win);
    }
    this.sql.exec(`DELETE FROM daily WHERE day < ?`, taipeiDay(-7));
  }
}
