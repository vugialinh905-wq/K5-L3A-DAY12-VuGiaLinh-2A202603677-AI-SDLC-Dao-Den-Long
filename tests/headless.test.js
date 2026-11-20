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

test('contract v1.1: tuning khop so chuan, co cac khoa moi', () => {
  const c = JSON.parse(fs.readFileSync(path.join(root, 'game.contract.json'), 'utf8'));
  assert.equal(c.contract_version, '1.1');
  assert.deepEqual(c.tuning, JSON.parse(JSON.stringify(TUNING)));
  for (const k of ['dash_speed', 'dash_duration_s', 'dash_cooldown_s', 'night2_duration_s', 'night3_duration_s']) assert.ok(k in c.tuning, k);
  assert.equal(c.tuning.carry_capacity, 10);
  assert.equal(c.tuning.lantern_cost, 10);
  assert.equal(c.tuning.pulse_cost, 3);
  assert.equal(c.tuning.score.per_second_left, 2);
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
  const cnt = { 1: 5, 2: 6, 3: 7 }, dur = { 1: 300, 2: 330, 3: 360 };
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

test('nap anh sang: nap nhieu lan, den nho tien do, +10/dom dom +100/den', () => {
  const lan = [{ id: 'L1', pos: [0, 0, 1.5] }];
  const a = run({ scenario: { ...Q, lanterns: lan, player: { carried: 4 } }, inputs: { frames: press(0, 'interact') }, ticks: 5 });
  assert.deepEqual(events(a, 'deposit')[0].data, { lantern_id: 'L1', amount: 4, deposited: 4 });
  assert.equal(events(a, 'lantern_lit').length, 0);
  assert.equal(end(a).score, 40);
  const b = run({ scenario: { ...Q, lanterns: [{ id: 'L1', pos: [0, 0, 1.5], deposited: 4 }], player: { carried: 9 } }, inputs: { frames: press(0, 'interact') }, ticks: 5 });
  assert.deepEqual(events(b, 'deposit')[0].data, { lantern_id: 'L1', amount: 6, deposited: 10 });
  assert.equal(events(b, 'lantern_lit').length, 1);
  assert.equal(last(b).player.carried, 3);
  assert.equal(end(b).score, 60 + 100);
});

test('tuong tac: trong 2.0 m, den gan nhat, bang nhau thi id nho hon, chi den chua sang', () => {
  const far = run({ scenario: { ...Q, lanterns: [{ id: 'L1', pos: [0, 0, 2.2] }], player: { carried: 3 } }, inputs: { frames: press(0, 'interact') }, ticks: 3 });
  assert.equal(events(far, 'deposit').length, 0);
  const tie = run({
    scenario: { ...Q, lanterns: [{ id: 'L2', pos: [1.5, 0, 0] }, { id: 'L1', pos: [-1.5, 0, 0] }], player: { carried: 3 } },
    inputs: { frames: press(0, 'interact') }, ticks: 3,
  });
  assert.equal(events(tie, 'deposit')[0].data.lantern_id, 'L1');
  const lit = run({
    scenario: { ...Q, lanterns: [{ id: 'L1', pos: [0.5, 0, 0], lit: true }, { id: 'L2', pos: [1.8, 0, 0] }], player: { carried: 3 } },
    inputs: { frames: press(0, 'interact') }, ticks: 3,
  });
  assert.equal(events(lit, 'deposit')[0].data.lantern_id, 'L2');
});

test('thang: diem = nap + den + floor(giay con lai)*2 + 50*lua; den lit san khong cong diem luc dung', () => {
  const litOthers = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  const r = run({
    scenario: { ...Q, player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 1.5] }, ...litOthers] },
    inputs: { frames: press(0, 'interact') }, ticks: 100,
  });
  assert.equal(r.lines[0].score, 0);
  assert.deepEqual(events(r, 'game_over')[0].data, { result: 'won', reason: 'all_lit' });
  assert.deepEqual(end(r), { type: 'end', ticks: 1, state: 'won', score: 100 + 100 + 299 * 2 + 3 * 50 });
});

test('thang ke ca dung tick het gio; con het gio ma chua du den thi thua dawn', () => {
  const litOthers = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  const sc = { ...Q, time_left_s: 1 / 60, player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 1.5] }, ...litOthers] };
  const won = run({ scenario: sc, inputs: { frames: press(0, 'interact') }, ticks: 10 });
  assert.equal(end(won).state, 'won');
  assert.equal(end(won).score, 100 + 100 + 0 + 150);
  const dawn = run({ scenario: { ...Q, time_left_s: 1 }, ticks: 500 });
  assert.deepEqual(events(dawn, 'game_over')[0].data, { result: 'lost', reason: 'dawn' });
  assert.equal(end(dawn).ticks, 60);
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
