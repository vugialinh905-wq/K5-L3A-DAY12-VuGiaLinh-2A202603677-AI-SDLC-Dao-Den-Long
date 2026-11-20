// Dung the gioi 3D tung Dem theo ban do chuan (src/core.js nightDef). Chi hien thi.
import * as THREE from 'three';
import { mulberry32, TUNING } from './core.js';

// Bang mau chuan cua Ticket-02
export const PAL = {
  sky: 0x0e1430, mist: 0x1b2350,
  grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, cloud: 0x12384a,
  lampOn: 0xffb347, lampCore: 0xffe9b0, lampOff: 0x5b5f6e,
  moteCore: 0xfff6c2, moteHalo: 0xffe58a,
  shade: 0x120a1a, shadeEdge: 0x7a3cff, shadeStun: 0x3a3450,
  shirt: 0xe8e2d0, scarf: 0xc8102e, gold: 0xf2c14e, drifter: 0x8fa3b8,
};

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 1, ...o });
const deg = (d) => (d * Math.PI) / 180;

export function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,246,194,1)');
  g.addColorStop(0.4, 'rgba(255,229,138,0.4)');
  g.addColorStop(1, 'rgba(255,200,80,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function disc(cx, cz, r, top, bottom, h) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 1.5, h, 64), mat(PAL.grass));
  m.position.set(cx, top - h / 2, cz);
  const rim = new THREE.Mesh(new THREE.RingGeometry(r - 2.5, r, 64), new THREE.MeshStandardMaterial({ color: PAL.sand, roughness: 1, side: THREE.DoubleSide }));
  rim.rotation.x = -Math.PI / 2; rim.position.set(cx, top + 0.02, cz);
  return [m, rim];
}

export function buildWorld(def, glow) {
  const root = new THREE.Group();
  const add = (...o) => o.forEach((x) => root.add(x));

  // Bien may
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshBasicMaterial({ color: PAL.cloud }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -12;
  add(sea);

  if (def.id === 1) add(...disc(0, 0, 40, 0, -3, 3));
  if (def.id === 2) {
    add(...disc(0, 0, 28, 0, -3, 3), ...disc(70, 0, 28, 0, -3, 3));
    // Cau tre x [26,44], z [-2,2], khong lan can
    const bridge = new THREE.Group();
    for (let i = 0; i < 36; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.25, 4), mat(i % 2 ? PAL.wood : 0x7d5a3c));
      p.position.set(26.25 + i * 0.5, -0.13, 0);
      bridge.add(p);
    }
    add(bridge);
    for (const pad of def.pads) add(...makePad(pad, glow));
  }
  if (def.id === 3) {
    add(...disc(0, 0, 45, 0, -3, 3));
    // Tang 1: vanh khan ban kinh 12-24, nua co z > 0, cao 3
    const sh = new THREE.Shape();
    sh.absarc(0, 0, 24, 0, Math.PI, false);
    sh.absarc(0, 0, 12, Math.PI, 0, true);
    const t1 = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 3, bevelEnabled: false, curveSegments: 48 }), mat(PAL.grass));
    t1.rotation.x = Math.PI / 2; t1.position.y = 3;
    const t1side = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.01, bevelEnabled: false, curveSegments: 48 }), mat(PAL.sand));
    t1side.rotation.x = Math.PI / 2; t1side.position.y = 3.02;
    // Tang 2: dia ban kinh 8, cao 6
    const t2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 48), mat(PAL.grass));
    t2.position.y = 3;
    const t2rim = new THREE.Mesh(new THREE.RingGeometry(6, 8, 48), new THREE.MeshStandardMaterial({ color: PAL.sand, roughness: 1, side: THREE.DoubleSide }));
    t2rim.rotation.x = -Math.PI / 2; t2rim.position.y = 6.02;
    add(t1, t1side, t2, t2rim);
    // 2 doc rong 3 m, goc 30 va 150 do, chan o r=30 (Y=0), dinh o r=24 (Y=3)
    for (const a of [30, 150]) {
      const g = new THREE.Group();
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(6, 3), 0.3, 3), mat(PAL.wood));
      ramp.position.set(27, 1.35, 0);
      ramp.rotation.z = -Math.atan2(3, 6);
      g.add(ramp);
      g.rotation.y = -deg(a);
      add(g);
    }
    // Thap chuong: tru ban kinh 2, cao 8 tren tang 2
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.3, 8, 20), mat(PAL.sand));
    tower.position.y = 10;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2, 20), mat(PAL.wood));
    roof.position.y = 15;
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: PAL.gold, emissiveIntensity: 0.5 }));
    bell.position.y = 12.5;
    add(tower, roof, bell);
    for (const pad of def.pads) add(...makePad(pad, glow));
  }

  decorate(root, def, glow);
  return root;
}

function makePad(pad, glow) {
  const g = new THREE.Mesh(new THREE.CircleGeometry(pad.r, 32), new THREE.MeshBasicMaterial({ color: PAL.lampOn, transparent: true, opacity: 0.75 }));
  g.rotation.x = -Math.PI / 2; g.position.set(pad.pos[0], pad.pos[1] + 0.05, pad.pos[2]);
  const ring = new THREE.Mesh(new THREE.RingGeometry(pad.r, pad.r + 0.2, 32), new THREE.MeshBasicMaterial({ color: PAL.lampCore, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.copy(g.position); ring.position.y += 0.01;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
  halo.scale.setScalar(4); halo.position.set(pad.pos[0], pad.pos[1] + 0.6, pad.pos[2]);
  return [g, ring, halo];
}

// Trang tri: bui cay, hoa, cay cau (Dem 2), den giay treo lo lung. Co dinh theo seed.
export const floaters = [];
function decorate(root, def, glow) {
  floaters.length = 0;
  const rnd = mulberry32(100 + def.id);
  const clear = [...def.lanterns, ...def.charms, ...def.pads.map((p) => p.pos), def.start, ...def.motePts];
  const pts = (n, minCheck = 3) => {
    const out = [];
    let guard = 0;
    while (out.length < n && guard++ < n * 60) {
      const span = def.id === 2 ? 100 : def.radius * 2;
      const x = (def.id === 2 ? 35 : 0) + (rnd() - 0.5) * (def.id === 2 ? 130 : span);
      const z = (rnd() - 0.5) * (def.id === 2 ? 60 : span);
      const h = def.heightAt(x, z);
      if (!isFinite(h) || h > 6.5 || Math.hypot(x, z) < 1.5 && def.id === 3) continue;
      if (def.id === 2 && x > 26 && x < 44) continue; // khong dat do len cau
      if (clear.some((c) => Math.hypot(c[0] - x, c[2] - z) < minCheck)) continue;
      // chi dat tren mat phang (khong tren doc) bang cach kiem tra do cao gan do
      if (Math.abs(def.heightAt(x + 1, z) - h) > 0.05 || Math.abs(def.heightAt(x, z + 1) - h) > 0.05) continue;
      out.push([x, h, z]);
    }
    return out;
  };
  // Bui cay kieu tranh ve: nen toi + rat nhieu la xep lop (instanced), xanh dam o duoi, xanh non o tren, vai mang sang
  {
    const spots = pts(def.id === 3 ? 40 : 36, 3.5);
    const lf = new THREE.Shape(); // la hinh giot nuoc
    lf.moveTo(0, 0); lf.quadraticCurveTo(0.55, 0.45, 0, 1.2); lf.quadraticCurveTo(-0.55, 0.45, 0, 0);
    const leafGeo = new THREE.ShapeGeometry(lf, 5);
    leafGeo.translate(0, -0.45, 0);
    const LEAVES = 190;
    const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ roughness: 1, side: THREE.DoubleSide, emissive: 0x2a5c34 }), spots.length * LEAVES);
    const baseGeo = new THREE.IcosahedronGeometry(1, 1);
    const bases = new THREE.InstancedMesh(baseGeo, new THREE.MeshStandardMaterial({ color: 0x1d4437, roughness: 1, flatShading: true }), spots.length * 3);
    const dark = new THREE.Color(0x2c6a50), mid = new THREE.Color(0x58aa56), light = new THREE.Color(0xc4ec66);
    const Z = new THREE.Vector3(0, 0, 1), nrm = new THREE.Vector3(), pp = new THREE.Vector3(), sc = new THREE.Vector3();
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), m = new THREE.Matrix4(), col = new THREE.Color();
    const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
    let li = 0, bi = 0;
    for (const [x, h, z] of spots) {
      const R = 1.2 + rnd() * 0.95, Hh = R * (0.62 + rnd() * 0.22);
      for (let k = 0; k < 3; k++) { // 3 khoi toi lam nen de khong ho
        const a = rnd() * Math.PI * 2, r = k === 0 ? 0 : R * 0.45;
        pp.set(x + Math.cos(a) * r * 0.6, h + Hh * 0.3, z + Math.sin(a) * r * 0.6);
        qa.identity(); sc.set(R * (0.62 + rnd() * 0.1), Hh * 0.5, R * (0.6 + rnd() * 0.1));
        m.compose(pp, qa, sc); bases.setMatrixAt(bi++, m);
      }
      const clumps = Array.from({ length: 3 }, () => { // vai mang la sang hon (nhu anh mau)
        const th = rnd() * Math.PI * 2, ph = Math.acos(1 - rnd() * 0.8);
        return new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
      });
      for (let i = 0; i < LEAVES; i++) {
        const th = rnd() * Math.PI * 2, ph = Math.acos(1 - rnd() * 0.97); // nua tren cua vom
        const d = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
        pp.set(x + d.x * R * 0.98, h + d.y * Hh * 1.02 + 0.08, z + d.z * R * 0.98);
        nrm.set(d.x / R, d.y / Hh, d.z / R).normalize(); // phap tuyen cua elip: la nam sat be mat
        qa.setFromUnitVectors(Z, nrm);
        qb.setFromAxisAngle(Z, rnd() * Math.PI * 2);
        qa.multiply(qb);
        const s = (0.34 + rnd() * 0.26) * (0.8 + 0.4 * d.y);
        sc.set(s, s * (1 + rnd() * 0.3), s);
        m.compose(pp, qa, sc); leaves.setMatrixAt(li, m);
        let f = 0; for (const c of clumps) f = Math.max(f, smooth(0.78, 0.97, d.dot(c)));
        const t = d.y * 0.85 + (rnd() - 0.5) * 0.35 + f * 0.45;
        col.copy(dark).lerp(mid, smooth(0.05, 0.6, t)).lerp(light, smooth(0.55, 1.05, t));
        leaves.setColorAt(li++, col);
      }
    }
    root.add(bases, leaves);
    // Cum co nho tren mat dat
    const tufts = pts(320, 1.5);
    const grass = new THREE.InstancedMesh(new THREE.ConeGeometry(0.05, 0.42, 4), new THREE.MeshStandardMaterial({ roughness: 1 }), tufts.length * 3);
    const gcol = [0x3a7260, 0x4a8a68, 0x58996c, 0x68a874, 0x78b47c].map((c) => new THREE.Color(c));
    const ee = new THREE.Euler();
    let gi = 0;
    for (const [x, h, z] of tufts) {
      for (let k = 0; k < 3; k++) {
        const hh = 0.7 + rnd() * 0.9;
        pp.set(x + (rnd() - 0.5) * 0.25, h + 0.2 * hh, z + (rnd() - 0.5) * 0.25);
        ee.set((rnd() - 0.5) * 0.5, 0, (rnd() - 0.5) * 0.5); qa.setFromEuler(ee);
        m.compose(pp, qa, sc.set(1, hh, 1)); grass.setMatrixAt(gi, m);
        grass.setColorAt(gi++, gcol[Math.floor(rnd() * gcol.length)]);
      }
    }
    root.add(grass);
  }
  // Cay dua (than cong, tan la long chim rũ, qua dua) va cay cau (thanh manh, thang) - chi la trang tri
  {
    const frondGeo = (len, wid) => {
      const g = new THREE.PlaneGeometry(1, 1, 2, 16);
      const pa = g.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        const sx = pa.getX(i), s = pa.getY(i) + 0.5;
        let xw = sx * 2 * wid * (1 - s * 0.78);
        if (Math.abs(sx) > 0.4) xw *= 1 + 0.22 * Math.sin(s * 46); // mep rang cua nhu cac chiec la phu
        const yy = len * (0.28 * s - 0.62 * s * s) - Math.abs(xw) * 0.5; // vong len roi rũ xuong, gap chu V
        pa.setXYZ(i, xw, yy, s * len);
      }
      g.computeVertexNormals();
      return g;
    };
    const makeInst = (geo, n, mat) => new THREE.InstancedMesh(geo, mat, Math.max(1, n));
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8c6c48, roughness: 1 });
    const palms = [];
    const nCoco = def.id === 2 ? 8 : 12, nAreca = def.id === 2 ? 14 : 0;
    for (const [x, h, z] of pts(nCoco, 4.5)) palms.push({ kind: 'coco', x, h, z });
    for (const [x, h, z] of pts(nAreca, 4)) palms.push({ kind: 'areca', x, h, z });
    const frondsC = [], frondsA = [], nuts = [], rings = [];
    const Zv = new THREE.Vector3(0, 0, 1), tmp = new THREE.Vector3();
    const q = new THREE.Quaternion(), mm = new THREE.Matrix4(), eu = new THREE.Euler(), pv = new THREE.Vector3(), sv = new THREE.Vector3();
    const gpal = [0x3f8a4a, 0x4fa055, 0x2f7a46, 0x63b05a, 0x56a85c].map((c) => new THREE.Color(c));
    for (const pl of palms) {
      const coco = pl.kind === 'coco';
      const H = coco ? 5 + rnd() * 2.2 : 6.5 + rnd() * 2;
      const lean = coco ? 1.4 + rnd() * 1.6 : 0.3 + rnd() * 0.4;
      const a = rnd() * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
      const curve = new THREE.CatmullRomCurve3([0, 0.25, 0.5, 0.75, 1].map((t) => new THREE.Vector3(dx * lean * t * t, H * t, dz * lean * t * t)));
      const r = coco ? 0.19 : 0.11;
      const trunk = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, r, 8, false), trunkMat);
      trunk.position.set(pl.x, pl.h, pl.z);
      root.add(trunk);
      for (let i = 1; i <= 7; i++) { // vong tren than
        const t = i / 8, pt = curve.getPoint(t);
        q.setFromUnitVectors(Zv, curve.getTangent(t, tmp).normalize());
        mm.compose(pv.set(pl.x + pt.x, pl.h + pt.y, pl.z + pt.z), q, sv.setScalar(r * 1.1));
        rings.push(mm.clone());
      }
      const top = curve.getPoint(1);
      const cx = pl.x + top.x, cy = pl.h + top.y, cz = pl.z + top.z;
      const n = coco ? 10 + Math.floor(rnd() * 3) : 7 + Math.floor(rnd() * 2);
      for (let i = 0; i < n; i++) {
        const yaw = (i / n) * Math.PI * 2 + rnd() * 0.4;
        const tilt = coco ? -0.35 + rnd() * 0.55 : -0.85 + rnd() * 0.4; // am = ngang len; dua rũ hon cau
        eu.set(tilt, yaw, 0, 'YXZ'); q.setFromEuler(eu);
        mm.compose(pv.set(cx, cy, cz), q, sv.setScalar(0.8 + rnd() * 0.45));
        (coco ? frondsC : frondsA).push({ m: mm.clone(), c: gpal[Math.floor(rnd() * gpal.length)] });
      }
      if (coco) for (let i = 0; i < 4; i++) { // chum qua dua duoi tan la
        const ang = rnd() * Math.PI * 2;
        mm.compose(pv.set(cx + Math.cos(ang) * 0.26, cy - 0.3 - rnd() * 0.15, cz + Math.sin(ang) * 0.26), q.identity(), sv.setScalar(0.2));
        nuts.push(mm.clone());
      }
    }
    const leafMat = () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x0a2010 });
    const build = (list, geo) => {
      const im = makeInst(geo, list.length, leafMat());
      list.forEach((f, i) => { im.setMatrixAt(i, f.m); im.setColorAt(i, f.c); });
      root.add(im);
    };
    build(frondsC, frondGeo(3.4, 0.5));
    build(frondsA, frondGeo(2.5, 0.32));
    const ringIm = makeInst(new THREE.TorusGeometry(1, 0.13, 5, 12), rings.length, new THREE.MeshStandardMaterial({ color: 0x6a4e32, roughness: 1 }));
    rings.forEach((r, i) => ringIm.setMatrixAt(i, r));
    const nutIm = makeInst(new THREE.SphereGeometry(1, 10, 8), nuts.length, new THREE.MeshStandardMaterial({ color: 0x6f8f3a, roughness: 0.8 }));
    nuts.forEach((r, i) => nutIm.setMatrixAt(i, r));
    root.add(ringIm, nutIm);
  }
  // Hoa nho (instanced)
  const list = pts(200, 2);
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.015, 0.02, 0.35, 5), mat(PAL.grass), list.length);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x222222 }), list.length);
  const palette = [0xff8fb8, 0xffe27a, 0xffffff, 0x9ec8ff, 0xd9a0ff].map((c) => new THREE.Color(c));
  const m4 = new THREE.Matrix4();
  list.forEach(([x, h, z], i) => {
    const hh = 0.25 + rnd() * 0.25;
    m4.makeScale(1, hh / 0.35, 1).setPosition(x, h + hh / 2, z); stems.setMatrixAt(i, m4);
    m4.makeScale(1, 0.7, 1).setPosition(x, h + hh + 0.04, z); heads.setMatrixAt(i, m4);
    heads.setColorAt(i, palette[Math.floor(rnd() * palette.length)]);
  });
  root.add(stems, heads);
  // Den long giay treo lo lung
  const spots = pts(14, 1.5);
  for (const [x, h, z] of spots) {
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: PAL.lampOn, emissive: PAL.lampOn, emissiveIntensity: 0.6, roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), m);
    body.scale.set(1, 1.25, 1);
    const cap = new THREE.CylinderGeometry(0.2, 0.2, 0.07, 10), capM = mat(PAL.wood);
    const top = new THREE.Mesh(cap, capM); top.position.y = 0.52;
    const bot = new THREE.Mesh(cap, capM); bot.position.y = -0.52;
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.6, 4), new THREE.MeshBasicMaterial({ color: 0x8a6a50 }));
    string.position.y = 1.35;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }));
    halo.scale.setScalar(3.2);
    g.add(body, top, bot, string, halo);
    const y = h + 3.2 + rnd() * 3.5;
    g.position.set(x, y, z);
    root.add(g);
    floaters.push({ g, mat: m, halo, y, ph: rnd() * 6.28, sway: 0.15 + rnd() * 0.2 });
  }
}

export function setLitProgress(frac, time) {
  for (const f of floaters) {
    f.g.position.y = f.y + Math.sin(time * 0.8 + f.ph) * 0.4;
    f.g.rotation.z = Math.sin(time * 0.6 + f.ph) * f.sway;
    f.mat.emissiveIntensity = 0.5 + frac * 1.2;
    f.halo.material.opacity = 0.45 + frac * 0.5;
  }
}

export { TUNING };
