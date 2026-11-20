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

export function buildWorld(def, glow, opts = {}) {
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

  if (opts.bench) floaters.length = 0; // benchmark: chi canh chuan, khong co phan trang tri sang tao
  else decorate(root, def, glow);
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
  // Bui cay (cum la xep lop), nam do cham trang, da goc canh, co non o goc: chi la trang tri (tat khi benchmark)
  {
    const Z = new THREE.Vector3(0, 0, 1), Yv = new THREE.Vector3(0, 1, 0);
    const nrm = new THREE.Vector3(), pp = new THREE.Vector3(), sc = new THREE.Vector3();
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), m = new THREE.Matrix4(), col = new THREE.Color(), ee = new THREE.Euler();
    const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
    const inst = (geo, mat, n) => new THREE.InstancedMesh(geo, mat, Math.max(1, n));
    const blades = []; // [x, h, z, huong] - co non moc quanh cum nam / da
    const addBlades = (x, h, z, n, r) => { for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, rr = r * (0.35 + rnd() * 0.75); blades.push([x + Math.cos(a) * rr, h, z + Math.sin(a) * rr, a]); } };

    // ---- Bui cay kieu tranh ve phang: cac cum tron xanh o-liu -> vang chanh xep tang, hoa vang nho (mot so tren cuong manh)
    {
      const spots = pts(def.id === 2 ? 16 : 14, 4);
      const NB = 15, FL = 17;
      const blobs = inst(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshStandardMaterial({ roughness: 1, emissive: 0x2c3c12 }), spots.length * NB);
      const petals = inst(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshStandardMaterial({ color: 0xffd53a, roughness: 0.8, emissive: 0x6a4c00 }), spots.length * FL * 5);
      const centers = inst(new THREE.SphereGeometry(1, 6, 5), new THREE.MeshStandardMaterial({ color: 0xe8861c, roughness: 0.8, emissive: 0x4a2200 }), spots.length * FL);
      const stemGeo = new THREE.CylinderGeometry(0.013, 0.016, 1, 4); stemGeo.translate(0, 0.5, 0);
      const stems = inst(stemGeo, new THREE.MeshStandardMaterial({ color: 0x5a9a3a, roughness: 1, emissive: 0x143a10 }), spots.length * FL);
      const dark = new THREE.Color(0x2f4a1c), mid = new THREE.Color(0x628a2a), light = new THREE.Color(0xc4d43e);
      const m1 = new THREE.Matrix4(), m2 = new THREE.Matrix4(), unit = new THREE.Vector3(1, 1, 1), fp = new THREE.Vector3(), lp = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
      let bi = 0, pi = 0, ci = 0, ti = 0;
      for (const [x, h, z] of spots) {
        const R = 1.2 + rnd() * 0.9, Hh = R * 0.78;
        for (let i = 0; i < NB; i++) { // cum tron: giua cao va toi, ria thap va sang
          const ang = rnd() * Math.PI * 2, d = R * 0.82 * Math.sqrt(rnd());
          const rb = R * (0.3 + rnd() * 0.24);
          pp.set(x + Math.cos(ang) * d, h + rb * 0.55 + (1 - d / R) * Hh * 0.55, z + Math.sin(ang) * d);
          qa.setFromAxisAngle(Yv, rnd() * Math.PI * 2);
          m.compose(pp, qa, sc.set(rb, rb * 0.82, rb)); blobs.setMatrixAt(bi, m);
          const t = smooth(0.1, 0.9, d / R + (rnd() - 0.5) * 0.7);
          col.copy(dark).lerp(mid, smooth(0, 0.55, t)).lerp(light, smooth(0.5, 1, t));
          blobs.setColorAt(bi++, col);
        }
        for (let i = 0; i < FL; i++) { // hoa vang
          const stem = rnd() < 0.35;
          const ang = rnd() * Math.PI * 2, d = R * (stem ? 0.35 + rnd() * 0.55 : 0.1 + rnd() * 0.7);
          const baseY = h + Hh * (1 - (d / R) * (d / R) * 0.55) + 0.05;
          const top = stem ? 0.3 + rnd() * 0.35 : 0.03;
          fp.set(x + Math.cos(ang) * d, baseY + top, z + Math.sin(ang) * d);
          nrm.set(Math.cos(ang) * 0.25, 1, Math.sin(ang) * 0.25).normalize();
          qa.setFromUnitVectors(Z, nrm);
          const fs = 1.25 + rnd() * 0.7;
          if (stem) { m.compose(pp.set(fp.x, baseY - 0.05, fp.z), qb.identity(), sc.set(1, top + 0.05, 1)); stems.setMatrixAt(ti++, m); }
          m1.compose(fp, qa, unit);
          for (let k = 0; k < 5; k++) {
            const th = (k / 5) * Math.PI * 2 + rnd() * 0.2;
            m2.compose(lp.set(0.085 * Math.cos(th) * fs, 0.085 * Math.sin(th) * fs, 0), qb.identity(), sc.set(0.075 * fs, 0.075 * fs, 0.03 * fs));
            petals.setMatrixAt(pi++, m1.clone().multiply(m2));
          }
          m2.compose(lp.set(0, 0, 0.012), qb.identity(), sc.setScalar(0.05 * fs));
          centers.setMatrixAt(ci++, m1.clone().multiply(m2));
        }
      }
      stems.count = ti;
      root.add(blobs, petals, centers, stems);
    }

    // ---- Nam: do, cham trang, chan kem; moi cum 1 cay to + 1 cay nho + co non
    {
      const clusters = pts(def.id === 2 ? 30 : 24, 2.5);
      const N = clusters.length * 2;
      const stalkGeo = new THREE.CylinderGeometry(0.5, 0.75, 1, 12); stalkGeo.translate(0, 0.5, 0);
      const capGeo = new THREE.SphereGeometry(1, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      const gillGeo = new THREE.CircleGeometry(1, 22); gillGeo.rotateX(Math.PI / 2);
      const spotGeo = new THREE.CircleGeometry(1, 10);
      const stalks = inst(stalkGeo, new THREE.MeshStandardMaterial({ color: 0xe9d8a6, roughness: 0.9, emissive: 0x2a2512 }), N);
      const caps = inst(capGeo, new THREE.MeshStandardMaterial({ color: 0xd8322e, roughness: 0.55, emissive: 0x4a0c0c }), N);
      const gills = inst(gillGeo, new THREE.MeshStandardMaterial({ color: 0xc9ae7e, roughness: 1, side: THREE.DoubleSide, emissive: 0x2a2010 }), N);
      const spots = inst(spotGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, emissive: 0x777777, side: THREE.DoubleSide }), N * 8);
      let si = 0, pi = 0;
      const mush = (x, h, z, s) => {
        const hs = 0.62 * s, R = 0.5 * s, yaw = rnd() * Math.PI * 2;
        qa.setFromAxisAngle(Yv, yaw);
        m.compose(pp.set(x, h, z), qa, sc.set(0.24 * s, hs, 0.24 * s)); stalks.setMatrixAt(si, m);
        const tilt = (rnd() - 0.5) * 0.18;
        ee.set(tilt, yaw, 0); qb.setFromEuler(ee);
        const capY = h + hs - 0.03 * s;
        m.compose(pp.set(x, capY, z), qb, sc.set(R, R * 0.72, R)); caps.setMatrixAt(si, m);
        m.compose(pp.set(x, capY - 0.01 * s, z), qb, sc.set(R * 0.97, 1, R * 0.97)); gills.setMatrixAt(si, m);
        si++;
        for (let k = 0; k < 8; k++) { // cham trang tren non
          const th = rnd() * Math.PI * 2, ph = 0.15 + rnd() * 0.95;
          const dx = Math.sin(ph) * Math.cos(th), dy = Math.cos(ph), dz = Math.sin(ph) * Math.sin(th);
          nrm.set(dx / R, dy / (R * 0.72), dz / R).normalize();
          qa.setFromUnitVectors(Z, nrm);
          pp.set(x + dx * R * 1.01, capY + dy * R * 0.72 * 1.01, z + dz * R * 1.01);
          m.compose(pp, qa, sc.set((0.05 + rnd() * 0.05) * s, (0.05 + rnd() * 0.05) * s, 1)); spots.setMatrixAt(pi++, m);
        }
      };
      for (const [x, h, z] of clusters) {
        mush(x, h, z, 0.95 + rnd() * 0.5);
        const a = rnd() * Math.PI * 2, d = 0.7 + rnd() * 0.3;
        mush(x + Math.cos(a) * d, h, z + Math.sin(a) * d, 0.5 + rnd() * 0.3);
        addBlades(x, h, z, 9, 0.9);
      }
      spots.count = pi;
      root.add(stalks, caps, gills, spots);
    }

    // ---- Da goc canh, mau nau xam, kem co non
    {
      const clusters = pts(def.id === 2 ? 20 : 16, 3);
      const rocks = inst(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true, emissive: 0x3a352c }), clusters.length * 3);
      const palette = [0xa09a8a, 0xb2a994, 0x8e887a, 0xbcb39c].map((c) => new THREE.Color(c));
      let ri = 0;
      for (const [x, h, z] of clusters) {
        const s0 = 0.95 + rnd() * 0.55;
        [[0, s0], [1, s0 * (0.5 + rnd() * 0.25)], [2, s0 * (0.38 + rnd() * 0.22)]].forEach(([k, s]) => {
          const a = rnd() * Math.PI * 2, d = k === 0 ? 0 : s0 * (0.85 + rnd() * 0.5);
          ee.set((rnd() - 0.5) * 0.4, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.4); qa.setFromEuler(ee);
          m.compose(pp.set(x + Math.cos(a) * d, h + s * 0.32, z + Math.sin(a) * d), qa, sc.set(s * (0.95 + rnd() * 0.3), s * (0.62 + rnd() * 0.2), s * (0.85 + rnd() * 0.3)));
          rocks.setMatrixAt(ri, m);
          rocks.setColorAt(ri++, col.copy(palette[Math.floor(rnd() * palette.length)]).offsetHSL(0, 0, (rnd() - 0.5) * 0.05));
        });
        addBlades(x, h, z, 12, s0 * 1.25);
      }
      root.add(rocks);
    }

    // ---- Co non quanh nam va da (nhieu mau xanh, nghieng ra ngoai)
    {
      const bladeGeo = new THREE.ConeGeometry(0.06, 0.6, 4); bladeGeo.translate(0, 0.3, 0);
      const gm = inst(bladeGeo, new THREE.MeshStandardMaterial({ roughness: 1, emissive: 0x143a14 }), blades.length);
      const gcol = [0x3f9a3a, 0x58b84a, 0x2f8a3a, 0x78c850].map((c) => new THREE.Color(c));
      const axis = new THREE.Vector3();
      blades.forEach(([x, h, z, a], i) => {
        axis.set(Math.sin(a), 0, -Math.cos(a));
        qa.setFromAxisAngle(axis, 0.2 + rnd() * 0.45);
        m.compose(pp.set(x, h, z), qa, sc.set(1, 0.6 + rnd() * 0.9, 1));
        gm.setMatrixAt(i, m); gm.setColorAt(i, gcol[Math.floor(rnd() * gcol.length)]);
      });
      root.add(gm);
    }

    // ---- Cum co nho rai tren mat dat
    {
      const tufts = pts(300, 1.5);
      const grass = inst(new THREE.ConeGeometry(0.05, 0.42, 4), new THREE.MeshStandardMaterial({ roughness: 1 }), tufts.length * 3);
      const gcol = [0x3a7260, 0x4a8a68, 0x58996c, 0x68a874, 0x78b47c].map((c) => new THREE.Color(c));
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
