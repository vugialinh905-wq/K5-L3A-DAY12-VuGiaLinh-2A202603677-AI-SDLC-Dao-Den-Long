// Ban web 3D: dung chung loi logic src/core.js (fixed 60 tick/s), Three.js chi lo hien thi + luong man hinh.
import * as THREE from 'three';
import { createGame, createBenchGame, benchStep, step, drainEvents, windInfo, needLit, capacity, TUNING, CONSTANTS as K } from './core.js';
import { buildWorld, setLitProgress, glowTexture, PAL } from './world.js';
import * as audio from './audio.js';
import { ACTIONS, defaultBindings, loadBindings, rebind, keyLabel, normalizeCode } from './bindings.js';
import { validateName, makeEntry, addEntry, sanitizeEntries } from './leaderboard.js';

const $ = (id) => document.getElementById(id);
const BENCH = new URLSearchParams(location.search).get('bench') === '1';
const DT = 1 / 60;

// ---------- Cai dat (luu giua cac lan mo) ----------
const settings = {
  volume: 0.7, sens: 1, cb: false, // cb = bang mau de phan biet (mu mau)
  captions: true, bigText: false, bindings: null,
  reduceMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
};
try { Object.assign(settings, JSON.parse(localStorage.getItem('ddl_settings') || '{}')); } catch { /* khong co localStorage */ }
settings.bindings = loadBindings(settings.bindings); // thieu / trung / sai -> mac dinh
const saveSettings = () => { try { localStorage.setItem('ddl_settings', JSON.stringify(settings)); } catch { /* bo qua */ } };
audio.setVolume(settings.volume);
const applyUi = () => {
  document.body.classList.toggle('cb', !!settings.cb);
  document.body.classList.toggle('bigtext', !!settings.bigText);
  document.body.classList.toggle('reduce-motion', !!settings.reduceMotion);
};
const applyCb = applyUi;
applyUi();
const warn = (m) => (settings.cb ? '⚠ ' : '') + m;
const lanternCost = (l) => (l.everLit ? TUNING.relight_cost : TUNING.lantern_cost);
const FUEL_MAX_U = TUNING.fuel_max * 60, LOW_U = TUNING.low_fuel_threshold * 60;
const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), Z_AXIS = new THREE.Vector3(0, 0, 1);

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
if (!BENCH) addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
const ambient = new THREE.AmbientLight(0x9aa8ff, 0.15);
const moon = new THREE.DirectionalLight(0x9aa8ff, 0.55);
moon.position.set(-20, 40, -10);
scene.add(ambient, moon);
const glow = glowTexture();

// ---------- Nhan vat May: vay hong, ao kem, khan do, non la co den long nho ----------
const player = new THREE.Group();
const rig = {};
function miniLantern(scale = 1) {
  const g = new THREE.Group();
  const paper = new THREE.MeshStandardMaterial({ color: PAL.lampOn, emissive: PAL.lampOn, emissiveIntensity: 0.9, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), paper); body.scale.set(1, 1.2, 1);
  const capM = new THREE.MeshStandardMaterial({ color: 0x5a3a24 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 10), capM); top.position.y = 0.2;
  const bot = top.clone(); bot.position.y = -0.2;
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 6), new THREE.MeshStandardMaterial({ color: PAL.scarf })); tassel.position.y = -0.3; tassel.rotation.x = Math.PI;
  g.add(body, top, bot, tassel);
  g.scale.setScalar(scale);
  return g;
}
{
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });
  const PINK = 0xf8a3c4, PINK_D = 0xe57aa3, SKIN = 0xf3cba6, HAIR = 0x3a2418;
  const upper = new THREE.Group(); // than tren: nhun khi chay
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.68, 0.8, 24, 1, true), std(PINK, { side: THREE.DoubleSide, emissive: 0x3a1020 }));
  skirt.position.y = 0.52;
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.675, 0.05, 8, 32), std(PINK_D)); hem.rotation.x = Math.PI / 2; hem.position.y = 0.13;
  const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.28, 0.07, 16), std(PINK_D)); waist.position.y = 0.93;
  const blouse = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.27, 0.34, 16), std(PAL.shirt)); blouse.position.y = 1.12;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 8, 16), std(PAL.scarf)); scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.33;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.03), std(PAL.scarf)); tail.position.set(0.1, 1.12, -0.24); tail.rotation.x = 0.35;
  const puffs = [-1, 1].map((sx) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), std(PAL.shirt)); m.position.set(sx * 0.27, 1.2, 0); return m; });
  const hands = [-1, 1].map((sx) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), std(SKIN)); m.position.set(sx * 0.3, 0.98, 0.04); return m; });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 18, 14), std(SKIN)); head.position.y = 1.58;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.31, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), std(HAIR)); hair.position.set(0, 1.6, -0.03); hair.rotation.x = -0.25;
  const tails = [-1, 1].map((sx) => {
    const t = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), std(HAIR)); t.position.set(sx * 0.3, 1.46, -0.08);
    const r = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), std(PINK)); r.position.set(sx * 0.28, 1.56, -0.05);
    return [t, r];
  }).flat();
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x1a1020 });
  const eyes = [-1, 1].map((sx) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeM); m.position.set(sx * 0.1, 1.58, 0.265); return m; });
  const cheeks = [-1, 1].map((sx) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff9db5 })); m.scale.z = 0.4; m.position.set(sx * 0.17, 1.51, 0.23); return m; });
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.5, 28), std(0xe8d08a)); hat.position.y = 2.0;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.025, 6, 32), std(PINK)); band.rotation.x = Math.PI / 2; band.position.y = 1.78;
  const strapL = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.34, 4), std(PINK)); strapL.position.set(-0.3, 1.55, 0.06);
  const strapR = strapL.clone(); strapR.position.x = 0.3;
  // Chan va giay
  const legs = [-1, 1].map((sx) => {
    const g = new THREE.Group(); g.position.set(sx * 0.13, 0.2, 0);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6), std(SKIN)); leg.position.y = -0.1;
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), std(0x7a3a4a)); shoe.scale.set(1, 0.6, 1.4); shoe.position.set(0, -0.25, 0.03);
    g.add(leg, shoe);
    return g;
  });
  // Den long nho treo o vanh non (theo PRD-0), co day
  const lampG = new THREE.Group(); lampG.position.set(0.66, 1.78, 0.05);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 4), std(0x333333)); cord.position.y = -0.15;
  const lamp = miniLantern(1.1); lamp.position.y = -0.48;
  lampG.add(cord, lamp);
  const lampLight = new THREE.PointLight(PAL.lampOn, 2.4, 14, 1.6); lampLight.position.set(0, -0.48, 0); lampG.add(lampLight);
  upper.add(waist, blouse, scarf, tail, ...puffs, ...hands, head, hair, ...tails, ...eyes, ...cheeks, hat, band, strapL, strapR, lampG);
  player.add(skirt, hem, upper, ...legs);
  Object.assign(rig, { upper, skirt, hem, legs, lampG });
  player.userData = { lampLight };
}
scene.add(player);
let walkPhase = 0, lastSync = 0;
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
  // Cot go co de da, canh tay, den long giay co khung suon, nap go, tua do va xich treo
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: PAL.wood, roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 1 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 0.3, 12), new THREE.MeshStandardMaterial({ color: 0x77706a, roughness: 1 })); base.position.y = 0.15;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 3.4, 8), wood); pole.position.y = 1.9;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 1.15, 8), wood); arm.rotation.z = Math.PI / 2; arm.position.set(0.52, 3.55, 0);
  const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6), wood); brace.rotation.z = -Math.PI / 4; brace.position.set(0.3, 3.2, 0);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), dark); knob.position.set(0, 3.62, 0);
  const swing = new THREE.Group(); swing.position.set(1.05, 3.55, 0); // diem treo
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 4), new THREE.MeshStandardMaterial({ color: PAL.gold, roughness: 0.4 })); chain.position.y = -0.2;
  const lg = new THREE.Group(); lg.position.y = -1.3; // tam than den
  const paper = new THREE.MeshStandardMaterial({ color: PAL.lampOff, emissive: PAL.lampOn, emissiveIntensity: 0, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.72, 24, 16), paper); body.scale.set(1, 1.2, 1);
  const ribM = new THREE.MeshStandardMaterial({ color: 0x7a2a1a, roughness: 0.8 });
  const ribs = new THREE.Group();
  for (let i = 0; i < 10; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.725, 0.014, 6, 32), ribM);
    r.rotation.y = (i * Math.PI) / 10;
    ribs.add(r);
  }
  ribs.scale.set(1, 1.2, 1);
  const hoopM = new THREE.MeshStandardMaterial({ color: PAL.gold, roughness: 0.4 });
  const hoop1 = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.025, 6, 32), hoopM); hoop1.rotation.x = Math.PI / 2; hoop1.position.y = 0.38;
  const hoop2 = hoop1.clone(); hoop2.position.y = -0.38;
  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.14, 16), dark); capTop.position.y = 0.88;
  const capBot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.34, 0.14, 16), dark); capBot.position.y = -0.88;
  const ringTop = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.025, 6, 12), hoopM); ringTop.position.y = 1.0;
  const tasM = new THREE.MeshStandardMaterial({ color: PAL.scarf, roughness: 0.8 });
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), tasM); knot.position.y = -1.0;
  const tassel = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.55, 4), tasM);
    t.position.set(Math.cos(a) * 0.05, -1.32, Math.sin(a) * 0.05);
    t.rotation.z = Math.cos(a) * 0.12; t.rotation.x = Math.sin(a) * 0.12;
    tassel.add(t);
  }
  const light = new THREE.PointLight(PAL.lampOn, 0, 26, 1.4);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  halo.scale.setScalar(6.5);
  lg.add(body, ribs, hoop1, hoop2, capTop, capBot, ringTop, knot, tassel, light, halo);
  swing.add(chain, lg);
  const ring = new THREE.Mesh(new THREE.RingGeometry(TUNING.safe_radius - 0.1, TUNING.safe_radius, 64), new THREE.MeshBasicMaterial({ color: PAL.lampOn, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
  // Thanh dau (luon quay ve camera) va vet rach tren giay (chi hien o che do mu mau khi den tat)
  const BW = 1.6;
  const bar = new THREE.Group();
  const barBack = new THREE.Mesh(new THREE.PlaneGeometry(BW + 0.14, 0.3), new THREE.MeshBasicMaterial({ color: PAL.sky }));
  const fillGeo = new THREE.PlaneGeometry(BW, 0.18); fillGeo.translate(BW / 2, 0, 0.01);
  const barFill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ color: PAL.lampOn }));
  barFill.position.x = -BW / 2;
  bar.add(barBack, barFill); bar.position.set(1.05, 5.3, 0); bar.visible = false;
  const tearShape = new THREE.Shape();
  [[-0.3, 0.36], [0.06, 0.1], [-0.12, -0.04], [0.26, -0.36], [0.02, -0.12], [0.22, 0.12], [-0.06, 0.3]].forEach(([x, y], i) => (i ? tearShape.lineTo(x, y) : tearShape.moveTo(x, y)));
  const tearM = new THREE.MeshBasicMaterial({ color: 0x1a1020, side: THREE.DoubleSide });
  const tear1 = new THREE.Mesh(new THREE.ShapeGeometry(tearShape), tearM); tear1.position.z = 0.73;
  const tear2 = tear1.clone(); tear2.rotation.y = Math.PI; tear2.position.z = -0.73;
  tear1.visible = tear2.visible = false;
  lg.add(tear1, tear2);
  g.add(base, pole, arm, brace, knob, swing, ring, bar);
  g.userData = { globe: body, light, halo, ring, swing, lg, bar, barFill, tears: [tear1, tear2] };
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
  const beamGeo = new THREE.CylinderGeometry(0.07, 0.07, 1, 6); beamGeo.rotateX(Math.PI / 2); beamGeo.translate(0, 0, 0.5);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: PAL.shadeEdge, transparent: true, opacity: 0.75 }));
  beam.frustumCulled = false; beam.visible = false;
  g.add(beam);
  g.userData = { body, edge, eyeM, beam };
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
function buildNightWorld(def, opts = {}) {
  if (worldGroup) { scene.remove(worldGroup); disposeTree(worldGroup); }
  clearViews();
  worldGroup = buildWorld(def, glow, opts);
  scene.add(worldGroup);
}

function syncViews(game, time) {
  const p = game.player;
  player.position.set(p.pos[0], p.pos[1], p.pos[2]);
  player.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
  player.visible = p.respawn === 0 && (p.invuln % 8 < 5);
  player.userData.lampLight.intensity = 2.4 + Math.sin(time * 6) * 0.25;
  { // chay: nhun nguoi, vay lac, chan buoc, den long dung dua
    const dtv = Math.min(0.1, Math.max(0, time - lastSync)); lastSync = time;
    const sp = Math.hypot(p.hv[0], p.hv[1]), k = p.grounded ? Math.min(1, sp / 6) : 0;
    walkPhase += sp * dtv * 1.9;
    rig.upper.position.y = Math.abs(Math.sin(walkPhase)) * 0.06 * k;
    rig.skirt.rotation.z = Math.sin(walkPhase) * 0.07 * k;
    rig.skirt.scale.set(1 + Math.sin(walkPhase * 2) * 0.03 * k, 1, 1 + Math.cos(walkPhase * 2) * 0.03 * k);
    rig.legs[0].rotation.x = Math.sin(walkPhase) * 0.7 * k; rig.legs[1].rotation.x = -Math.sin(walkPhase) * 0.7 * k;
    rig.lampG.rotation.z = Math.sin(time * 2.2) * 0.06 + Math.sin(walkPhase) * 0.12 * k;
  }

  const total = game.lanterns.length, lit = game.lanterns.filter((l) => l.lit).length;
  ambient.intensity = 0.15 + 0.55 * (lit / total); // cong thuc chuan cua ticket
  scene.fog.density = 0.016 - 0.005 * (lit / total);

  for (const l of game.lanterns) {
    let v = views.lanterns.get(l.id);
    if (!v) { v = makeLantern(); views.lanterns.set(l.id, v); }
    v.position.set(l.pos[0], l.pos[1], l.pos[2]);
    // Canh tay huong ve tam dao
    const cx = game.night === 2 && l.pos[0] > 35 ? 70 : 0;
    v.rotation.y = Math.atan2(l.pos[2], cx - l.pos[0]);
    const fuel = l.lit ? l.fuelU / 60 : 0;
    const weak = l.lit && fuel < TUNING.low_fuel_threshold;
    const blink = weak && Math.floor(time * 2) % 2 === 0; // fuel < 30: den va thanh dau nhap nhay cham (1 Hz)
    const frac = l.lit ? 1 : l.deposited / lanternCost(l);
    const dim = 0.35 + 0.65 * Math.min(1, fuel / TUNING.low_fuel_threshold);
    const u = v.userData, mt = u.globe.material;
    if (l.lit) { mt.color.setHex(PAL.lampOn); mt.emissive.setHex(PAL.lampCore); mt.emissiveIntensity = (blink ? 0.2 : 0.95) * (0.5 + 0.5 * dim); }
    else { mt.color.setHex(PAL.lampOff).lerp(new THREE.Color(PAL.lampOn), frac * 0.8); mt.emissive.setHex(PAL.lampOn); mt.emissiveIntensity = frac * 0.7; }
    u.light.intensity = l.lit ? 70 * dim * (blink ? 0.3 : 1) : frac * 10;
    u.halo.material.opacity = l.lit ? 0.85 * dim * (blink ? 0.4 : 1) : frac * 0.4;
    u.ring.material.opacity = l.lit && fuel >= TUNING.low_fuel_threshold ? 0.55 : 0; // vung an toan chi con khi fuel >= 30
    u.swing.rotation.z = Math.sin(time * 1.3 + l.pos[0]) * (l.lit ? 0.05 : 0.025);
    // thanh dau: chi o den dang sang, quay ve camera
    u.bar.visible = l.lit && !blink;
    u.barFill.scale.x = Math.max(0.001, fuel / TUNING.fuel_max);
    u.barFill.material.color.setHex(weak ? (settings.cb ? 0xffffff : 0xff5a5f) : PAL.lampOn);
    v.getWorldQuaternion(tmpQ).invert();
    u.bar.quaternion.copy(tmpQ).multiply(camera.quaternion);
    // mu mau: den tat xep 20% va co vet rach de phan biet khong can mau
    u.lg.scale.y = settings.cb && !l.lit ? 0.8 : 1;
    for (const t of u.tears) t.visible = settings.cb && !l.lit;
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
    const cb = settings.cb, u = v.userData, dr = s.state === 'drain';
    u.edge.material.color.setHex(cb ? 0x00b3ff : PAL.shadeEdge); // mu mau: vien va mat #00B3FF
    u.eyeM.color.setHex(cb ? 0x00b3ff : 0xd6a0ff);
    u.body.material.emissive.setHex(dr ? (cb ? 0x0077aa : 0x5a2aa8) : 0x000000);
    u.body.material.emissiveIntensity = dr ? 0.6 + 0.4 * Math.sin(time * 8) : 0;
    const L = dr && s.target ? game.lanterns.find((x) => x.id === s.target) : null;
    if (L) { // tia hut dau noi toi qua den
      const lv = views.lanterns.get(L.id), th = lv ? lv.rotation.y : 0;
      v.updateMatrixWorld(true);
      tmpV.set(L.pos[0] + 1.05 * Math.cos(th), L.pos[1] + 2.25, L.pos[2] - 1.05 * Math.sin(th));
      v.worldToLocal(tmpV);
      u.beam.quaternion.setFromUnitVectors(Z_AXIS, tmpV.clone().normalize());
      u.beam.scale.set(1, 1, tmpV.length());
      u.beam.material.color.setHex(cb ? 0x00b3ff : PAL.shadeEdge);
      u.beam.visible = true;
    } else u.beam.visible = false;
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
  leaves.visible = (w.active || w.warn) && !settings.reduceMotion;
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
let yaw = 0, shake = 0;
function updateCamera() {
  const th = (yaw * Math.PI) / 180;
  const fx = Math.sin(th), fz = Math.cos(th);
  const p = player.position;
  camera.position.set(p.x - fx * 9, p.y + 6, p.z - fz * 9);
  camera.lookAt(p.x, p.y + 1, p.z);
  if (shake > 0 && !settings.reduceMotion) { // rung camera khi bi danh / toa sang (tat duoc bang Giam chuyen dong)
    camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake * 0.6; camera.position.z += (Math.random() - 0.5) * shake;
    camera.lookAt(p.x, p.y + 1, p.z);
  }
  camera.updateMatrixWorld();
}

// ---------- Input ----------
const keys = new Set();
const mouse = { down: false, rot: false, x: 0, y: 0 };
let capture = null; // { id, btn } khi dang cho phim moi (doi phim)
const bound = () => settings.bindings;
const isTextField = (e) => e.target instanceof HTMLInputElement && e.target.type === 'text';
addEventListener('keydown', (e) => {
  if (capture) { e.preventDefault(); e.stopPropagation(); finishCapture(e.code); return; }
  if (isTextField(e)) return; // dang go ten
  const code = normalizeCode(e.code);
  if (e.repeat) { if (run.state === 'play' && (code === 'Space' || code.startsWith('Arrow'))) e.preventDefault(); return; }
  keys.add(code);
  if (run.state === 'play' && (code === 'Space' || code.startsWith('Arrow'))) e.preventDefault();
  if (code === bound().pause || code === 'KeyP') {
    if (run.state === 'play') pauseGame(); else if (run.state === 'pause') resumeGame();
  }
  if (code === 'KeyH' && (run.state === 'play' || run.state === 'pause')) toggleHelp();
  if (code === 'KeyR' && run.state === 'result') $('btnNext').click();
});
addEventListener('keyup', (e) => keys.delete(normalizeCode(e.code)));
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
  const b = bound();
  // Camera nhin theo +forward => man hinh "phai" la -X o yaw=0, nen phai => x = -1.
  let x = (keys.has(b.left) ? 1 : 0) - (keys.has(b.right) ? 1 : 0);
  let z = (keys.has(b.forward) ? 1 : 0) - (keys.has(b.back) ? 1 : 0);
  if (x === 0 && z === 0) [x, z] = mouseMove(game);
  const jump = keys.has(b.jump);
  if (jump && !prevJump && game.player.grounded && game.state === 'playing') audio.sfx.jump();
  prevJump = jump;
  return { move: [x, z], cam_yaw_deg: yaw, jump, interact: keys.has(b.interact), pulse: keys.has(b.pulse), dash: keys.has(b.dash), pause };
}

// ---------- Man hinh / luong game ----------
const NIGHTS = {
  1: { name: 'Đêm 1 · Đảo Bến', quote: 'Sương đen đã nuốt hết ánh sáng đảo Bến, Mây à. Gom đom đóm, thắp lại các ngọn đèn lồng, rồi nhớ giữ chúng sáng: đèn nào sắp cạn dầu thì châm thêm đom đóm. Chỉ cần còn ít nhất 3 trên 5 ngọn sáng khi bình minh tới là đảo được cứu. Coi chừng Bóng Mực hút dầu nhé.' },
  2: { name: 'Đêm 2 · Đảo Cau', quote: 'Đảo Cau có hai bờ nối bằng cây cầu tre không lan can. Bước cho vững, hoặc cứ nhảy lên bục để bay sang. Coi chừng Gió Lạc, chúng thích cuỗm đom đóm của người mang nhiều. Đêm nay cần giữ ít nhất 4 trên 6 ngọn đèn sáng tới bình minh.' },
  3: { name: 'Đêm 3 · Đảo Chuông', quote: 'Đảo Chuông cao ba tầng, gió thổi từng cơn. Ngọn đèn cuối nằm sát chân tháp chuông. Cần giữ ít nhất 5 trên 7 ngọn sáng tới bình minh. Ông Đăng tin Mây làm được.' },
};
const run = {
  night: 1, total: 0, state: 'menu', game: null, resultAt: 0, counted: false, lastSecond: -1, lastWarn: false, settingsFrom: 'menu',
  nightsWon: 0, seed: 1, attempt: 0, weak: new Set(), shadeAlert: null, boardFrom: 'menu', lastEntry: null,
};
function newRun() { run.total = 0; run.nightsWon = 0; run.seed = (Date.now() & 0x7fffffff) || 1; run.attempt = 0; run.lastEntry = null; }
const screens = ['menu', 'intro', 'pause', 'settings', 'board', 'result', 'dawn'];
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
  run.game = createGame({ seed: ((run.seed + run.night * 100 + run.attempt++) & 0x7fffffff) || 1, night: run.night });
  run.weak.clear(); run.shadeAlert = null; hideNameForm(); showHelp(15000);
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
  const lit = g.lanterns.filter((l) => l.lit).length, need = needLit(g);
  run.state = 'result';
  if (won && !run.counted) { run.total += g.score; run.nightsWon += 1; run.counted = true; }
  if (won && run.night === 3) { $('dawnScore').textContent = run.total; run.state = 'dawn'; show('dawn'); showNameForm('dawnSlot'); return; }
  $('resTitle').textContent = won ? `Bình minh! Đêm ${run.night} hoàn thành` : 'Sương đen nuốt mất ánh sáng…';
  $('resBody').textContent = won
    ? `${lit}/${g.lanterns.length} đèn còn sáng · còn ${g.player.flames} ngọn lửa`
    : g.player.flames <= 0 ? 'Mây đã hết ngọn lửa.' : `Bình minh tới nhưng chỉ ${lit}/${g.lanterns.length} đèn còn sáng (cần ${need}).`;
  $('resScore').textContent = `Điểm đêm này: ${g.score}`;
  $('resTotal').textContent = `Tổng điểm: ${run.total}`;
  $('btnNext').textContent = won ? 'Đêm kế tiếp' : `Chơi lại Đêm ${run.night}`;
  show('result');
  if (won) hideNameForm(); else showNameForm('resSlot'); // thua o bat ky Dem nao cung duoc luu diem
}
function toMenu() { run.state = 'menu'; run.game = null; show('menu'); }
function openSettings(from) { run.settingsFrom = from; $('settings').classList.add('on'); for (const s of screens) if (s !== 'settings') $(s).classList.remove('on'); }

click('btnStart', () => { newRun(); showIntro(1); });
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
click('btnAgain', () => { newRun(); showIntro(1); });

const volEl = $('vol'), sensEl = $('sens');
volEl.value = Math.round(settings.volume * 100); sensEl.value = Math.round(settings.sens * 100);
const syncSettingText = () => { $('volVal').textContent = volEl.value + '%'; $('sensVal').textContent = (sensEl.value / 100).toFixed(2) + '×'; };
syncSettingText();
volEl.addEventListener('input', () => { settings.volume = volEl.value / 100; audio.setVolume(settings.volume); saveSettings(); syncSettingText(); });
sensEl.addEventListener('input', () => { settings.sens = sensEl.value / 100; saveSettings(); syncSettingText(); });
volEl.addEventListener('change', () => audio.sfx.ui());
const cbEl = $('cb');
cbEl.checked = !!settings.cb;
cbEl.addEventListener('change', () => { settings.cb = cbEl.checked; saveSettings(); applyCb(); audio.sfx.ui(); });
for (const [id, key] of [['cap', 'captions'], ['rm', 'reduceMotion'], ['big', 'bigText']]) {
  const el = $(id);
  el.checked = !!settings[key];
  el.addEventListener('change', () => { settings[key] = el.checked; saveSettings(); applyUi(); audio.sfx.ui(); });
}

// ---------- Doi phim ----------
function renderKeys() {
  const list = $('keyList');
  list.textContent = '';
  for (const a of ACTIONS) {
    const row = document.createElement('div'); row.className = 'row';
    const lab = document.createElement('label'); lab.textContent = a.label; lab.style.minWidth = '11em'; lab.htmlFor = 'key_' + a.id;
    const btn = document.createElement('button'); btn.type = 'button'; btn.id = 'key_' + a.id; btn.className = 'keybtn'; btn.textContent = keyLabel(settings.bindings[a.id]);
    btn.addEventListener('click', () => {
      audio.initAudio();
      if (capture && capture.btn === btn) { capture = null; renderKeys(); return; } // bam lai de huy
      capture = { id: a.id, btn };
      renderKeys();
      const nb = $('key_' + a.id); nb.classList.add('capturing'); nb.textContent = 'Nhấn phím…'; nb.focus();
      $('keyMsg').textContent = '';
    });
    row.append(lab, btn);
    list.appendChild(row);
  }
  refreshKeyHints();
}
function finishCapture(code) {
  const { id } = capture;
  const r = rebind(settings.bindings, id, code);
  capture = null;
  if (r.ok) { settings.bindings = r.bindings; saveSettings(); $('keyMsg').textContent = ''; }
  else $('keyMsg').textContent = `⚠ Phím ${keyLabel(normalizeCode(code))} đã dùng cho: ${r.conflict}. Hãy chọn phím khác.`;
  renderKeys();
  $('key_' + id)?.focus();
}
click('btnKeysReset', () => { settings.bindings = defaultBindings(); capture = null; saveSettings(); renderKeys(); $('keyMsg').textContent = ''; });

// ---------- Tro giup phim (hien 15 s dau moi Dem, bam H de bat/tat) ----------
let helpTimer = 0;
function renderHelp() {
  const b = settings.bindings, k = (id) => `<b>${keyLabel(b[id])}</b>`;
  $('help').innerHTML = `Đi: ${k('forward')} ${k('left')} ${k('back')} ${k('right')} hoặc <b>giữ chuột trái</b><br>Nhảy ${k('jump')} · Lướt ${k('dash')}<br>Tương tác ${k('interact')} · Tỏa sáng ${k('pulse')}<br>Tạm dừng ${k('pause')} · Camera <b>← →</b> hoặc chuột phải · Ẩn: <b>H</b>`;
}
function showHelp(ms) { renderHelp(); $('help').classList.add('show'); clearTimeout(helpTimer); if (ms) helpTimer = setTimeout(() => $('help').classList.remove('show'), ms); }
function toggleHelp() { clearTimeout(helpTimer); renderHelp(); $('help').classList.toggle('show'); }
function refreshKeyHints() {
  const b = settings.bindings;
  $('keyDash').textContent = keyLabel(b.dash);
  $('keyPulse').textContent = keyLabel(b.pulse);
  $('menuHint').textContent = `Điều khiển: ${keyLabel(b.forward)}${keyLabel(b.left)}${keyLabel(b.back)}${keyLabel(b.right)} hoặc giữ chuột trái · ${keyLabel(b.jump)} nhảy · ${keyLabel(b.dash)} lướt · ${keyLabel(b.interact)} nạp đèn · ${keyLabel(b.pulse)} tỏa sáng · ${keyLabel(b.pause)} tạm dừng`;
  renderHelp();
}
renderKeys();

// ---------- Phu de / chi bao hinh anh ----------
function caption(text, warnKind = false) {
  if (!settings.captions) return;
  const box = $('captions'), el = document.createElement('div');
  el.className = 'cap' + (warnKind ? ' warn' : '');
  el.textContent = (warnKind && settings.cb ? '⚠ ' : '') + text;
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => el.remove(), 4500);
}

// ---------- Bang xep hang (luu tren dia qua serve.js; du phong localStorage khi khong co server) ----------
const LB_KEY = 'ddl_leaderboard', NAME_KEY = 'ddl_last_name';
const loadLocalBoard = () => { try { return sanitizeEntries(JSON.parse(localStorage.getItem(LB_KEY) || '[]')); } catch { return []; } };
const saveLocalBoard = (e) => { try { localStorage.setItem(LB_KEY, JSON.stringify(e)); } catch { /* bo qua */ } };
async function fetchBoard() {
  try {
    const r = await fetch('/api/leaderboard', { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    return { entries: sanitizeEntries(await r.json()), source: 'server' };
  } catch { return { entries: loadLocalBoard(), source: 'local' }; }
}
async function submitScore(name) {
  const payload = { name, score: run.total, nights_won: run.nightsWon, seed: run.seed };
  try {
    const r = await fetch('/api/leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const j = await r.json();
    if (!r.ok) return { ok: false, error: j.error || 'Không lưu được' };
    return { ok: true, entry: j.entry, rank: j.rank };
  } catch { // khong co server: luu tren trinh duyet
    try {
      const entry = makeEntry(payload);
      const { entries, rank } = addEntry(loadLocalBoard(), entry);
      saveLocalBoard(entries);
      return { ok: true, entry, rank, local: true };
    } catch (e) { return { ok: false, error: e.message }; }
  }
}
function hideNameForm() { $('nameForm').classList.remove('show'); }
function showNameForm(slotId) {
  const f = $('nameForm');
  $(slotId).appendChild(f);
  f.classList.add('show');
  $('nameMsg').textContent = ''; $('nameMsg').className = '';
  $('btnSave').disabled = false;
  try { $('nameInput').value = localStorage.getItem(NAME_KEY) || ''; } catch { $('nameInput').value = ''; }
}
async function saveScore() {
  const msg = $('nameMsg'), v = validateName($('nameInput').value);
  if (!v.ok) { msg.textContent = v.reason; msg.className = 'err'; $('nameInput').focus(); return; }
  $('btnSave').disabled = true;
  const r = await submitScore(v.name);
  if (!r.ok) { msg.textContent = r.error; msg.className = 'err'; $('btnSave').disabled = false; return; }
  try { localStorage.setItem(NAME_KEY, v.name); } catch { /* bo qua */ }
  run.lastEntry = r.entry;
  msg.className = '';
  msg.textContent = r.rank >= 0 ? `Đã lưu! Bạn xếp hạng #${r.rank + 1}.` : 'Đã lưu, nhưng chưa vào top 10.';
  openBoard(run.state === 'dawn' ? 'dawn' : 'result');
}
async function openBoard(from) {
  run.boardFrom = from;
  show('board');
  const tb = $('boardRows');
  tb.textContent = '';
  const { entries, source } = await fetchBoard();
  $('boardNote').textContent = entries.length ? (source === 'local' ? 'Lưu trên trình duyệt này (không có server).' : 'Top 10 điểm cao nhất, lưu trên máy bạn.') : 'Chưa có ai trong bảng xếp hạng. Hãy là người đầu tiên!';
  entries.forEach((e, i) => {
    const tr = document.createElement('tr');
    if (run.lastEntry && e.achieved_at === run.lastEntry.achieved_at && e.name === run.lastEntry.name) tr.className = 'me';
    const cell = (text, cls) => { const td = document.createElement('td'); td.textContent = text; if (cls) td.className = cls; tr.appendChild(td); };
    cell(i + 1, 'num'); cell(e.name); cell(e.score, 'num'); cell(`${e.nights_won}/3`, 'num');
    cell(new Date(e.achieved_at).toLocaleDateString('vi-VN'));
    tb.appendChild(tr);
  });
}
click('btnBoard', () => openBoard('menu'));
click('btnDawnBoard', () => openBoard('dawn'));
click('btnBoardBack', () => show(run.boardFrom));
click('btnSave', saveScore);
$('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveScore(); } });

// ---------- Su kien tu loi game -> am thanh + hieu ung ----------
let toastTimer = 0;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.style.display = 'block';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.style.display = 'none'; }, 2200);
}
function flash() { if (settings.reduceMotion) return; const f = $('flash'); f.style.opacity = 1; setTimeout(() => { f.style.opacity = 0; }, 160); }
function handleEvents(evs) {
  for (const e of evs) {
    switch (e.name) {
      case 'mote_picked': audio.sfx.pickup(); break;
      case 'deposit': audio.sfx.deposit(); break;
      case 'lantern_lit': audio.sfx.light(); toast(e.data.relight ? 'Đèn đã được thắp lại!' : 'Một ngọn đèn đã sáng lại!'); break;
      case 'refuel': audio.sfx.deposit(); toast(`Châm dầu +${e.data.amount} đom đóm → ${Math.round(e.data.fuel)}%`); break;
      case 'lantern_out': audio.sfx.out(); toast(warn('Một ngọn đèn đã cạn dầu và tắt!')); break;
      case 'fuel_drain': audio.sfx.steal(); toast(warn('Bóng Mực đang hút dầu đèn!')); break;
      case 'pulse': audio.sfx.pulse(); shake = 0.2; break;
      case 'dash': audio.sfx.dash(); break;
      case 'player_hit': audio.sfx.hit(); flash(); shake = 0.45; if (e.data.by === 'fall') toast('Mây rơi khỏi đảo! Mất hết đom đóm.'); break;
      case 'shade_spawned': audio.sfx.spawn(); caption('Bóng Mực xuất hiện!', true); run.shadeAlert = { id: e.data.id, until: performance.now() + 4500 }; break;
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
  const cap = capacity(game); // suc chua tang dan: 10 + 2 * lan thap thanh cong, toi da 20
  ensure('pips', TUNING.capacity_max, pip).forEach((el, i) => { el.style.display = i < cap ? '' : 'none'; el.classList.toggle('on', i < p.carried); });
  $('capText').textContent = `${p.carried}/${cap}`;
  const lit = game.lanterns.filter((l) => l.lit).length;
  const need = needLit(game);
  $('lanternCount').textContent = `${lit}/${game.lanterns.length}`;
  $('goal').textContent = `Giữ ≥ ${need}/${game.lanterns.length} đèn sáng tới bình minh · hiện ${lit}`;
  $('goal').classList.toggle('bad', lit < need);
  $('scoreVal').textContent = run.total + game.score;
  const left = Math.max(0, game.timeInit - game.simTick / 60);
  const mm = Math.floor(left / 60), ss = Math.floor(left % 60);
  $('time').textContent = `${mm}:${String(ss).padStart(2, '0')}`;
  $('time').classList.toggle('danger', left <= 30);
  if (left <= 30 && settings.cb) $('time').textContent = '⚠ ' + $('time').textContent;
  const sec = Math.ceil(left);
  const cdn = $('countdown');
  if (game.state === 'playing' && !game.paused && sec <= 10 && sec > 0) {
    if (sec !== run.lastSecond) { audio.sfx.tick(); if (sec === 10) caption('10 giây cuối!', true); }
    cdn.style.display = settings.captions ? 'block' : 'none'; cdn.textContent = (settings.cb ? '⚠ ' : '') + sec;
  } else cdn.style.display = 'none';
  run.lastSecond = sec;
  for (const l of game.lanterns) { // chi bao: den co fuel < 30
    const weak = l.lit && l.fuelU < LOW_U;
    if (weak && !run.weak.has(l.id)) { run.weak.add(l.id); caption(`Đèn ${l.id} sắp hết dầu (${Math.floor(l.fuelU / 60)}%)`, true); }
    else if (!weak) run.weak.delete(l.id);
  }
  charmEl.style.display = p.charm > 0 ? 'block' : 'none';
  charmEl.textContent = `Bùa Gió · ${(p.charm / 60).toFixed(1)}s`;

  const dashP = p.charm > 0 ? 1 : 1 - p.dashCd / K.dash_cd;
  $('cdDash').style.setProperty('--p', dashP); $('cdDash').classList.toggle('off', dashP < 1);
  const pulseP = 1 - p.pulseCd / K.pulse_cd;
  $('cdPulse').style.setProperty('--p', pulseP); $('cdPulse').classList.toggle('off', pulseP < 1 || p.carried < TUNING.pulse_cost);

  // Nhac "E": den nhan duoc (chua sang, hoac sang chua day dau) trong 2 m; mui ten: den chua sang gan nhat, khong co thi den yeu gan nhat
  let near = null, nd = Infinity, target = null, td = Infinity, weakT = null, wd = Infinity;
  for (const l of game.lanterns) {
    const d = Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]);
    const eligible = !l.lit || l.fuelU < FUEL_MAX_U;
    if (eligible && d <= TUNING.interact_radius && d < nd) { near = l; nd = d; }
    if (!l.lit && d < td) { target = l; td = d; }
    if (l.lit && l.fuelU < LOW_U && d < wd) { weakT = l; wd = d; }
  }
  if (!target) target = weakT;
  const pr = $('prompt');
  if (near) {
    pr.style.display = 'block';
    pr.textContent = (near.lit ? `E — Châm dầu (${Math.floor(near.fuelU / 60)}%)` : `E — ${near.everLit ? 'Thắp lại' : 'Nạp ánh sáng'} (${near.deposited}/${lanternCost(near)})`)
      + (p.carried === 0 ? ' · cần đom đóm' : '');
  } else pr.style.display = 'none';
  const ar = $('arrow');
  if (target && !near) placeEdgeArrow(ar, target.pos[0], target.pos[1] + 3.4, target.pos[2], false);
  else ar.style.display = 'none';
  // mui ten chi huong Bong Muc vua xuat hien (o mep man hinh, ke ca khi no dang nam trong khung hinh)
  const sa = $('shadeArrow'), al = run.shadeAlert;
  const sh = settings.captions && al && performance.now() < al.until ? game.shades.find((x) => x.id === al.id) : null;
  if (sh) placeEdgeArrow(sa, sh.pos[0], sh.pos[1], sh.pos[2], true); else sa.style.display = 'none';
}

function placeEdgeArrow(el, wx, wy, wz, always) {
  ndc.set(wx, wy, wz).project(camera);
  const behind = ndc.z > 1;
  let x = ndc.x, y = ndc.y;
  if (behind) { x = -x; y = -y; }
  const off = behind || Math.abs(x) > 0.92 || Math.abs(y) > 0.88;
  if (!off && !always) { el.style.display = 'none'; return; }
  const m = Math.max(Math.abs(x) / 0.92, Math.abs(y) / 0.88, 1e-6);
  x /= m; y /= m;
  if (Math.abs(x) < 1e-3 && Math.abs(y) < 1e-3) y = -0.88;
  el.style.display = 'block';
  el.style.left = ((x * 0.5 + 0.5) * innerWidth) + 'px';
  el.style.top = ((-y * 0.5 + 0.5) * innerHeight) + 'px';
  el.style.transform = `rotate(${Math.atan2(x, y) * 180 / Math.PI}deg)`;
}

// Kiem tra co chu: moi van ban dang hien phai >= 18 px o 1280x720 (xem docs/proof/phase-4.md)
window.__auditFonts = () => {
  const out = [];
  document.querySelectorAll('body *').forEach((el) => {
    if (!el.getClientRects().length) return;
    if (!Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())) return;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 18) out.push({ el: el.id || el.className || el.tagName, fs, text: el.textContent.trim().slice(0, 40) });
  });
  return out;
};

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
      if (w.warn && !run.lastWarn) { audio.sfx.wind(); toast('Gió sắp nổi! Bám chắc.'); caption('Gió sắp thổi! Bám chắc.', true); }
      run.lastWarn = w.warn;
    }
    shake = Math.max(0, shake - dt * 1.2);
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

// ---------- Benchmark (Ticket-04): http://localhost:PORT/index.html?bench=1&seed=42&duration=30 (do bang `node bench.js`) ----------
function runBench() {
  const q = new URLSearchParams(location.search);
  const seed = Number(q.get('seed')) || 42, duration = Number(q.get('duration')) || 30;
  document.querySelectorAll('.screen').forEach((e) => e.classList.remove('on'));
  document.body.classList.add('bench');
  try { const dx = 1280 - innerWidth, dy = 720 - innerHeight; if (dx || dy) window.resizeTo(outerWidth + dx, outerHeight + dy); } catch { /* khong doi duoc cua so */ }
  renderer.setPixelRatio(1);
  renderer.setSize(1280, 720); // cua so chuan 1280x720
  renderer.domElement.style.cssText = 'position:fixed;left:0;top:0;width:1280px;height:720px;cursor:none';
  camera.aspect = 1280 / 720; camera.updateProjectionMatrix();
  const g = createBenchGame(seed);
  buildNightWorld(g.def, { bench: true }); // chi canh chuan: tat phan trang tri sang tao
  const WARM = 3000, MEASURE = duration * 1000;
  let t0 = null, prev = null, acc = 0, firstEpoch = null;
  const dts = [];
  const finish = async () => {
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const ver = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext ? 'WebGL2' : 'WebGL1';
    const ua = (navigator.userAgent.match(/(Chrome|Edg)\/[\d.]+/g) || [navigator.userAgent]).join(' ');
    const body = { dts, first_frame_epoch_ms: firstEpoch, renderer: `Three.js r${THREE.REVISION} / ${ver} / ${gpu} / ${ua}`, inner: [innerWidth, innerHeight], seed, duration };
    try { await fetch('/__bench', { method: 'POST', body: JSON.stringify(body) }); } catch { /* bench.js se het gio */ }
    document.title = 'Benchmark xong';
  };
  const loop = (now) => {
    if (t0 === null) { t0 = now; firstEpoch = performance.timeOrigin + now; }
    if (prev !== null) { acc += Math.min(0.1, (now - prev) / 1000); while (acc >= DT) { benchStep(g); acc -= DT; } }
    syncViews(g, now / 1000);
    const th = ((now - t0) / 15000) * Math.PI * 2; // 15 s / vong, nguoc chieu kim dong ho, bat dau o goc 0 (30, 15, 0)
    camera.position.set(30 * Math.cos(th), 15, 30 * Math.sin(th));
    camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    renderer.render(scene, camera);
    if (prev !== null && now - t0 >= WARM) dts.push(now - prev);
    prev = now;
    if (now - t0 >= WARM + MEASURE) { finish(); return; }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
if (BENCH) runBench();
else {
  buildNightWorld(menuGame().def);
  syncViews(menuGame(), 0);
  requestAnimationFrame(frame);
}
window.__run = () => run;
window.__game = () => run.game;

// Duong tat de thu nhanh: http://localhost:8080/?night=2 (hoac 3) mo thang man gioi thieu Dem do
{
  const q = new URLSearchParams(location.search).get('night');
  if (q === '1' || q === '2' || q === '3') { newRun(); showIntro(Number(q)); }
}

// Roi tab / an cua so: tu dong tam dung game va tat tieng (khong de nhac chay ngam)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (run.state === 'play') pauseGame();
    audio.suspendAudio();
  } else audio.resumeAudio();
});
addEventListener('pagehide', () => { audio.stopMusic(); audio.suspendAudio(); });
window.__scene = () => scene; // de kiem tra / chup man hinh
