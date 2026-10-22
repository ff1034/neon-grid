// NEON GRID shared rules: used by the browser client and by the Cloudflare Durable Object server.
// Keep this file free of DOM / THREE dependencies so both sides simulate identically.
export const VERSION = 2;
export const MAX_PLAYERS = 8;
export const MAX_QUEUE = 64;
export const TICK = 1 / 60;
export const SEND_EVERY = 3;            // client batches 3 ticks per message => 20 messages/s
export const BITS = { FIRE: 1, JUMP: 2, RELOAD: 4, SW0: 8, SW1: 16 };
export const P = { speed: 6, grav: 22, jumpV: Math.sqrt(2 * 22 * 1.05), radius: .35, height: 1.8, eye: 1.62, step: .55, shield: 100, respawn: 3, protect: 1.5 };
export const MATCH = { time: 300, score: 20, countdown: 10, results: 9, minPlayers: 2, offerSec: 15 };
export const WEAPONS = [
  { id: 'pulse', name: '脈衝步槍', short: '脈衝', dmg: 20, rate: 6, mag: 24, reload: 1.6, range: 90, pellets: 0, spreadDeg: 0, color: 0x2ef2ff },
  { id: 'arc', name: '電弧散射器', short: '電弧', dmg: 8, rate: 1, mag: 6, reload: 2.0, range: 22, pellets: 6, spreadDeg: 2.6, color: 0xff2fb4 }];
export const PATTERN = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; PATTERN.push([Math.cos(a), Math.sin(a)]); }
export const PLAYER_COLORS = [0x2ef2ff, 0xff3fb8, 0xffb43a, 0x8cff5a, 0xa77bff, 0xff6a3d, 0x9fd8ff, 0xff4a5a];
export const SPAWNS = [[-13, 0, -6], [13, 0, 6], [-22, 0, -15.6], [22, 0, 15.6], [0, 3.5, 20], [0, 3.5, -20], [-12, 3.5, 20], [12, 3.5, -20], [0, 0, 10], [0, 0, -10], [-8, 0, 21], [8, 0, -21]];
export const NODES = [[0, 0, 10], [0, 0, -10], [-8, 0, 0], [8, 0, 0], [-8, 0, 10], [8, 0, 10], [-8, 0, -10], [8, 0, -10], [-12, 0, -3], [12, 0, 3], [-12, 0, 3], [12, 0, -3],
  [-14, 0, -13], [-14, 0, 13], [14, 0, 13], [14, 0, -13], [-22, 0, -18], [-22, 0, 18], [22, 0, 18], [22, 0, -18], [-8, 0, 20], [8, 0, 20], [-8, 0, -20], [8, 0, -20],
  [-16, 0, 2.6], [16, 0, 2.6], [-16, 0, -2.6], [16, 0, -2.6], [-16, 3.5, 17.2], [16, 3.5, 17.2], [-16, 3.5, -17.2], [16, 3.5, -17.2],
  [-10, 3.5, 18.5], [0, 3.5, 18.5], [10, 3.5, 18.5], [-10, 3.5, -18.5], [0, 3.5, -18.5], [10, 3.5, -18.5], [0, 3.5, 10], [0, 3.5, 0], [0, 3.5, -10]];
export const STAIR_LINKS = [[24, 28], [25, 29], [26, 30], [27, 31]];

export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const r3 = v => Math.round(v * 1000) / 1000;
export const r4 = v => Math.round(v * 10000) / 10000;
export const angWrap = a => { if (!isFinite(a)) return 0; a = a % (2 * Math.PI); if (a > Math.PI) a -= 2 * Math.PI; if (a < -Math.PI) a += 2 * Math.PI; return a; };
export function sanitizeName(s) { return (String(s || '').replace(/[\u0000-\u001f\u007f<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16)) || '代理人'; }

/* ---------- Map: every solid box. [x0,x1,y0,y1,z0,z1,material,uvScale] ---------- */
export function buildMap() {
  const M = [], b = (x0, x1, y0, y1, z0, z1, mat, uv = 4) => M.push([x0, x1, y0, y1, z0, z1, mat, uv]);
  b(-25.5, -24.5, 0, 9, -25.5, 25.5, 'concD'); b(24.5, 25.5, 0, 9, -25.5, 25.5, 'concD');
  b(-24.5, 24.5, 0, 9, -25.5, -24.5, 'concD'); b(-24.5, 24.5, 0, 9, 24.5, 25.5, 'concD');
  b(-3, 3, 0, 3.3, -3, 3, 'tower', 3); b(-3.15, 3.15, 3.3, 3.5, -3.15, 3.15, 'metal');
  b(-1.25, 1.25, 3.2, 3.5, 3.15, 16, 'grate', 2); b(-1.25, 1.25, 3.2, 3.5, -16, -3.15, 'grate', 2);
  b(-17, 17, 3.1, 3.5, 16, 24.5, 'grate', 2); b(-17, 17, 3.1, 3.5, -24.5, -16, 'grate', 2);
  for (const x of [-13.5, -7, 7, 13.5]) { b(x - .3, x + .3, 0, 3.1, 16, 16.6, 'metal', 2); b(x - .3, x + .3, 0, 3.1, -16.6, -16, 'metal', 2); }
  for (const [a, c] of [[-14.5, -9], [-5, -1.25], [1.25, 5], [9, 14.5]]) { b(a, c, 3.5, 4.5, 16, 16.12, 'metal', 1); b(a, c, 3.5, 4.5, -16.12, -16, 'metal', 1); }
  for (let i = 1; i <= 12; i++) { const h = i * 3.5 / 12;
    b(-17, -15, 0, h, 3 + i, 4 + i, 'metal', 2); b(15, 17, 0, h, 3 + i, 4 + i, 'metal', 2);
    b(-17, -15, 0, h, -4 - i, -3 - i, 'metal', 2); b(15, 17, 0, h, -4 - i, -3 - i, 'metal', 2); }
  for (const s of [-1, 1]) { const x0 = s > 0 ? 9.5 : -10.5, x1 = s > 0 ? 10.5 : -9.5; b(x0, x1, 0, 4, -12, -4, 'conc'); b(x0, x1, 0, 4, 4, 12, 'conc'); }
  b(-24.5, -19, 0, 11, -9, 9, 'bldg', 6); b(19, 24.5, 0, 11, -9, 9, 'bldg', 6);
  for (const c of [[4.5, 6.5, 1.1, 6, 8], [-6.5, -4.5, 1.1, -8, -6], [-7, -5, 2, 5.5, 6.5], [5, 7, 2, -6.5, -5.5], [-7, -6, 1.2, -1.5, 1.5], [6, 7, 1.2, -1.5, 1.5],
    [-14.5, -12.5, 1.3, -1, 1], [12.5, 14.5, 1.3, -1, 1], [-23, -21, 1.1, 11, 13], [-22, -20, 2, -14, -12], [17, 18.5, 1.1, 10.5, 12], [21, 23, 1.1, -13, -11], [20, 22, 2, 12, 14],
    [-8, -7, 1.1, 13, 14], [7, 8, 1.1, -14, -13], [-18.5, -17, 1.1, -12, -10.5]]) b(c[0], c[1], 0, c[2], c[3], c[4], 'crate', 1.2);
  for (const s of [1, -1]) for (const x of [-11, -3.5, 4, 11.5]) b(x, x + 1.1, 0, 2.1, s > 0 ? 23.7 : -24.5, s > 0 ? 24.5 : -23.7, 'dark', 1);
  for (const [x, z] of [[-21.5, 15.2], [21.5, -15.2], [-12, -14]]) b(x - .6, x + .6, 0, .5, z - .6, z + .6, 'metal', 1);
  return M;
}
export function buildColliders(map) {
  const C = [{ x0: -30, x1: 30, y0: -3, y1: 0, z0: -30, z1: 30 }];
  for (const m of map) C.push({ x0: m[0], x1: m[1], y0: m[2], y1: m[3], z0: m[4], z1: m[5] });
  return C;
}

/* ---------- Player state ---------- */
export function newPlayer(id, name, color) {
  return { id, name, color, pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, onGround: false, airT: 0,
    shield: P.shield, alive: false, respawnT: 0, protect: 0, score: 0, deaths: 0, wi: 0, ws: WEAPONS.map(w => ({ ammo: w.mag, reload: 0 })),
    cd: 0, switchT: 0, ack: 0, landed: false, bumped: false };
}

/* ---------- Collision & physics ---------- */
export function overlapsAt(x, y, z, r, h, b) { return x + r > b.x0 && x - r < b.x1 && z + r > b.z0 && z - r < b.z1 && y < b.y1 - 1e-3 && y + h > b.y0 + 1e-3; }
export function blockedAt(C, x, y, z, r, h) { for (const b of C) if (overlapsAt(x, y, z, r, h, b)) return true; return false; }
export function supported(C, x, y, z) { if (y < .05) return true; for (const b of C) if (Math.abs(b.y1 - y) < .08 && x > b.x0 - .02 && x < b.x1 + .02 && z > b.z0 - .02 && z < b.z1 + .02) return true; return false; }
function moveAxis(a, C, ax, d) {
  if (!d) return; const p = a.pos; p[ax] += d;
  for (const b of C) {
    if (!overlapsAt(p.x, p.y, p.z, P.radius, P.height, b)) continue;
    const up = b.y1 - p.y;
    if (up > 0 && up <= P.step && (a.onGround || a.vel.y <= 1.5) && !blockedAt(C, p.x, b.y1 + .001, p.z, P.radius, P.height)) { p.y = b.y1; a.vel.y = Math.max(a.vel.y, 0); a.onGround = true; continue; }
    if (ax === 'x') p.x = d > 0 ? b.x0 - P.radius - 1e-4 : b.x1 + P.radius + 1e-4; else p.z = d > 0 ? b.z0 - P.radius - 1e-4 : b.z1 + P.radius + 1e-4;
    a.vel[ax] = 0; a.bumped = true;
  }
}
function moveY(a, C, d) {
  const p = a.pos, prev = p.y; p.y += d; a.onGround = false;
  for (const b of C) {
    if (!overlapsAt(p.x, p.y, p.z, P.radius, P.height, b)) continue;
    if (d <= 0 && prev >= b.y1 - .06) { p.y = b.y1; a.vel.y = 0; a.onGround = true; }
    else if (d > 0 && prev + P.height <= b.y0 + .06) { p.y = b.y0 - P.height - 1e-3; a.vel.y = 0; }
  }
}
export function physics(a, C, wx, wz, jump, dt) {
  const acc = a.onGround ? 55 : 11, tx = wx * P.speed, tz = wz * P.speed;
  a.vel.x += clamp(tx - a.vel.x, -acc * dt, acc * dt); a.vel.z += clamp(tz - a.vel.z, -acc * dt, acc * dt);
  if (jump && a.onGround) { a.vel.y = P.jumpV; a.onGround = false; }
  a.vel.y -= P.grav * dt; if (a.vel.y < -40) a.vel.y = -40;
  const was = a.onGround; a.bumped = false;
  moveAxis(a, C, 'x', a.vel.x * dt); moveAxis(a, C, 'z', a.vel.z * dt); moveY(a, C, a.vel.y * dt);
  if (!was && a.onGround && a.airT > .25) a.landed = true;
  a.airT = a.onGround ? 0 : a.airT + dt;
}
let _nx = 0, _ny = 0, _nz = 0;
export function rayBox(o, d, b, tmax) {
  let t0 = 0, t1 = tmax, ax = -1, sg = 0;
  const lo = [b.x0, b.y0, b.z0], hi = [b.x1, b.y1, b.z1], oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dd[i]) < 1e-9) { if (oo[i] < lo[i] || oo[i] > hi[i]) return -1; continue; }
    let ta = (lo[i] - oo[i]) / dd[i], tb = (hi[i] - oo[i]) / dd[i]; if (ta > tb) { const q = ta; ta = tb; tb = q; }
    if (ta > t0) { t0 = ta; ax = i; sg = dd[i] > 0 ? -1 : 1; } if (tb < t1) t1 = tb; if (t0 > t1) return -1;
  }
  if (ax >= 0) { _nx = ax === 0 ? sg : 0; _ny = ax === 1 ? sg : 0; _nz = ax === 2 ? sg : 0; }
  return t0;
}
export function rayWorld(C, o, d, tmax, nOut) {
  let best = tmax, hit = false;
  for (const b of C) { const t = rayBox(o, d, b, best); if (t >= 0 && t < best) { best = t; hit = true; if (nOut) { nOut.x = _nx; nOut.y = _ny; nOut.z = _nz; } } }
  return hit ? best : -1;
}
export function los(C, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz);
  return rayWorld(C, a, { x: dx / L, y: dy / L, z: dz / L }, L - .05) < 0;
}
export function aimDir(yaw, pitch, out = {}) { const cp = Math.cos(pitch); out.x = -Math.sin(yaw) * cp; out.y = Math.sin(pitch); out.z = -Math.cos(yaw) * cp; return out; }
export function eye(a, out = {}) { out.x = a.pos.x; out.y = a.pos.y + P.eye; out.z = a.pos.z; return out; }

/* ---------- Weapons ---------- */
export function startReload(a) { const w = WEAPONS[a.wi], st = a.ws[a.wi]; if (st.reload > 0 || st.ammo >= w.mag || !a.alive) return false; st.reload = w.reload; return true; }
export function switchWeapon(a, i) { if (i === a.wi || !a.alive || (i !== 0 && i !== 1)) return false; a.ws[a.wi].reload = 0; a.wi = i; a.switchT = .35; return true; }
export function weaponTimers(a, dt) {
  a.cd -= dt; a.switchT -= dt; if (a.protect > 0) a.protect -= dt;
  const st = a.ws[a.wi]; if (st.reload > 0) { st.reload -= dt; if (st.reload <= 0) { st.reload = 0; st.ammo = WEAPONS[a.wi].mag; } }
}
export function tryFire(a) {
  const w = WEAPONS[a.wi], st = a.ws[a.wi];
  if (!a.alive || a.cd > 0 || a.switchT > 0 || st.reload > 0) return false;
  if (st.ammo <= 0) { startReload(a); return false; }
  st.ammo--; a.cd = 1 / w.rate; a.protect = 0;
  if (st.ammo === 0) startReload(a);
  return true;
}
/** Directions for a shot from yaw/pitch; fixed pattern for the scatter weapon (no randomness). */
export function shotDirs(a) {
  const w = WEAPONS[a.wi], f = aimDir(a.yaw, a.pitch);
  if (!w.pellets) return [f];
  const r = { x: Math.cos(a.yaw), y: 0, z: -Math.sin(a.yaw) };
  const u = { x: r.y * f.z - r.z * f.y, y: r.z * f.x - r.x * f.z, z: r.x * f.y - r.y * f.x };
  const tn = Math.tan(w.spreadDeg * Math.PI / 180), out = [];
  for (const [px, py] of PATTERN) { const x = f.x + r.x * px * tn + u.x * py * tn, y = f.y + r.y * px * tn + u.y * py * tn, z = f.z + r.z * px * tn + u.z * py * tn, L = Math.hypot(x, y, z); out.push({ x: x / L, y: y / L, z: z / L }); }
  return out;
}
const _tb = { x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0 };
/** Trace one ray against world and players. Returns {t, hit, n} */
export function traceShot(C, players, self, o, d, range) {
  const n = { x: 0, y: 0, z: 0 }; const wt = rayWorld(C, o, d, range, n);
  let end = wt < 0 ? range : wt, hit = null;
  for (const t of players) {
    if (t === self || !t.alive) continue;
    _tb.x0 = t.pos.x - .38; _tb.x1 = t.pos.x + .38; _tb.z0 = t.pos.z - .38; _tb.z1 = t.pos.z + .38; _tb.y0 = t.pos.y; _tb.y1 = t.pos.y + 1.86;
    const tt = rayBox(o, d, _tb, end); if (tt >= 0 && tt < end) { end = tt; hit = t; }
  }
  return { t: end, hit, n: hit ? null : (wt >= 0 ? n : null) };
}

/* ---------- One simulation tick for a player from an input ---------- */
// input: { s:seq, mx:strafe(-1..1), mz:forward(-1..1), y:yaw, p:pitch, b:bits }
export function sanitizeInput(i) {
  if (!i || typeof i !== 'object') return null;
  const s = +i.s, mx = +i.mx, mz = +i.mz, y = +i.y, p = +i.p, b = i.b | 0;
  if (![s, mx, mz, y, p].every(Number.isFinite)) return null;
  return { s: Math.floor(s), mx: clamp(mx, -1, 1), mz: clamp(mz, -1, 1), y: angWrap(y), p: clamp(p, -1.52, 1.52), b: b & 31 };
}
export function stepPlayer(a, inp, dt, C, allowFire = true) {
  a.yaw = inp.y; a.pitch = inp.p;
  weaponTimers(a, dt);
  if (!a.alive) { a.vel.x = a.vel.z = 0; physics(a, C, 0, 0, false, dt); return false; }
  if (inp.b & BITS.SW0) switchWeapon(a, 0); else if (inp.b & BITS.SW1) switchWeapon(a, 1);
  if (inp.b & BITS.RELOAD) startReload(a);
  let mx = inp.mx, mz = inp.mz; const L = Math.hypot(mx, mz); if (L > 1) { mx /= L; mz /= L; }
  const sy = Math.sin(a.yaw), cy = Math.cos(a.yaw);
  physics(a, C, -sy * mz + cy * mx, -cy * mz - sy * mx, !!(inp.b & BITS.JUMP), dt);
  if (allowFire && (inp.b & BITS.FIRE)) return tryFire(a);
  return false;
}

/* ---------- Spawning (server side in online play) ---------- */
export function pickSpawn(C, a, players, spawnState, now) {
  const en = players.filter(o => o !== a && o.alive), cand = [];
  for (let i = 0; i < SPAWNS.length; i++) {
    const sp = SPAWNS[i], st = spawnState[i]; const p = { x: sp[0], y: sp[1], z: sp[2] };
    if (en.some(o => Math.hypot(o.pos.x - p.x, o.pos.y - p.y, o.pos.z - p.z) < 1.2)) continue;
    const t = { x: p.x, y: p.y + 1.2, z: p.z }; let seen = false, minD = 60;
    for (const e of en) { const d = Math.hypot(e.pos.x - p.x, e.pos.y - p.y, e.pos.z - p.z); minD = Math.min(minD, d); if (!seen && d < 60 && los(C, eye(e), t)) seen = true; }
    cand.push({ i, seen, score: Math.min(minD, 40) - st.uses * 2.5 - (now - st.last < 6 ? 18 : 0) + Math.random() * 3 });
  }
  let pool = cand.filter(c => !c.seen); if (!pool.length) pool = cand; if (!pool.length) return Math.floor(Math.random() * SPAWNS.length);
  pool.sort((x, y) => y.score - x.score); return pool[0].i;
}
export function placeAt(a, i, spawnState, now) {
  const sp = SPAWNS[i]; spawnState[i].uses++; spawnState[i].last = now;
  a.pos.x = sp[0]; a.pos.y = sp[1] + .02; a.pos.z = sp[2]; a.vel.x = a.vel.y = a.vel.z = 0;
  a.yaw = Math.atan2(sp[0], sp[2]); a.pitch = 0; a.shield = P.shield; a.ws.forEach((s, k) => { s.ammo = WEAPONS[k].mag; s.reload = 0; });
  a.wi = 0; a.cd = 0; a.switchT = 0; a.protect = P.protect; a.alive = true; a.onGround = false; a.airT = 0;
}
export function rankPlayers(list) { return list.slice().sort((x, y) => y.score - x.score || x.deaths - y.deaths); }
