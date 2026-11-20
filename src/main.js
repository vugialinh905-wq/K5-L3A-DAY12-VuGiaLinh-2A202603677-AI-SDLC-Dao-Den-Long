// Ban web 3D: dung chung loi logic src/core.js (fixed 60 tick/s), Three.js chi lo hien thi.
import * as THREE from 'three';
import { createGame, step, drainEvents, mulberry32, TUNING, ISLAND_RADIUS, LANTERN_RING } from './core.js';

const $ = (id) => document.getElementById(id);
const DT = 1 / 60;

// ---------- Scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0614);
scene.fog = new THREE.FogExp2(0x1a0d2e, 0.02);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const ambient = new THREE.AmbientLight(0xa08ad0, 1.2);
scene.add(ambient);
const moon = new THREE.DirectionalLight(0xa090e0, 0.9);
moon.position.set(-20, 40, -10);
scene.add(moon);

// Dao tron + bien may
const island = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS + 2, 3, 64), new THREE.MeshStandardMaterial({ color: 0x628a62, roughness: 1 }));
island.position.y = -1.5;
scene.add(island);
const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: 0x1a1030 }));
sea.rotation.x = -Math.PI / 2;
sea.position.y = -6;
scene.add(sea);
for (let i = 0; i < 18; i++) { // vai tang da / bui cho dep
  const a = (i / 18) * Math.PI * 2 + 0.3;
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + (i % 3) * 0.35), new THREE.MeshStandardMaterial({ color: 0x3a3a52, roughness: 1 }));
  rock.position.set(Math.cos(a) * (ISLAND_RADIUS - 1.5), 0.2, Math.sin(a) * (ISLAND_RADIUS - 1.5));
  scene.add(rock);
}

// ---------- Trang tri (chi hien thi, khong anh huong luat choi) ----------
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,235,160,1)');
  g.addColorStop(0.4, 'rgba(255,190,80,0.35)');
  g.addColorStop(1, 'rgba(255,160,40,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const glowTex = glowTexture();
const deco = mulberry32(2026); // co dinh de canh dao luon giong nhau
const floaters = [];
const awayFromLanterns = (x, z, r) => {
  for (let i = 0; i < TUNING.lantern_count_night1; i++) {
    const a = (i * 2 * Math.PI) / TUNING.lantern_count_night1;
    if (Math.hypot(x - LANTERN_RING * Math.sin(a), z - LANTERN_RING * Math.cos(a)) < r) return false;
  }
  return Math.hypot(x, z) > 3;
};
function scatter(n, minR, maxR, clear) {
  const pts = [];
  while (pts.length < n) {
    const a = deco() * Math.PI * 2, r = minR + Math.sqrt(deco()) * (maxR - minR);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (awayFromLanterns(x, z, clear)) pts.push([x, z]);
  }
  return pts;
}
// Bui cay: cum 2-3 khoi cau dep
{
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const greens = [0x2f6b3d, 0x3b7d46, 0x275a35];
  for (const [x, z] of scatter(36, 6, ISLAND_RADIUS - 3, 3.5)) {
    const g = new THREE.Group();
    const n = 2 + Math.floor(deco() * 2);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: greens[Math.floor(deco() * 3)], roughness: 1, flatShading: true }));
      const s = 0.5 + deco() * 0.6;
      m.scale.set(s, s * 0.8, s);
      m.position.set((deco() - 0.5) * 1.1, s * 0.6, (deco() - 0.5) * 1.1);
      g.add(m);
    }
    g.position.set(x, 0, z);
    scene.add(g);
  }
}
// Hoa nho duoi dat (instanced: than + canh)
{
  const N = 220;
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.015, 0.02, 0.35, 5), new THREE.MeshStandardMaterial({ color: 0x3f7a45 }), N);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x222222 }), N);
  const palette = [0xff8fb8, 0xffe27a, 0xffffff, 0x9ec8ff, 0xd9a0ff].map((c) => new THREE.Color(c));
  const m4 = new THREE.Matrix4();
  scatter(N, 2, ISLAND_RADIUS - 1.5, 2).forEach(([x, z], i) => {
    const h = 0.25 + deco() * 0.25;
    m4.makeScale(1, h / 0.35, 1).setPosition(x, h / 2, z);
    stems.setMatrixAt(i, m4);
    m4.makeScale(1, 0.7, 1).setPosition(x, h + 0.04, z);
    heads.setMatrixAt(i, m4);
    heads.setColorAt(i, palette[Math.floor(deco() * palette.length)]);
  });
  scene.add(stems, heads);
}
// Den long giay treo lo lung tren cao: sang len khi dao duoc thap them
{
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + deco() * 0.4;
    const r = 6 + deco() * (ISLAND_RADIUS - 10);
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xff7a2e, emissive: 0xff8a30, emissiveIntensity: 0.6, roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), mat);
    body.scale.set(1, 1.25, 1);
    const capGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.07, 10);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x5a3a24 });
    const top = new THREE.Mesh(capGeo, capMat); top.position.y = 0.52;
    const bot = new THREE.Mesh(capGeo, capMat); bot.position.y = -0.52;
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.6, 4), new THREE.MeshBasicMaterial({ color: 0x8a6a50 }));
    string.position.y = 1.35;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
    halo.scale.setScalar(3.2);
    g.add(body, top, bot, string, halo);
    const y = 3.2 + deco() * 3.5;
    g.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    scene.add(g);
    floaters.push({ g, mat, halo, y, ph: deco() * 6.28, sway: 0.15 + deco() * 0.2 });
  }
}

// ---------- Nhan vat May: non la + den long nho ----------
const player = new THREE.Group();
const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.9, 12), new THREE.MeshStandardMaterial({ color: 0xd98a4a }));
body.position.y = 0.55;
const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf0c9a0 }));
head.position.y = 1.2;
const hat = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.5, 20), new THREE.MeshStandardMaterial({ color: 0xe8d08a }));
hat.position.y = 1.55;
const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffb347 }));
lamp.position.set(0.45, 1.25, 0);
const lampLight = new THREE.PointLight(0xffa040, 2.2, 14, 1.6);
lampLight.position.copy(lamp.position);
player.add(body, head, hat, lamp, lampLight);
scene.add(player);

const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffc060, transparent: true, side: THREE.DoubleSide }));
pulseRing.rotation.x = -Math.PI / 2;
pulseRing.visible = false;
scene.add(pulseRing);

// ---------- Thuc the dong ----------
const lanternViews = new Map();
const shadeViews = new Map();
const moteViews = new Map();
// Dom dom hinh ngoi sao 5 canh + quang sang
function starShape(R, r) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i + Math.PI / 2, rad = i % 2 ? r : R;
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    if (i) s.lineTo(x, y); else s.moveTo(x, y);
  }
  s.closePath();
  return s;
}
const moteGeo = new THREE.ExtrudeGeometry(starShape(0.34, 0.15), { depth: 0.08, bevelEnabled: false });
moteGeo.center();
const moteMat = new THREE.MeshBasicMaterial({ color: 0xffe27a });
function makeMote() {
  const g = new THREE.Group();
  const star = new THREE.Mesh(moteGeo, moteMat);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }));
  halo.scale.setScalar(1.6);
  g.add(star, halo);
  g.userData = { star };
  return g;
}

function makeLantern() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3, 8), new THREE.MeshStandardMaterial({ color: 0x4a3b35 }));
  pole.position.y = 1.5;
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 14), new THREE.MeshStandardMaterial({ color: 0x554466, emissive: 0xff9a30, emissiveIntensity: 0 }));
  globe.position.y = 3.4;
  const light = new THREE.PointLight(0xffa040, 0, 30, 1.4);
  light.position.y = 3.4;
  const ring = new THREE.Mesh(new THREE.RingGeometry(TUNING.safe_radius - 0.08, TUNING.safe_radius, 48), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  g.add(pole, globe, light, ring);
  g.userData = { globe, light, ring };
  scene.add(g);
  return g;
}

function makeShade() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), new THREE.MeshStandardMaterial({ color: 0x1a0a2a, emissive: 0x3a0a6a, emissiveIntensity: 0.6, roughness: 0.4 }));
  const eyeM = new THREE.MeshBasicMaterial({ color: 0xd6a0ff });
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), eyeM);
  const e2 = e1.clone();
  e1.position.set(-0.22, 0.15, 0.58);
  e2.position.set(0.22, 0.15, 0.58);
  g.add(body, e1, e2);
  g.userData = { body };
  scene.add(g);
  return g;
}

function syncViews(game, time) {
  const p = game.player;
  player.position.set(p.pos[0], p.pos[1], p.pos[2]);
  player.visible = p.invuln % 8 < 5; // nhap nhay khi bat tu
  lampLight.intensity = 2.2 + Math.sin(time * 6) * 0.25;
  const litNow = game.lanterns.filter((l) => l.lit).length;
  for (const f of floaters) { // den treo lo lung: bap benh, sang dan len khi thap den
    f.g.position.y = f.y + Math.sin(time * 0.8 + f.ph) * 0.4;
    f.g.rotation.z = Math.sin(time * 0.6 + f.ph) * f.sway;
    f.mat.emissiveIntensity = 0.5 + litNow * 0.25;
    f.halo.material.opacity = 0.45 + litNow * 0.12;
  }

  for (const l of game.lanterns) {
    let v = lanternViews.get(l.id);
    if (!v) { v = makeLantern(); lanternViews.set(l.id, v); }
    v.position.set(l.pos[0], l.pos[1], l.pos[2]);
    const frac = l.lit ? 1 : l.deposited / TUNING.lantern_cost;
    v.userData.globe.material.emissiveIntensity = 0.1 + frac * 1.6;
    v.userData.light.intensity = l.lit ? 60 : frac * 12;
    v.userData.ring.material.opacity = l.lit ? 0.5 : 0;
  }

  const seen = new Set();
  for (const m of game.motes) {
    seen.add(m.id);
    let v = moteViews.get(m.id);
    if (!v) { v = makeMote(); scene.add(v); moteViews.set(m.id, v); }
    v.position.set(m.pos[0], 0.9 + Math.sin(time * 2.5 + m.pos[0]) * 0.25, m.pos[2]);
    v.userData.star.rotation.y = time * 2 + m.pos[2];
  }
  for (const [id, v] of moteViews) if (!seen.has(id)) { scene.remove(v); moteViews.delete(id); }

  const seenS = new Set();
  for (const s of game.shades) {
    seenS.add(s.id);
    let v = shadeViews.get(s.id);
    if (!v) { v = makeShade(); shadeViews.set(s.id, v); }
    const stunned = s.state === 'stunned';
    v.position.set(s.pos[0], 0.8 + Math.sin(time * 4 + s.pos[2]) * 0.1, s.pos[2]);
    v.scale.setScalar(stunned ? 0.6 : 1);
    v.userData.body.material.emissive.setHex(stunned ? 0x2255aa : 0x3a0a6a);
    v.lookAt(p.pos[0], 0.8, p.pos[2]);
  }
  for (const [id, v] of shadeViews) if (!seenS.has(id)) { scene.remove(v); shadeViews.delete(id); }

  const lit = game.lanterns.filter((l) => l.lit).length;
  ambient.intensity = 1.2 + lit * 0.2;
  scene.fog.density = 0.02 - lit * 0.003;

  if (game.pulseFx > 0) {
    const k = 1 - game.pulseFx / 20;
    pulseRing.visible = true;
    pulseRing.position.set(p.pos[0], 0.05, p.pos[2]);
    pulseRing.scale.setScalar(TUNING.pulse_radius * k + 0.1);
    pulseRing.material.opacity = 1 - k;
  } else pulseRing.visible = false;
}

function updateCamera(yawDeg) {
  const th = (yawDeg * Math.PI) / 180;
  const fx = Math.sin(th), fz = Math.cos(th); // huong "tien" cua nguoi choi
  const p = player.position;
  camera.position.set(p.x - fx * 9, p.y + 6, p.z - fz * 9);
  camera.lookAt(p.x, p.y + 1, p.z);
}

// ---------- HUD ----------
// Dung lai DOM theo so luong phan tu co dinh, chi doi class de nhe.
function ensure(id, n, make) {
  const el = $(id);
  while (el.children.length < n) el.appendChild(make());
  return el.children;
}
const span = (t) => () => { const s = document.createElement('span'); s.textContent = t; return s; };
const pip = () => { const d = document.createElement('div'); d.className = 'pip'; return d; };

function hud(game) {
  const p = game.player;
  [...ensure('flames', TUNING.flames, span('🔥'))].forEach((el, i) => el.classList.toggle('off', i >= p.flames));
  [...ensure('motes', TUNING.carry_capacity, pip)].forEach((el, i) => el.classList.toggle('on', i < p.carried));
  const lit = game.lanterns.filter((l) => l.lit).length;
  $('lanternCount').textContent = `${lit}/${game.lanterns.length}`;
  [...ensure('lanterns', game.lanterns.length, span('🏮'))].forEach((el, i) => {
    const l = game.lanterns[i];
    el.className = l.lit ? 'lit' : l.deposited > 0 ? 'part' : '';
  });
  const left = Math.max(0, game.timeInit - game.tick / 60);
  $('time').textContent = `🌙 ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  $('timefill').style.width = `${(left / game.timeInit) * 100}%`;
  $('scoreVal').textContent = game.score;

  const cd = p.pulseCd / (TUNING.pulse_cooldown_s * 60);
  const noMote = p.carried < TUNING.pulse_cost;
  const box = $('pulse');
  box.classList.toggle('wait', cd > 0);
  box.classList.toggle('empty', cd <= 0 && noMote);
  $('pulseFill').style.width = `${(1 - cd) * 100}%`;
  $('pulseSub').textContent = cd > 0 ? 'Đang hồi…' : noMote ? `Cần ${TUNING.pulse_cost} đom đóm` : `Tốn ${TUNING.pulse_cost} đom đóm`;

  const msg = $('msg');
  if (game.state === 'playing') msg.style.display = 'none';
  else {
    msg.style.display = 'flex';
    $('msgTitle').textContent = game.state === 'won' ? 'Đảo đã sáng lại!' : 'Sương đen nuốt mất ánh sáng…';
    $('msgBody').textContent = game.state === 'won' ? `${lit}/${game.lanterns.length} đèn · còn ${p.flames} ngọn lửa` : game.player.flames <= 0 ? 'Mây đã hết ngọn lửa.' : 'Bình minh tới, nhưng đảo vẫn còn tối.';
    $('msgScore').textContent = `Điểm: ${game.score}`;
  }
}

// ---------- Input ----------
const keys = new Set();
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyR' && game.state !== 'playing') restart();
});
addEventListener('keyup', (e) => keys.delete(e.code));
let yaw = 0;

// Chuot: giu chuot trai de di ve phia con tro (chieu con tro xuong mat dat y=0).
const mouse = { down: false, x: 0, y: 0 };
const raycaster = new THREE.Raycaster();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();
renderer.domElement.addEventListener('mousedown', (e) => { if (e.button === 0) { mouse.down = true; mouse.x = e.clientX; mouse.y = e.clientY; } });
addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
addEventListener('blur', () => { mouse.down = false; keys.clear(); });

function mouseMove() {
  if (!mouse.down) return [0, 0];
  raycaster.setFromCamera(new THREE.Vector2((mouse.x / innerWidth) * 2 - 1, -(mouse.y / innerHeight) * 2 + 1), camera);
  if (!raycaster.ray.intersectPlane(ground, hit)) return [0, 0];
  const dx = hit.x - game.player.pos[0], dz = hit.z - game.player.pos[2];
  const d = Math.hypot(dx, dz);
  if (d < 0.5) return [0, 0]; // vung chet quanh nhan vat de khong rung lac
  const k = Math.min(1, d / 2); // gan con tro thi di cham lai
  const wx = (dx / d) * k, wz = (dz / d) * k;
  const th = (yaw * Math.PI) / 180; // doi huong the gioi -> [x,z] theo cong thuc contract (nghich dao)
  return [wx * Math.cos(th) - wz * Math.sin(th), wx * Math.sin(th) + wz * Math.cos(th)];
}

function readInput() {
  // Camera nhin theo +forward => man hinh "phai" la -X o yaw=0, nen D => x = -1.
  let x = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
  let z = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  if (x === 0 && z === 0) [x, z] = mouseMove();
  return { move: [x, z], cam_yaw_deg: yaw, jump: keys.has('Space'), interact: keys.has('KeyE'), pulse: keys.has('KeyF') };
}

// ---------- Vong lap ----------
let game;
function restart() { game = createGame({ seed: (Date.now() & 0x7fffffff) || 1 }); }
restart();
let acc = 0, last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (keys.has('ArrowLeft') || keys.has('KeyZ')) yaw -= 120 * dt;
  if (keys.has('ArrowRight') || keys.has('KeyC')) yaw += 120 * dt;
  acc += dt;
  while (acc >= DT) {
    step(game, readInput());
    drainEvents(game);
    acc -= DT;
  }
  syncViews(game, now / 1000);
  updateCamera(yaw);
  hud(game);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__game = () => game; // de debug / chup man hinh
