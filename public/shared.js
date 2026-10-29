// NEON GRID shared rules: used by the browser client and by the Cloudflare Durable Object server.
// Keep this file free of DOM / THREE dependencies so both sides simulate identically.
export const VERSION = 5;
export const MAX_PLAYERS = 8;
export const MAX_QUEUE = 64;
export const TICK = 1 / 60;
export const SEND_EVERY = 3;            // client batches 3 ticks per message => 20 messages/s
export const BITS = { FIRE: 1, JUMP: 2, RELOAD: 4, SW0: 8, SW1: 16, SW2: 32 };
export const P = { boostMul: 1.35, speed: 6, grav: 22, jumpV: Math.sqrt(2 * 22 * 1.05), radius: .35, height: 1.8, eye: 1.62, step: .55, shield: 100, respawn: 3, protect: 1.5 };
export const MATCH = { time: 300, countdown: 10, results: 10, minPlayers: 2, offerSec: 15, fillTo: 4 };
export const MODES = {
  ffa: { id: 'ffa', name: '自由競技', score: 20, desc: '淘汰對手得 1 分' },
  koth: { id: 'koth', name: '佔領中繼站', score: 60, desc: '獨自站在中繼塔頂，每秒得 1 分' } };
// Arenas rotate every full round of modes (server-decided, everyone sees the same one); each has its own colliders (buildMap)
// and bot nav graph (LAYOUTS), the outer shell (walls, platforms, stairs, side buildings) is shared so SPAWNS / PICKUPS fit all of them.
export const ARENAS = {
  city: { id: 'city', name: '霓虹城市' },
  underground: { id: 'underground', name: '地下電網' },
  skyfort: { id: 'skyfort', name: '天穹要塞' },
  magma: { id: 'magma', name: '熔岩工業區' },
  coastal: { id: 'coastal', name: '海岸研究站' } };
export const ARENA_ORDER = ['city', 'underground', 'skyfort', 'magma', 'coastal'];
export const KOTH_ZONE = { x0: -3.15, x1: 3.15, z0: -3.15, z1: 3.15, y0: 3.3, y1: 6 };
export const canFire = state => state === 'playing' || state === 'waiting';
export function inZone(p) { const q = p.pos; return p.alive && q.x > KOTH_ZONE.x0 && q.x < KOTH_ZONE.x1 && q.z > KOTH_ZONE.z0 && q.z < KOTH_ZONE.z1 && q.y >= KOTH_ZONE.y0 && q.y < KOTH_ZONE.y1; }
export const PICKUP_TYPES = { shield: { amount: 50, respawn: 20 }, boost: { time: 6, respawn: 25 } };
export const PICKUPS = [
  { type: 'shield', x: -12.5, y: 0, z: 6 }, { type: 'shield', x: 12.5, y: 0, z: -6 }, { type: 'shield', x: 0, y: 0, z: 21.5 }, { type: 'shield', x: 0, y: 0, z: -21.5 },
  { type: 'boost', x: 8, y: 3.5, z: 20.5 }, { type: 'boost', x: -8, y: 3.5, z: -20.5 }];
export const QUICK_CHAT = ['好槍法！', '再來一場？', '等我一下', '跟我來', '小心後面', '哈哈哈'];
export const BOT_NAMES = ['霓影', 'K-ROW', '雨刃', 'VEX-9', '幽頻', 'NULLA', '赤弦', '鈦鴉'];
export const DIFF = { easy: { react: .75, err: .085, turn: 3.6, fireAng: .09, track: 1.8 }, normal: { react: .45, err: .05, turn: 5.2, fireAng: .06, track: 1.2 }, hard: { react: .25, err: .026, turn: 8, fireAng: .04, track: .8 } };
export const WEAPONS = [
  { id: 'pulse', name: '脈衝步槍', short: '脈衝', dmg: 20, rate: 6, mag: 24, reload: 1.6, range: 90, pellets: 0, spreadDeg: 0, color: 0x2ef2ff },
  { id: 'arc', name: '電弧散射器', short: '電弧', dmg: 8, rate: 1, mag: 6, reload: 2.0, range: 22, pellets: 6, spreadDeg: 2.6, color: 0xff2fb4 },
  { id: 'rail', name: '軌道狙擊槍', short: '軌道', dmg: 70, rate: .8, mag: 4, reload: 2.4, range: 120, pellets: 0, spreadDeg: 0, color: 0xffb43a }];
export const PATTERN = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; PATTERN.push([Math.cos(a), Math.sin(a)]); }
export const PLAYER_COLORS = [0x2ef2ff, 0xff3fb8, 0xffb43a, 0x8cff5a, 0xa77bff, 0xff6a3d, 0x9fd8ff, 0xff4a5a];
export const SPAWNS = [[-13, 0, -6], [13, 0, 6], [-22, 0, -15.6], [22, 0, 15.6], [0, 3.5, 20], [0, 3.5, -20], [-12, 3.5, 20], [12, 3.5, -20], [0, 0, 10], [0, 0, -10], [-8, 0, 21], [8, 0, -21]];
export const NODES = [[0, 0, 10], [0, 0, -10], [-8, 0, 0], [8, 0, 0], [-8, 0, 10], [8, 0, 10], [-8, 0, -10], [8, 0, -10], [-12, 0, -3], [12, 0, 3], [-12, 0, 3], [12, 0, -3],
  [-14, 0, -13], [-14, 0, 13], [14, 0, 13], [14, 0, -13], [-22, 0, -18], [-22, 0, 18], [22, 0, 18], [22, 0, -18], [-8, 0, 20], [8, 0, 20], [-8, 0, -20], [8, 0, -20],
  [-16, 0, 2.6], [16, 0, 2.6], [-16, 0, -2.6], [16, 0, -2.6], [-16, 3.5, 17.2], [16, 3.5, 17.2], [-16, 3.5, -17.2], [16, 3.5, -17.2],
  [-10, 3.5, 18.5], [0, 3.5, 18.5], [10, 3.5, 18.5], [-10, 3.5, -18.5], [0, 3.5, -18.5], [10, 3.5, -18.5], [0, 3.5, 10], [0, 3.5, 0], [0, 3.5, -10]];
export const STAIR_LINKS = [[24, 28], [25, 29], [26, 30], [27, 31]];
// Underground nav: same graph as the city (so STAIR_LINKS indices still hold), but the bridge-centre nodes move onto the
// new catwalks (north: two narrow side walkways, south: one diagonal), plus a few nodes where those join the reactor/platforms.
const U_NODES = NODES.map(n => n.slice());
U_NODES[38] = [1.8, 3.5, 10]; U_NODES[40] = [-4, 3.5, -9.6]; U_NODES[12] = [-13.5, 0, -15];  // #12 sat inside the west crate maze
U_NODES.push([-1.8, 3.5, 10], [1.8, 3.5, 2], [-1.8, 3.5, 2], [1.8, 3.5, 17], [-1.8, 3.5, 17], [0, 3.5, -2.6], [-8, 3.5, -17]);
// skyfort / coastal: cross bridges (east / west ones end on side-building balconies); skyfort also has the 8 m sky ring
const CROSS_NODES = [[5, 3.5, 0], [-5, 3.5, 0], [11, 3.5, 0], [-11, 3.5, 0], [16.5, 3.5, 0], [-16.5, 3.5, 0],
  [18.25, 3.5, 4.5], [18.25, 3.5, -4.5], [-18.25, 3.5, 4.5], [-18.25, 3.5, -4.5], [0, 3.5, 5], [0, 3.5, -5], [18.25, 3.5, 0], [-18.25, 3.5, 0]];
const S_NODES = NODES.concat(CROSS_NODES, [[8, 3.5, 0], [-8, 3.5, 0], [0, 3.5, 8], [0, 3.5, -8], [8, 3.5, 8], [-8, 3.5, 8], [8, 3.5, -8], [-8, 3.5, -8], [4.5, 3.5, 8], [-4.5, 3.5, 8], [4.5, 3.5, -8], [-4.5, 3.5, -8],
  [8, 3.5, 4.5], [8, 3.5, -4.5], [-8, 3.5, 4.5], [-8, 3.5, -4.5]]);
// magma: no straight bridges, so the three bridge-centre nodes (#38-40) move: #38/#40 onto the NE/SW diagonals, plus the other
// diagonals and the landings where they meet the platforms
const MG_NODES = NODES.map(n => n.slice());
MG_NODES[38] = [7.12, 3.5, 9.6]; MG_NODES[40] = [-7.12, 3.5, -9.6];
MG_NODES.push([-7.12, 3.5, 9.6], [7.12, 3.5, -9.6], [11.69, 3.5, 15.6], [-11.69, 3.5, 15.6], [11.69, 3.5, -15.6], [-11.69, 3.5, -15.6],
  [11.7, 3.5, 17.5], [-11.7, 3.5, 17.5], [11.7, 3.5, -17.5], [-11.7, 3.5, -17.5], [4.2, 3.5, 5.6], [-4.2, 3.5, 5.6], [4.2, 3.5, -5.6], [-4.2, 3.5, -5.6]);
export const LAYOUTS = {
  city: { nodes: NODES, stairLinks: STAIR_LINKS },
  underground: { nodes: U_NODES, stairLinks: STAIR_LINKS },
  skyfort: { nodes: S_NODES, stairLinks: STAIR_LINKS },
  magma: { nodes: MG_NODES, stairLinks: STAIR_LINKS },
  coastal: { nodes: NODES.concat(CROSS_NODES), stairLinks: STAIR_LINKS } };

export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const r3 = v => Math.round(v * 1000) / 1000;
export const r4 = v => Math.round(v * 10000) / 10000;
export const angWrap = a => { if (!isFinite(a)) return 0; a = a % (2 * Math.PI); if (a > Math.PI) a -= 2 * Math.PI; if (a < -Math.PI) a += 2 * Math.PI; return a; };
export function sanitizeName(s) { return (String(s || '').replace(/[\u0000-\u001f\u007f<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16)) || '代理人'; }

/* ---------- Map: every solid box. [x0,x1,y0,y1,z0,z1,material,uvScale,group] ----------
 * group names the Blender object the box belongs to (the .glb is built from these exact numbers). */
export function buildMap(arena = 'city') {
  const M = [], b = (x0, x1, y0, y1, z0, z1, mat, uv, group) => M.push([x0, x1, y0, y1, z0, z1, mat, uv, group]);
  if (!ARENAS[arena]) arena = 'city';
  const U = arena === 'underground', MG = arena === 'magma';
  // shared by every arena: perimeter, upper platforms, pillars, stairs, side buildings, wall units, vents
  b(-25.5, -24.5, 0, 9, -25.5, 25.5, 'concD', 4, 'Outer_Walls'); b(24.5, 25.5, 0, 9, -25.5, 25.5, 'concD', 4, 'Outer_Walls');
  b(-24.5, 24.5, 0, 9, -25.5, -24.5, 'concD', 4, 'Outer_Walls'); b(-24.5, 24.5, 0, 9, 24.5, 25.5, 'concD', 4, 'Outer_Walls');
  b(-17, 17, 3.1, 3.5, 16, 24.5, 'grate', 2, 'Upper_Platform_N'); b(-17, 17, 3.1, 3.5, -24.5, -16, 'grate', 2, 'Upper_Platform_S');
  for (const x of [-13.5, -7, 7, 13.5]) { b(x - .3, x + .3, 0, 3.1, 16, 16.6, 'metal', 2, 'Pillars'); b(x - .3, x + .3, 0, 3.1, -16.6, -16, 'metal', 2, 'Pillars'); }
  for (let i = 1; i <= 12; i++) { const h = i * 3.5 / 12;
    b(-17, -15, 0, h, 3 + i, 4 + i, 'metal', 2, 'Stairs_1'); b(15, 17, 0, h, 3 + i, 4 + i, 'metal', 2, 'Stairs_2');
    b(-17, -15, 0, h, -4 - i, -3 - i, 'metal', 2, 'Stairs_3'); b(15, 17, 0, h, -4 - i, -3 - i, 'metal', 2, 'Stairs_4'); }
  // magma works has big pipelines here instead of the 4 m divider walls
  if (!MG) for (const s of [-1, 1]) { const x0 = s > 0 ? 9.5 : -10.5, x1 = s > 0 ? 10.5 : -9.5; b(x0, x1, 0, 4, -12, -4, 'conc', 4, 'Divider_Walls'); b(x0, x1, 0, 4, 4, 12, 'conc', 4, 'Divider_Walls'); }
  b(-24.5, -19, 0, 11, -9, 9, 'bldg', 6, 'Side_Building_W'); b(19, 24.5, 0, 11, -9, 9, 'bldg', 6, 'Side_Building_E');
  for (const s of [1, -1]) for (const x of [-11, -3.5, 4, 11.5]) b(x, x + 1.1, 0, 2.1, s > 0 ? 23.7 : -24.5, s > 0 ? 24.5 : -23.7, 'dark', 1, 'Wall_Units');
  for (const [x, z] of [[-21.5, 15.2], [21.5, -15.2], [-12, -14]]) b(x - .6, x + .6, 0, .5, z - .6, z + .6, 'metal', 1, 'Floor_Plates');
  if (arena === 'skyfort' || arena === 'magma' || arena === 'coastal') return buildMapNew(arena, b, M);
  if (!U) {
    // city: square relay tower, two straight bridges, symmetric cover
    b(-3, 3, 0, 3.3, -3, 3, 'tower', 3, 'Central_Tower'); b(-3.15, 3.15, 3.3, 3.5, -3.15, 3.15, 'metal', 4, 'Central_Tower');
    b(-1.25, 1.25, 3.2, 3.5, 3.15, 16, 'grate', 2, 'North_Bridge'); b(-1.25, 1.25, 3.2, 3.5, -16, -3.15, 'grate', 2, 'South_Bridge');
    for (const [a, c] of [[-14.5, -9], [-5, -1.25], [1.25, 5], [9, 14.5]]) { b(a, c, 3.5, 4.5, 16, 16.12, 'metal', 1, 'Railings'); b(a, c, 3.5, 4.5, -16.12, -16, 'metal', 1, 'Railings'); }
    for (const c of [[4.5, 6.5, 1.1, 6, 8], [-6.5, -4.5, 1.1, -8, -6], [-7, -5, 2, 5.5, 6.5], [5, 7, 2, -6.5, -5.5], [-7, -6, 1.2, -1.5, 1.5], [6, 7, 1.2, -1.5, 1.5],
      [-14.5, -12.5, 1.3, -1, 1], [12.5, 14.5, 1.3, -1, 1], [-23, -21, 1.1, 11, 13], [-22, -20, 2, -14, -12], [17, 18.5, 1.1, 10.5, 12], [21, 23, 1.1, -13, -11], [20, 22, 2, 12, 14],
      [-8, -7, 1.1, 13, 14], [7, 8, 1.1, -14, -13], [-18.5, -17, 1.1, -12, -10.5]]) b(c[0], c[1], 0, c[2], c[3], c[4], 'crate', 1.2, 'Crates');
    return M;
  }
  // underground: round reactor core (octagon of 5 non-overlapping boxes, still inside ±3) with a ±3.15 glass deck on top
  const oct = (r, w, y0, y1, mat, g) => { const s = r * Math.SQRT1_2;
    b(-s, s, y0, y1, -s, s, mat, 3, g);
    b(s, r, y0, y1, -w, w, mat, 3, g); b(-r, -s, y0, y1, -w, w, mat, 3, g); b(-w, w, y0, y1, s, r, mat, 3, g); b(-w, w, y0, y1, -r, -s, mat, 3, g); };
  oct(3, 1.24, 0, 3.3, 'tower', 'Reactor_Core'); oct(3.15, 1.3, 3.3, 3.5, 'metal', 'Reactor_Core');
  // north (+z): two narrow walkways with nothing between them; they leave the deck where its centre square ends
  const deckS = 3.15 * Math.SQRT1_2;
  for (const s of [-1, 1]) b(s > 0 ? 1.35 : -2.25, s > 0 ? 2.25 : -1.35, 3.2, 3.5, deckS, 16, 'grate', 2, 'North_Catwalks');
  // south (-z): one diagonal catwalk to x = -8, built as 13 short segments, each shifted sideways (walkable stair-step edge)
  const segN = 13, segL = (16 - 3.15) / segN;
  for (let i = 0; i < segN; i++) { const z1 = -3.15 - i * segL, z0 = z1 - segL, cx = -8 * (i / (segN - 1));
    b(cx - .8, cx + .8, 3.2, 3.5, z0, z1, 'grate', 2, 'South_Catwalk'); }
  // railings line the platform edges, with gaps where the walkways land and a jump-down gap on each side
  for (const [a, c] of [[-14.5, -3], [-.9, .9], [3, 9], [12, 14.5]]) b(a, c, 3.5, 4.5, 16, 16.12, 'metal', 1, 'Railings');
  for (const [a, c] of [[-14.5, -9.6], [-6.4, -1.5], [1.5, 6], [9.5, 14.5]]) b(a, c, 3.5, 4.5, -16.12, -16, 'metal', 1, 'Railings');
  // blast shields on the platforms: chest-high cover
  for (const [x0, x1, z0, z1] of [[-11, -9.2, 19.4, 19.7], [5.5, 7.3, 19.4, 19.7], [-2, -.2, 22, 22.3],
    [9, 10.8, -19.7, -19.4], [-4.5, -2.7, -19.7, -19.4], [2, 3.8, -22.3, -22]]) b(x0, x1, 3.5, 4.7, z0, z1, 'dark', 1, 'Blast_Shields');
  // asymmetric cover: a dense transformer / container maze in the west, open sightlines in the east
  for (const c of [[-8.5, -6.5, 2, 1.5, 3.5], [-7, -5.5, 1.2, -3, -1.5], [-14.8, -12.8, 2, .3, 2.1], [-13, -11.5, 1.1, -1.9, -.6], [-16.5, -15, 2, -1.5, 1.5],
    [-8, -6, 1.1, 7, 9], [-6, -4.5, 2, -9, -7], [-14.5, -12.5, 1.3, 9, 11], [-13.5, -12, 2, -11, -9], [-20, -18.5, 1.1, 10.5, 12], [-22.5, -21, 2, -13, -11.5],
    [-5.5, -4, 1.1, 12.5, 14], [6, 7, 1.2, -1.5, 1.5], [13, 14.5, 1.3, 2, 3.5], [20, 22, 2, 12, 14], [7, 8, 1.1, -14, -13]]) b(c[0], c[1], 0, c[2], c[3], c[4], 'crate', 1.2, 'Crates');
  return M;
}
/* skyfort / magma / coastal: every one of them keeps the shared shell above (walls, platforms, stairs, side buildings) and
 * swaps the centre. All three have a 6.3 m tower whose 3.5 m deck is the relay zone, topped by an open crown frame
 * (posts + edge beams, 6.6-6.9 m, above head height) and an 11 m spire. */
function buildMapNew(arena, b, M) {
  const crown = (g, post, mid) => {   // post: half size of the frame; mid: posts at the middle of each edge instead of the corners
    if (mid) { b(post - .3, post, 3.5, 6.6, -.15, .15, 'metal', 1, g); b(-post, -post + .3, 3.5, 6.6, -.15, .15, 'metal', 1, g);
      b(-.15, .15, 3.5, 6.6, post - .3, post, 'metal', 1, g); b(-.15, .15, 3.5, 6.6, -post, -post + .3, 'metal', 1, g); }
    else for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const x = sx * post, z = sz * post;
      b(Math.min(x, x - sx * .3), Math.max(x, x - sx * .3), 3.5, 6.6, Math.min(z, z - sz * .3), Math.max(z, z - sz * .3), 'metal', 1, g); }
    b(-post, post, 6.6, 6.9, post - .3, post, 'metal', 1, g); b(-post, post, 6.6, 6.9, -post, -post + .3, 'metal', 1, g);
    b(post - .3, post, 6.6, 6.9, -post + .3, post - .3, 'metal', 1, g); b(-post, -post + .3, 6.6, 6.9, -post + .3, post - .3, 'metal', 1, g);
    b(-.9, .9, 7.4, 11, -.9, .9, 'tower', 2, 'Tower_Spire'); };
  // four straight bridges (cross) plus a 1.5 m balcony on each side building where the east / west bridge lands
  const cross = () => {
    b(-1.25, 1.25, 3.2, 3.5, 3.15, 16, 'grate', 2, 'North_Bridge'); b(-1.25, 1.25, 3.2, 3.5, -16, -3.15, 'grate', 2, 'South_Bridge');
    b(3.15, 17.5, 3.2, 3.5, -1.25, 1.25, 'grate', 2, 'East_Bridge'); b(-17.5, -3.15, 3.2, 3.5, -1.25, 1.25, 'grate', 2, 'West_Bridge');
    b(17.5, 19, 3.1, 3.5, -6, 6, 'metal', 2, 'Balconies'); b(-19, -17.5, 3.1, 3.5, -6, 6, 'metal', 2, 'Balconies'); };
  const rails = gaps => { for (const [a, c] of gaps) { b(a, c, 3.5, 4.5, 16, 16.12, 'metal', 1, 'Railings'); b(-c, -a, 3.5, 4.5, -16.12, -16, 'metal', 1, 'Railings'); } };
  const crates = list => { for (const c of list) b(c[0], c[1], 0, c[2], c[3], c[4], 'crate', 1.2, 'Crates'); };
  if (arena === 'skyfort') {
    // floating fortress: square tower, cross bridges, and an elevated square ring (the "square frame") at 8 m around it
    b(-3, 3, 0, 3.3, -3, 3, 'tower', 3, 'Central_Tower'); b(-3.15, 3.15, 3.3, 3.5, -3.15, 3.15, 'metal', 4, 'Central_Tower'); crown('Tower_Crown', 3.05);
    cross();
    for (const s of [-1, 1]) { const z0 = s > 0 ? 7.25 : -8.75, z1 = z0 + 1.5;
      b(-8.75, -1.25, 3.2, 3.5, z0, z1, 'grate', 2, 'Sky_Ring'); b(1.25, 8.75, 3.2, 3.5, z0, z1, 'grate', 2, 'Sky_Ring');
      b(z0, z1, 3.2, 3.5, -7.25, -1.25, 'grate', 2, 'Sky_Ring'); b(z0, z1, 3.2, 3.5, 1.25, 7.25, 'grate', 2, 'Sky_Ring'); }
    rails([[-14.5, -9], [-5, -1.25], [1.25, 5], [9, 14.5]]);
    crates([[4.5, 6.5, 1.1, 5, 6.5], [-6.5, -4.5, 1.1, -6.5, -5], [-6.8, -5.6, 2, 2, 3.5], [5.6, 6.8, 2, -3.5, -2], [-14.5, -12.5, 1.3, -1, 1], [12.5, 14.5, 1.3, -1, 1],
      [-23, -21, 1.1, 11, 13], [-22, -20, 2, -14, -12], [17, 18.5, 1.1, 10.5, 12], [21, 23, 1.1, -13, -11], [20, 22, 2, 12, 14],
      [-8, -6.5, 1.1, 13, 14.5], [6.5, 8, 1.1, -14.5, -13], [-18.5, -17, 1.1, -12, -10.5], [-4, -2.5, 1.2, 12.5, 14], [2.5, 4, 1.2, -14, -12.5]]);
    return M;
  }
  if (arena === 'magma') {
    // furnace tower (chamfered corners) and an X of diagonal bridges to the platforms, each built from 16 short
    // segments shifted sideways (walkable stair-step edges); big pipelines on the ground instead of divider walls
    b(-3, 3, 0, 3.3, -2, 2, 'tower', 3, 'Furnace_Tower'); b(-2, 2, 0, 3.3, 2, 3, 'tower', 3, 'Furnace_Tower'); b(-2, 2, 0, 3.3, -3, -2, 'tower', 3, 'Furnace_Tower');
    b(-3.15, 3.15, 3.3, 3.5, -3.15, 3.15, 'metal', 4, 'Furnace_Tower'); crown('Tower_Crown', 3.05, true);  // diagonal bridges land at the corners
    const N = 16, L = (16 - 3.15) / N, k = 9.8 / 12.85;
    for (const [sx, sz, g] of [[1, 1, 'Bridge_NE'], [-1, 1, 'Bridge_NW'], [1, -1, 'Bridge_SE'], [-1, -1, 'Bridge_SW']])
      for (let i = 0; i < N; i++) { const za = 3.15 + i * L, zb = za + L, cx = 2.2 + ((za + zb) / 2 - 3.15) * k;
        b(sx > 0 ? cx - 1.5 : -cx - 1.5, sx > 0 ? cx + 1.5 : -cx + 1.5, 3.2, 3.5, sz > 0 ? za : -zb, sz > 0 ? zb : -za, 'grate', 2, g); }
    rails([[-14.5, -13.7], [-9.9, 9.9], [13.7, 14.5]]);
    for (const s of [-1, 1]) {   // horizontal pipelines (chest-high cover) and 4 m vertical risers
      b(s > 0 ? 9.25 : -10.75, s > 0 ? 10.75 : -9.25, 0, 1.5, 4, 12, 'metal', 2, 'Pipelines'); b(s > 0 ? 9.25 : -10.75, s > 0 ? 10.75 : -9.25, 0, 1.5, -12, -4, 'metal', 2, 'Pipelines'); }
    for (const [x, z] of [[5, -12.75], [-5, 12.75], [11.5, 10.5], [-11.5, -10.5]]) b(x - .75, x + .75, 0, 4, z - .75, z + .75, 'metal', 2, 'Pipe_Risers');
    crates([[4.5, 6.5, 1.1, 6, 8], [-6.5, -4.5, 1.1, -8, -6], [-7, -6, 1.2, -1.5, 1.5], [6, 7, 1.2, -1.5, 1.5], [-14.5, -12.5, 1.3, -1, 1], [12.5, 14.5, 1.3, -1, 1],
      [-23, -21, 1.1, 11, 13], [-22, -20, 2, -14, -12], [17, 18.5, 1.1, 10.5, 12], [21, 23, 1.1, -13, -11], [20, 22, 2, 12, 14],
      [-8, -7, 1.1, 13, 14], [7, 8, 1.1, -14, -13], [-18.5, -17, 1.1, -12, -10.5], [-3, -1.5, 2, 6.5, 8], [1.5, 3, 2, -8, -6.5]]);
    return M;
  }
  // coastal: round (octagonal) lab tower, cross bridges, and an octagon of planters (palms) around the tower
  const oct = (r, w, y0, y1, mat) => { const s = r * Math.SQRT1_2;
    b(-s, s, y0, y1, -s, s, mat, 3, 'Lab_Tower');
    b(s, r, y0, y1, -w, w, mat, 3, 'Lab_Tower'); b(-r, -s, y0, y1, -w, w, mat, 3, 'Lab_Tower'); b(-w, w, y0, y1, s, r, mat, 3, 'Lab_Tower'); b(-w, w, y0, y1, -r, -s, mat, 3, 'Lab_Tower'); };
  oct(3, 1.24, 0, 3.3, 'tower'); oct(3.15, 1.3, 3.3, 3.5, 'metal'); crown('Tower_Crown', 2.2);
  cross();
  rails([[-14.5, -9], [-5, -1.25], [1.25, 5], [9, 14.5]]);
  for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4, x = Math.cos(a) * 6.6, z = Math.sin(a) * 6.6;
    b(x - .7, x + .7, 0, 1.1, z - .7, z + .7, 'conc', 2, 'Planters'); b(x - .18, x + .18, 1.1, 6.4, z - .18, z + .18, 'dark', 1, 'Palms'); }
  crates([[-14.5, -12.5, 1.3, -1, 1], [12.5, 14.5, 1.3, -1, 1], [-23, -21, 1.1, 11, 13], [-22, -20, 2, -14, -12], [17, 18.5, 1.1, 10.5, 12], [21, 23, 1.1, -13, -11],
    [20, 22, 2, 12, 14], [-8, -7, 1.1, 13, 14], [7, 8, 1.1, -14, -13], [-18.5, -17, 1.1, -12, -10.5], [-5, -3.5, 1.2, 12, 13.5], [3.5, 5, 1.2, -13.5, -12],
    [-13.5, -12, 2, 9, 10.5], [12, 13.5, 2, -10.5, -9]]);
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
    cd: 0, switchT: 0, ack: 0, landed: false, bumped: false, boostT: 0,
    kills: 0, shots: 0, hits: 0, streak: 0, best: 0, hold: 0, hist: [] };
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
  const sp = P.speed * (a.boostT > 0 ? P.boostMul : 1), acc = a.onGround ? 55 : 11, tx = wx * sp, tz = wz * sp;
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
export function switchWeapon(a, i) { if (i === a.wi || !a.alive || !(i >= 0 && i < WEAPONS.length)) return false; a.ws[a.wi].reload = 0; a.wi = i; a.switchT = .35; return true; }
export function weaponTimers(a, dt) {
  a.cd -= dt; a.switchT -= dt; if (a.protect > 0) a.protect -= dt; if (a.boostT > 0) a.boostT -= dt;
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
  return { s: Math.floor(s), mx: clamp(mx, -1, 1), mz: clamp(mz, -1, 1), y: angWrap(y), p: clamp(p, -1.52, 1.52), b: b & 63 };
}
export function stepPlayer(a, inp, dt, C, allowFire = true) {
  a.yaw = inp.y; a.pitch = inp.p;
  weaponTimers(a, dt);
  if (!a.alive) { a.vel.x = a.vel.z = 0; physics(a, C, 0, 0, false, dt); return false; }
  if (inp.b & BITS.SW0) switchWeapon(a, 0); else if (inp.b & BITS.SW1) switchWeapon(a, 1); else if (inp.b & BITS.SW2) switchWeapon(a, 2);
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
  a.wi = 0; a.cd = 0; a.switchT = 0; a.protect = P.protect; a.alive = true; a.onGround = false; a.airT = 0; a.boostT = 0; a.hist = [];
}
export function rankPlayers(list) { return list.slice().sort((x, y) => y.score - x.score || x.deaths - y.deaths); }

/* ---------- Snapshot packing (server -> client), one array per player ---------- */
export const IDX = { id: 0, x: 1, y: 2, z: 3, vx: 4, vy: 5, vz: 6, yaw: 7, pitch: 8, flags: 9, shield: 10, wi: 11, protect: 12, respawnT: 13, score: 14, deaths: 15,
  rtt: 16, ack: 17, cd: 18, switchT: 19, ammo0: 20, airT: 26, boostT: 27, kills: 28 };
export function packPlayer(p, rtt) {
  const r = r3; return [p.id, r(p.pos.x), r(p.pos.y), r(p.pos.z), r(p.vel.x), r(p.vel.y), r(p.vel.z), r4(p.yaw), r4(p.pitch),
    (p.onGround ? 1 : 0) | (p.alive ? 2 : 0) | (p.bot ? 4 : 0), Math.ceil(p.shield), p.wi, r(Math.max(0, p.protect)), r(Math.max(0, p.respawnT)), p.score, p.deaths, rtt | 0, p.ack,
    r(p.cd), r(p.switchT), p.ws[0].ammo, r(p.ws[0].reload), p.ws[1].ammo, r(p.ws[1].reload), p.ws[2].ammo, r(p.ws[2].reload), r(p.airT), r(Math.max(0, p.boostT)), p.kills];
}
