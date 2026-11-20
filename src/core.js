// Loi logic Dao Den Long. Thuan JS, khong phu thuoc do hoa/DOM => chay duoc headless va dung chung voi ban web.
// Quy uoc: 60 tick/s, don vi met, Y huong len, khoang cach do tren mat phang XZ, "trong ban kinh r" = <= r.

export const DT = 1 / 60;
export const ISLAND_RADIUS = 40;
export const LANTERN_RING = 25;
export const MAX_SHADES = 5;
export const MAX_MOTES = 20;
export const JUMP_SPEED = 6.5;
export const GRAVITY = 18;

export const TUNING = Object.freeze({
  player_speed: 6,
  carry_capacity: 5,
  lantern_cost: 5,
  lantern_count_night1: 5,
  pickup_radius: 1.2,
  interact_radius: 2.5,
  pulse_cost: 1,
  pulse_radius: 6,
  night1_duration_s: 300,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 3,
  pulse_push_m: 3,
  pulse_cooldown_s: 2,
  safe_radius: 4,
  shade_speed: 3.5,
  shade_hit_radius: 0.8,
  fall_enabled: false,
  score: Object.freeze({ per_mote: 10, per_lantern: 100, per_stun: 20, per_second_left: 1, per_flame_left: 50 }),
});

export class ContractError extends Error {} // file input/scenario sai dinh dang -> exit 2

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

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isVec = (v, n) => Array.isArray(v) && v.length === n && v.every(isNum);
const bad = (msg) => { throw new ContractError(msg); };

export function validateScenario(sc) {
  if (sc === null || typeof sc !== 'object' || Array.isArray(sc)) bad('scenario phai la object');
  if (sc.player !== undefined) {
    const p = sc.player;
    if (p === null || typeof p !== 'object' || Array.isArray(p)) bad('player phai la object');
    if (p.pos !== undefined && !isVec(p.pos, 3)) bad('player.pos phai la [x,y,z]');
    if (p.carried !== undefined && !(Number.isInteger(p.carried) && p.carried >= 0)) bad('player.carried khong hop le');
    if (p.flames !== undefined && !(Number.isInteger(p.flames) && p.flames >= 0)) bad('player.flames khong hop le');
  }
  for (const k of ['random_motes', 'random_shades']) {
    if (sc[k] !== undefined && typeof sc[k] !== 'boolean') bad(k + ' phai la boolean');
  }
  if (sc.motes !== undefined) {
    if (!Array.isArray(sc.motes) || !sc.motes.every((m) => isVec(m, 3))) bad('motes phai la mang [x,y,z]');
  }
  if (sc.shades !== undefined) {
    if (!Array.isArray(sc.shades)) bad('shades phai la mang');
    for (const s of sc.shades) {
      if (s === null || typeof s !== 'object' || !isVec(s.pos, 3)) bad('shade.pos phai la [x,y,z]');
      if (s.id !== undefined && typeof s.id !== 'string') bad('shade.id phai la string');
    }
  }
  if (sc.lanterns !== undefined) {
    if (!Array.isArray(sc.lanterns)) bad('lanterns phai la mang');
    for (const l of sc.lanterns) {
      if (l === null || typeof l !== 'object' || typeof l.id !== 'string') bad('lantern.id bat buoc');
      if (l.pos !== undefined && !isVec(l.pos, 3)) bad('lantern.pos phai la [x,y,z]');
      if (l.deposited !== undefined && !(Number.isInteger(l.deposited) && l.deposited >= 0)) bad('lantern.deposited khong hop le');
      if (l.lit !== undefined && typeof l.lit !== 'boolean') bad('lantern.lit phai la boolean');
    }
  }
  if (sc.time_left_s !== undefined && !(isNum(sc.time_left_s) && sc.time_left_s >= 0)) bad('time_left_s khong hop le');
  return sc;
}

export function validateInputs(inp) {
  if (inp === null || typeof inp !== 'object' || !Array.isArray(inp.frames)) bad('inputs phai co mang frames');
  let last = -1;
  for (const f of inp.frames) {
    if (f === null || typeof f !== 'object') bad('frame phai la object');
    if (!Number.isInteger(f.tick) || f.tick < 0) bad('frame.tick phai la so nguyen >= 0');
    if (f.tick <= last) bad('frame.tick phai tang nghiem ngat');
    last = f.tick;
    if (f.move !== undefined && !(isVec(f.move, 2) && f.move.every((c) => c >= -1 && c <= 1))) bad('move phai la [x,z] trong [-1,1]');
    if (f.cam_yaw_deg !== undefined && !isNum(f.cam_yaw_deg)) bad('cam_yaw_deg phai la so');
    for (const b of ['jump', 'interact', 'pulse', 'dash']) {
      if (f[b] !== undefined && typeof f[b] !== 'boolean') bad(b + ' phai la boolean');
    }
  }
  return inp;
}

const sec = (s) => Math.round(s * 60);
const dist2d = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

function defaultLanterns() {
  const out = [];
  for (let i = 0; i < TUNING.lantern_count_night1; i++) {
    const a = (i * 2 * Math.PI) / TUNING.lantern_count_night1;
    out.push({ id: 'L' + (i + 1), pos: [LANTERN_RING * Math.sin(a), 0, LANTERN_RING * Math.cos(a)], lit: false, deposited: 0 });
  }
  return out;
}

export function createGame({ seed = 1, scenario = {} } = {}) {
  validateScenario(scenario);
  const T = TUNING;
  const g = {
    tick: 0, state: 'playing', result: null, score: 0, events: [],
    rng: mulberry32(seed),
    timeInit: scenario.time_left_s ?? T.night1_duration_s,
    player: { pos: [0, 0, 0], vy: 0, flames: T.flames, carried: 0, invuln: 0, pulseCd: 0 },
    lanterns: defaultLanterns(), shades: [], motes: [],
    nextShade: 1, nextMote: 1, nextShadeTick: 300,
    randomMotes: scenario.random_motes ?? true,
    randomShades: scenario.random_shades ?? true,
    input: { move: [0, 0], yaw: 0, jump: false, interact: false, pulse: false },
    prev: { jump: false, interact: false, pulse: false },
    pulseFx: 0,
  };
  const sp = scenario.player;
  if (sp) {
    if (sp.pos) g.player.pos = [...sp.pos];
    if (sp.carried !== undefined) g.player.carried = sp.carried;
    if (sp.flames !== undefined) g.player.flames = sp.flames;
  }
  for (const sl of scenario.lanterns ?? []) {
    const l = g.lanterns.find((x) => x.id === sl.id);
    if (!l) continue; // id la: bo qua
    if (sl.pos) l.pos = [...sl.pos];
    if (sl.deposited !== undefined) l.deposited = sl.deposited;
    if (sl.lit !== undefined) l.lit = sl.lit;
  }
  if (scenario.motes) {
    for (const m of scenario.motes) g.motes.push({ id: 'M' + g.nextMote++, pos: [...m] });
  } else if (g.randomMotes) {
    for (let i = 0; i < MAX_MOTES; i++) g.motes.push(randomMote(g));
  }
  if (scenario.shades) {
    for (const s of scenario.shades) {
      const id = s.id ?? 'S' + g.nextShade;
      g.nextShade++;
      g.shades.push({ id, pos: [s.pos[0], 1.0, s.pos[2]], state: 'chase', stun: 0 });
    }
  }
  return g;
}

function randomMote(g) {
  const a = g.rng() * 2 * Math.PI;
  const r = 4 + Math.sqrt(g.rng()) * (ISLAND_RADIUS - 8);
  return { id: 'M' + g.nextMote++, pos: [r * Math.cos(a), 0, r * Math.sin(a)] };
}

function clampIsland(pos) {
  const r = Math.hypot(pos[0], pos[2]);
  if (r > ISLAND_RADIUS) { pos[0] *= ISLAND_RADIUS / r; pos[2] *= ISLAND_RADIUS / r; }
}

function emit(g, name, data) { g.events.push({ type: 'event', tick: g.tick, name, data }); }
export function drainEvents(g) { const e = g.events; g.events = []; return e; }

// input: { move:[x,z], cam_yaw_deg, jump, interact, pulse } (gia tri hien tai, khong phai frame)
export function step(g, input) {
  if (g.state !== 'playing') return;
  const T = TUNING;
  g.tick += 1;
  const t = g.tick;
  const p = g.player;
  if (g.pulseFx > 0) g.pulseFx -= 1;

  // 1. timers
  if (p.invuln > 0) p.invuln--;
  if (p.pulseCd > 0) p.pulseCd--;
  for (const s of g.shades) if (s.stun > 0) { s.stun--; if (s.stun === 0) s.state = 'chase'; }

  // 2. input -> huong di (xoay theo camera), nhay
  let [mx, mz] = input.move;
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const th = (input.cam_yaw_deg * Math.PI) / 180;
  const wx = mx * Math.cos(th) + mz * Math.sin(th);
  const wz = -mx * Math.sin(th) + mz * Math.cos(th);
  p.pos[0] += wx * T.player_speed * DT;
  p.pos[2] += wz * T.player_speed * DT;
  clampIsland(p.pos);
  if (input.jump && !g.prev.jump && p.pos[1] === 0) p.vy = JUMP_SPEED;
  if (p.pos[1] > 0 || p.vy > 0) {
    p.vy -= GRAVITY * DT;
    p.pos[1] += p.vy * DT;
    if (p.pos[1] <= 0) { p.pos[1] = 0; p.vy = 0; }
  }

  // 3. interact: nap anh sang vao den gan nhat chua thap
  if (input.interact && !g.prev.interact && p.carried > 0) {
    let best = null, bd = Infinity;
    for (const l of g.lanterns) {
      if (l.lit) continue;
      const d = dist2d(p.pos, l.pos);
      if (d <= T.interact_radius && d < bd) { best = l; bd = d; }
    }
    if (best) {
      const amount = Math.min(p.carried, T.lantern_cost - best.deposited);
      if (amount > 0) {
        p.carried -= amount;
        best.deposited += amount;
        emit(g, 'deposit', { lantern_id: best.id, amount, deposited: best.deposited });
        if (best.deposited >= T.lantern_cost) {
          best.lit = true;
          g.score += T.score.per_lantern;
          emit(g, 'lantern_lit', { lantern_id: best.id });
        }
      }
    }
  }

  // 4. pulse: ton pulse_cost dom dom da mang, hoi chieu, lam choang + day lui
  if (input.pulse && !g.prev.pulse && p.pulseCd <= 0 && p.carried >= T.pulse_cost) {
    p.carried -= T.pulse_cost;
    p.pulseCd = sec(T.pulse_cooldown_s);
    g.pulseFx = 20;
    const ids = [];
    for (const s of g.shades) {
      if (s.stun > 0) continue;
      const d = dist2d(p.pos, s.pos);
      if (d > T.pulse_radius) continue;
      s.stun = sec(T.pulse_stun_s);
      s.state = 'stunned';
      const dx = d > 1e-9 ? (s.pos[0] - p.pos[0]) / d : 1;
      const dz = d > 1e-9 ? (s.pos[2] - p.pos[2]) / d : 0;
      s.pos[0] += dx * T.pulse_push_m;
      s.pos[2] += dz * T.pulse_push_m;
      clampIsland(s.pos);
      g.score += T.score.per_stun;
      ids.push(s.id);
    }
    emit(g, 'pulse', { stunned_ids: ids });
  }
  g.prev.jump = input.jump; g.prev.interact = input.interact; g.prev.pulse = input.pulse;

  // 5. sinh Bong Muc / dom dom ngau nhien (chi khi random_*)
  if (g.randomShades && t >= g.nextShadeTick && g.shades.length < MAX_SHADES) {
    const a = g.rng() * 2 * Math.PI;
    const id = 'S' + g.nextShade++;
    g.shades.push({ id, pos: [(ISLAND_RADIUS - 2) * Math.cos(a), 1.0, (ISLAND_RADIUS - 2) * Math.sin(a)], state: 'chase', stun: 0 });
    g.nextShadeTick = t + 600;
    emit(g, 'shade_spawned', { id });
  }
  if (g.randomMotes && g.motes.length < MAX_MOTES && t % 180 === 0) g.motes.push(randomMote(g));

  // 6. Bong Muc duoi theo, so den da thap (khong vao safe_radius)
  for (const s of g.shades) {
    if (s.state !== 'chase') continue;
    const d = dist2d(s.pos, p.pos);
    if (d > 1e-9) {
      const m = Math.min(T.shade_speed * DT, d);
      s.pos[0] += ((p.pos[0] - s.pos[0]) / d) * m;
      s.pos[2] += ((p.pos[2] - s.pos[2]) / d) * m;
    }
    for (const l of g.lanterns) {
      if (!l.lit) continue;
      const dl = dist2d(s.pos, l.pos);
      if (dl < T.safe_radius) {
        const ux = dl > 1e-9 ? (s.pos[0] - l.pos[0]) / dl : 1;
        const uz = dl > 1e-9 ? (s.pos[2] - l.pos[2]) / dl : 0;
        s.pos[0] = l.pos[0] + ux * T.safe_radius;
        s.pos[2] = l.pos[2] + uz * T.safe_radius;
      }
    }
  }

  // 7. cham Bong Muc -> mat 1 ngon lua, rot hit_drop_ratio dom dom, bat tu invuln_s
  if (p.invuln <= 0) {
    for (const s of g.shades) {
      if (s.state === 'stunned') continue;
      if (dist2d(s.pos, p.pos) <= T.shade_hit_radius) {
        p.flames -= 1;
        p.invuln = sec(T.invuln_s);
        const dropped = Math.floor(p.carried * T.hit_drop_ratio);
        p.carried -= dropped;
        for (let i = 0; i < dropped; i++) {
          const a = g.rng() * 2 * Math.PI;
          const pos = [p.pos[0] + 2 * Math.cos(a), 0, p.pos[2] + 2 * Math.sin(a)];
          clampIsland(pos);
          g.motes.push({ id: 'M' + g.nextMote++, pos });
        }
        emit(g, 'player_hit', { by: 'shade', flames: p.flames, dropped });
        break;
      }
    }
  }

  // 8. nhat dom dom
  for (let i = 0; i < g.motes.length && p.carried < T.carry_capacity; ) {
    if (dist2d(g.motes[i].pos, p.pos) <= T.pickup_radius) {
      g.motes.splice(i, 1);
      p.carried += 1;
      g.score += T.score.per_mote;
      emit(g, 'mote_picked', { carried: p.carried });
    } else i++;
  }

  // 9. ket thuc: het lua -> thua; thap het den -> thang; het gio (binh minh) -> thua
  const timeLeft = g.timeInit - t / 60;
  if (p.flames <= 0) {
    finish(g, 'lost', 'no_flames');
  } else if (g.lanterns.every((l) => l.lit)) {
    g.score += T.score.per_second_left * Math.floor(Math.max(0, timeLeft)) + T.score.per_flame_left * p.flames;
    finish(g, 'won', 'all_lit');
  } else if (timeLeft <= 0) {
    finish(g, 'lost', 'dawn');
  }
}

function finish(g, result, reason) {
  g.state = result;
  g.result = result;
  emit(g, 'game_over', { result, reason });
}

const r3 = (n) => Math.round(n * 1000) / 1000;
const rv = (v) => v.map(r3);

export function snapshot(g) {
  return {
    type: 'snapshot', tick: g.tick, sim_tick: g.tick, state: g.state,
    time_left_s: r3(Math.max(0, g.timeInit - g.tick / 60)),
    score: g.score,
    player: { pos: rv(g.player.pos), flames: g.player.flames, carried: g.player.carried },
    lanterns: g.lanterns.map((l) => ({ id: l.id, pos: rv(l.pos), lit: l.lit, deposited: l.deposited })),
    shades: g.shades.map((s) => ({ id: s.id, pos: rv(s.pos), state: s.state })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: rv(m.pos) })),
  };
}

export function roundEvent(e) { return e; }

// Tien ich: ap frame inputs theo tick (gia tri giu nguyen neu frame khong nhac toi)
export function makeInputFeeder(inputs) {
  const frames = inputs?.frames ?? [];
  let idx = 0;
  const cur = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false };
  return function inputFor(k) {
    while (idx < frames.length && frames[idx].tick <= k) {
      const f = frames[idx++];
      if (f.move !== undefined) cur.move = f.move;
      if (f.cam_yaw_deg !== undefined) cur.cam_yaw_deg = f.cam_yaw_deg;
      for (const b of ['jump', 'interact', 'pulse']) if (f[b] !== undefined) cur[b] = f[b];
    }
    return cur;
  };
}
