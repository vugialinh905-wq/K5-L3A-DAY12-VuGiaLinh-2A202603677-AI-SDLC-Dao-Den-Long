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

// Chay headless, tra ve { code, stderr, lines[] }
function run({ seed = 1, scenario, inputs, ticks = 60, every = 10, extra = [] }) {
  const out = path.join(tmp, `o${n++}.jsonl`);
  const args = [path.join(root, 'src/headless.js'), '--seed', String(seed), '--night', '1', '--ticks', String(ticks), '--out', out, '--snapshot-every', String(every), ...extra];
  if (scenario !== undefined) args.push('--scenario', write(scenario));
  if (inputs !== undefined) args.push('--inputs', write(inputs));
  const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
  const lines = fs.existsSync(out) ? fs.readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
  return { code: r.status, stderr: r.stderr, lines, raw: fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '' };
}
const events = (r, name) => r.lines.filter((l) => l.type === 'event' && l.name === name);
const end = (r) => r.lines.at(-1);
const quiet = { random_motes: false, random_shades: false };

test('game.contract.json khop voi tuning that cua game', () => {
  const c = JSON.parse(fs.readFileSync(path.join(root, 'game.contract.json'), 'utf8'));
  assert.equal(c.contract_version, '1.0');
  assert.deepEqual(c.tuning, JSON.parse(JSON.stringify(TUNING)));
});

test('tick 0 la snapshot sau khi dung scenario, dung dinh dang, dong end o cuoi', () => {
  const r = run({ scenario: { ...quiet, motes: [], shades: [] }, ticks: 30 });
  assert.equal(r.code, 0);
  assert.equal(r.lines[0].type, 'snapshot');
  assert.equal(r.lines[0].tick, 0);
  assert.equal(r.lines[0].lanterns.length, 5);
  assert.deepEqual(r.lines[0].player.pos, [0, 0, 0]);
  assert.equal(r.lines[0].time_left_s, 300);
  assert.deepEqual(end(r), { type: 'end', ticks: 30, state: 'playing', score: 0 });
  assert.deepEqual(r.lines.filter((l) => l.type === 'snapshot').map((l) => l.tick), [0, 10, 20, 30]);
});

test('nhat dom dom: di ve +Z, nhat khi trong pickup_radius, +per_mote', () => {
  const r = run({
    scenario: { ...quiet, motes: [[0, 0, 5]], shades: [] },
    inputs: { frames: [{ tick: 0, move: [0, 1] }] }, ticks: 60,
  });
  const e = events(r, 'mote_picked');
  assert.equal(e.length, 1);
  assert.deepEqual(e[0].data, { carried: 1 });
  assert.equal(e[0].tick, 38); // 5 - 1.2 = 3.8m, 6 m/s => 38 buoc (3.8/0.1 = 38)
  assert.equal(end(r).score, 10);
});

test('nap anh sang va thap den: deposit + lantern_lit, +per_lantern', () => {
  const r = run({
    scenario: { ...quiet, motes: [], shades: [], player: { carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, 2] }] },
    inputs: { frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }] }, ticks: 5,
  });
  assert.deepEqual(events(r, 'deposit')[0].data, { lantern_id: 'L1', amount: 5, deposited: 5 });
  assert.equal(events(r, 'deposit')[0].tick, 1);
  assert.equal(events(r, 'lantern_lit').length, 1);
  assert.equal(end(r).score, 100);
  assert.equal(r.lines.at(-2).lanterns[0].lit, true);
});

test('thang: thap den cuoi cung -> won/all_lit, cong diem thoi gian + lua; den dat san lit khong cong diem luc dung', () => {
  const lit = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  const r = run({
    scenario: { ...quiet, motes: [], shades: [], player: { carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, 2] }, ...lit] },
    inputs: { frames: [{ tick: 0, interact: true }] }, ticks: 100,
  });
  assert.equal(r.lines[0].score, 0);
  assert.deepEqual(events(r, 'game_over')[0].data, { result: 'won', reason: 'all_lit' });
  // 100 (den) + floor(300 - 1/60) = 299 + 3 lua * 50
  assert.deepEqual(end(r), { type: 'end', ticks: 1, state: 'won', score: 100 + 299 + 150 });
});

test('toa sang: lam choang Bong Muc trong ban kinh, day lui, +per_stun, ton pulse_cost', () => {
  const r = run({
    scenario: { ...quiet, motes: [], shades: [{ id: 'S1', pos: [3, 0, 0] }, { id: 'S2', pos: [20, 0, 0] }], player: { carried: 2 } },
    inputs: { frames: [{ tick: 0, pulse: true }] }, ticks: 1,
  });
  assert.deepEqual(events(r, 'pulse')[0].data, { stunned_ids: ['S1'] });
  const s = r.lines.at(-2);
  assert.equal(s.player.carried, 1);
  assert.equal(s.shades[0].state, 'stunned');
  assert.equal(s.shades[0].pos[0], 6); // 3 + pulse_push_m 3
  assert.equal(s.shades[1].state, 'chase');
  assert.equal(end(r).score, 20);
});

test('toa sang khong du dom dom thi khong lam gi', () => {
  const r = run({ scenario: { ...quiet, motes: [], shades: [{ pos: [3, 0, 0] }] }, inputs: { frames: [{ tick: 0, pulse: true }] }, ticks: 1 });
  assert.equal(events(r, 'pulse').length, 0);
});

test('bi Bong Muc cham: mat 1 lua, rot dom dom, bat tu 1.5s', () => {
  const r = run({
    scenario: { ...quiet, motes: [], shades: [{ pos: [0.5, 0, 0] }], player: { carried: 4 } }, ticks: 120,
  });
  const hits = events(r, 'player_hit');
  assert.equal(hits[0].tick, 1);
  assert.deepEqual(hits[0].data, { by: 'shade', flames: 2, dropped: 2 });
  assert.equal(hits[1].tick, 91); // 90 tick sau (invuln_s = 1.5)
});

test('het lua -> lost/no_flames', () => {
  const r = run({ scenario: { ...quiet, motes: [], shades: [{ pos: [0.5, 0, 0] }], player: { flames: 1 } }, ticks: 50 });
  assert.deepEqual(events(r, 'game_over')[0].data, { result: 'lost', reason: 'no_flames' });
  assert.equal(end(r).state, 'lost');
  assert.equal(end(r).ticks, 1);
});

test('het gio -> lost/dawn va dung dung tick 60', () => {
  const r = run({ scenario: { ...quiet, motes: [], shades: [], time_left_s: 1 }, ticks: 500 });
  assert.deepEqual(events(r, 'game_over')[0].data, { result: 'lost', reason: 'dawn' });
  assert.equal(end(r).ticks, 60);
});

test('Bong Muc khong vao safe_radius quanh den da thap', () => {
  const r = run({
    scenario: { ...quiet, motes: [], shades: [{ pos: [20, 0, 0] }], lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }], player: { pos: [0, 0, 1] } },
    ticks: 600, every: 600,
  });
  const s = r.lines.at(-2).shades[0];
  assert.ok(Math.hypot(s.pos[0], s.pos[2]) >= TUNING.safe_radius - 1e-3);
});

test('tat dinh: cung seed/scenario/inputs -> output giong het; khac seed -> khac', () => {
  const inputs = { frames: [{ tick: 0, move: [1, 1] }, { tick: 300, move: [-1, 0.3], cam_yaw_deg: 45 }] };
  const a = run({ seed: 7, inputs, ticks: 1500 });
  const b = run({ seed: 7, inputs, ticks: 1500 });
  const c = run({ seed: 8, inputs, ticks: 1500 });
  assert.equal(a.raw, b.raw);
  assert.notEqual(a.raw, c.raw);
  assert.ok(events(a, 'shade_spawned').length >= 1);
});

test('huong di xoay theo cam_yaw_deg (90 do: move [0,1] di theo +X)', () => {
  const r = run({ scenario: { ...quiet, motes: [], shades: [] }, inputs: { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }] }, ticks: 10 });
  const p = r.lines.at(-2).player.pos;
  assert.ok(Math.abs(p[0] - 1) < 1e-3 && Math.abs(p[2]) < 1e-3);
});

test('vector di chuyen dai hon 1 duoc chuan hoa', () => {
  const r = run({ scenario: { ...quiet, motes: [], shades: [] }, inputs: { frames: [{ tick: 0, move: [1, 1] }] }, ticks: 60 });
  const p = r.lines.at(-2).player.pos;
  assert.ok(Math.abs(Math.hypot(p[0], p[2]) - 6) < 1e-2);
});

test('file sai dinh dang -> exit 2', () => {
  assert.equal(run({ scenario: '{khong phai json' }).code, 2);
  assert.equal(run({ inputs: { frames: [{ tick: 5 }, { tick: 5 }] } }).code, 2);
  assert.equal(run({ inputs: { frames: [{ tick: 0, move: [2, 0] }] } }).code, 2);
  assert.equal(run({ scenario: { player: { pos: [0, 0] } } }).code, 2);
  assert.equal(run({ extra: ['--scenario', path.join(tmp, 'khong-ton-tai.json')] }).code, 2);
});

test('thieu tham so bat buoc -> exit khac 0 va co thong bao stderr', () => {
  const r = spawnSync(process.execPath, [path.join(root, 'src/headless.js'), '--seed', '1'], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.ok(r.stderr.length > 0);
});
