/* ============ Blender 模型（public/models/*.glb） ============
 * 找得到檔案就用模型，找不到（或載入失敗）就回傳 null，遊戲繼續用程式模型。
 * 規格見「NEON GRID Blender 建模規格」：角色與武器面朝 Blender -Y（glTF +Z），
 * 這裡統一轉 180° 讓它們面朝遊戲的 -Z；場景與道具本來就是世界座標，不轉。
 * 材質：TeamColor → 玩家代表色；TeamGlow → 代表色發光；名稱含 Glow/Neon 或有 Emission 的 → 發光（toneMapped:false，會進 bloom）。
 */
export const MODEL_NAMES = ['agent', 'gun_pulse', 'gun_arc', 'gun_rail', 'arena', 'arena_underground', 'arena_skyfort', 'arena_magma', 'arena_coastal', 'pickup_shield', 'pickup_boost'];

// 角色、武器與場景有兩個版本：電腦版 name.glb 與手機版 name_low.glb（角色 5,000 面內、武器 3,000 面內、場景不含細節物件且圓形分段減半）。
// 手機與平板先試手機版，找不到再用電腦版；兩個都沒有就沿用程式模型。
export const MOBILE = matchMedia('(pointer:coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
const HAS_LOW = new Set(['agent', 'gun_pulse', 'gun_arc', 'gun_rail', 'arena', 'arena_underground', 'arena_skyfort', 'arena_magma', 'arena_coastal']);
const filesFor = name => (MOBILE && HAS_LOW.has(name) ? [`${name}_low`, name] : [name]);

export function loadModels(onProgress, timeoutMs = 15000) {
  const out = {};
  if (!THREE.GLTFLoader) return Promise.resolve(out);
  const loader = new THREE.GLTFLoader();
  let done = 0;
  const tryLoad = file => new Promise(res => {
    let settled = false;
    const end = g => { if (!settled) { settled = true; res(g); } };
    loader.load(`models/${file}.glb`, end, undefined, () => end(null));
    setTimeout(() => end(null), timeoutMs);  // 行動網路太慢就先用程式模型
  });
  const one = async name => {
    let g = null;
    for (const file of filesFor(name)) { g = await tryLoad(file); if (g) break; }
    out[name] = g;
    onProgress && onProgress(++done / MODEL_NAMES.length);
  };
  return Promise.all(MODEL_NAMES.map(one)).then(() => out);
}

const glowCache = {};
export function glowMat(color, k, skinning) {
  const c = new THREE.Color(color);
  const key = c.getHexString() + '_' + k + (skinning ? '_s' : '');
  if (!glowCache[key]) {
    const m = new THREE.MeshBasicMaterial({ color: c.multiplyScalar(k), toneMapped: false });
    m.skinning = !!skinning;  // r128 的 SkinnedMesh 需要材質開 skinning
    glowCache[key] = m;
  }
  return glowCache[key];
}

function isGlow(m) {
  if (/glow|neon/i.test(m.name)) return true;
  const e = m.emissive;
  return !!e && e.r + e.g + e.b > 0.15;
}

/** 依規格換材質；team = 玩家代表色（只有角色用）。 */
export function prepare(root, { team = null, glowK = 2.4, shadow = true } = {}) {
  root.traverse(o => {
    if (!o.isMesh) return;
    if (shadow) { o.castShadow = true; o.receiveShadow = true; }
    const sk = !!o.isSkinnedMesh;
    const conv = m => {
      if (team !== null && m.name === 'TeamColor') { const n = m.clone(); n.color.set(team); n.skinning = sk; return n; }
      if (team !== null && m.name === 'TeamGlow') return glowMat(team, glowK, sk);
      if (isGlow(m)) {
        const e = m.emissive && m.emissive.getHex() ? m.emissive : m.color;
        return glowMat(e, /window/i.test(m.name) ? 1.1 : glowK, sk);
      }
      return m;
    };
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
    // see-through parts (blast glass) must not cast a solid shadow
    if ((Array.isArray(o.material) ? o.material : [o.material]).some(m => m.transparent)) o.castShadow = false;
  });
  return root;
}

/** 面朝 Blender -Y 的模型轉成面朝遊戲 -Z。 */
export function faceForward(obj) { obj.rotation.y = Math.PI; return obj; }

/* ---------- 角色：每位玩家一份骨架、一個 AnimationMixer ---------- */
const UPPER_WEIGHT = 4;  // Fire/Reload 只有上半身的 key，跟底層動作加權平均時給它 4/5 的比重

export function makeAgentModel(gltf, color) {
  const model = faceForward(prepare(THREE.SkeletonUtils.clone(gltf.scene), { team: color }));
  const mixer = new THREE.AnimationMixer(model);
  const acts = {};
  for (const clip of gltf.animations) acts[clip.name] = mixer.clipAction(clip);
  for (const n of ['Fire', 'Reload']) if (acts[n]) { acts[n].setLoop(THREE.LoopOnce, 1); acts[n].clampWhenFinished = false; }
  const bones = {};
  model.traverse(o => { if (o.isBone) bones[o.name] = o; });
  let base = null;
  return {
    model, mixer, bones, muzzle: model.getObjectByName('Muzzle'),
    setBase(name, timeScale = 1) {
      const a = acts[name];
      if (!a) return;
      a.setEffectiveTimeScale(timeScale);
      if (base === name) return;
      if (base && acts[base]) acts[base].fadeOut(.15);
      a.reset().setEffectiveWeight(1).fadeIn(.15).play();
      base = name;
    },
    oneShot(name) {
      const a = acts[name];
      if (!a) return;
      a.reset().setEffectiveWeight(UPPER_WEIGHT).play();
    },
    /** 在動畫之上加瞄準俯仰：骨頭 X 軸是左右軸，正值往前彎，所以抬頭用負值。 */
    aim(pitch) {
      if (bones.Spine) bones.Spine.rotateX(-pitch * .35);
      if (bones.Chest) bones.Chest.rotateX(-pitch * .35);
      if (bones.Neck) bones.Neck.rotateX(-pitch * .3);
    },
  };
}
