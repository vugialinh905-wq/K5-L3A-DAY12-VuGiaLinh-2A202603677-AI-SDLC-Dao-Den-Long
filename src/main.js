// Ban web 3D: dung chung loi logic src/core.js (fixed 60 tick/s), Three.js chi lo hien thi + luong man hinh.
import * as THREE from 'three';
import { createGame, step, drainEvents, windInfo, TUNING, CONSTANTS as K } from './core.js';
import { buildWorld, setLitProgress, glowTexture, PAL } from './world.js';
import * as audio from './audio.js';

const $ = (id) => document.getElementById(id);
const DT = 1 / 60;

// ---------- Cai dat (luu giua cac lan mo) ----------
const settings = { volume: 0.7, sens: 1 };
try { Object.assign(settings, JSON.parse(localStorage.getItem('ddl_settings') || '{}')); } catch { /* khong co localStorage */ }
const saveSettings = () => { try { localStorage.setItem('ddl_settings', JSON.stringify(settings)); } catch { /* bo qua */ } };
audio.setVolume(settings.volume);

// ---------- Renderer / canh ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
let pixelRatio = Math.min(devicePixelRatio, 1.5);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(PAL.sky);
scene.fog = new THREE.FogExp2(PAL.mist, 0.016);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
const ambient = new THREE.AmbientLight(0x9aa8ff, 0.15);
const moon = new THREE.DirectionalLight(0x9aa8ff, 0.55);
moon.position.set(-20, 40, -10);
scene.add(ambient, moon);
const glow = glowTexture();

// ---------- Nhan vat May: non la + khan do + den long nho ----------
const player = new THREE.Group();
{
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...o });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.45, 0.9, 12), std(PAL.shirt)); body.position.y = 0.55;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 8, 16), std(PAL.scarf)); scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.02;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.04), std(PAL.scarf)); tail.position.set(0, 0.8, -0.32); tail.rotation.x = 0.3;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 16, 12), std(0xf0c9a0)); head.position.y = 1.25;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.5, 20), std(0xe8d08a)); hat.position.y = 1.6;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: PAL.lampOn })); lamp.position.set(0.5, 1.3, 0.1);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 4), std(0x333333)); cord.position.set(0.5, 1.5, 0.1);
  const lampLight = new THREE.PointLight(PAL.lampOn, 2.4, 14, 1.6); lampLight.position.copy(lamp.position);
  player.add(body, scarf, tail, head, hat, lamp, cord, lampLight);
  player.userData = { lampLight };
}
scene.add(player);
const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: PAL.lampOn, transparent: true, side: THREE.DoubleSide }));
pulseRing.rotation.x = -Math.PI / 2; pulseRing.visible = false;
scene.add(pulseRing);

// ---------- Thuc the dong ----------
const views = { lanterns: new Map(), shades: new Map(), motes: new Map(), drifters: new Map(), charms: new Map() };
function star(R, r) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i + Math.PI / 2, rad = i % 2 ? r : R;
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    if (i) s.lineTo(x, y); else s.moveTo(x, y);
  }
  s.closePath();
  return s;
}
const moteGeo = new THREE.ExtrudeGeometry(star(0.34, 0.15), { depth: 0.08, bevelEnabled: false });
moteGeo.center();
const moteMat = new THREE.MeshBasicMaterial({ color: PAL.moteCore });
function makeMote() {
  const g = new THREE.Group();
  const star = new THREE.Mesh(moteGeo, moteMat);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }));
  halo.scale.setScalar(1.7);
  g.add(star, halo);
  g.userData = { star, halo };
  scene.add(g);
  return g;
}
function makeLantern() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3, 8), new THREE.MeshStandardMaterial({ color: PAL.wood }));
  pole.position.y = 1.5;
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 14), new THREE.MeshStandardMaterial({ color: PAL.lampOff, emissive: PAL.lampOn, emissiveIntensity: 0 }));
  globe.position.y = 3.4;
  const light = new THREE.PointLight(PAL.lampOn, 0, 26, 1.4); light.position.y = 3.4;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  halo.scale.setScalar(6); halo.position.y = 3.4;
  const ring = new THREE.Mesh(new THREE.RingGeometry(TUNING.safe_radius - 0.1, TUNING.safe_radius, 64), new THREE.MeshBasicMaterial({ color: PAL.lampOn, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
  g.add(pole, globe, light, halo, ring);
  g.userData = { globe, light, halo, ring };
  scene.add(g);
  return g;
}
function makeShade() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), new THREE.MeshStandardMaterial({ color: PAL.shade, roughness: 0.5 }));
  const edge = new THREE.Mesh(new THREE.SphereGeometry(0.78, 16, 12), new THREE.MeshBasicMaterial({ color: PAL.shadeEdge, side: THREE.BackSide }));
  const eyeM = new THREE.MeshBasicMaterial({ color: 0xd6a0ff });
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), eyeM), e2 = e1.clone();
  e1.position.set(-0.22, 0.15, 0.58); e2.position.set(0.22, 0.15, 0.58);
  g.add(body, edge, e1, e2);
  g.userData = { body, edge };
  scene.add(g);
  return g;
}
function makeDrifter() {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: PAL.drifter, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  const ribbons = [];
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.PlaneGeometry(2.6, 0.45, 18, 1);
    const r = new THREE.Mesh(geo, m);
    r.rotation.x = (i - 1) * 0.5;
    r.userData.base = geo.attributes.position.array.slice();
    g.add(r); ribbons.push(r);
  }
  g.userData = { ribbons };
  scene.add(g);
  return g;
}
function makeCharm() {
  const g = new THREE.Group();
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.92, 0.04), new THREE.MeshBasicMaterial({ color: PAL.gold }));
  const card = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.06), new THREE.MeshBasicMaterial({ color: PAL.scarf }));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
  halo.scale.setScalar(2.2);
  g.add(edge, card, halo);
  scene.add(g);
  return g;
}

// La bay khi co gio
const LEAVES = 70;
const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.28, 0.16), new THREE.MeshBasicMaterial({ color: 0x6a8f4a, side: THREE.DoubleSide }), LEAVES);
leaves.visible = false; leaves.frustumCulled = false;
scene.add(leaves);
const leafState = Array.from({ length: LEAVES }, () => ({ x: (Math.random() - 0.5) * 50, y: Math.random() * 6 + 0.3, z: (Math.random() - 0.5) * 50, ph: Math.random() * 6.28 }));
const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), s3 = new THREE.Vector3(1, 1, 1), p3 = new THREE.Vector3();

// ---------- The gioi theo Dem ----------
let worldGroup = null;
function disposeTree(o) {
  o.traverse((c) => { c.geometry?.dispose?.(); if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => m.dispose?.()); });
}
function clearViews() {
  for (const map of Object.values(views)) { for (const v of map.values()) scene.remove(v); map.clear(); }
}
function buildNightWorld(def) {
  if (worldGroup) { scene.remove(worldGroup); disposeTree(worldGroup); }
  clearViews();
  worldGroup = buildWorld(def, glow);
  scene.add(worldGroup);
}

function syncViews(game, time) {
  const p = game.player;
  player.position.set(p.pos[0], p.pos[1], p.pos[2]);
  player.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
  player.visible = p.respawn === 0 && (p.invuln % 8 < 5);
  player.userData.lampLight.intensity = 2.4 + Math.sin(time * 6) * 0.25;

  const total = game.lanterns.length, lit = game.lanterns.filter((l) => l.lit).length;
  ambient.intensity = 0.15 + 0.55 * (lit / total); // cong thuc chuan cua ticket
  scene.fog.density = 0.016 - 0.005 * (lit / total);

  for (const l of game.lanterns) {
    let v = views.lanterns.get(l.id);
    if (!v) { v = makeLantern(); views.lanterns.set(l.id, v); }
    v.position.set(l.pos[0], l.pos[1], l.pos[2]);
    const frac = l.lit ? 1 : l.deposited / TUNING.lantern_cost;
    const u = v.userData;
    u.globe.material.color.setHex(l.lit ? PAL.lampCore : PAL.lampOff).lerp(new THREE.Color(PAL.lampOn), l.lit ? 0 : frac * 0.7);
    u.globe.material.emissive.setHex(l.lit ? PAL.lampOn : PAL.lampOn);
    u.globe.material.emissiveIntensity = l.lit ? 1.6 : frac * 1.1;
    u.light.intensity = l.lit ? 70 : frac * 10;
    u.halo.material.opacity = l.lit ? 0.85 : frac * 0.4;
    u.ring.material.opacity = l.lit ? 0.55 : 0;
    u.ring.scale.setScalar(1);
  }

  const seen = new Set();
  for (const m of game.motes) {
    seen.add(m.id);
    let v = views.motes.get(m.id);
    if (!v) { v = makeMote(); views.motes.set(m.id, v); }
    v.position.set(m.pos[0], m.pos[1] + 0.9 + Math.sin(time * 2.5 + m.pos[0]) * 0.25, m.pos[2]);
    v.userData.star.rotation.y = time * 2 + m.pos[2];
    const dropped = m.kind === 'dropped';
    v.scale.setScalar(dropped ? 0.8 : 1);
    v.visible = !(dropped && m.ttl < 120 && Math.floor(time * 8) % 2 === 0); // nhap nhay sap het han
  }
  for (const [id, v] of views.motes) if (!seen.has(id)) { scene.remove(v); views.motes.delete(id); }

  const seenS = new Set();
  for (const s of game.shades) {
    seenS.add(s.id);
    let v = views.shades.get(s.id);
    if (!v) { v = makeShade(); views.shades.set(s.id, v); }
    const stunned = s.state === 'stunned';
    v.position.set(s.pos[0], s.pos[1] - 0.2 + Math.sin(time * 4 + s.pos[2]) * 0.1, s.pos[2]);
    v.scale.setScalar(s.state === 'spawning' ? 0.3 : stunned ? 0.7 : 1);
    v.userData.body.material.color.setHex(stunned ? PAL.shadeStun : PAL.shade);
    v.userData.edge.visible = !stunned;
    v.lookAt(p.pos[0], v.position.y, p.pos[2]);
  }
  for (const [id, v] of views.shades) if (!seenS.has(id)) { scene.remove(v); views.shades.delete(id); }

  const seenD = new Set();
  for (const d of game.drifters) {
    seenD.add(d.id);
    let v = views.drifters.get(d.id);
    if (!v) { v = makeDrifter(); views.drifters.set(d.id, v); }
    v.position.set(d.pos[0], d.pos[1], d.pos[2]);
    v.rotation.y = time * (d.state === 'idle' ? 0.5 : 2);
    for (const [i, r] of v.userData.ribbons.entries()) {
      const pos = r.geometry.attributes.position, base = r.userData.base;
      for (let k = 0; k < pos.count; k++) pos.setZ(k, base[k * 3 + 2] + Math.sin(base[k * 3] * 3 - time * 8 + i) * 0.28);
      pos.needsUpdate = true;
    }
  }
  for (const [id, v] of views.drifters) if (!seenD.has(id)) { scene.remove(v); views.drifters.delete(id); }

  for (const c of game.charms) {
    let v = views.charms.get(c.id);
    if (!v) { v = makeCharm(); views.charms.set(c.id, v); }
    v.visible = c.available;
    v.position.set(c.pos[0], c.pos[1] + 1.2 + Math.sin(time * 2) * 0.15, c.pos[2]);
    v.rotation.y = time * 1.5;
  }

  if (game.pulseFx > 0) {
    const k = 1 - game.pulseFx / 20;
    pulseRing.visible = true;
    pulseRing.position.set(p.pos[0], p.pos[1] + 0.05, p.pos[2]);
    pulseRing.scale.setScalar(TUNING.pulse_radius * k + 0.1);
    pulseRing.material.opacity = 1 - k;
  } else pulseRing.visible = false;

  setLitProgress(lit / total, time);

  // La bay bao gio manh
  const w = windInfo(game);
  leaves.visible = w.active || w.warn;
  if (leaves.visible) {
    const sp = w.active ? 9 : 2.5, dx = Math.cos((w.dir_deg * Math.PI) / 180), dz = Math.sin((w.dir_deg * Math.PI) / 180);
    leafState.forEach((l, i) => {
      l.x += dx * sp * DT + Math.sin(time * 3 + l.ph) * 0.02; l.z += dz * sp * DT; l.y += Math.sin(time * 2 + l.ph) * 0.01;
      if (Math.abs(l.x) > 25) l.x -= Math.sign(l.x) * 50;
      if (Math.abs(l.z) > 25) l.z -= Math.sign(l.z) * 50;
      p3.set(p.pos[0] + l.x, p.pos[1] + l.y, p.pos[2] + l.z);
      e4.set(time * 3 + l.ph, time * 2, l.ph); q4.setFromEuler(e4);
      m4.compose(p3, q4, s3); leaves.setMatrixAt(i, m4);
    });
    leaves.instanceMatrix.needsUpdate = true;
  }
}

// ---------- Camera ----------
let yaw = 0;
function updateCamera() {
  const th = (yaw * Math.PI) / 180;
  const fx = Math.sin(th), fz = Math.cos(th);
  const p = player.position;
  camera.position.set(p.x - fx * 9, p.y + 6, p.z - fz * 9);
  camera.lookAt(p.x, p.y + 1, p.z);
  camera.updateMatrixWorld();
}

// ---------- Input ----------
const keys = new Set();
const mouse = { down: false, rot: false, x: 0, y: 0 };
let pendingStep = null;
addEventListener('keydown', (e) => {
  if (e.repeat) { if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); return; }
  keys.add(e.code);
  if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (run.state === 'play') pauseGame(); else if (run.state === 'pause') resumeGame();
  }
  if (e.code === 'KeyR' && (run.state === 'result')) $('btnNext').click();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { mouse.down = false; mouse.rot = false; keys.clear(); });
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button === 0) { mouse.down = true; mouse.x = e.clientX; mouse.y = e.clientY; }
  if (e.button === 2) mouse.rot = true;
});
addEventListener('mousemove', (e) => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  if (mouse.rot) yaw += e.movementX * 0.25 * settings.sens;
});
addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; if (e.button === 2) mouse.rot = false; });

const raycaster = new THREE.Raycaster();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();
function mouseMove(game) {
  if (!mouse.down) return [0, 0];
  raycaster.setFromCamera(new THREE.Vector2((mouse.x / innerWidth) * 2 - 1, -(mouse.y / innerHeight) * 2 + 1), camera);
  ground.constant = -game.player.pos[1]; // mat phang ngang ngay duoi chan May
  if (!raycaster.ray.intersectPlane(ground, hit)) return [0, 0];
  const dx = hit.x - game.player.pos[0], dz = hit.z - game.player.pos[2];
  const d = Math.hypot(dx, dz);
  if (d < 0.5) return [0, 0];
  const k = Math.min(1, d / 2);
  const wx = (dx / d) * k, wz = (dz / d) * k;
  const th = (yaw * Math.PI) / 180; // nghich dao cong thuc xoay cua contract
  return [wx * Math.cos(th) - wz * Math.sin(th), wx * Math.sin(th) + wz * Math.cos(th)];
}

let prevJump = false;
function readInput(game, pause = false) {
  // Camera nhin theo +forward => man hinh "phai" la -X o yaw=0, nen D => x = -1.
  let x = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
  let z = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  if (x === 0 && z === 0) [x, z] = mouseMove(game);
  const jump = keys.has('Space');
  if (jump && !prevJump && game.player.grounded && game.state === 'playing') audio.sfx.jump();
  prevJump = jump;
  return {
    move: [x, z], cam_yaw_deg: yaw, jump, interact: keys.has('KeyE'), pulse: keys.has('KeyF'),
    dash: keys.has('ShiftLeft') || keys.has('ShiftRight'), pause,
  };
}

// ---------- Man hinh / luong game ----------
const NIGHTS = {
  1: { name: 'Đêm 1 · Đảo Bến', quote: 'Sương đen đã nuốt hết ánh sáng đảo Bến, Mây à. Gom đom đóm, thắp lại năm ngọn đèn lồng trước bình minh, và nhớ giữ lại vài đốm sáng để xua Bóng Mực nhé.' },
  2: { name: 'Đêm 2 · Đảo Cau', quote: 'Đảo Cau có hai bờ nối bằng cây cầu tre không lan can. Bước cho vững, hoặc cứ nhảy lên bục để bay sang. Coi chừng Gió Lạc, chúng thích cuỗm đom đóm của người mang nhiều đấy.' },
  3: { name: 'Đêm 3 · Đảo Chuông', quote: 'Đảo Chuông cao ba tầng, gió thổi từng cơn. Ngọn đèn cuối nằm sát chân tháp chuông. Ông Đăng tin Mây làm được.' },
};
const run = { night: 1, total: 0, state: 'menu', game: null, resultAt: 0, counted: false, lastSecond: -1, lastWarn: false, settingsFrom: 'menu' };
const screens = ['menu', 'intro', 'pause', 'settings', 'result', 'dawn'];
function show(name) {
  for (const s of screens) $(s).classList.toggle('on', s === name);
  document.body.classList.toggle('playing', run.state === 'play' || run.state === 'pause');
}
const click = (id, fn) => $(id).addEventListener('click', () => { audio.initAudio(); audio.sfx.ui(); fn(); });

function showIntro(n) {
  run.night = n; run.state = 'intro';
  $('introNum').textContent = `Đêm ${n} / 3`;
  $('introName').textContent = NIGHTS[n].name;
  $('introQuote').textContent = '"' + NIGHTS[n].quote + '"';
  show('intro');
}
function beginNight() {
  run.game = createGame({ seed: (Date.now() & 0x7fffffff) || 1, night: run.night });
  buildNightWorld(run.game.def);
  yaw = 0; run.counted = false; run.lastSecond = -1; run.lastWarn = false;
  run.state = 'play';
  show(null);
  audio.startMusic();
}
function pauseGame() {
  run.state = 'pause';
  step(run.game, readInput(run.game, true)); step(run.game, readInput(run.game, false)); // bat/tat co pause cua loi
  show('pause');
}
function resumeGame() {
  run.state = 'play';
  show(null);
  step(run.game, readInput(run.game, true)); // canh len cua pause => tiep tuc (xem 'resumed')
  handleEvents(drainEvents(run.game));
}
function endNight(data) {
  run.resultAt = performance.now() + 1300;
  if (data.result === 'won') audio.sfx.win(); else audio.sfx.lose();
}
function showResult() {
  const g = run.game, won = g.state === 'won';
  run.state = 'result';
  if (won && !run.counted) { run.total += g.score; run.counted = true; }
  if (won && run.night === 3) { $('dawnScore').textContent = run.total; run.state = 'dawn'; show('dawn'); return; }
  $('resTitle').textContent = won ? `Đêm ${run.night} hoàn thành!` : 'Sương đen nuốt mất ánh sáng…';
  $('resBody').textContent = won
    ? `${g.lanterns.length}/${g.lanterns.length} đèn đã sáng · còn ${g.player.flames} ngọn lửa`
    : g.player.flames <= 0 ? 'Mây đã hết ngọn lửa.' : 'Bình minh tới nhưng đảo vẫn còn tối.';
  $('resScore').textContent = `Điểm đêm này: ${g.score}`;
  $('resTotal').textContent = `Tổng điểm: ${run.total}`;
  $('btnNext').textContent = won ? 'Đêm kế tiếp' : `Chơi lại Đêm ${run.night}`;
  show('result');
}
function toMenu() { run.state = 'menu'; run.game = null; show('menu'); }
function openSettings(from) { run.settingsFrom = from; $('settings').classList.add('on'); for (const s of screens) if (s !== 'settings') $(s).classList.remove('on'); }

click('btnStart', () => { run.total = 0; showIntro(1); });
click('btnSettings', () => openSettings('menu'));
click('btnGo', beginNight);
click('btnResume', resumeGame);
click('btnRetry', () => { run.state = 'intro'; beginNight(); });
click('btnPauseSettings', () => openSettings('pause'));
click('btnToMenu', toMenu);
click('btnSettingsBack', () => { show(run.settingsFrom); });
click('btnNext', () => {
  if (run.game.state === 'won') showIntro(run.night + 1); else beginNight();
});
click('btnResMenu', toMenu);
click('btnAgain', () => { run.total = 0; showIntro(1); });

const volEl = $('vol'), sensEl = $('sens');
volEl.value = Math.round(settings.volume * 100); sensEl.value = Math.round(settings.sens * 100);
const syncSettingText = () => { $('volVal').textContent = volEl.value + '%'; $('sensVal').textContent = (sensEl.value / 100).toFixed(2) + '×'; };
syncSettingText();
volEl.addEventListener('input', () => { settings.volume = volEl.value / 100; audio.setVolume(settings.volume); saveSettings(); syncSettingText(); });
sensEl.addEventListener('input', () => { settings.sens = sensEl.value / 100; saveSettings(); syncSettingText(); });
volEl.addEventListener('change', () => audio.sfx.ui());

// ---------- Su kien tu loi game -> am thanh + hieu ung ----------
let toastTimer = 0;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.style.display = 'block';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.style.display = 'none'; }, 2200);
}
function flash() { const f = $('flash'); f.style.opacity = 1; setTimeout(() => { f.style.opacity = 0; }, 160); }
function handleEvents(evs) {
  for (const e of evs) {
    switch (e.name) {
      case 'mote_picked': audio.sfx.pickup(); break;
      case 'deposit': audio.sfx.deposit(); break;
      case 'lantern_lit': audio.sfx.light(); toast('Một ngọn đèn đã sáng lại!'); break;
      case 'pulse': audio.sfx.pulse(); break;
      case 'dash': audio.sfx.dash(); break;
      case 'player_hit': audio.sfx.hit(); flash(); if (e.data.by === 'fall') toast('Mây rơi khỏi đảo! Mất hết đom đóm.'); break;
      case 'shade_spawned': audio.sfx.spawn(); break;
      case 'charm_picked': audio.sfx.charm(); toast('Bùa Gió! Chạy nhanh hơn và lướt không cần chờ.'); break;
      case 'drifter_steal': audio.sfx.steal(); toast(`Gió Lạc cuỗm ${e.data.amount} đom đóm! Tỏa sáng để đòi lại.`); break;
      case 'drifter_drop': toast('Đã đòi lại đom đóm!'); break;
      case 'game_over': endNight(e.data); break;
      default: break;
    }
  }
}

// ---------- HUD ----------
function ensure(id, n, make) { const el = $(id); while (el.children.length < n) el.appendChild(make()); return [...el.children]; }
const span = (t) => () => { const s = document.createElement('span'); s.textContent = t; return s; };
const pip = () => { const d = document.createElement('div'); d.className = 'pip'; return d; };
const charmEl = document.createElement('div'); charmEl.style.cssText = 'font-size:13px;color:#FF5A5F;display:none'; $('center').appendChild(charmEl);
const ndc = new THREE.Vector3();

function hud(game) {
  const p = game.player;
  ensure('flames', TUNING.flames, span('🔥')).forEach((el, i) => el.classList.toggle('off', i >= p.flames));
  ensure('motebar', TUNING.carry_capacity, pip).forEach((el, i) => el.classList.toggle('on', i < p.carried));
  const lit = game.lanterns.filter((l) => l.lit).length;
  $('lanternCount').textContent = `${lit}/${game.lanterns.length}`;
  $('scoreVal').textContent = run.total + game.score;
  const left = Math.max(0, game.timeInit - game.simTick / 60);
  const mm = Math.floor(left / 60), ss = Math.floor(left % 60);
  $('time').textContent = `${mm}:${String(ss).padStart(2, '0')}`;
  $('time').classList.toggle('danger', left <= 30);
  const sec = Math.ceil(left);
  if (game.state === 'playing' && !game.paused && sec <= 10 && sec > 0 && sec !== run.lastSecond) { audio.sfx.tick(); }
  run.lastSecond = sec;
  charmEl.style.display = p.charm > 0 ? 'block' : 'none';
  charmEl.textContent = `Bùa Gió · ${(p.charm / 60).toFixed(1)}s`;

  const dashP = p.charm > 0 ? 1 : 1 - p.dashCd / K.dash_cd;
  $('cdDash').style.setProperty('--p', dashP); $('cdDash').classList.toggle('off', dashP < 1);
  const pulseP = 1 - p.pulseCd / K.pulse_cd;
  $('cdPulse').style.setProperty('--p', pulseP); $('cdPulse').classList.toggle('off', pulseP < 1 || p.carried < TUNING.pulse_cost);

  // Nhac "E" khi dung gan den + mui ten chi den chua sang gan nhat
  let near = null, nd = Infinity, target = null, td = Infinity;
  for (const l of game.lanterns) {
    if (l.lit) continue;
    const d = Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]);
    if (d <= TUNING.interact_radius && d < nd) { near = l; nd = d; }
    if (d < td) { target = l; td = d; }
  }
  const pr = $('prompt');
  if (near) { pr.style.display = 'block'; pr.textContent = `E — Nạp ánh sáng (${near.deposited}/${TUNING.lantern_cost})` + (p.carried === 0 ? ' · cần đom đóm' : ''); }
  else pr.style.display = 'none';
  const ar = $('arrow');
  if (target && !near) {
    ndc.set(target.pos[0], target.pos[1] + 3.4, target.pos[2]).project(camera);
    const behind = ndc.z > 1;
    let x = ndc.x, y = ndc.y;
    if (behind) { x = -x; y = -y; }
    const off = behind || Math.abs(x) > 0.92 || Math.abs(y) > 0.88;
    if (off) {
      const m = Math.max(Math.abs(x) / 0.92, Math.abs(y) / 0.88, 1e-6);
      x /= m; y /= m;
      if (Math.abs(x) < 1e-3 && Math.abs(y) < 1e-3) y = -0.88;
      ar.style.display = 'block';
      ar.style.left = ((x * 0.5 + 0.5) * innerWidth) + 'px';
      ar.style.top = ((-y * 0.5 + 0.5) * innerHeight) + 'px';
      ar.style.transform = `rotate(${Math.atan2(x, y) * 180 / Math.PI}deg)`;
    } else ar.style.display = 'none';
  } else ar.style.display = 'none';
}

// ---------- Vong lap ----------
let acc = 0, last = performance.now(), fpsAcc = 0, fpsN = 0, adapted = false;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const g = run.game;
  if (g && (run.state === 'play' || run.state === 'pause' || run.state === 'result')) {
    if (run.state === 'play') {
      if (keys.has('ArrowLeft') || keys.has('KeyZ')) yaw -= 120 * dt * settings.sens;
      if (keys.has('ArrowRight') || keys.has('KeyC')) yaw += 120 * dt * settings.sens;
      acc += dt;
      while (acc >= DT && g.state === 'playing') {
        step(g, readInput(g));
        handleEvents(drainEvents(g));
        acc -= DT;
      }
      const w = windInfo(g);
      if (w.warn && !run.lastWarn) { audio.sfx.wind(); toast('Gió sắp nổi! Bám chắc.'); }
      run.lastWarn = w.warn;
    }
    syncViews(g, now / 1000);
    updateCamera();
    hud(g);
    if (run.state === 'play' && g.state !== 'playing' && now >= run.resultAt && run.resultAt) { run.resultAt = 0; showResult(); }
  } else if (run.state === 'menu' || run.state === 'intro' || run.state === 'dawn') {
    // canh nen cham chap sau man hinh menu
    yaw += dt * 8; player.position.set(0, 0, 0); updateCamera();
    if (!worldGroup) buildNightWorld(menuGame().def);
  }
  fpsAcc += dt; fpsN++;
  if (!adapted && fpsAcc > 4 && run.state === 'play') { adapted = true; if (fpsN / fpsAcc < 30) { pixelRatio = 1; renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight); } }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
let _menu = null;
function menuGame() { return (_menu ||= createGame({ seed: 1, night: 1 })); }
buildNightWorld(menuGame().def);
syncViews(menuGame(), 0);
requestAnimationFrame(frame);
window.__run = () => run;
window.__game = () => run.game;
