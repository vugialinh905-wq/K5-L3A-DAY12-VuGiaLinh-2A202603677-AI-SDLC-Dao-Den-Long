// Ban web 3D: dung chung loi logic src/core.js (fixed 60 tick/s), Three.js chi lo hien thi.
import * as THREE from 'three';
import { createGame, step, drainEvents, TUNING, ISLAND_RADIUS } from './core.js';

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

const ambient = new THREE.AmbientLight(0x8a6ac0, 0.8);
scene.add(ambient);
const moon = new THREE.DirectionalLight(0xa090e0, 0.9);
moon.position.set(-20, 40, -10);
scene.add(moon);

// Dao tron + bien may
const island = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS + 2, 3, 64), new THREE.MeshStandardMaterial({ color: 0x4a6a50, roughness: 1 }));
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
const moteGeo = new THREE.SphereGeometry(0.16, 10, 8);
const moteMat = new THREE.MeshBasicMaterial({ color: 0xffe27a });

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
    if (!v) { v = new THREE.Mesh(moteGeo, moteMat); scene.add(v); moteViews.set(m.id, v); }
    v.position.set(m.pos[0], 0.9 + Math.sin(time * 2.5 + m.pos[0]) * 0.25, m.pos[2]);
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
  ambient.intensity = 0.8 + lit * 0.2;
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
function hud(game) {
  $('flames').textContent = '🔥'.repeat(Math.max(0, game.player.flames)) || '💀';
  $('carried').textContent = `✨ ${game.player.carried}/${TUNING.carry_capacity}`;
  $('lanterns').textContent = `🏮 ${game.lanterns.filter((l) => l.lit).length}/${game.lanterns.length}`;
  const left = Math.max(0, game.timeInit - game.tick / 60);
  $('time').textContent = `🌙 ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  $('score').textContent = `Điểm ${game.score}`;
  const msg = $('msg');
  if (game.state === 'playing') msg.style.display = 'none';
  else {
    msg.style.display = 'flex';
    $('msgTitle').textContent = game.state === 'won' ? 'Đảo đã sáng lại!' : 'Sương đen nuốt mất ánh sáng…';
    $('msgBody').textContent = `Điểm: ${game.score}`;
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

function readInput() {
  // Camera nhin theo +forward => man hinh "phai" la -X o yaw=0, nen D => x = -1.
  const x = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
  const z = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
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
