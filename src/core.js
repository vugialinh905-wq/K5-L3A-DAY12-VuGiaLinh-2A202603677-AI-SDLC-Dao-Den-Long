// Loi logic Dao Den Long, Test Contract v1.3 (Ticket-04: phat hanh; luat khong doi so voi v1.2 Ticket-03: Den can dau).
// Thuan JS, khong phu thuoc DOM/GPU => dung chung cho headless va ban web.
// Quy uoc: 60 tick/s; met, giay; Y huong len; toa do cuc (x = cx + r*cos(a), z = r*sin(a)), goc do tu +X;
// khoang cach mac dinh do tren XZ, "trong ban kinh r" = <= r. Thu tu xu ly trong tick theo dung Ticket-02.

export const DT = 1 / 60;
export const STEP_UP = 0.35; // do cao toi da buoc len khi di ngang (dung cho doc), cao hon = vach dung

export const TUNING = Object.freeze({
  player_speed: 6.0,
  carry_capacity: 10,
  lantern_cost: 10,
  lantern_count_night1: 5,
  pickup_radius: 1.0,
  interact_radius: 2.0,
  pulse_cost: 3,
  pulse_radius: 5,
  night1_duration_s: 240,
  night2_duration_s: 270,
  night3_duration_s: 300,
  fuel_max: 100,
  fuel_decay_per_s: 1.0,
  fuel_per_mote: 10,
  relight_cost: 5,
  win_ratio: 0.6,
  drain_per_s: 5,
  low_fuel_threshold: 30,
  capacity_max: 20,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2,
  pulse_push_m: 4,
  pulse_cooldown_s: 3,
  safe_radius: 6,
  shade_speed: 4.0,
  shade_hit_radius: 1.0,
  dash_speed: 14,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  fall_enabled: true,
  score: Object.freeze({ per_mote: 5, per_lantern: 100, per_relight: 40, per_stun: 5, per_stun_drain: 15, per_lit_lantern_dawn: 50, per_flame_left: 50, per_second_left: 0 }),
});

// Hang so khac (khong nam trong khoi tuning cua contract nhung la so chuan cua ticket)
const K = Object.freeze({
  jump_speed: 7.0, gravity: 20, charm_speed: 7.2, accel_time_s: 0.1,
  mote_start: 20, mote_cap: 30, mote_every: 240, mote_drop_ttl: 480,
  pickup_height: 1.5, hit_height: 1.5, shade_speed_night3: 4.5,
  detect: 12, lose: 18, recoil_m: 2, recoil_ticks: 60, stun_ticks: 120, knock_ticks: 15, expel_ticks: 30,
  shade_first_tick: 300, shade_first_count: 2, spawn_min_dist: 15,
  invuln_ticks: 90, fall_y: -10, fall_wait: 60, pulse_height: 0.8,
  drifter_speed: 7, drifter_idle_speed: 2, drifter_max: 2, drifter_every: 1200, drifter_detect: 15, drifter_need: 5,
  drifter_hit: 1.2, drifter_steal: 3, drifter_flee_ticks: 240, drifter_drop_ticks: 120,
  charm_ticks: 600, charm_respawn: 2700,
  wind_every: 1800, wind_len: 300, wind_warn: 120, wind_speed: 2,
  dash_ticks: 12, dash_cd: 90, pulse_cd: 180,
  capacity_step: 2, drain_range: 2, drain_chase: 6, wander_stop: 1.5,
});
export const CONSTANTS = K;

// Don vi nhien lieu = 1/60 (1 tick hao 1 don vi khi hao 1.0/giay) => khong sai so so thuc
const U = 60;
const FUEL_MAX = TUNING.fuel_max * U;
const LOW = TUNING.low_fuel_threshold * U;

export class ContractError extends Error {}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rad = (d) => (d * Math.PI) / 180;
const polar = (cx, r, d, y = 0, cz = 0) => [cx + r * Math.cos(rad(d)), y, cz + r * Math.sin(rad(d))];
const ring = (cx, r, n, start, step, y = 0) => Array.from({ length: n }, (_, i) => polar(cx, r, start + i * step, y));
const NEG = -Infinity; // cao do cua "hu khong" (bien may): roi xuong

// ---------------------------------------------------------------- Ban do chuan
function inCircle(x, z, cx, cz, r) { return Math.hypot(x - cx, z - cz) <= r; }

function rampHeight(x, z) {
  for (const a of [30, 150]) {
    const ux = Math.cos(rad(a)), uz = Math.sin(rad(a));
    const along = x * ux + z * uz, lat = -x * uz + z * ux;
    if (along >= 24 && along <= 30 && Math.abs(lat) <= 1.5) return (3 * (30 - along)) / 6;
  }
  return NEG;
}

export function nightDef(n) {
  if (n === 1) {
    return {
      id: 1, name: 'Đảo Bến', duration: TUNING.night1_duration_s, start: [0, 0, 0], facing: [0, 1], radius: 40,
      heightAt: (x, z) => (Math.hypot(x, z) <= 40 ? 0 : NEG),
      lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
      motePts: [...ring(0, 12, 8, 0, 45), ...ring(0, 33, 16, 0, 22.5)],
      shadePts: ring(0, 37, 12, 15, 30).map((p) => [p[0], p[2]]),
      shadeEvery: 480, shadeMax: 6, shadeSpeed: TUNING.shade_speed,
      driftPts: ring(0, 30, 8, 0, 45).map((p) => [p[0], p[2]]),
      pads: [], charms: [], wind: false, drifters: false,
    };
  }
  if (n === 2) {
    const islands = [[0, 0], [70, 0]];
    const onBridge = (x, z) => x >= 26 && x <= 44 && Math.abs(z) <= 2;
    return {
      id: 2, name: 'Đảo Cau', duration: TUNING.night2_duration_s, start: [0, 0, 0], facing: [0, 1], radius: 28,
      heightAt: (x, z) => (islands.some(([cx, cz]) => inCircle(x, z, cx, cz, 28)) || onBridge(x, z) ? 0 : NEG),
      lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
      motePts: islands.flatMap(([cx]) => [...ring(cx, 10, 4, 0, 90), ...ring(cx, 22, 8, 0, 45)]),
      shadePts: islands.flatMap(([cx]) => ring(cx, 26, 8, 22.5, 45).map((p) => [p[0], p[2]])),
      shadeEvery: 420, shadeMax: 8, shadeSpeed: TUNING.shade_speed,
      driftPts: islands.flatMap(([cx]) => ring(cx, 20, 6, 0, 60).map((p) => [p[0], p[2]])),
      pads: [
        { pos: [20, 0, 18], r: 1, vy: 14, hv: dirTo([20, 18], [70, 0], 24) },
        { pos: [50, 0, -18], r: 1, vy: 14, hv: dirTo([50, -18], [0, 0], 24) },
      ],
      charms: [[35, 0, 0]], wind: false, drifters: true,
    };
  }
  if (n === 3) {
    return {
      id: 3, name: 'Đảo Chuông', duration: TUNING.night3_duration_s, start: [0, 0, -14], facing: [0, 1], radius: 45,
      heightAt: (x, z) => {
        const r = Math.hypot(x, z);
        let h = r <= 45 ? 0 : NEG;
        if (z > 0 && r >= 12 && r <= 24) h = Math.max(h, 3);
        if (r <= 8) h = Math.max(h, 6);
        if (r <= 2) h = Math.max(h, 14); // thap chuong cao 8 m tren tang 2: khong leo duoc
        return Math.max(h, rampHeight(x, z));
      },
      lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
      motePts: [...ring(0, 34, 18, 0, 20, 0), ...ring(0, 18, 8, 20, 20, 3), ...ring(0, 5, 4, 45, 90, 6)],
      shadePts: ring(0, 43, 16, 0, 22.5).map((p) => [p[0], p[2]]),
      shadeEvery: 360, shadeMax: 10, shadeSpeed: K.shade_speed_night3,
      driftPts: ring(0, 30, 8, 0, 45).map((p) => [p[0], p[2]]),
      pads: [{ pos: [0, 3, 13], r: 1, vy: 12, hv: [0, -8] }],
      charms: [[30, 0, 25], [-30, 0, 25]], wind: true, drifters: true,
    };
  }
  throw new ContractError('night phai la 1, 2 hoac 3');
}

function dirTo(a, b, speed) {
  const dx = b[0] - a[0], dz = b[1] - a[1], d = Math.hypot(dx, dz);
  return [(dx / d) * speed, (dz / d) * speed];
}

// ---------------------------------------------------------------- Kiem tra dau vao
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isVec = (v, n) => Array.isArray(v) && v.length === n && v.every(isNum);
const isNat = (v) => Number.isInteger(v) && v >= 0;
const bad = (msg) => { throw new ContractError(msg); };
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const SHADE_STATES = ['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain'];
const DRIFTER_STATES = ['idle', 'chase', 'flee'];

export function validateScenario(sc) {
  if (!isObj(sc)) bad('scenario phai la object');
  if (sc.player !== undefined) {
    const p = sc.player;
    if (!isObj(p)) bad('player phai la object');
    if (p.pos !== undefined && !isVec(p.pos, 3)) bad('player.pos phai la [x,y,z]');
    for (const k of ['carried', 'flames', 'invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks', 'successful_lights']) {
      if (p[k] !== undefined && !isNat(p[k])) bad(`player.${k} phai la so nguyen >= 0`);
    }
  }
  for (const k of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled']) {
    if (sc[k] !== undefined && typeof sc[k] !== 'boolean') bad(k + ' phai la boolean');
  }
  if (sc.motes !== undefined) {
    if (!Array.isArray(sc.motes)) bad('motes phai la mang');
    for (const m of sc.motes) {
      if (isVec(m, 3)) continue;
      if (!isObj(m) || !isVec(m.pos, 3)) bad('moi mote phai la [x,y,z] hoac {pos}');
      if (m.kind !== undefined && !['random', 'dropped'].includes(m.kind)) bad('mote.kind khong hop le');
      if (m.ttl_ticks !== undefined && !isNat(m.ttl_ticks)) bad('mote.ttl_ticks khong hop le');
    }
  }
  if (sc.shades !== undefined) {
    if (!Array.isArray(sc.shades)) bad('shades phai la mang');
    for (const s of sc.shades) {
      if (!isObj(s) || !isVec(s.pos, 3)) bad('shade.pos phai la [x,y,z]');
      if (s.id !== undefined && typeof s.id !== 'string') bad('shade.id phai la string');
      if (s.state !== undefined && !SHADE_STATES.includes(s.state)) bad('shade.state khong hop le');
      if (s.state_ticks_left !== undefined && !isNat(s.state_ticks_left)) bad('shade.state_ticks_left khong hop le');
      if (s.target_lantern_id !== undefined && typeof s.target_lantern_id !== 'string') bad('shade.target_lantern_id phai la string');
    }
  }
  if (sc.drifters !== undefined) {
    if (!Array.isArray(sc.drifters)) bad('drifters phai la mang');
    for (const d of sc.drifters) {
      if (!isObj(d) || !isVec(d.pos, 3)) bad('drifter.pos phai la [x,y,z]');
      if (d.state !== undefined && !DRIFTER_STATES.includes(d.state)) bad('drifter.state khong hop le');
      if (d.stolen !== undefined && !isNat(d.stolen)) bad('drifter.stolen khong hop le');
      if (d.state_ticks_left !== undefined && !isNat(d.state_ticks_left)) bad('drifter.state_ticks_left khong hop le');
    }
  }
  if (sc.charms !== undefined) {
    if (!Array.isArray(sc.charms)) bad('charms phai la mang');
    for (const c of sc.charms) {
      if (!isObj(c) || typeof c.id !== 'string' || !isVec(c.pos, 3)) bad('charm can id va pos [x,y,z]');
      if (c.available !== undefined && typeof c.available !== 'boolean') bad('charm.available phai la boolean');
      if (c.respawn_ticks !== undefined && !isNat(c.respawn_ticks)) bad('charm.respawn_ticks khong hop le');
    }
  }
  if (sc.lanterns !== undefined) {
    if (!Array.isArray(sc.lanterns)) bad('lanterns phai la mang');
    for (const l of sc.lanterns) {
      if (!isObj(l) || typeof l.id !== 'string') bad('lantern.id bat buoc');
      if (l.pos !== undefined && !isVec(l.pos, 3)) bad('lantern.pos phai la [x,y,z]');
      if (l.deposited !== undefined && !isNat(l.deposited)) bad('lantern.deposited khong hop le');
      if (l.lit !== undefined && typeof l.lit !== 'boolean') bad('lantern.lit phai la boolean');
      if (l.fuel !== undefined && !(isNum(l.fuel) && l.fuel >= 0 && l.fuel <= TUNING.fuel_max)) bad('lantern.fuel phai trong [0, 100]');
      if (l.ever_lit !== undefined && typeof l.ever_lit !== 'boolean') bad('lantern.ever_lit phai la boolean');
    }
  }
  if (sc.time_left_s !== undefined && !(isNum(sc.time_left_s) && sc.time_left_s >= 0)) bad('time_left_s khong hop le');
  return sc;
}

const BUTTONS = ['jump', 'interact', 'pulse', 'dash', 'pause'];

export function validateInputs(inp) {
  if (!isObj(inp) || !Array.isArray(inp.frames)) bad('inputs phai co mang frames');
  let last = -1;
  for (const f of inp.frames) {
    if (!isObj(f)) bad('frame phai la object');
    if (!Number.isInteger(f.tick) || f.tick < 0) bad('frame.tick phai la so nguyen >= 0');
    if (f.tick <= last) bad('frame.tick phai tang nghiem ngat');
    last = f.tick;
    if (f.move !== undefined && !(isVec(f.move, 2) && f.move.every((c) => c >= -1 && c <= 1))) bad('move phai la [x,z] trong [-1,1]');
    if (f.cam_yaw_deg !== undefined && !isNum(f.cam_yaw_deg)) bad('cam_yaw_deg phai la so');
    for (const b of BUTTONS) if (f[b] !== undefined && typeof f[b] !== 'boolean') bad(b + ' phai la boolean');
  }
  return inp;
}

// ---------------------------------------------------------------- Khoi tao
export function createGame({ seed = 1, night = 1, scenario = {} } = {}) {
  validateScenario(scenario);
  const def = nightDef(night);
  const T = TUNING;
  const g = {
    tick: 0, simTick: 0, night, def, state: 'playing', paused: false, score: 0, events: [],
    seed, rng: mulberry32(seed),
    timeInit: scenario.time_left_s ?? def.duration,
    player: {
      pos: [...def.start], hv: [0, 0], vy: 0, grounded: true, flames: T.flames, carried: 0,
      invuln: 0, dashCd: 0, dashTicks: 0, dashDir: [0, 1], pulseCd: 0, charm: 0,
      facing: [...def.facing], launched: false, launchHv: [0, 0], respawn: 0, successful: 0,
    },
    lanterns: def.lanterns.map((p, i) => ({ id: 'L' + (i + 1), pos: [...p], lit: false, deposited: 0, fuelU: 0, everLit: false, relit: 0 })),
    shades: [], motes: [], drifters: [],
    charms: def.charms.map((p, i) => ({ id: 'C' + (i + 1), pos: [...p], available: true, respawn: 0 })),
    nextShade: 1, nextMote: 1, nextDrifter: 1,
    randomMotes: scenario.random_motes ?? true,
    randomShades: scenario.random_shades ?? true,
    randomDrifters: scenario.random_drifters ?? def.drifters,
    windEnabled: scenario.wind_enabled ?? def.wind,
    input: null, prev: { jump: false, interact: false, pulse: false, dash: false, pause: false },
    pulseFx: 0,
  };
  const p = g.player;
  const sp = scenario.player;
  if (sp) {
    if (sp.pos) p.pos = [...sp.pos];
    if (sp.carried !== undefined) p.carried = sp.carried;
    if (sp.flames !== undefined) p.flames = sp.flames;
    if (sp.invuln_ticks !== undefined) p.invuln = sp.invuln_ticks;
    if (sp.dash_cd_ticks !== undefined) p.dashCd = sp.dash_cd_ticks;
    if (sp.pulse_cd_ticks !== undefined) p.pulseCd = sp.pulse_cd_ticks;
    if (sp.charm_ticks !== undefined) p.charm = sp.charm_ticks;
    if (sp.successful_lights !== undefined) p.successful = sp.successful_lights;
  }
  const h0 = def.heightAt(p.pos[0], p.pos[2]);
  p.grounded = isFinite(h0) && p.pos[1] <= h0 + 1e-9;
  if (p.grounded) p.pos[1] = h0;

  for (const sl of scenario.lanterns ?? []) {
    const l = g.lanterns.find((x) => x.id === sl.id);
    if (!l) continue;
    if (sl.pos) l.pos = [...sl.pos];
    if (sl.lit !== undefined) { l.lit = sl.lit; if (sl.lit && sl.deposited === undefined) l.deposited = T.lantern_cost; }
    if (sl.deposited !== undefined) l.deposited = sl.deposited;
    // Den dat lit:true ma khong co fuel thi fuel = 100; dat san bang scenario khong tinh vao successful_lights
    if (l.lit) { l.fuelU = Math.round((sl.fuel ?? T.fuel_max) * U); l.everLit = sl.ever_lit ?? true; }
    else if (sl.ever_lit !== undefined) l.everLit = sl.ever_lit;
  }
  if (scenario.charms) {
    g.charms = scenario.charms.map((c) => ({
      id: c.id, pos: [...c.pos], available: c.available ?? true, respawn: c.respawn_ticks ?? 0,
    }));
  }
  if (scenario.motes) {
    for (const m of scenario.motes) {
      const o = Array.isArray(m) ? { pos: m } : m;
      g.motes.push({ id: 'M' + g.nextMote++, pos: [...o.pos], kind: o.kind ?? 'random', ttl: o.kind === 'dropped' ? o.ttl_ticks ?? K.mote_drop_ttl : o.ttl_ticks ?? null });
    }
  } else if (g.randomMotes) {
    const idx = def.motePts.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(g.rng() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    for (const i of idx.slice(0, K.mote_start).sort((a, b) => a - b)) {
      g.motes.push({ id: 'M' + g.nextMote++, pos: [...def.motePts[i]], kind: 'random', ttl: null });
    }
  }
  if (scenario.shades) {
    for (const s of scenario.shades) {
      const id = s.id ?? 'S' + g.nextShade;
      g.nextShade++;
      const h = def.heightAt(s.pos[0], s.pos[2]);
      const state = s.state ?? (dist2(s.pos, p.pos) <= K.detect ? 'chase' : 'wander');
      const dflt = state === 'stunned' ? K.stun_ticks : state === 'recoil' ? K.recoil_ticks : state === 'spawning' ? 1 : 0;
      g.shades.push({
        id, pos: [s.pos[0], (isFinite(h) ? h : s.pos[1] - 1) + 1, s.pos[2]], state, ticks: s.state_ticks_left ?? dflt,
        knock: 0, knockDir: [1, 0], wdir: 0, wt: 0, expel: null,
        target: s.target_lantern_id ?? null, pinned: s.target_lantern_id !== undefined, drainTicks: 0,
      });
      const sh = g.shades.at(-1);
      if (sh.state === 'drain' && !sh.target) { // scenario khong cho target: den dang sang gan nhat
        let best = null, bd = Infinity;
        for (const l of g.lanterns) { const d = dist2(sh.pos, l.pos); if (l.lit && d < bd) { best = l; bd = d; } }
        sh.target = best ? best.id : null;
      }
    }
  }
  if (scenario.drifters) {
    for (const d of scenario.drifters) {
      g.drifters.push({ id: d.id ?? 'D' + g.nextDrifter, pos: [...d.pos], state: d.state ?? 'idle', stolen: d.stolen ?? 0, ticks: d.state_ticks_left ?? (d.state === 'flee' ? K.drifter_flee_ticks : 0), wdir: 0, wt: 0 });
      g.nextDrifter++;
    }
  }
  return g;
}

// ---------------------------------------------------------------- Tien ich
function dist2(a, b) { return Math.hypot(a[0] - b[0], a[2] - b[2]); }
function emit(g, name, data) { g.events.push({ type: 'event', tick: g.tick, name, data }); }
export function drainEvents(g) { const e = g.events; g.events = []; return e; }
const H = (g, x, z) => g.def.heightAt(x, z);

function windInfo(g) {
  const s = g.simTick;
  const dirOf = (k) => mulberry32((g.seed * 31 + k * 7919) >>> 0)() * 360;
  if (!g.windEnabled) return { active: false, warn: false, dir_deg: 0 };
  if (s >= K.wind_every && s % K.wind_every < K.wind_len) return { active: true, warn: false, dir_deg: dirOf(Math.floor(s / K.wind_every)) };
  const ph = s % K.wind_every;
  if (ph >= K.wind_every - K.wind_warn) return { active: false, warn: true, dir_deg: dirOf(Math.floor(s / K.wind_every) + 1) };
  return { active: false, warn: false, dir_deg: 0 };
}

function canEnter(g, x, z, y) { return H(g, x, z) <= y + STEP_UP; }

// ---------------------------------------------------------------- Den: nhien lieu
const r1 = (n) => Math.round(n * 10) / 10;
export const capacity = (g) => Math.min(TUNING.capacity_max, TUNING.carry_capacity + K.capacity_step * g.player.successful);
export const needLit = (g) => Math.ceil(TUNING.win_ratio * g.lanterns.length - 1e-9);
const lanternCost = (l) => (l.everLit ? TUNING.relight_cost : TUNING.lantern_cost);
const zoneActive = (l) => l.lit && l.fuelU >= LOW; // fuel dung 30 van con vung an toan
const lanternById = (g, id) => g.lanterns.find((l) => l.id === id) ?? null;


// ---------------------------------------------------------------- Mot tick
export function step(g, input) {
  if (g.state !== 'playing') return;
  const T = TUNING;
  g.tick += 1;
  const p = g.player;

  // 1. Doc input; xu ly pause truoc
  const edge = {};
  for (const b of BUTTONS) { edge[b] = !!input[b] && !g.prev[b]; g.prev[b] = !!input[b]; }
  if (edge.pause) {
    g.paused = !g.paused;
    emit(g, g.paused ? 'paused' : 'resumed', {});
    if (g.paused) return;
  } else if (g.paused) return;
  g.simTick += 1;
  const t = g.simTick;
  if (g.pulseFx > 0) g.pulseFx -= 1;

  // 2. Giam cac bo dem
  if (p.dashCd > 0) p.dashCd--;
  if (p.pulseCd > 0) p.pulseCd--;
  if (p.invuln > 0) p.invuln--;
  if (p.charm > 0) p.charm--;
  for (const s of g.shades) {
    if (s.ticks > 0) {
      s.ticks--;
      if (s.ticks === 0) {
        if (s.state === 'spawning') s.state = 'wander';
        else if (s.state === 'stunned') { s.state = 'wander'; s.expel = null; } // het choang -> wander (Ticket-03)
        else if (s.state === 'recoil') { s.state = dist2(s.pos, p.pos) <= K.lose ? 'chase' : 'wander'; s.expel = null; }
      }
    }
  }
  for (let i = g.motes.length - 1; i >= 0; i--) {
    const m = g.motes[i];
    if (m.ttl !== null && m.ttl > 0 && --m.ttl === 0) g.motes.splice(i, 1);
  }
  for (const c of g.charms) if (c.respawn > 0 && --c.respawn === 0) c.available = true;
  for (const d of g.drifters) if (d.state === 'flee' && --d.ticks <= 0) d.state = 'removed';
  g.drifters = g.drifters.filter((d) => d.state !== 'removed');
  // Nhien lieu den: hao 1.0/giay + bi Bong Muc (drain) hut 5/giay moi con; het dau thi tat ngay sau buoc nay
  for (const l of g.lanterns) if (l.lit) l.fuelU -= T.fuel_decay_per_s;
  for (const s of g.shades) {
    if (s.state !== 'drain' || !s.target) continue;
    const l = lanternById(g, s.target);
    if (!l || !l.lit) continue;
    l.fuelU -= T.drain_per_s;
    if (++s.drainTicks % 60 === 0) emit(g, 'fuel_drain', { lantern_id: l.id, shade_id: s.id, fuel: r1(Math.max(0, l.fuelU) / U) });
  }
  for (const l of g.lanterns) {
    if (l.lit && l.fuelU <= 0) { l.lit = false; l.fuelU = 0; l.deposited = 0; emit(g, 'lantern_out', { lantern_id: l.id }); }
  }
  if (p.respawn > 0) {
    p.respawn--;
    if (p.respawn === 0) {
      p.pos = [...g.def.start]; p.hv = [0, 0]; p.vy = 0; p.grounded = true; p.launched = false;
      p.dashTicks = 0; p.invuln = K.invuln_ticks;
      p.pos[1] = H(g, p.pos[0], p.pos[2]);
    }
  }
  const alive = p.respawn === 0;

  // 3. Di chuyen May (chay, nhay, luot, buc nhay, gio) roi kiem tra roi
  if (alive) movePlayer(g, input, edge);

  // 4. Nhat dom dom va bua
  if (alive) {
    for (let i = 0; i < g.motes.length && p.carried < capacity(g); ) {
      const m = g.motes[i];
      if (dist2(m.pos, p.pos) <= T.pickup_radius && Math.abs(p.pos[1] - m.pos[1]) <= K.pickup_height) {
        g.motes.splice(i, 1);
        p.carried += 1;
        emit(g, 'mote_picked', { carried: p.carried });
      } else i++;
    }
    for (const c of g.charms) {
      if (c.available && dist2(c.pos, p.pos) <= T.pickup_radius && Math.abs(p.pos[1] - c.pos[1]) <= K.pickup_height) {
        c.available = false; c.respawn = K.charm_respawn; p.charm = K.charm_ticks;
        emit(g, 'charm_picked', { charm_id: c.id, charm_ticks: p.charm });
      }
    }
  }

  // 5. Tuong tac voi den: nap de thap (10; thap lai 5) hoac chau dau cho den dang sang chua day
  const newlyLit = []; // den vua thap / vua tro lai du dau (>= 30): bong trong 6 m bi day ra
  if (alive && edge.interact && p.carried > 0) {
    let best = null, bd = Infinity;
    for (const l of g.lanterns) {
      if (l.lit && l.fuelU >= FUEL_MAX) continue; // day dau: khong duoc chon
      const d = dist2(p.pos, l.pos);
      if (d <= T.interact_radius && d < bd) { best = l; bd = d; }
    }
    if (best && !best.lit) {
      const cost = lanternCost(best);
      const amount = Math.min(p.carried, cost - best.deposited);
      if (amount > 0) {
        p.carried -= amount;
        best.deposited += amount;
        g.score += amount * T.score.per_mote;
        emit(g, 'deposit', { lantern_id: best.id, amount, deposited: best.deposited });
        if (best.deposited >= cost) {
          const relight = best.everLit;
          best.lit = true; best.fuelU = FUEL_MAX; best.everLit = true;
          if (relight) best.relit += 1;
          p.successful += 1;
          g.score += relight ? T.score.per_relight : T.score.per_lantern;
          newlyLit.push(best);
          emit(g, 'lantern_lit', { lantern_id: best.id, relight });
        }
      }
    } else if (best) {
      const used = Math.min(p.carried, Math.ceil((FUEL_MAX - best.fuelU) / (T.fuel_per_mote * U)));
      if (used > 0) {
        const before = best.fuelU;
        best.fuelU = Math.min(FUEL_MAX, best.fuelU + T.fuel_per_mote * U * used);
        p.carried -= used;
        g.score += used * T.score.per_mote;
        emit(g, 'refuel', { lantern_id: best.id, amount: used, fuel: r1(best.fuelU / U) });
        if (before < LOW && best.fuelU >= LOW) newlyLit.push(best);
      }
    }
  }

  // 6. Cap nhat vung an toan: Bong Muc dang o trong den vua thap bi day ra mep trong toi da 30 tick
  for (const l of newlyLit) {
    for (const s of g.shades) {
      const d = dist2(s.pos, l.pos);
      if (d < T.safe_radius && s.state !== 'spawning') {
        s.state = 'recoil'; s.ticks = K.expel_ticks; s.expel = l; s.knock = 0; s.target = null; s.pinned = false;
      }
    }
  }

  // 7. Toa Sang
  if (alive && edge.pulse && p.pulseCd === 0 && p.carried >= T.pulse_cost) {
    p.carried -= T.pulse_cost;
    p.pulseCd = K.pulse_cd;
    g.pulseFx = 20;
    const c = [p.pos[0], p.pos[1] + K.pulse_height, p.pos[2]];
    const ids = [];
    for (const s of g.shades) {
      if (dist3(c, s.pos) > T.pulse_radius) continue;
      const dx = s.pos[0] - p.pos[0], dz = s.pos[2] - p.pos[2], d = Math.hypot(dx, dz);
      s.knockDir = d > 1e-9 ? [dx / d, dz / d] : [1, 0];
      s.knock = K.knock_ticks;
      g.score += s.state === 'drain' ? T.score.per_stun_drain : T.score.per_stun; // dang hut dau: tong +15
      s.state = 'stunned'; s.ticks = K.stun_ticks; s.expel = null; s.target = null; s.pinned = false;
      ids.push(s.id);
    }
    for (const d of g.drifters) {
      if (dist3(c, d.pos) > T.pulse_radius) continue;
      if (d.state === 'chase') { d.state = 'flee'; d.ticks = K.drifter_flee_ticks; }
      else if (d.state === 'flee' && d.stolen > 0) {
        const amount = d.stolen;
        d.stolen = 0; d.ticks = K.drifter_drop_ticks;
        const h = H(g, d.pos[0], d.pos[2]);
        if (isFinite(h)) for (let i = 0; i < amount; i++) g.motes.push({ id: 'M' + g.nextMote++, pos: [d.pos[0], h, d.pos[2]], kind: 'dropped', ttl: K.mote_drop_ttl });
        emit(g, 'drifter_drop', { drifter_id: d.id, amount });
      }
    }
    emit(g, 'pulse', { stunned_ids: ids });
  }

  // 8. Di chuyen Bong Muc va Gio Lac
  for (const s of g.shades) moveShade(g, s);
  for (const d of g.drifters) moveDrifter(g, d);

  // 9. Cham: Gio Lac cuop truoc, roi Bong Muc gay hit (theo id tang dan)
  if (alive) {
    for (const d of g.drifters) {
      if (d.state === 'chase' && dist2(d.pos, p.pos) <= K.drifter_hit && p.carried > 0) {
        const amount = Math.min(K.drifter_steal, p.carried);
        p.carried -= amount; d.stolen = amount; d.state = 'flee'; d.ticks = K.drifter_flee_ticks;
        emit(g, 'drifter_steal', { drifter_id: d.id, amount, carried: p.carried });
      }
    }
    if (p.invuln === 0) {
      for (const s of g.shades) {
        if (s.state !== 'chase' && s.state !== 'wander') continue;
        if (dist2(s.pos, p.pos) <= T.shade_hit_radius && Math.abs(p.pos[1] - (s.pos[1] - 1)) <= K.hit_height) {
          p.flames -= 1;
          p.invuln = K.invuln_ticks;
          const dropped = Math.floor(p.carried * T.hit_drop_ratio);
          p.carried -= dropped;
          for (let i = 0; i < dropped; i++) dropMote(g, p);
          s.state = 'recoil'; s.ticks = K.recoil_ticks; s.expel = null;
          emit(g, 'player_hit', { by: 'shade', flames: p.flames, dropped });
          break;
        }
      }
    }
  }

  // 10. Sinh dom dom, Bong Muc, Gio Lac theo lich (thuc the moi tuong tac tu tick sau)
  if (g.randomMotes && t % K.mote_every === 0 && g.motes.length < K.mote_cap) {
    const free = g.def.motePts.filter((q) => !g.motes.some((m) => m.pos[0] === q[0] && m.pos[2] === q[2] && m.pos[1] === q[1]));
    if (free.length) g.motes.push({ id: 'M' + g.nextMote++, pos: [...free[Math.floor(g.rng() * free.length)]], kind: 'random', ttl: null });
  }
  if (g.randomShades) {
    let n = 0;
    if (t === K.shade_first_tick) n = K.shade_first_count;
    else if (t > K.shade_first_tick && (t - K.shade_first_tick) % g.def.shadeEvery === 0) n = 1;
    for (let i = 0; i < n; i++) spawnShade(g);
  }
  if (g.randomDrifters && t % K.drifter_every === 0 && g.drifters.length < K.drifter_max) {
    const q = g.def.driftPts[Math.floor(g.rng() * g.def.driftPts.length)];
    const h = H(g, q[0], q[1]);
    g.drifters.push({ id: 'D' + g.nextDrifter++, pos: [q[0], (isFinite(h) ? h : 0) + 1.5, q[1]], state: 'idle', stolen: 0, ticks: 0, wdir: g.rng() * 6.283, wt: 90 });
  }

  // 11. Thang / thua (sau moi cap nhat cua tick): het lua luon thua; het gio (binh minh) thi xet so den dang sang
  const timeLeft = g.timeInit - t / 60;
  if (p.flames <= 0) finish(g, 'lost', 'no_flames');
  else if (timeLeft <= 0) {
    const lit = g.lanterns.filter((l) => l.lit);
    if (lit.length >= needLit(g)) {
      for (const l of lit) g.score += T.score.per_lit_lantern_dawn + Math.floor(l.fuelU / U);
      g.score += T.score.per_flame_left * p.flames;
      finish(g, 'won', 'dawn_survived');
    } else finish(g, 'lost', 'dawn');
  }
}

function dist3(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }

function finish(g, result, reason) {
  g.state = result;
  emit(g, 'game_over', { result, reason });
}

function dropMote(g, p) {
  for (let tries = 0; tries < 8; tries++) {
    const a = g.rng() * 2 * Math.PI, r = 1.5 + g.rng();
    const x = p.pos[0] + r * Math.cos(a), z = p.pos[2] + r * Math.sin(a);
    const h = H(g, x, z);
    if (isFinite(h) && Math.abs(h - p.pos[1]) <= K.pickup_height) {
      g.motes.push({ id: 'M' + g.nextMote++, pos: [x, h, z], kind: 'dropped', ttl: K.mote_drop_ttl });
      return;
    }
  }
  g.motes.push({ id: 'M' + g.nextMote++, pos: [p.pos[0], p.pos[1], p.pos[2]], kind: 'dropped', ttl: K.mote_drop_ttl });
}

function spawnShade(g) {
  if (g.shades.length >= g.def.shadeMax) return;
  const p = g.player;
  const valid = g.def.shadePts.filter((q) => {
    if (Math.hypot(q[0] - p.pos[0], q[1] - p.pos[2]) < K.spawn_min_dist) return false;
    return !g.lanterns.some((l) => zoneActive(l) && Math.hypot(q[0] - l.pos[0], q[1] - l.pos[2]) < TUNING.safe_radius);
  });
  if (!valid.length) return;
  const q = valid[Math.floor(g.rng() * valid.length)];
  const h = H(g, q[0], q[1]);
  const id = 'S' + g.nextShade++;
  g.shades.push({ id, pos: [q[0], (isFinite(h) ? h : 0) + 1, q[1]], state: 'spawning', ticks: 1, knock: 0, knockDir: [1, 0], wdir: 0, wt: 0, expel: null, target: null, pinned: false, drainTicks: 0 });
  emit(g, 'shade_spawned', { id });
}

// ---------------------------------------------------------------- Di chuyen May
function movePlayer(g, input, edge) {
  const T = TUNING, p = g.player;
  let [mx, mz] = input.move;
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const th = rad(input.cam_yaw_deg);
  const wx = mx * Math.cos(th) + mz * Math.sin(th);
  const wz = -mx * Math.sin(th) + mz * Math.cos(th);
  const wl = Math.hypot(wx, wz);
  if (wl > 1e-9) p.facing = [wx / wl, wz / wl];

  // Luot
  if (edge.dash && p.dashCd === 0 && p.dashTicks === 0) {
    p.dashDir = wl > 1e-9 ? [wx / wl, wz / wl] : [...p.facing];
    p.dashTicks = K.dash_ticks;
    p.dashCd = p.charm > 0 ? 0 : K.dash_cd;
    emit(g, 'dash', {});
  }
  const dashing = p.dashTicks > 0;
  if (dashing) p.dashTicks--;

  // Van toc ngang
  if (dashing) p.hv = [p.dashDir[0] * T.dash_speed, p.dashDir[1] * T.dash_speed];
  else if (p.launched) p.hv = [...p.launchHv];
  else {
    const S = p.charm > 0 ? K.charm_speed : T.player_speed;
    const tx = wx * S, tz = wz * S;
    const dx = tx - p.hv[0], dz = tz - p.hv[1], dl = Math.hypot(dx, dz);
    const maxd = (S * DT) / K.accel_time_s; // dat toc do toi da trong <= 0.1 s
    if (dl <= maxd) p.hv = [tx, tz];
    else p.hv = [p.hv[0] + (dx / dl) * maxd, p.hv[1] + (dz / dl) * maxd];
  }
  let vx = p.hv[0], vz = p.hv[1];
  const w = windInfo(g);
  if (w.active) { vx += Math.cos(rad(w.dir_deg)) * K.wind_speed; vz += Math.sin(rad(w.dir_deg)) * K.wind_speed; }

  // Ngang (chan boi vach dung)
  const y = p.pos[1];
  const nx = p.pos[0] + vx * DT, nz = p.pos[2] + vz * DT;
  if (canEnter(g, nx, nz, y)) { p.pos[0] = nx; p.pos[2] = nz; }
  else if (vx !== 0 && canEnter(g, nx, p.pos[2], y)) { p.pos[0] = nx; p.hv[1] = 0; if (p.launched) p.launchHv[1] = 0; }
  else if (vz !== 0 && canEnter(g, p.pos[0], nz, y)) { p.pos[2] = nz; p.hv[0] = 0; if (p.launched) p.launchHv[0] = 0; }
  else { p.hv = [0, 0]; if (p.launched) p.launchHv = [0, 0]; }

  // Doc
  if (edge.jump && p.grounded && !dashing) { p.vy = K.jump_speed; p.grounded = false; }
  const h = H(g, p.pos[0], p.pos[2]);
  if (dashing) p.vy = 0;
  else if (p.vy !== 0 || p.pos[1] > h) {
    p.vy -= K.gravity * DT;
    p.pos[1] += p.vy * DT;
  }
  if (p.pos[1] <= h && p.vy <= 0) { p.pos[1] = h; p.vy = 0; p.grounded = true; p.launched = false; }
  else p.grounded = false;

  // Buc nhay
  if (p.grounded) {
    for (const pad of g.def.pads) {
      if (Math.hypot(p.pos[0] - pad.pos[0], p.pos[2] - pad.pos[2]) <= pad.r && Math.abs(p.pos[1] - pad.pos[1]) <= 0.1) {
        p.vy = pad.vy; p.launchHv = [...pad.hv]; p.hv = [...pad.hv]; p.launched = true; p.grounded = false;
        break;
      }
    }
  }

  // Roi khoi dao
  if (p.pos[1] < K.fall_y) {
    const lost = p.carried;
    p.flames -= 1;
    p.carried = 0;
    p.respawn = K.fall_wait;
    p.vy = 0; p.hv = [0, 0]; p.launched = false; p.dashTicks = 0;
    emit(g, 'player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
  }
}

// ---------------------------------------------------------------- Bong Muc
function tryShadeMove(g, s, dx, dz) {
  const gy = s.pos[1] - 1;
  const nx = s.pos[0] + dx, nz = s.pos[2] + dz;
  const h = H(g, nx, nz);
  if (h === NEG || h > gy + STEP_UP) return false;
  s.pos = [nx, h + 1, nz];
  return true;
}

function clampZones(g, s) {
  for (const l of g.lanterns) {
    if (!zoneActive(l)) continue;
    const d = dist2(s.pos, l.pos);
    if (d < TUNING.safe_radius) {
      const ux = d > 1e-9 ? (s.pos[0] - l.pos[0]) / d : 1, uz = d > 1e-9 ? (s.pos[2] - l.pos[2]) / d : 0;
      const nx = l.pos[0] + ux * TUNING.safe_radius, nz = l.pos[2] + uz * TUNING.safe_radius;
      const h = H(g, nx, nz);
      if (h !== NEG) s.pos = [nx, h + 1, nz];
    }
  }
}

// Muc tieu cua bong wander: den dang sang fuel < 30 gan nhat (hoa: id nho); khong co thi den tat gan nhat
function pickWanderTarget(g, s) {
  if (s.pinned && s.target) { // muc tieu do scenario dat, con hieu luc thi giu
    const l = lanternById(g, s.target);
    if (l && (!l.lit || l.fuelU < LOW)) return l;
    s.pinned = false;
  }
  let best = null, bd = Infinity;
  for (const l of g.lanterns) {
    if (!(l.lit && l.fuelU < LOW)) continue;
    const d = dist2(s.pos, l.pos);
    if (d < bd) { best = l; bd = d; }
  }
  if (best) return best;
  for (const l of g.lanterns) {
    if (l.lit) continue;
    const d = dist2(s.pos, l.pos);
    if (d < bd) { best = l; bd = d; }
  }
  return best;
}

function stepToward(g, s, tx, tz, spd) {
  const d = Math.hypot(tx - s.pos[0], tz - s.pos[2]);
  if (d < 1e-9) return;
  const m = Math.min(spd * DT, d);
  const ang = Math.atan2(tz - s.pos[2], tx - s.pos[0]);
  for (const off of [0, 0.52, -0.52, 1.05, -1.05, 1.57, -1.57]) {
    if (tryShadeMove(g, s, Math.cos(ang + off) * m, Math.sin(ang + off) * m)) break;
  }
}

function moveShade(g, s) {
  const p = g.player, T = TUNING;
  if (s.state === 'spawning') return;
  if (s.state === 'stunned') {
    if (s.knock > 0) {
      const step = T.pulse_push_m / K.knock_ticks;
      if (!tryShadeMove(g, s, s.knockDir[0] * step, s.knockDir[1] * step)) s.knock = 0;
      else s.knock--;
      clampZones(g, s);
    }
    return;
  }
  if (s.state === 'recoil') {
    if (s.expel) {
      const l = s.expel;
      const d = dist2(s.pos, l.pos);
      const gap = T.safe_radius - d;
      if (gap > 0) {
        const ux = d > 1e-9 ? (s.pos[0] - l.pos[0]) / d : 1, uz = d > 1e-9 ? (s.pos[2] - l.pos[2]) / d : 0;
        const m = gap / Math.max(1, s.ticks);
        tryShadeMove(g, s, ux * m, uz * m);
      }
    } else {
      const dx = s.pos[0] - p.pos[0], dz = s.pos[2] - p.pos[2], d = Math.hypot(dx, dz);
      const ux = d > 1e-9 ? dx / d : 1, uz = d > 1e-9 ? dz / d : 0;
      const m = K.recoil_m / (K.recoil_ticks - 1); // dem lui xuong truoc khi di chuyen: 59 buoc di chuyen
      tryShadeMove(g, s, ux * m, uz * m);
      clampZones(g, s);
    }
    return;
  }
  if (s.state === 'drain') { // dung yen hut dau; thoat khi: May vao 6 m (chase) / den tat, du dau, hoac xa > 2 m (wander)
    const L = s.target ? lanternById(g, s.target) : null;
    if (dist2(s.pos, p.pos) <= K.drain_chase) { s.state = 'chase'; s.target = null; s.pinned = false; }
    else if (!L || !L.lit || L.fuelU >= LOW || dist2(s.pos, L.pos) > K.drain_range) { s.state = 'wander'; s.target = null; s.pinned = false; }
    else return;
  }
  const d = dist2(s.pos, p.pos);
  if (s.state === 'wander' && !g.noDetect && d <= K.detect) { s.state = 'chase'; s.target = null; s.pinned = false; } // noDetect: chi canh benchmark
  else if (s.state === 'chase' && d > K.lose) s.state = 'wander';
  const spd = g.def.shadeSpeed;
  if (s.state === 'chase') {
    stepToward(g, s, p.pos[0], p.pos[2], spd);
  } else {
    const L = pickWanderTarget(g, s);
    s.target = L ? L.id : null;
    if (L) {
      const weak = L.lit;
      if (weak && dist2(s.pos, L.pos) <= K.drain_range) { s.state = 'drain'; s.drainTicks = 0; }
      else if (dist2(s.pos, L.pos) > (weak ? K.drain_range : K.wander_stop)) {
        stepToward(g, s, L.pos[0], L.pos[2], spd);
        if (weak && dist2(s.pos, L.pos) <= K.drain_range) { s.state = 'drain'; s.drainTicks = 0; }
      }
    } else { // khong con den can toi: di cham ngau nhien
      if (s.wt <= 0) { s.wdir = g.rng() * Math.PI * 2; s.wt = 90; }
      s.wt--;
      const m = spd * 0.5 * DT;
      if (!tryShadeMove(g, s, Math.cos(s.wdir) * m, Math.sin(s.wdir) * m)) s.wt = 0;
    }
  }
  clampZones(g, s);
}

// ---------------------------------------------------------------- Gio Lac
function moveDrifter(g, d) {
  const p = g.player;
  if (d.state === 'idle' || d.state === 'chase') {
    const dd = dist2(d.pos, p.pos);
    if (p.carried >= K.drifter_need && dd <= K.drifter_detect) d.state = 'chase';
    else d.state = 'idle';
  }
  if (d.state === 'chase') {
    const dd = dist2(d.pos, p.pos);
    if (dd > 1e-9) {
      const m = Math.min(K.drifter_speed * DT, dd);
      d.pos[0] += ((p.pos[0] - d.pos[0]) / dd) * m;
      d.pos[2] += ((p.pos[2] - d.pos[2]) / dd) * m;
    }
    d.pos[1] = p.pos[1] + 1.0;
  } else if (d.state === 'flee') {
    const dx = d.pos[0] - p.pos[0], dz = d.pos[2] - p.pos[2], dd = Math.hypot(dx, dz);
    const ux = dd > 1e-9 ? dx / dd : 1, uz = dd > 1e-9 ? dz / dd : 0;
    d.pos[0] += ux * K.drifter_speed * DT;
    d.pos[2] += uz * K.drifter_speed * DT;
  } else { // idle: luon cham 2 m/s
    if (d.wt <= 0) { d.wdir = g.rng() * Math.PI * 2; d.wt = 120; }
    d.wt--;
    const nx = d.pos[0] + Math.cos(d.wdir) * K.drifter_idle_speed * DT, nz = d.pos[2] + Math.sin(d.wdir) * K.drifter_idle_speed * DT;
    if (H(g, nx, nz) !== NEG) { d.pos[0] = nx; d.pos[2] = nz; } else d.wt = 0;
  }
}

// ---------------------------------------------------------------- Snapshot
const r3 = (n) => Math.round(n * 1000) / 1000;
const rv = (v) => v.map(r3);

export function snapshot(g) {
  const p = g.player, w = windInfo(g);
  return {
    type: 'snapshot', tick: g.tick, sim_tick: g.simTick, night: g.night,
    state: g.paused && g.state === 'playing' ? 'paused' : g.state,
    time_left_s: r3(Math.max(0, g.timeInit - g.simTick / 60)),
    score: g.score,
    wind: { active: w.active, dir_deg: r3(w.dir_deg) },
    player: {
      pos: rv(p.pos), vel: rv([p.hv[0], p.vy, p.hv[1]]), grounded: p.grounded,
      flames: p.flames, carried: p.carried, capacity: capacity(g),
      invuln: p.invuln > 0, invuln_s: r3(p.invuln / 60),
      dash_cd_s: r3(p.dashCd / 60), pulse_cd_s: r3(p.pulseCd / 60), charm_s: r3(p.charm / 60),
      facing: rv(p.facing),
    },
    lanterns: g.lanterns.map((l) => ({ id: l.id, pos: rv(l.pos), lit: l.lit, deposited: l.deposited, fuel: l.lit ? r1(l.fuelU / U) : 0, ever_lit: l.everLit, relit_count: l.relit })),
    shades: g.shades.map((s) => ({ id: s.id, pos: rv(s.pos), state: s.state, state_ticks_left: s.ticks, target_lantern_id: s.target })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: rv(m.pos), kind: m.kind, ttl_s: m.ttl === null ? null : r3(m.ttl / 60) })),
    drifters: g.drifters.map((d) => ({ id: d.id, pos: rv(d.pos), state: d.state, stolen: d.stolen })),
    charms: g.charms.map((c) => ({ id: c.id, available: c.available, respawn_s: r3(c.respawn / 60) })),
  };
}

export { windInfo };

// Tien ich: ap frame inputs theo tick (gia tri giu nguyen neu frame khong nhac toi)
export function makeInputFeeder(inputs) {
  const frames = inputs?.frames ?? [];
  let idx = 0;
  const cur = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  return function inputFor(k) {
    while (idx < frames.length && frames[idx].tick <= k) {
      const f = frames[idx++];
      if (f.move !== undefined) cur.move = f.move;
      if (f.cam_yaw_deg !== undefined) cur.cam_yaw_deg = f.cam_yaw_deg;
      for (const b of BUTTONS) if (f[b] !== undefined) cur[b] = f[b];
    }
    return cur;
  };
}

// ---------------------------------------------------------------- Canh benchmark (Ticket-04)
// 200 Bong Muc `wander` rai deu (hoa huong duong, seed), 100 dom dom, den L1-L3 sang fuel 100, May dung yen o (0,0,0).
// Tat: sinh them, sat thuong, nhat dom dom, hao dau, ket thuc Dem (benchStep chi di chuyen bong theo luat wander).
export function createBenchGame(seed = 42) {
  const lit = ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true, fuel: 100 }));
  const g = createGame({
    seed, night: 1,
    scenario: { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, motes: [], shades: [], lanterns: lit, player: { pos: [0, 0, 0] } },
  });
  g.noDetect = true; // bong khong chuyen sang chase du Mây o gan
  g.bench = true;
  const GOLDEN = 2.399963229728653;
  for (let i = 0; i < 200; i++) {
    const r = 38 * Math.sqrt((i + 0.5) / 200), a = i * GOLDEN + (g.rng() - 0.5) * 0.35;
    g.shades.push({
      id: 'S' + (i + 1), pos: [r * Math.cos(a), 1, r * Math.sin(a)], state: 'wander', ticks: 0,
      knock: 0, knockDir: [1, 0], wdir: 0, wt: 0, expel: null, target: null, pinned: false, drainTicks: 0,
    });
  }
  g.nextShade = 201;
  for (let i = 0; i < 100; i++) {
    const r = 37 * Math.sqrt((i + 0.5) / 100), a = i * GOLDEN + 0.8 + (g.rng() - 0.5) * 0.4;
    g.motes.push({ id: 'M' + (i + 1), pos: [r * Math.cos(a), 0, r * Math.sin(a)], kind: 'random', ttl: null });
  }
  g.nextMote = 101;
  return g;
}

export function benchStep(g) {
  g.tick += 1;
  for (const s of g.shades) moveShade(g, s);
}
