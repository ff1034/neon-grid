// NEON GRID bot brain. Produces the same input objects a human client sends, so bots obey identical rules.
import * as SH from './shared.js';

export function buildNav(C, arena = 'city') {
  const L = SH.LAYOUTS[arena] || SH.LAYOUTS.city;
  const nodes = L.nodes.map(a => ({ x: a[0], y: a[1], z: a[2] })), links = nodes.map(() => []);
  const walkable = (a, b) => {
    if (Math.abs(a.y - b.y) > .1) return false;
    const L = Math.hypot(a.x - b.x, a.z - b.z), n = Math.ceil(L / .35);
    for (let i = 0; i <= n; i++) { const t = i / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      if (SH.blockedAt(C, x, a.y + .3, z, .42, 1.45) || !SH.supported(C, x, a.y, z)) return false; }
    return true;
  };
  const link = (i, j) => { const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y, nodes[i].z - nodes[j].z); links[i].push([j, d]); links[j].push([i, d]); };
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++)
    if (Math.hypot(nodes[i].x - nodes[j].x, nodes[i].z - nodes[j].z) < 17 && walkable(nodes[i], nodes[j])) link(i, j);
  for (const [a, b] of L.stairLinks) link(a, b);
  const zoneNode = nodes.findIndex(n => n.x === 0 && n.z === 0 && n.y > 3);
  return { nodes, links, zoneNode };
}
export function nearestNode(nav, p) {
  let best = 0, bd = 1e9;
  nav.nodes.forEach((n, i) => { const d = Math.hypot(n.x - p.x, n.z - p.z) + Math.abs(n.y - p.y) * 6; if (d < bd) { bd = d; best = i; } });
  return best;
}
/** Nearest node the bot can walk to in a straight line (a node behind a wall is useless as a start: the bot would push into the wall). */
function startNode(nav, C, p) {
  const order = nav.nodes.map((n, i) => [Math.hypot(n.x - p.x, n.z - p.z) + Math.abs(n.y - p.y) * 6, i]).sort((a, b) => a[0] - b[0]);
  for (const [, i] of order.slice(0, 8)) {
    const n = nav.nodes[i]; if (Math.abs(n.y - p.y) > 1.2) continue;
    const L = Math.hypot(n.x - p.x, n.z - p.z), steps = Math.ceil(L / .35); let ok = true;
    for (let k = 1; k <= steps && ok; k++) { const t = k / steps; if (SH.blockedAt(C, p.x + (n.x - p.x) * t, p.y + .3, p.z + (n.z - p.z) * t, .3, 1.4)) ok = false; }
    if (ok) return i;
  }
  return order[0][1];
}
function planPath(nav, C, from, goal) {
  const N = nav.nodes.length, s = startNode(nav, C, from);
  if (goal === s) return [];
  const dist = new Array(N).fill(1e9), prev = new Array(N).fill(-1), done = new Array(N).fill(false); dist[s] = 0;
  for (;;) {
    let u = -1, ud = 1e9; for (let i = 0; i < N; i++) if (!done[i] && dist[i] < ud) { ud = dist[i]; u = i; }
    if (u < 0 || u === goal) break; done[u] = true;
    for (const [v, w] of nav.links[u]) if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; }
  }
  const path = []; if (dist[goal] < 1e9) { let c = goal; while (c !== -1) { path.unshift(c); c = prev[c]; } } else path.push(s);
  return path;
}
export function newBotAI() { return { goalPos: null, target: null, seeT: 0, think: 0, errX: 0, errY: 0, strafe: 1, strafeT: 0, path: [], stuckT: 0, hurtBy: null, hurtT: 0, holdT: 0, wish: false, fought: false }; }

function chooseGoal(a, X) {
  const nav = X.nav; a.ai.goalPos = null;
  if (X.mode === 'koth' && Math.random() < .7) return nav.zoneNode;
  if (a.shield < 60) {
    let best = null, bd = 1e9;
    X.pickups.forEach(p => { if (p.on && p.type === 'shield') { const d = Math.hypot(p.x - a.pos.x, p.z - a.pos.z); if (d < bd) { bd = d; best = p; } } });
    if (best) { a.ai.goalPos = best; return nearestNode(nav, best); }
  }
  if (Math.random() < .2) { const b = X.pickups.find(p => p.on && p.type === 'boost'); if (b) { a.ai.goalPos = b; return nearestNode(nav, b); } }
  return Math.floor(Math.random() * nav.nodes.length);
}

/** Returns an input {mx,mz,y,p,b} for one 1/60 s tick. X = { C, nav, players, diff, frozen, mode, pickups } */
export function botInput(a, X, dt) {
  const ai = a.ai, D = SH.DIFF[X.diff] || SH.DIFF.normal;
  let yaw = a.yaw, pitch = a.pitch, b = 0, wx = 0, wz = 0;
  if (!a.alive) { ai.target = null; ai.path = []; return { mx: 0, mz: 0, y: yaw, p: pitch, b: 0 }; }
  const e = SH.eye(a), turn = (want, wantP, rate) => { yaw += SH.clamp(SH.angWrap(want - yaw), -rate * dt, rate * dt); pitch += SH.clamp(wantP - pitch, -rate * dt, rate * dt); };
  ai.think -= dt; ai.hurtT -= dt;
  if (ai.think <= 0) {
    ai.think = .12 + Math.random() * .08; let best = null, bs = 1e9; const f = SH.aimDir(yaw, 0);
    for (const t of X.players) {
      if (t === a || !t.alive) continue;
      const dx = t.pos.x - a.pos.x, dz = t.pos.z - a.pos.z, hd = Math.hypot(dx, dz); if (hd > 70) continue;
      const facing = (dx * f.x + dz * f.z) / (hd || 1), aware = facing > .3 || hd < 7 || (ai.hurtBy === t && ai.hurtT > 0); if (!aware) continue;
      if (!SH.los(X.C, e, { x: t.pos.x, y: t.pos.y + 1.2, z: t.pos.z })) continue;
      const sc = hd - (t === ai.target ? 6 : 0) - (t === ai.hurtBy ? 8 : 0) + (t.protect > 0 ? 10 : 0);
      if (sc < bs) { bs = sc; best = t; }
    }
    if (best !== ai.target) { ai.target = best; ai.seeT = 0; ai.errX = (Math.random() - .5) * D.err * 7; ai.errY = (Math.random() - .5) * D.err * 4; }
  }
  const t = ai.target;
  if (t && t.alive) {
    ai.seeT += dt; ai.fought = true;
    const dx = t.pos.x - a.pos.x, dz = t.pos.z - a.pos.z, hd = Math.max(.01, Math.hypot(dx, dz)), dy = (t.pos.y + 1.2) - (a.pos.y + SH.P.eye);
    const dec = Math.exp(-dt / D.track);
    ai.errX = ai.errX * dec + (Math.random() - .5) * D.err * dt * 4; ai.errY = ai.errY * dec + (Math.random() - .5) * D.err * dt * 3;
    const lead = .06, want = Math.atan2(-(dx + t.vel.x * lead), -(dz + t.vel.z * lead)) + ai.errX, wantP = Math.atan2(dy, hd) + ai.errY;
    turn(want, wantP, D.turn);
    const ww = hd < 7 ? 1 : hd > 24 ? 2 : 0;
    if (ww !== a.wi && a.switchT <= 0 && Math.random() < dt * 2.5) b |= [SH.BITS.SW0, SH.BITS.SW1, SH.BITS.SW2][ww];
    const rail = a.wi === 2, react = D.react * (rail ? 1.3 : 1), ang = D.fireAng * (hd < 8 ? 2.5 : 1) * (rail ? .5 : 1);
    if (!X.frozen && ai.seeT > react && Math.abs(SH.angWrap(want - yaw)) < ang && SH.los(X.C, e, { x: t.pos.x, y: t.pos.y + 1.2, z: t.pos.z })) b |= SH.BITS.FIRE;
    ai.strafeT -= dt; if (ai.strafeT <= 0) { ai.strafe = -ai.strafe; ai.strafeT = .5 + Math.random() * 1.4; }
    const pref = a.wi === 1 ? 4 : a.wi === 2 ? 22 : 13, rad = hd > pref + 3 ? 1 : (hd < pref - 3 ? -.7 : 0), fx = dx / hd, fz = dz / hd;
    let rx = fx * rad, rz = fz * rad;
    if (X.mode === 'koth' && ai.holdT > 0) { rx = 0; rz = 0; }       // holding the relay: strafe only
    wx = rx + fz * ai.strafe * .9; wz = rz - fx * ai.strafe * .9;
    if (a.onGround && Math.random() < dt * .35) b |= SH.BITS.JUMP;
  } else {
    ai.target = null;
    // strafing during a fight moves the bot off its route: plan again from here instead of walking back to a stale node
    if (ai.fought) { ai.fought = false; ai.path = []; }
    if (ai.hurtBy && ai.hurtT > 0 && ai.hurtBy.alive) { const dx = ai.hurtBy.pos.x - a.pos.x, dz = ai.hurtBy.pos.z - a.pos.z; turn(Math.atan2(-dx, -dz), 0, D.turn); }
    else {
      const inZone = X.mode === 'koth' && SH.inZone(a);
      if (inZone) { ai.holdT = 3; ai.path = []; ai.strafeT -= dt; if (ai.strafeT <= 0) { ai.strafe = -ai.strafe; ai.strafeT = .8 + Math.random(); }
        wx = Math.cos(yaw) * ai.strafe * .5 - a.pos.x * .3; wz = -Math.sin(yaw) * ai.strafe * .5 - a.pos.z * .3; turn(yaw + dt * 1.2, 0, 2); }
      else {
        ai.holdT -= dt;
        const gp = ai.goalPos;
        if (!ai.path.length && gp && Math.abs(gp.y - a.pos.y) < 1 && Math.hypot(gp.x - a.pos.x, gp.z - a.pos.z) < 6) {
          const dx = gp.x - a.pos.x, dz = gp.z - a.pos.z, hd = Math.hypot(dx, dz);
          if (hd < .4 || (gp.on === false)) ai.goalPos = null; else { wx = dx / hd; wz = dz / hd; turn(Math.atan2(-dx, -dz), 0, 5); }
        } else {
        if (!ai.path.length) ai.path = planPath(X.nav, X.C, a.pos, chooseGoal(a, X));
        if (ai.path.length) {
          const n = X.nav.nodes[ai.path[0]], dx = n.x - a.pos.x, dz = n.z - a.pos.z, hd = Math.hypot(dx, dz);
          // up on the catwalks a 0.75 m early turn walks a bot off a 0.9 m walkway, so be precise there
          if (hd < (n.y > 3 ? .35 : .75) && Math.abs(n.y - a.pos.y) < 1.6) ai.path.shift();
          else { wx = dx / hd; wz = dz / hd; turn(Math.atan2(-dx, -dz), 0, 5); }
        }
        }
        pitch += SH.clamp(-pitch, -2 * dt, 2 * dt);
      }
    }
    if (a.ws[a.wi].ammo < SH.WEAPONS[a.wi].mag * .5) b |= SH.BITS.RELOAD;
  }
  let L = Math.hypot(wx, wz); if (L > 1) { wx /= L; wz /= L; }
  if (a.pos.y > .5 && (wx || wz) && !SH.supported(X.C, a.pos.x + wx * .9, a.pos.y, a.pos.z + wz * .9) && !SH.blockedAt(X.C, a.pos.x + wx * .9, a.pos.y - .4, a.pos.z + wz * .9, .1, .4)) {
    if (t) { wx = -wx * .3; wz = -wz * .3; ai.strafe *= -1; }
  }
  // stuck handling, based on the previous physics step
  if (a.bumped && ai.wish) ai.stuckT += dt; else ai.stuckT = Math.max(0, ai.stuckT - dt * .5);
  if (ai.stuckT > .35 && a.onGround) b |= SH.BITS.JUMP;
  if (ai.stuckT > 1.6) { ai.path = []; ai.stuckT = 0; ai.strafe *= -1; }
  if (X.frozen) { wx = wz = 0; b &= ~(SH.BITS.JUMP | SH.BITS.FIRE); }
  ai.wish = !!(wx || wz);
  yaw = SH.angWrap(yaw); pitch = SH.clamp(pitch, -1.52, 1.52);
  const sy = Math.sin(yaw), cy = Math.cos(yaw);
  return { mx: wx * cy - wz * sy, mz: -wx * sy - wz * cy, y: yaw, p: pitch, b };
}
