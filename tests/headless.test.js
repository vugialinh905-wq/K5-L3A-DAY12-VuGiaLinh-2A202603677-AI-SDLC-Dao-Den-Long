import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TUNING } from '../src/core.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-'));
let n = 0;

function write(obj) {
  const f = path.join(tmp, `f${n++}.json`);
  fs.writeFileSync(f, typeof obj === 'string' ? obj : JSON.stringify(obj));
  return f;
}

// Chay headless that, tra ve { code, stderr, lines[] }
function run({ seed = 1, night = 1, scenario, inputs, ticks = 60, every = 10, extra = [] }) {
  const out = path.join(tmp, `o${n++}.jsonl`);
  const args = [path.join(root, 'src/headless.js'), '--seed', String(seed), '--night', String(night), '--ticks', String(ticks), '--out', out, '--snapshot-every', String(every), ...extra];
  if (scenario !== undefined) args.push('--scenario', write(scenario));
  if (inputs !== undefined) args.push('--inputs', write(inputs));
  const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
  const raw = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  const lines = raw ? raw.trim().split('\n').map((l) => JSON.parse(l)) : [];
  return { code: r.status, stderr: r.stderr, lines, raw };
}
const events = (r, name) => r.lines.filter((l) => l.type === 'event' && l.name === name);
const snaps = (r) => r.lines.filter((l) => l.type === 'snapshot');
const snapAt = (r, tick) => snaps(r).find((s) => s.tick === tick);
const last = (r) => snaps(r).at(-1);
const end = (r) => r.lines.at(-1);
const near = (a, b, eps = 0.05) => Math.abs(a - b) <= eps;
const Q = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, motes: [], shades: [] };
const press = (tick, key) => [{ tick, [key]: true }, { tick: tick + 1, [key]: false }];

// [Ticket-03] Doi ten + cap nhat: contract_version 1.2, 3 thoi luong moi, khoa nhien lieu, diem moi.
test('contract v1.2: tuning khop so chuan, co cac khoa nhien lieu', () => {
  const c = JSON.parse(fs.readFileSync(path.join(root, 'game.contract.json'), 'utf8'));
  assert.equal(c.contract_version, '1.2');
  assert.deepEqual(c.tuning, JSON.parse(JSON.stringify(TUNING)));
  const t = c.tuning;
  assert.deepEqual([t.fuel_max, t.fuel_decay_per_s, t.fuel_per_mote, t.relight_cost, t.win_ratio, t.drain_per_s, t.low_fuel_threshold, t.capacity_max], [100, 1.0, 10, 5, 0.6, 5, 30, 20]);
  assert.deepEqual([t.night1_duration_s, t.night2_duration_s, t.night3_duration_s], [240, 270, 300]);
  assert.equal(t.carry_capacity, 10);
  assert.equal(t.lantern_cost, 10);
  assert.equal(t.pulse_cost, 3);
  assert.equal(t.score.per_mote, 5);
  assert.equal(t.score.per_relight, 40);
  assert.equal(t.score.per_second_left, 0); // thuong thoi gian bi bo
});

test('snapshot tick 0: truong moi cua v1.1, 20 dom dom o 20 diem khac nhau, dong end', () => {
  const r = run({ ticks: 20 });
  assert.equal(r.code, 0);
  const s = r.lines[0];
  assert.equal(s.type, 'snapshot'); assert.equal(s.tick, 0); assert.equal(s.night, 1);
  assert.deepEqual(s.wind, { active: false, dir_deg: 0 });
  for (const k of ['pos', 'vel', 'grounded', 'invuln', 'dash_cd_s', 'pulse_cd_s', 'charm_s', 'flames', 'carried']) assert.ok(k in s.player, k);
  assert.equal(s.motes_active, 20);
  assert.equal(new Set(s.motes.map((m) => m.pos.join())).size, 20);
  assert.ok(s.motes.every((m) => m.kind === 'random' && m.ttl_s === null));
  assert.deepEqual(s.drifters, []); assert.deepEqual(s.charms, []);
  assert.deepEqual(r.lines.find((l) => l.name === 'night_start'), { type: 'event', tick: 0, name: 'night_start', data: { night: 1 } });
  assert.equal(end(r).type, 'end');
});

test('ban do chuan: so den, thoi luong, vi tri xuat phat, bua tung dem', () => {
  const cnt = { 1: 5, 2: 6, 3: 7 }, dur = { 1: 240, 2: 270, 3: 300 }; // [Ticket-03] thoi luong moi
  for (const night of [1, 2, 3]) {
    const s = run({ night, ticks: 0 }).lines[0];
    assert.equal(s.lanterns.length, cnt[night]);
    assert.equal(s.time_left_s, dur[night]);
    assert.equal(s.motes_active, 20);
  }
  const l1 = run({ night: 1, ticks: 0 }).lines[0].lanterns;
  assert.deepEqual(l1.map((l) => l.pos), [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]);
  assert.equal(run({ night: 2, ticks: 0 }).lines[0].charms.length, 1);
  assert.equal(run({ night: 3, ticks: 0 }).lines[0].charms.length, 2);
  assert.deepEqual(run({ night: 3, ticks: 0 }).lines[0].lanterns[0].pos, [0, 6, 6]);
});

test('nhat dom dom: trong 1.0 m, +chenh cao <= 1.5; khong cong diem khi nhat', () => {
  const r = run({ scenario: { ...Q, motes: [[0, 0, 5]] }, inputs: { frames: [{ tick: 0, move: [0, 1] }] }, ticks: 90 });
  const e = events(r, 'mote_picked');
  assert.equal(e.length, 1);
  assert.deepEqual(e[0].data, { carried: 1 });
  assert.ok(e[0].tick >= 40 && e[0].tick <= 60, 'tick ' + e[0].tick);
  assert.equal(end(r).score, 0);
  // chenh cao 2 m > 1.5 => khong nhat; 1.4 m => nhat
  const hi = run({ scenario: { ...Q, motes: [[0, 2, 0.5]] }, ticks: 5 });
  assert.equal(events(hi, 'mote_picked').length, 0);
  const ok = run({ scenario: { ...Q, motes: [[0, 1.4, 0.5]] }, ticks: 5 });
  assert.equal(events(ok, 'mote_picked').length, 1);
});

test('suc chua 10: mang du roi thi khong nhat them', () => {
  const r = run({ scenario: { ...Q, motes: [[0, 0, 0.5]], player: { carried: 10 } }, ticks: 5 });
  assert.equal(events(r, 'mote_picked').length, 0);
  assert.equal(last(r).motes_active, 1);
});

// [Ticket-03] +5 diem/dom dom (truoc: +10); den thap lan dau van +100; den moi sang co fuel 100.
test('nap anh sang: nap nhieu lan, den nho tien do, +5/dom dom, +100 thap lan dau, fuel 100', () => {
  const lan = [{ id: 'L1', pos: [0, 0, 1.5] }];
  const a = run({ scenario: { ...Q, lanterns: lan, player: { carried: 4 } }, inputs: { frames: press(0, 'interact') }, ticks: 5 });
  assert.deepEqual(events(a, 'deposit')[0].data, { lantern_id: 'L1', amount: 4, deposited: 4 });
  assert.equal(events(a, 'lantern_lit').length, 0);
  assert.equal(end(a).score, 20);
  const b = run({ scenario: { ...Q, lanterns: [{ id: 'L1', pos: [0, 0, 1.5], deposited: 4 }], player: { carried: 9 } }, inputs: { frames: press(0, 'interact') }, ticks: 5 });
  assert.deepEqual(events(b, 'deposit')[0].data, { lantern_id: 'L1', amount: 6, deposited: 10 });
  assert.deepEqual(events(b, 'lantern_lit')[0].data, { lantern_id: 'L1', relight: false });
  assert.equal(last(b).player.carried, 3);
  assert.equal(end(b).score, 30 + 100);
  const l = last(b).lanterns[0];
  assert.equal(l.lit, true); assert.equal(l.ever_lit, true); assert.equal(l.relit_count, 0);
  assert.ok(l.fuel >= 99.9 && l.fuel <= 100);
  assert.equal(last(b).player.capacity, 12); // 10 + 2 * 1 lan thap thanh cong
});

// [Ticket-03] Tuong tac gio xet ca den dang sang chua day dau (truoc: chi den chua sang).
test('tuong tac: trong 2.0 m, chon den gan nhat nhan duoc, bang nhau thi id nho hon', () => {
  const far = run({ scenario: { ...Q, lanterns: [{ id: 'L1', pos: [0, 0, 2.2] }], player: { carried: 3 } }, inputs: { frames: press(0, 'interact') }, ticks: 3 });
  assert.equal(events(far, 'deposit').length, 0);
  const tie = run({
    scenario: { ...Q, lanterns: [{ id: 'L2', pos: [1.5, 0, 0] }, { id: 'L1', pos: [-1.5, 0, 0] }], player: { carried: 3 } },
    inputs: { frames: press(0, 'interact') }, ticks: 3,
  });
  assert.equal(events(tie, 'deposit')[0].data.lantern_id, 'L1');
  // den sang dang hao dau (gan hon) duoc chon de chau dau, khong phai den tat o xa hon
  const refuelNearest = run({
    scenario: { ...Q, lanterns: [{ id: 'L1', pos: [0.5, 0, 0], lit: true, fuel: 50 }, { id: 'L2', pos: [1.8, 0, 0] }], player: { carried: 3 } },
    inputs: { frames: press(0, 'interact') }, ticks: 3,
  });
  assert.equal(events(refuelNearest, 'refuel').length, 1);
  assert.equal(events(refuelNearest, 'refuel')[0].data.lantern_id, 'L1');
  assert.equal(events(refuelNearest, 'deposit').length, 0);
  // den tat gan hon den sang -> chon den tat
  const nearUnlit = run({
    scenario: { ...Q, lanterns: [{ id: 'L1', pos: [1.8, 0, 0], lit: true, fuel: 50 }, { id: 'L2', pos: [0.5, 0, 0] }], player: { carried: 3 } },
    inputs: { frames: press(0, 'interact') }, ticks: 3,
  });
  assert.equal(events(nearUnlit, 'deposit')[0].data.lantern_id, 'L2');
});

// [Ticket-03] THAY THE: khong con thang som khi du den; thang = song sot toi binh minh voi >= ceil(0.6 * tong) den sang.
test('khong con thang som: thap du den van tiep tuc Dem (all_lit khong con dung)', () => {
  const lit5 = ['L1', 'L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  const r = run({ scenario: { ...Q, lanterns: lit5 }, ticks: 100 });
  assert.equal(events(r, 'game_over').length, 0);
  assert.equal(end(r).state, 'playing');
  assert.equal(end(r).ticks, 100);
});

// [Ticket-03] THAY THE test "thang ke ca dung tick het gio": nay xet thang/thua tai tick binh minh.
test('binh minh: thang dawn_survived khi du den sang; diem = (50 + floor(fuel)) moi den + 50 moi lua, khong thuong thoi gian', () => {
  const lit = (n) => ['L1', 'L2', 'L3', 'L4', 'L5'].slice(0, n).map((id) => ({ id, lit: true }));
  const won = run({ scenario: { ...Q, time_left_s: 1 / 60, lanterns: lit(3) }, ticks: 10 });
  assert.deepEqual(events(won, 'game_over')[0].data, { result: 'won', reason: 'dawn_survived' });
  assert.equal(end(won).ticks, 1);
  assert.equal(end(won).score, 3 * (50 + 99) + 3 * 50); // fuel 99.98 -> floor 99
  const two = run({ scenario: { ...Q, time_left_s: 1 / 60, lanterns: lit(2) }, ticks: 10 });
  assert.deepEqual(events(two, 'game_over')[0].data, { result: 'lost', reason: 'dawn' });
  assert.equal(end(two).score, 0);
  const fl = run({ scenario: { ...Q, time_left_s: 1 / 60, lanterns: lit(3), player: { flames: 2 } }, ticks: 10 });
  assert.equal(end(fl).score, 3 * 149 + 2 * 50);
  const full = run({ scenario: { ...Q, time_left_s: 5, lanterns: lit(3) }, ticks: 400 });
  assert.equal(end(full).ticks, 300); // chi ket thuc dung luc binh minh
});

test('nguong thang theo dem: dem 1 can 3/5, dem 2 can 4/6, dem 3 can 5/7', () => {
  const ids = (n, total) => Array.from({ length: total }, (_, i) => 'L' + (i + 1)).slice(0, n).map((id) => ({ id, lit: true }));
  for (const [night, total, need] of [[1, 5, 3], [2, 6, 4], [3, 7, 5]]) {
    const ok = run({ night, scenario: { ...Q, time_left_s: 1 / 60, lanterns: ids(need, total) }, ticks: 5 });
    assert.equal(end(ok).state, 'won', `dem ${night} voi ${need}`);
    const no = run({ night, scenario: { ...Q, time_left_s: 1 / 60, lanterns: ids(need - 1, total) }, ticks: 5 });
    assert.equal(end(no).state, 'lost', `dem ${night} voi ${need - 1}`);
  }
});

test('binh minh: het Ngon Lua luon thua no_flames, ke ca o tick cuoi khi da du den', () => {
  const lit3 = ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true }));
  const r = run({ scenario: { ...Q, time_left_s: 1 / 60, lanterns: lit3, player: { flames: 0 } }, ticks: 5 });
  assert.deepEqual(events(r, 'game_over')[0].data, { result: 'lost', reason: 'no_flames' });
  assert.equal(end(r).score, 0);
});

test('het lua luon thua (no_flames) ke ca khi dong thoi thap du den', () => {
  const litOthers = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  const r = run({
    scenario: { ...Q, player: { carried: 10, flames: 0 }, lanterns: [{ id: 'L1', pos: [0, 0, 1.5] }, ...litOthers] },
    inputs: { frames: press(0, 'interact') }, ticks: 20,
  });
  assert.deepEqual(events(r, 'game_over')[0].data, { result: 'lost', reason: 'no_flames' });
  assert.equal(end(r).state, 'lost');
});

test('Toa Sang: ton 3, ban kinh 3D 5 m tu chan+0.8, choang 120 tick, day lui 4 m trong 15 tick, +5/con', () => {
  const sc = { ...Q, player: { carried: 4 }, shades: [{ id: 'S1', pos: [3, 0, 0] }, { id: 'S2', pos: [4.9, 0, 0] }, { id: 'S3', pos: [5.3, 0, 0] }] };
  const r = run({ scenario: sc, inputs: { frames: press(0, 'pulse') }, ticks: 140, every: 1 });
  assert.deepEqual(events(r, 'pulse')[0].data, { stunned_ids: ['S1', 'S2'] });
  assert.equal(events(r, 'pulse')[0].tick, 1);
  assert.equal(snapAt(r, 1).player.carried, 1);
  assert.equal(snapAt(r, 1).shades[0].state, 'stunned');
  assert.equal(snapAt(r, 1).shades[2].state, 'chase');
  assert.ok(near(snapAt(r, 15).shades[0].pos[0], 7, 0.01)); // 3 + 4
  assert.ok(near(snapAt(r, 60).shades[0].pos[0], 7, 0.01));
  assert.equal(snapAt(r, 119).shades[0].state, 'stunned');
  assert.notEqual(snapAt(r, 121).shades[0].state, 'stunned');
  assert.equal(snapAt(r, 1).score ?? 0, 10);
});

test('Toa Sang: khong du 3 dom dom hoac dang hoi 3 s thi khong kich hoat; lam moi choang va diem', () => {
  const none = run({ scenario: { ...Q, player: { carried: 2 }, shades: [{ pos: [3, 0, 0] }] }, inputs: { frames: press(0, 'pulse') }, ticks: 3 });
  assert.equal(events(none, 'pulse').length, 0);
  const sc = { ...Q, player: { carried: 9 }, shades: [{ pos: [2, 0, 0] }] };
  const fr = [...press(0, 'pulse'), ...press(100, 'pulse'), ...press(180, 'pulse')];
  const r = run({ scenario: sc, inputs: { frames: fr }, ticks: 200, every: 1 });
  const ev = events(r, 'pulse');
  assert.deepEqual(ev.map((e) => e.tick), [1, 181]); // lan 2 (tick 101) bi hoi chieu chan; lan 3 dung 180 tick sau
  assert.equal(last(r).player.carried, 3);
  assert.equal(snapAt(r, 181).score, 10);
});

test('Luot: 14 m/s trong 0.2 s, hoi 1.5 s, huong = huong di, dung yen thi theo huong mat', () => {
  const stand = run({ scenario: Q, inputs: { frames: press(0, 'dash') }, ticks: 20, every: 1 });
  assert.equal(events(stand, 'dash').length, 1);
  assert.ok(near(snapAt(stand, 12).player.pos[2], 2.8, 0.01)); // mat quay +Z
  assert.ok(near(snapAt(stand, 12).player.pos[0], 0, 0.01));
  assert.ok(near(snapAt(stand, 1).player.dash_cd_s, 1.5 - 1 / 60, 0.001) || near(snapAt(stand, 1).player.dash_cd_s, 1.5, 0.02));
  const mv = run({ scenario: Q, inputs: { frames: [{ tick: 0, move: [-1, 0], dash: true }, { tick: 1, dash: false }] }, ticks: 12, every: 1 });
  assert.ok(snapAt(mv, 12).player.pos[0] < -2.5);
  // luot lai trong luc hoi: bi bo qua; dung 90 tick: duoc
  const fr = [...press(0, 'dash'), ...press(50, 'dash'), ...press(90, 'dash')];
  const cd = run({ scenario: Q, inputs: { frames: fr }, ticks: 100 });
  assert.deepEqual(events(cd, 'dash').map((e) => e.tick), [1, 91]);
});

test('Luot tren khong giu nguyen do cao; khong bat tu khi luot', () => {
  const fr = [{ tick: 0, jump: true }, { tick: 1, jump: false }, { tick: 10, dash: true }, { tick: 11, dash: false }];
  const r = run({ scenario: Q, inputs: { frames: fr }, ticks: 30, every: 1 });
  const y0 = snapAt(r, 11).player.pos[1];
  assert.ok(y0 > 0.5);
  assert.ok(near(snapAt(r, 22).player.pos[1], y0, 1e-6)); // 12 tick luot: y khong doi
  assert.equal(snapAt(r, 15).player.invuln, false);
});

test('Nhay: 7 m/s, trong luc 20 m/s2, chi nhay khi cham dat', () => {
  const fr = [{ tick: 0, jump: true }, { tick: 1, jump: false }, { tick: 5, jump: true }, { tick: 6, jump: false }];
  const r = run({ scenario: Q, inputs: { frames: fr }, ticks: 60, every: 1 });
  const ys = snaps(r).map((s) => s.player.pos[1]);
  const apex = Math.max(...ys);
  assert.ok(apex > 1.15 && apex < 1.3, 'apex ' + apex); // 7^2 / (2*20) = 1.225
  assert.equal(snapAt(r, 60).player.grounded, true);
  assert.equal(snapAt(r, 60).player.pos[1], 0);
  assert.ok(near(snapAt(r, 1).player.vel[1], 7 - 20 / 60, 0.01));
});

test('Toc do chay 6 m/s dat trong <= 0.1 s; bua: 7.2 m/s', () => {
  const r = run({ scenario: Q, inputs: { frames: [{ tick: 0, move: [0, 1] }] }, ticks: 60, every: 1 });
  assert.ok(near(snapAt(r, 6).player.vel[2], 6, 1e-6));
  assert.ok(near(snapAt(r, 60).player.pos[2], 5.7, 0.05));
  const c = run({ scenario: { ...Q, player: { charm_ticks: 600 } }, inputs: { frames: [{ tick: 0, move: [0, 1] }] }, ticks: 20, every: 1 });
  assert.ok(near(snapAt(c, 20).player.vel[2], 7.2, 1e-6));
});

test('Bi Bong Muc cham: -1 lua, rot floor(mang/2) dom dom quanh 1.5-2.5 m (480 tick), bat tu 90 tick, bong lui 2 m', () => {
  const r = run({ scenario: { ...Q, shades: [{ id: 'S1', pos: [0.5, 0, 0] }], player: { carried: 5 } }, ticks: 100, every: 1 });
  const hits = events(r, 'player_hit');
  assert.deepEqual(hits[0].data, { by: 'shade', flames: 2, dropped: 2 });
  assert.equal(hits[0].tick, 1);
  const s1 = snapAt(r, 1);
  assert.equal(s1.player.invuln, true);
  assert.equal(s1.player.carried, 3);
  const dropped = s1.motes.filter((m) => m.kind === 'dropped');
  assert.equal(dropped.length, 2);
  for (const m of dropped) { const d = Math.hypot(m.pos[0], m.pos[2]); assert.ok(d >= 1.5 - 1e-3 && d <= 2.5 + 1e-3); assert.ok(near(m.ttl_s, 8, 0.02)); }
  assert.equal(s1.shades[0].state, 'recoil');
  assert.ok(near(Math.hypot(snapAt(r, 60).shades[0].pos[0], snapAt(r, 60).shades[0].pos[2]), 2.5, 0.1)); // lui 2 m so voi luc cham (0.5 -> ~2.5)
  assert.equal(hits[1].tick, 91);
});

test('chi mat toi da 1 lua moi tick; bong cham luc bat tu khong lam gi', () => {
  const sc = { ...Q, shades: [{ id: 'S1', pos: [0.4, 0, 0] }, { id: 'S2', pos: [-0.4, 0, 0] }], player: { carried: 4 } };
  const r = run({ scenario: sc, ticks: 60, every: 1 });
  assert.equal(events(r, 'player_hit').length, 1);
  assert.equal(events(r, 'player_hit')[0].data.flames, 2);
  assert.equal(events(r, 'player_hit')[0].tick, 1);
  assert.equal(snapAt(r, 1).shades[1].state, 'chase'); // S2 cham luc bat tu: khong lui
  assert.equal(snapAt(r, 1).motes_active, 2);
});

test('dom dom roi (kind dropped) ton tai dung 480 tick', () => {
  const r = run({ scenario: { ...Q, motes: [{ pos: [20, 0, 20], kind: 'dropped', ttl_ticks: 480 }] }, ticks: 500, every: 1 });
  assert.equal(snapAt(r, 479).motes.length, 1);
  assert.ok(near(snapAt(r, 479).motes[0].ttl_s, 1 / 60, 1e-3));
  assert.equal(snapAt(r, 480).motes.length, 0);
});

test('het lua -> lost/no_flames', () => {
  const r = run({ scenario: { ...Q, shades: [{ pos: [0.5, 0, 0] }], player: { flames: 1 } }, ticks: 50 });
  assert.deepEqual(events(r, 'game_over')[0].data, { result: 'lost', reason: 'no_flames' });
  assert.equal(end(r).ticks, 1);
});

test('Bong Muc: phat hien 12 m, bo duoi 18 m, trang thai dung ten', () => {
  const r = run({ scenario: { ...Q, shades: [{ id: 'A', pos: [11.9, 0, 0], state: 'wander' }, { id: 'B', pos: [12.5, 0, 0], state: 'wander' }, { id: 'C', pos: [17.9, 0, 0], state: 'chase' }, { id: 'D', pos: [18.5, 0, 0], state: 'chase' }] }, ticks: 1, every: 1 });
  const st = Object.fromEntries(snapAt(r, 1).shades.map((s) => [s.id, s.state]));
  assert.deepEqual(st, { A: 'chase', B: 'wander', C: 'chase', D: 'wander' });
  const sp = run({ scenario: { ...Q, shades: [{ pos: [10, 0, 0] }] }, ticks: 60, every: 60 });
  assert.ok(near(snapAt(sp, 60).shades[0].pos[0], 6, 0.01)); // 4 m/s
});

test('lich sinh Bong Muc: 2 con tick 300, roi moi 480 tick (dem 1), id S1.., o diem ban kinh 37 m, toi da 6', () => {
  const r = run({ scenario: { random_motes: false, random_drifters: false, time_left_s: 900, player: { pos: [0, 0, 0], flames: 99 } }, ticks: 300 + 480 * 6, every: 1000 });
  const sp = events(r, 'shade_spawned');
  assert.deepEqual(sp.slice(0, 3).map((e) => [e.tick, e.data.id]), [[300, 'S1'], [300, 'S2'], [780, 'S3']]);
  assert.equal(sp.length, 6); // chan o 6
  assert.equal(snapAt(r, 300) ?? null, null);
  const first = run({ scenario: { random_motes: false, random_drifters: false }, ticks: 300, every: 300 });
  const s = snapAt(first, 300);
  assert.equal(s.shades.length, 2);
  for (const sh of s.shades) { assert.equal(sh.state, 'spawning'); assert.ok(near(Math.hypot(sh.pos[0], sh.pos[2]), 37, 0.01)); }
});

test('dom dom: 1 con moi 240 tick toi tran 30', () => {
  const r = run({ scenario: { random_shades: false, random_drifters: false, wind_enabled: false }, ticks: 481, every: 1 });
  assert.equal(snapAt(r, 239).motes_active, 20);
  assert.equal(snapAt(r, 240).motes_active, 21);
  assert.equal(snapAt(r, 480).motes_active, 22);
});

test('vung an toan: bong ngoai bi chan o 6 m; bong trong khi den vua thap bi day ra trong <= 30 tick va khong gay sat thuong', () => {
  const out = run({ scenario: { ...Q, shades: [{ pos: [20, 0, 0] }], lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }], player: { pos: [0, 0, 1] } }, ticks: 600, every: 600 });
  assert.ok(Math.hypot(...[last(out).shades[0].pos[0], last(out).shades[0].pos[2]]) >= 6 - 1e-3);
  const r = run({
    scenario: { ...Q, player: { pos: [0, 0, 1.5], carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 0] }], shades: [{ pos: [3, 0, 1.5] }] },
    inputs: { frames: press(0, 'interact') }, ticks: 60, every: 1,
  });
  assert.equal(events(r, 'lantern_lit').length, 1);
  assert.equal(events(r, 'player_hit').length, 0);
  assert.equal(snapAt(r, 1).shades[0].state, 'recoil');
  const d = (s) => Math.hypot(s.shades[0].pos[0], s.shades[0].pos[2]);
  assert.ok(d(snapAt(r, 31)) >= 6 - 1e-3, 'd=' + d(snapAt(r, 31)));
  assert.ok(d(snapAt(r, 15)) < 6 && d(snapAt(r, 15)) > d(snapAt(r, 1)));
});

test('roi khoi dao (Dem 2): dung 1 lan, -1 lua, mat het dom dom, cho 60 tick roi hoi sinh o diem xuat phat, bat tu 90 tick', () => {
  const r = run({ night: 2, scenario: { ...Q, player: { pos: [30, 0, 10], carried: 4 } }, ticks: 300, every: 1 });
  const hits = events(r, 'player_hit');
  assert.equal(hits.length, 1);
  assert.deepEqual(hits[0].data, { by: 'fall', flames: 2, dropped: 0, lost: 4 });
  const ft = hits[0].tick;
  assert.ok(snapAt(r, ft).player.pos[1] < -10);
  assert.equal(snapAt(r, ft).player.carried, 0);
  const back = snapAt(r, ft + 60);
  assert.deepEqual(back.player.pos, [0, 0, 0]);
  assert.deepEqual(back.player.vel, [0, 0, 0]);
  assert.equal(back.player.invuln, true);
  assert.equal(back.player.flames, 2);
  assert.equal(snapAt(r, ft + 59).player.pos[1] < -10, true);
});

test('roi khi het lua -> thua ngay, khong hoi sinh', () => {
  const r = run({ night: 2, scenario: { ...Q, player: { pos: [30, 0, 10], flames: 1 } }, ticks: 300 });
  assert.deepEqual(events(r, 'game_over')[0].data, { result: 'lost', reason: 'no_flames' });
  assert.ok(end(r).ticks < 120);
});

test('Dem 2: cau tre di duoc; buc nhay bay sang dao B', () => {
  const bridge = run({ night: 2, scenario: { ...Q, player: { pos: [20, 0, 0] } }, inputs: { frames: [{ tick: 0, move: [1, 0] }] }, ticks: 300 });
  assert.equal(events(bridge, 'player_hit').length, 0);
  assert.ok(last(bridge).player.pos[0] > 44);
  const pad = run({ night: 2, scenario: { ...Q, player: { pos: [20, 0, 18] } }, ticks: 140, every: 1 });
  assert.ok(snapAt(pad, 1).player.vel[1] > 13);
  assert.ok(snapAt(pad, 1).player.grounded === false);
  const fin = last(pad).player;
  assert.equal(fin.grounded, true);
  assert.ok(fin.pos[0] > 44 && fin.pos[0] < 98 && Math.hypot(fin.pos[0] - 70, fin.pos[2]) <= 28, JSON.stringify(fin.pos));
  assert.equal(events(pad, 'player_hit').length, 0);
});

test('Dem 3: dung doc len tang 1, vach dung chan, buc nhay len tang 2', () => {
  const ramp = run({ night: 3, scenario: { ...Q, player: { pos: [25.98, 0, 15] } }, inputs: { frames: [{ tick: 0, move: [-0.866, -0.5] }] }, ticks: 120, every: 1 });
  assert.ok(near(snapAt(ramp, 120).player.pos[1], 3, 0.01));
  assert.equal(snapAt(ramp, 120).player.grounded, true);
  const wall = run({ night: 3, scenario: { ...Q, player: { pos: [0, 0, 30] } }, inputs: { frames: [{ tick: 0, move: [0, -1] }] }, ticks: 200 });
  assert.equal(last(wall).player.pos[1], 0);
  assert.ok(last(wall).player.pos[2] >= 23.9);
  const pad = run({ night: 3, scenario: { ...Q, player: { pos: [0, 3, 13] } }, ticks: 120, every: 1 });
  const f = last(pad).player;
  assert.ok(near(f.pos[1], 6, 1e-6) && Math.hypot(f.pos[0], f.pos[2]) < 8 && Math.hypot(f.pos[0], f.pos[2]) > 2, JSON.stringify(f.pos));
});

test('Dem 3: thap chuong chan duong, mat do cao tang theo thang may', () => {
  const r = run({ night: 3, scenario: { ...Q, player: { pos: [0, 6, 5] } }, inputs: { frames: [{ tick: 0, move: [0, -1] }] }, ticks: 120 });
  assert.ok(last(r).player.pos[2] >= 1.9);
  assert.equal(last(r).player.pos[1], 6);
});

test('Gio manh (Dem 3): bao truoc 2 s, 5 s moi 30 s, day 2 m/s dung huong dir_deg', () => {
  const r = run({ night: 3, scenario: { ...Q, time_left_s: 600, wind_enabled: true, player: { pos: [0, 0, -30] } }, ticks: 2200, every: 50 });
  assert.equal(snapAt(r, 1700).wind.active, false);
  assert.equal(snapAt(r, 1800).wind.active, true);
  assert.equal(snapAt(r, 2050).wind.active, true);
  assert.equal(snapAt(r, 2100).wind.active, false);
  const p0 = snapAt(r, 1750).player.pos, p1 = snapAt(r, 2100).player.pos;
  const dx = p1[0] - p0[0], dz = p1[2] - p0[2];
  assert.ok(near(Math.hypot(dx, dz), 10, 0.2), 'quang duong ' + Math.hypot(dx, dz)); // 2 m/s x 5 s
  const d = snapAt(r, 2000).wind.dir_deg;
  assert.ok(d >= 0 && d < 360);
  assert.ok(near(dx / 10, Math.cos((d * Math.PI) / 180), 0.03) && near(dz / 10, Math.sin((d * Math.PI) / 180), 0.03));
  const off = run({ night: 3, scenario: { ...Q, time_left_s: 600, wind_enabled: false }, ticks: 2200, every: 2200 });
  assert.equal(snapAt(off, 2200).wind.active, false);
  assert.deepEqual(snapAt(off, 2200).player.pos, [0, 0, -14]);
});

test('Gio Lac: duoi khi mang >= 5 va cach <= 15 m, cuop min(3, mang), bay di 240 tick roi bien mat cung do cuop', () => {
  const sc = { ...Q, player: { carried: 5 }, drifters: [{ id: 'D1', pos: [10, 1.5, 0] }] };
  const r = run({ night: 2, scenario: sc, ticks: 400, every: 1 });
  const st = events(r, 'drifter_steal');
  assert.equal(st.length, 1);
  assert.deepEqual(st[0].data, { drifter_id: 'D1', amount: 3, carried: 2 });
  assert.equal(snapAt(r, st[0].tick).drifters[0].state, 'flee');
  assert.equal(snapAt(r, st[0].tick).drifters[0].stolen, 3);
  assert.equal(snapAt(r, st[0].tick - 1).drifters[0].state, 'chase');
  assert.equal(snapAt(r, st[0].tick + 239).drifters.length, 1);
  assert.equal(snapAt(r, st[0].tick + 240).drifters.length, 0);
  assert.equal(events(r, 'player_hit').length, 0); // khong lam mat Ngon Lua
  // it hon 5 dom dom: khong duoi, ve idle
  const calm = run({ night: 2, scenario: { ...Q, player: { carried: 4 }, drifters: [{ pos: [5, 1.5, 0] }] }, ticks: 30, every: 1 });
  assert.equal(events(calm, 'drifter_steal').length, 0);
  assert.equal(snapAt(calm, 30).drifters[0].state, 'idle');
});

test('Gio Lac: Toa Sang khi dang duoi -> bay di khong cuop; khi dang bay mang do -> tha lai toan bo', () => {
  const a = run({ night: 2, scenario: { ...Q, player: { carried: 9 }, drifters: [{ pos: [4, 1.5, 0], state: 'chase' }] }, inputs: { frames: press(0, 'pulse') }, ticks: 20, every: 1 });
  assert.equal(events(a, 'drifter_steal').length, 0);
  assert.equal(snapAt(a, 1).drifters[0].state, 'flee');
  assert.equal(snapAt(a, 1).drifters[0].stolen, 0);
  const b = run({ night: 2, scenario: { ...Q, player: { carried: 3 }, drifters: [{ id: 'D1', pos: [3, 1.5, 0], state: 'flee', stolen: 3 }] }, inputs: { frames: press(0, 'pulse') }, ticks: 140, every: 1 });
  assert.deepEqual(events(b, 'drifter_drop')[0].data, { drifter_id: 'D1', amount: 3 });
  assert.equal(snapAt(b, 1).motes.filter((m) => m.kind === 'dropped').length, 3);
  assert.equal(snapAt(b, 1).drifters[0].stolen, 0);
  assert.equal(snapAt(b, 120).drifters.length, 1);
  assert.equal(snapAt(b, 121).drifters.length, 0); // bien mat sau 120 tick
});

test('Gio Lac: lich sinh tick 1200, toi da 2, id D1.. (Dem 2)', () => {
  const r = run({ night: 2, scenario: { random_motes: false, random_shades: false }, ticks: 3700, every: 1 });
  assert.equal(snapAt(r, 1199).drifters.length, 0);
  assert.equal(snapAt(r, 1200).drifters[0].id, 'D1');
  assert.equal(snapAt(r, 3600).drifters.length <= 2, true);
  assert.equal(run({ night: 1, scenario: { random_motes: false, random_shades: false }, ticks: 1300, every: 1300 }).lines.at(-2).drifters.length, 0);
});

test('Bua Gio: nhat -> 600 tick, toc do 7.2, bua bien mat 2700 tick roi xuat hien lai, luot khong hoi', () => {
  const r = run({ night: 2, scenario: { ...Q, player: { pos: [34.5, 0, 0] } }, inputs: { frames: [{ tick: 5, move: [1, 0] }, { tick: 60, move: [0, 0] }] }, ticks: 2800, every: 1 });
  assert.deepEqual(events(r, 'charm_picked')[0].data, { charm_id: 'C1', charm_ticks: 600 });
  assert.equal(snapAt(r, 1).charms[0].available, false);
  assert.ok(near(snapAt(r, 1).charms[0].respawn_s, 45, 0.02));
  assert.ok(near(snapAt(r, 1).player.charm_s, 10, 0.02));
  assert.ok(near(snapAt(r, 301).player.charm_s, 5, 0.02));
  assert.equal(snapAt(r, 601).player.charm_s, 0);
  assert.equal(snapAt(r, 2700).charms[0].available, false);
  assert.equal(snapAt(r, 2701).charms[0].available, true);
  const d = run({ scenario: { ...Q, player: { charm_ticks: 600 } }, inputs: { frames: [...press(0, 'dash'), ...press(5, 'dash'), ...press(12, 'dash')] }, ticks: 30 });
  assert.deepEqual(events(d, 'dash').map((e) => e.tick), [1, 13]); // bam khi dang luot bi bo qua; xong luot la luot lai duoc
});

test('Tam dung: tick van tang, sim_tick/thoi gian dung yen, snapshot paused, su kien paused/resumed', () => {
  const fr = [{ tick: 0, move: [0, 1] }, ...press(10, 'pause'), ...press(50, 'pause')];
  const r = run({ scenario: Q, inputs: { frames: fr }, ticks: 100, every: 1 });
  assert.deepEqual(events(r, 'paused').map((e) => e.tick), [11]);
  assert.deepEqual(events(r, 'resumed').map((e) => e.tick), [51]);
  assert.equal(snapAt(r, 30).state, 'paused');
  assert.equal(snapAt(r, 30).sim_tick, 10);
  assert.equal(snapAt(r, 30).time_left_s, snapAt(r, 11).time_left_s);
  assert.deepEqual(snapAt(r, 30).player.pos, snapAt(r, 11).player.pos);
  assert.equal(snapAt(r, 100).sim_tick, 100 - 40);
  assert.equal(snapAt(r, 100).state, 'playing');
});

test('khong thay doi hanh vi: sinh/ttl/hoi chieu dung yen khi tam dung', () => {
  const fr = [...press(5, 'pause'), ...press(400, 'pause')];
  const r = run({ scenario: { random_shades: false, random_drifters: false, wind_enabled: false }, inputs: { frames: fr }, ticks: 600, every: 1 });
  assert.equal(snapAt(r, 300).motes_active, 20); // lich sinh dom dom 240 tick chua den vi sim_tick bi dung
});

test('tat dinh: cung seed/scenario/inputs -> output giong het; khac seed -> khac; ca 3 dem', () => {
  for (const night of [1, 2, 3]) {
    const inputs = { frames: [{ tick: 0, move: [1, 1] }, ...press(100, 'dash'), ...press(200, 'pulse'), { tick: 300, move: [-1, 0.3], cam_yaw_deg: 45 }] };
    const a = run({ seed: 7, night, inputs, ticks: 3000 });
    const b = run({ seed: 7, night, inputs, ticks: 3000 });
    const c = run({ seed: 8, night, inputs, ticks: 3000 });
    assert.equal(a.raw, b.raw);
    assert.notEqual(a.raw, c.raw);
  }
});

test('huong di xoay theo cam_yaw_deg; vector > 1 duoc chuan hoa', () => {
  const r = run({ scenario: Q, inputs: { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }] }, ticks: 30, every: 30 });
  const p = last(r).player.pos;
  assert.ok(p[0] > 2 && Math.abs(p[2]) < 1e-3);
  const diag = run({ scenario: Q, inputs: { frames: [{ tick: 0, move: [1, 1] }] }, ticks: 60 });
  assert.ok(near(Math.hypot(last(diag).player.vel[0], last(diag).player.vel[2]), 6, 1e-3));
});

test('file sai dinh dang -> exit 2; --night ngoai 1..3 hoac thieu tham so -> exit != 0', () => {
  assert.equal(run({ scenario: '{khong phai json' }).code, 2);
  assert.equal(run({ inputs: { frames: [{ tick: 5 }, { tick: 5 }] } }).code, 2);
  assert.equal(run({ inputs: { frames: [{ tick: 0, move: [2, 0] }] } }).code, 2);
  assert.equal(run({ inputs: { frames: [{ tick: 0, pause: 'yes' }] } }).code, 2);
  assert.equal(run({ scenario: { player: { pos: [0, 0] } } }).code, 2);
  assert.equal(run({ scenario: { shades: [{ pos: [0, 0, 0], state: 'sleeping' }] } }).code, 2);
  assert.equal(run({ scenario: { drifters: [{ pos: [0, 0, 0], state: 'angry' }] } }).code, 2);
  assert.equal(run({ extra: ['--scenario', path.join(tmp, 'khong-ton-tai.json')] }).code, 2);
  assert.notEqual(run({ night: 4 }).code, 0);
  const r = spawnSync(process.execPath, [path.join(root, 'src/headless.js'), '--seed', '1'], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.ok(r.stderr.length > 0);
});

test('hieu nang: mot dem day du 21600 tick xong trong <= 30 s', () => {
  const t0 = Date.now();
  const inputs = { frames: [{ tick: 0, move: [1, 1] }, { tick: 900, move: [-1, 1] }, { tick: 1800, move: [0, -1] }] };
  const r = run({ night: 3, seed: 3, inputs, ticks: 21600, scenario: { time_left_s: 360, player: { flames: 99 } } });
  assert.equal(r.code, 0);
  assert.ok(Date.now() - t0 < 30000);
  assert.ok(end(r).ticks <= 21600);
});


// ---------------------------------------------------------------- Ticket-03: nhien lieu den
const near1 = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false };

test('snapshot v1.2: den co fuel/ever_lit/relit_count, nguoi choi co capacity, den tat fuel 0; lit:true khong fuel -> 100', () => {
  const r = run({ scenario: { ...Q, lanterns: [{ id: 'L1', lit: true }] }, ticks: 0 });
  const s = r.lines[0];
  assert.deepEqual(s.lanterns[0], { id: 'L1', pos: [0, 0, 25], lit: true, deposited: 10, fuel: 100, ever_lit: true, relit_count: 0 });
  assert.equal(s.lanterns[1].fuel, 0); assert.equal(s.lanterns[1].ever_lit, false); assert.equal(s.lanterns[1].lit, false);
  assert.equal(s.player.capacity, 10); // den dat san bang scenario khong tinh vao successful_lights
  assert.ok(!r.lines.some((l) => l.name === 'lantern_lit'));
});

test('hao dau 1.0/giay: 600 tick -> mat 10', () => {
  const r = run({ scenario: { ...Q, lanterns: [{ id: 'L1', lit: true }] }, ticks: 600, every: 600 });
  assert.equal(snapAt(r, 600).lanterns[0].fuel, 90);
  assert.equal(snapAt(r, 600).lanterns[0].lit, true);
});

test('het dau: den tat dung tick, deposited = 0, nho ever_lit, phat lantern_out; thap lai chi can 5', () => {
  const lan = [{ id: 'L1', pos: [0, 0, 1.5], lit: true, fuel: 0.5 }]; // 30 don vi => het dau o tick 30
  const fr = press(40, 'interact');
  const r = run({ scenario: { ...Q, lanterns: lan, player: { carried: 5 } }, inputs: { frames: fr }, ticks: 60, every: 1 });
  const out = events(r, 'lantern_out');
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].data, { lantern_id: 'L1' });
  assert.equal(out[0].tick, 30);
  assert.equal(snapAt(r, 29).lanterns[0].lit, true);
  const s30 = snapAt(r, 30).lanterns[0];
  assert.deepEqual([s30.lit, s30.deposited, s30.fuel, s30.ever_lit], [false, 0, 0, true]);
  // thap lai o tick 41 voi 5 dom dom
  assert.deepEqual(events(r, 'lantern_lit')[0].data, { lantern_id: 'L1', relight: true });
  assert.equal(events(r, 'lantern_lit')[0].tick, 41);
  assert.equal(snapAt(r, 41).lanterns[0].relit_count, 1);
  assert.equal(snapAt(r, 41).player.carried, 0);
});

test('thap lai: +5/dom dom +40 diem (khong +100), tinh vao successful_lights; chua tung sang van can 10', () => {
  const sc = (ever) => ({ ...Q, lanterns: [{ id: 'L1', pos: [0, 0, 1.5], ever_lit: ever }], player: { carried: 5 } });
  const re = run({ scenario: sc(true), inputs: { frames: press(0, 'interact') }, ticks: 3 });
  assert.deepEqual(events(re, 'lantern_lit')[0].data.relight, true);
  assert.equal(end(re).score, 25 + 40);
  assert.equal(last(re).player.capacity, 12);
  assert.equal(last(re).lanterns[0].relit_count, 1);
  const first = run({ scenario: sc(false), inputs: { frames: press(0, 'interact') }, ticks: 3 });
  assert.equal(events(first, 'lantern_lit').length, 0); // moi nap 5/10
  assert.equal(last(first).lanterns[0].deposited, 5);
  const four = run({ scenario: { ...sc(true), player: { carried: 4 } }, inputs: { frames: press(0, 'interact') }, ticks: 3 });
  assert.equal(events(four, 'lantern_lit').length, 0);
});

test('chau dau: used = min(mang, ceil((100-fuel)/10)), +10 dau/dom dom, +5 diem/dom dom', () => {
  // fuel scenario = muc mong muon + 1/60 vi dau hao truoc buoc Tuong tac cua cung tick
  const mk = (fuel, carried) => run({ scenario: { ...Q, lanterns: [{ id: 'L1', pos: [0, 0, 1.5], lit: true, fuel: fuel + 1 / 60 }], player: { carried } }, inputs: { frames: press(0, 'interact') }, ticks: 3, every: 1 });
  const a = mk(40, 10);
  assert.deepEqual(events(a, 'refuel')[0].data, { lantern_id: 'L1', amount: 6, fuel: 100 });
  assert.equal(snapAt(a, 1).player.carried, 4);
  assert.equal(end(a).score, 30);
  const b = mk(40, 2);
  assert.deepEqual(events(b, 'refuel')[0].data, { lantern_id: 'L1', amount: 2, fuel: 60 });
  assert.equal(snapAt(b, 1).player.carried, 0);
  assert.equal(end(b).score, 10);
  const c = mk(95, 5);
  assert.deepEqual(events(c, 'refuel')[0].data, { lantern_id: 'L1', amount: 1, fuel: 100 }); // chi can 1 dom dom (khong tran)
  assert.equal(snapAt(c, 1).player.carried, 4);
  const none = mk(40, 0); // khong mang gi: khong su kien, khong diem
  assert.equal(events(none, 'refuel').length, 0);
  assert.equal(end(none).score, 0);
  assert.equal(events(a, 'lantern_lit').length, 0); // chau dau khong phai thap lai: khong cong diem den
});

test('dau hao truoc Tuong tac: den vua day 100 van "thieu" 0.017 nen 1 dom dom chau duoc (documented)', () => {
  const r = run({ scenario: { ...Q, lanterns: [{ id: 'L1', pos: [0, 0, 1.5], lit: true }], player: { carried: 2 } }, inputs: { frames: press(0, 'interact') }, ticks: 3 });
  assert.deepEqual(events(r, 'refuel')[0].data, { lantern_id: 'L1', amount: 1, fuel: 100 });
});

test('Suc chua tang dan: 10 + 2*successful_lights toi da 20; dem 0; den dat san khong tinh; nhat dung tran', () => {
  const cap = (n) => run({ scenario: { ...Q, player: { successful_lights: n } }, ticks: 0 }).lines[0].player.capacity;
  assert.deepEqual([cap(0), cap(1), cap(3), cap(5), cap(9), cap(50)], [10, 12, 16, 20, 20, 20]);
  const full = run({ scenario: { ...Q, motes: [[0, 0, 0.5]], player: { carried: 12, successful_lights: 1 } }, ticks: 5 });
  assert.equal(events(full, 'mote_picked').length, 0);
  const room = run({ scenario: { ...Q, motes: [[0, 0, 0.5]], player: { carried: 11, successful_lights: 1 } }, ticks: 5 });
  assert.deepEqual(events(room, 'mote_picked')[0].data, { carried: 12 });
});

// ---------------------------------------------------------------- Ticket-03: vung an toan va Bong Muc hut dau
test('vung an toan chi con khi fuel >= 30 (dung 30 van con); chau len >= 30 thi bong trong 6 m bi day ra, khong sat thuong', () => {
  const mk = (fuel) => run({
    scenario: { ...Q, player: { pos: [0, 0, 1.5], carried: 1 }, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel }], shades: [{ pos: [3, 0, 1.5] }] },
    inputs: { frames: press(0, 'interact') }, ticks: 40, every: 1,
  });
  const at30 = mk(20 + 1 / 60); // sau hao + chau (+10) = dung 30.0 -> con vung
  assert.equal(snapAt(at30, 1).lanterns[0].fuel, 30);
  assert.equal(snapAt(at30, 1).shades[0].state, 'recoil');
  const dist = (s) => Math.hypot(s.shades[0].pos[0], s.shades[0].pos[2]);
  assert.ok(dist(snapAt(at30, 30)) >= 6 - 1e-3); // day ra xong trong <= 30 tick (sau do fuel < 30 nen vung mat ngay)
  assert.ok(dist(snapAt(at30, 15)) < 6 && dist(snapAt(at30, 15)) > dist(snapAt(at30, 1)));
  assert.equal(events(at30, 'player_hit').length, 0);
  const below = mk(19.9); // sau hao + chau = 29.88 < 30 -> khong co vung, khong ai bi day ra
  assert.notEqual(snapAt(below, 1).shades[0].state, 'recoil');
  // den yeu (fuel < 30) khong chan duoc bong dang duoi (o trong 12 m): bong den sat nguoi choi
  const weak = run({ scenario: { ...Q, player: { pos: [0, 0, 1] }, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 10 }], shades: [{ pos: [11, 0, 0] }] }, ticks: 400 });
  assert.ok(events(weak, 'player_hit').length >= 1);
  const strong = run({ scenario: { ...Q, player: { pos: [0, 0, 1] }, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 100 }], shades: [{ pos: [11, 0, 0] }] }, ticks: 400 });
  assert.equal(events(strong, 'player_hit').length, 0);
});

const far = { player: { pos: [-20, 0, -20] } }; // xa moi thu: khong bi phat hien (>12 m)
const drainLantern = (fuel = 20) => ({ id: 'L1', pos: [0, 0, 0], lit: true, fuel });

test('wander: nham den sang fuel < 30 gan nhat truoc, khong co thi den tat gan nhat; hoa thi id nho', () => {
  const target = (lanterns, pos = [0, 0, 10]) => snapAt(run({ scenario: { ...Q, ...far, lanterns, shades: [{ pos, state: 'wander' }] }, ticks: 1, every: 1 }), 1).shades[0].target_lantern_id;
  const weakFar = { id: 'L1', pos: [30, 0, 0], lit: true, fuel: 10 };
  const unlitNear = { id: 'L2', pos: [5, 0, 5] };
  assert.equal(target([weakFar, unlitNear]), 'L1'); // den yeu xa van duoc chon truoc den tat gan
  assert.equal(target([{ ...weakFar, fuel: 100 }, unlitNear]), 'L2'); // khong co den yeu -> den tat gan nhat
  assert.equal(target([{ id: 'L1', pos: [10, 0, 10], lit: true, fuel: 5 }, { id: 'L2', pos: [-10, 0, 10], lit: true, fuel: 5 }]), 'L1'); // hoa -> id nho
  assert.equal(target([{ id: 'L2', pos: [10, 0, 10], lit: true, fuel: 5 }, { id: 'L1', pos: [-10, 0, 10], lit: true, fuel: 5 }]), 'L1');
  // bong dang duoi (chase) khong doi muc tieu
  const chase = run({ scenario: { ...Q, player: { pos: [8, 0, 8] }, lanterns: [{ id: 'L1', pos: [30, 0, 0], lit: true, fuel: 10 }], shades: [{ pos: [0, 0, 10], state: 'chase' }] }, ticks: 1, every: 1 });
  assert.equal(snapAt(chase, 1).shades[0].state, 'chase');
  assert.equal(snapAt(chase, 1).shades[0].target_lantern_id, null);
});

test('drain: bong toi den yeu trong 2 m thi dung yen hut 5/giay (cong don voi hao 1/giay); fuel_drain moi 60 tick; het dau thi ve wander', () => {
  const r = run({ scenario: { ...Q, ...far, lanterns: [drainLantern(20)], shades: [{ id: 'S1', pos: [10, 0, 0], state: 'wander', target_lantern_id: 'L1' }] }, ticks: 400, every: 1 });
  assert.equal(snapAt(r, 100).shades[0].state, 'wander');
  const d0 = snapAt(r, 122).shades[0];
  assert.equal(d0.state, 'drain');
  assert.ok(Math.hypot(d0.pos[0], d0.pos[2]) <= 2 + 1e-3);
  assert.deepEqual(snapAt(r, 140).shades[0].pos, d0.pos); // dung yen
  const f = (t) => snapAt(r, t).lanterns[0].fuel;
  assert.ok(near(f(150) - f(210), 6.0, 0.06), `giam ${f(150) - f(210)}`); // 1 + 5 moi giay
  const fd = events(r, 'fuel_drain');
  assert.ok(fd.length >= 2);
  assert.equal(fd[1].tick - fd[0].tick, 60);
  assert.equal(fd[0].data.lantern_id, 'L1'); assert.equal(fd[0].data.shade_id, 'S1');
  assert.equal(typeof fd[0].data.fuel, 'number');
  const outEv = events(r, 'lantern_out');
  assert.equal(outEv.length, 1);
  assert.ok(outEv[0].tick > 280 && outEv[0].tick < 320);
  assert.equal(snapAt(r, outEv[0].tick).shades[0].state, 'wander'); // den tat -> wander ngay
});

test('drain cong don nhieu con: 2 con -> 11/giay', () => {
  const sh = [{ id: 'S1', pos: [1.5, 0, 0], state: 'drain', target_lantern_id: 'L1' }, { id: 'S2', pos: [-1.5, 0, 0], state: 'drain', target_lantern_id: 'L1' }];
  const r = run({ scenario: { ...Q, ...far, lanterns: [drainLantern(20)], shades: sh }, ticks: 60, every: 60 });
  assert.equal(snapAt(r, 60).lanterns[0].fuel, 9); // 20 - 60 * (1 + 5 + 5) / 60
});

test('drain -> chase khi May vao trong 6 m; -> stunned khi trung Toa Sang (+15 diem); -> wander khi xa den > 2 m', () => {
  const sh = { id: 'S1', pos: [1.5, 0, 0], state: 'drain', target_lantern_id: 'L1' };
  const ch = run({ scenario: { ...Q, player: { pos: [5, 0, 0] }, lanterns: [drainLantern()], shades: [sh] }, ticks: 1, every: 1 });
  assert.equal(snapAt(ch, 1).shades[0].state, 'chase');
  const pu = run({ scenario: { ...Q, player: { pos: [5, 0, 0], carried: 3 }, lanterns: [drainLantern()], shades: [sh] }, inputs: { frames: press(0, 'pulse') }, ticks: 1, every: 1 });
  assert.equal(snapAt(pu, 1).shades[0].state, 'stunned');
  assert.equal(end(pu).score, 15); // tong +15 khi dang drain (thuong: 5)
  const plain = run({ scenario: { ...Q, player: { pos: [5, 0, 0], carried: 3 }, shades: [{ pos: [8, 0, 0] }] }, inputs: { frames: press(0, 'pulse') }, ticks: 1 });
  assert.equal(end(plain).score, 5);
  const away = run({ scenario: { ...Q, ...far, lanterns: [drainLantern()], shades: [{ id: 'S1', pos: [5, 0, 0], state: 'drain', target_lantern_id: 'L1' }] }, ticks: 1, every: 1 });
  assert.equal(snapAt(away, 1).shades[0].state, 'wander');
  const dead = run({ scenario: { ...Q, ...far, lanterns: [drainLantern(0.05)], shades: [sh] }, ticks: 1, every: 1 });
  assert.equal(events(dead, 'lantern_out').length, 1);
  assert.equal(snapAt(dead, 1).shades[0].state, 'wander');
});

test('chau dau len >= 30 khi bong dang hut: bong bi day ra khoi vung 6 m (recoil), khong sat thuong', () => {
  const r = run({
    scenario: { ...Q, player: { pos: [0, 0, -1.5], carried: 3 }, lanterns: [drainLantern(10 + 1 / 60)], shades: [{ id: 'S1', pos: [1.5, 0, 0], state: 'drain', target_lantern_id: 'L1' }] },
    inputs: { frames: press(0, 'interact') }, ticks: 40, every: 1,
  });
  assert.equal(events(r, 'refuel').length, 1);
  assert.equal(snapAt(r, 1).shades[0].state, 'recoil');
  assert.equal(events(r, 'player_hit').length, 0);
  const d = snapAt(r, 30).shades[0];
  assert.ok(Math.hypot(d.pos[0], d.pos[2]) >= 6 - 1e-3);
});

test('het choang -> wander (khong con chase); bong choang khong hut dau', () => {
  const r = run({ scenario: { ...Q, player: { pos: [0, 0, 0] }, lanterns: [drainLantern(20)], shades: [{ id: 'S1', pos: [15, 0, 0], state: 'stunned', state_ticks_left: 1 }] }, ticks: 1, every: 1 });
  assert.equal(snapAt(r, 1).shades[0].state, 'wander'); // truoc Ticket-03: 'chase' vi <= 18 m
});

test('Dem 2 va 3: nhien lieu hoat dong nhu nhau (hao, thap lai, nang suc chua)', () => {
  for (const night of [2, 3]) {
    const r = run({ night, scenario: { ...Q, lanterns: [{ id: 'L1', lit: true }, { id: 'L2', ever_lit: true }] }, ticks: 120, every: 60 });
    assert.equal(snapAt(r, 120).lanterns[0].fuel, 98);
    assert.equal(snapAt(r, 120).lanterns[1].lit, false);
  }
});

test('v1.2: scenario sai (fuel ngoai [0,100], ever_lit, target_lantern_id, successful_lights) -> exit 2', () => {
  assert.equal(run({ scenario: { lanterns: [{ id: 'L1', lit: true, fuel: 150 }] } }).code, 2);
  assert.equal(run({ scenario: { lanterns: [{ id: 'L1', lit: true, fuel: -1 }] } }).code, 2);
  assert.equal(run({ scenario: { lanterns: [{ id: 'L1', ever_lit: 'x' }] } }).code, 2);
  assert.equal(run({ scenario: { shades: [{ pos: [0, 0, 0], target_lantern_id: 5 }] } }).code, 2);
  assert.equal(run({ scenario: { player: { successful_lights: -1 } } }).code, 2);
  assert.equal(run({ scenario: { shades: [{ pos: [0, 0, 0], state: 'drain' }] } }).code, 0); // drain hop le
});

test('tat dinh voi nhien lieu: scenario co den dang hut dau, cung seed cho cung output', () => {
  const sc = { random_motes: false, lanterns: [{ id: 'L1', lit: true, fuel: 25 }, { id: 'L2', lit: true, fuel: 15 }] };
  const inputs = { frames: [{ tick: 0, move: [0, 1] }, ...press(200, 'interact')] };
  const a = run({ seed: 9, scenario: sc, inputs, ticks: 3000 });
  const b = run({ seed: 9, scenario: sc, inputs, ticks: 3000 });
  assert.equal(a.raw, b.raw);
  assert.ok(events(a, 'lantern_out').length >= 1);
});
