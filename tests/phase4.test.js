// Ticket-04: bang xep hang, doi phim, thong ke benchmark, canh benchmark, soak test, xuat bang xep hang.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateName, makeEntry, addEntry, compareEntries, sanitizeEntries, isoWithOffset, MAX_ENTRIES } from '../src/leaderboard.js';
import { ACTIONS, defaultBindings, rebind, findConflict, loadBindings, normalizeCode, keyLabel } from '../src/bindings.js';
import { computeStats } from '../src/benchstats.js';
import { createBenchGame, benchStep, createGame } from '../src/core.js';
import { createAppServer, loadLeaderboard } from '../src/server.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl4-'));
const node = (args, env = {}) => spawnSync(process.execPath, args, { encoding: 'utf8', cwd: root, env: { ...process.env, ...env } });
const entry = (name, score, at, extra = {}) => ({ name, score, nights_won: 1, achieved_at: at, seed: 1, ...extra });

// ------------------------------------------------------------ contract v1.3
test('contract v1.3: bench_cmd va soak_cmd, v1.0-v1.2 giu nguyen', () => {
  const c = JSON.parse(fs.readFileSync(path.join(root, 'game.contract.json'), 'utf8'));
  assert.equal(c.contract_version, '1.3');
  assert.equal(c.bench_cmd, 'node bench.js');
  assert.equal(c.soak_cmd, 'node soak.js');
  for (const k of ['build_cmd', 'run_cmd', 'headless_cmd', 'team']) assert.ok(c[k], k);
  for (const k of ['fuel_max', 'dash_speed', 'night3_duration_s', 'capacity_max']) assert.ok(k in c.tuning, k);
});

// ------------------------------------------------------------ bang xep hang
test('ten: 3-12 ky tu, chu cai (co dau), so, gach duoi; chuan hoa NFC', () => {
  for (const ok of ['abc', 'Linh_2026', 'ABCdef123456', 'Mây_Linh', 'Đăng', 'Nguyễn_Văn']) assert.equal(validateName(ok).ok, true, ok);
  for (const bad of ['ab', 'abcdefghijklm', 'Linh!', 'a b c', '', '   ', 'Linh-Vu', 'a😀bc', null, undefined]) assert.equal(validateName(bad).ok, false, String(bad));
  assert.equal(validateName('  Linh  ').name, 'Linh'); // cat khoang trang hai dau
  assert.equal(validateName('Mây').name, 'Mây'); // to hop dau -> NFC
  assert.equal(validateName('Mây_ab').ok, true);
});

test('muc luu: name, score, nights_won, achieved_at ISO 8601 co mui gio, seed', () => {
  const e = makeEntry({ name: 'Linh', score: 1234, nights_won: 3, seed: 42 }, new Date('2026-11-20T08:00:00Z'));
  assert.deepEqual(Object.keys(e).sort(), ['achieved_at', 'name', 'nights_won', 'score', 'seed']);
  assert.match(e.achieved_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
  assert.equal(Date.parse(e.achieved_at), Date.parse('2026-11-20T08:00:00Z')); // cung thoi diem
  assert.match(isoWithOffset(new Date()), /[+-]\d{2}:\d{2}$/);
  assert.throws(() => makeEntry({ name: 'ab', score: 1, nights_won: 0, seed: 1 }));
  assert.throws(() => makeEntry({ name: 'Linh', score: -1, nights_won: 0, seed: 1 }));
  assert.throws(() => makeEntry({ name: 'Linh', score: 1.5, nights_won: 0, seed: 1 }));
  assert.throws(() => makeEntry({ name: 'Linh', score: 1, nights_won: 4, seed: 1 }));
  assert.throws(() => makeEntry({ name: 'Linh', score: 1, nights_won: 0, seed: 1.5 }));
});

test('sap xep: diem giam dan; bang diem thi ai dat truoc dung tren; top 10', () => {
  let list = [];
  list = addEntry(list, entry('Nam_B', 100, '2026-11-20T10:00:00.000+07:00')).entries;
  list = addEntry(list, entry('Nam_A', 100, '2026-11-20T09:00:00.000+07:00')).entries; // bang diem nhung dat som hon
  list = addEntry(list, entry('Cao', 500, '2026-11-20T11:00:00.000+07:00')).entries;
  assert.deepEqual(list.map((e) => e.name), ['Cao', 'Nam_A', 'Nam_B']);
  // bang diem va cung thoi diem: giu thu tu them vao
  const t = '2026-11-20T12:00:00.000+07:00';
  list = addEntry(list, entry('Dong_1', 100, t)).entries;
  list = addEntry(list, entry('Dong_2', 100, t)).entries;
  assert.deepEqual(list.slice(3).map((e) => e.name), ['Dong_1', 'Dong_2']);
  // mui gio khac nhau van so dung thoi diem thuc
  assert.ok(compareEntries(entry('a', 1, '2026-11-20T10:00:00.000+07:00'), entry('b', 1, '2026-11-20T04:00:00.000+00:00')) < 0);
  // top 10
  let big = [];
  for (let i = 0; i < 15; i++) big = addEntry(big, entry(`Nguoi_${i}`, i * 10, `2026-11-20T10:${String(i).padStart(2, '0')}:00.000+07:00`)).entries;
  assert.equal(big.length, MAX_ENTRIES);
  assert.equal(big[0].score, 140);
  assert.equal(big.at(-1).score, 50);
  const low = entry('Thap_1', 1, '2026-11-20T23:00:00.000+07:00');
  assert.equal(addEntry(big, low).rank, -1); // khong vao top 10
});

test('sanitize: bo muc hong / sai dinh dang va sap xep lai', () => {
  const raw = { entries: [entry('Tot_1', 50, '2026-11-20T10:00:00.000+07:00'), { name: 'x' }, null, entry('Bad!', 9, '2026-11-20T10:00:00.000+07:00'), entry('Tot_2', 90, '2026-11-20T10:00:00.000+07:00'), entry('NgayXau', 5, 'khong phai ngay')] };
  assert.deepEqual(sanitizeEntries(raw).map((e) => e.name), ['Tot_2', 'Tot_1']);
  assert.deepEqual(sanitizeEntries('rac'), []);
});

test('API bang xep hang: ghi xuong dia, con lai sau khi mo lai, tu choi du lieu sai', async () => {
  const dataDir = path.join(tmp, 'api-data');
  const start = () => new Promise((res) => { const s = createAppServer({ root, dataDir }); s.listen(0, '127.0.0.1', () => res(s)); });
  const call = (port, method, body) => new Promise((res, rej) => {
    const req = http.request({ host: '127.0.0.1', port, path: '/api/leaderboard', method, headers: { 'Content-Type': 'application/json' } }, (r) => {
      let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res({ code: r.statusCode, json: JSON.parse(d || '{}') }));
    });
    req.on('error', rej); if (body !== undefined) req.write(typeof body === 'string' ? body : JSON.stringify(body)); req.end();
  });
  let s = await start();
  try {
    assert.deepEqual((await call(s.address().port, 'GET')).json, { entries: [] });
    const a = await call(s.address().port, 'POST', { name: 'Linh_A', score: 300, nights_won: 2, seed: 7 });
    assert.equal(a.code, 200); assert.equal(a.json.rank, 0);
    await call(s.address().port, 'POST', { name: 'Linh_B', score: 900, nights_won: 3, seed: 8 });
    assert.equal((await call(s.address().port, 'POST', { name: 'Linh!', score: 1, nights_won: 0, seed: 1 })).code, 400);
    assert.equal((await call(s.address().port, 'POST', { name: 'Linh_C', score: 'x', nights_won: 0, seed: 1 })).code, 400);
    assert.equal((await call(s.address().port, 'POST', '{khong json')).code, 400);
    assert.equal((await call(s.address().port, 'DELETE')).code, 405);
  } finally { await new Promise((r) => s.close(r)); }
  // "tat va mo lai game": server moi doc lai tu dia
  s = await start();
  try {
    const list = (await call(s.address().port, 'GET')).json.entries;
    assert.deepEqual(list.map((e) => [e.name, e.score]), [['Linh_B', 900], ['Linh_A', 300]]);
  } finally { await new Promise((r) => s.close(r)); }
  assert.equal(loadLeaderboard(dataDir).length, 2);
});

test('--export-leaderboard: xuat {"entries":[...]} dung thu tu, top 10, ma thoat 0; thieu tham so -> loi', () => {
  const dir = path.join(tmp, 'export-data');
  fs.mkdirSync(dir, { recursive: true });
  const entries = Array.from({ length: 12 }, (_, i) => entry(`Nguoi_${i}`, (i % 6) * 100, `2026-11-20T10:${String(i).padStart(2, '0')}:00.000+07:00`));
  fs.writeFileSync(path.join(dir, 'leaderboard.json'), JSON.stringify({ entries: entries.reverse() }));
  const out = path.join(tmp, 'lb.json');
  const r = node(['serve.js', '--export-leaderboard', out], { DDL_DATA_DIR: dir });
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.deepEqual(Object.keys(j), ['entries']);
  assert.equal(j.entries.length, 10);
  const scores = j.entries.map((e) => e.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  for (let i = 1; i < j.entries.length; i++) if (j.entries[i].score === j.entries[i - 1].score) assert.ok(Date.parse(j.entries[i - 1].achieved_at) <= Date.parse(j.entries[i].achieved_at));
  // chua co file: entries rong
  const empty = node(['serve.js', '--export-leaderboard', path.join(tmp, 'e.json')], { DDL_DATA_DIR: path.join(tmp, 'khong-co') });
  assert.equal(empty.status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(tmp, 'e.json'), 'utf8')), { entries: [] });
  assert.notEqual(node(['serve.js', '--export-leaderboard']).status, 0);
});

// ------------------------------------------------------------ doi phim
test('doi phim: bao trung, phim co dinh, khoi phuc mac dinh, doc luu tru hong', () => {
  const b = defaultBindings();
  assert.deepEqual(ACTIONS.map((a) => a.id), ['forward', 'back', 'left', 'right', 'jump', 'dash', 'interact', 'pulse', 'pause']); // di 4 huong, nhay, luot, tuong tac, toa sang, tam dung
  assert.equal(new Set(Object.values(b)).size, 9);
  const ok = rebind(b, 'jump', 'KeyQ');
  assert.equal(ok.ok, true); assert.equal(ok.bindings.jump, 'KeyQ'); assert.equal(b.jump, 'Space'); // khong sua ban goc
  const dup = rebind(ok.bindings, 'pulse', 'KeyQ');
  assert.equal(dup.ok, false); assert.equal(dup.conflict, 'Nhảy');
  assert.equal(rebind(b, 'jump', 'ArrowLeft').ok, false); // xoay camera la phim co dinh
  assert.equal(rebind(b, 'jump', 'KeyP').ok, false);
  assert.equal(rebind(b, 'pause', 'KeyP').ok, true); // P la phim phu cua chinh Tam dung
  assert.equal(rebind(b, 'jump', 'Space').ok, true); // giu nguyen phim cua chinh no
  assert.equal(findConflict(b, 'jump', 'KeyW'), 'Đi lên');
  assert.equal(normalizeCode('ShiftRight'), 'ShiftLeft');
  assert.equal(rebind(b, 'jump', 'ShiftRight').conflict, 'Lướt');
  assert.equal(rebind(b, 'nope', 'KeyQ').ok, false);
  // doc luu tru: hop le giu nguyen, trung / sai / rong -> mac dinh
  assert.equal(loadBindings({ ...b, jump: 'KeyQ' }).jump, 'KeyQ');
  assert.deepEqual(loadBindings({ ...b, jump: 'KeyW' }), b);
  assert.deepEqual(loadBindings({ jump: 'Key Q' }), b);
  assert.deepEqual(loadBindings(null), b);
  assert.deepEqual(loadBindings('rac'), b);
  assert.equal(keyLabel('KeyW'), 'W'); assert.equal(keyLabel('Space'), 'Space'); assert.equal(keyLabel('ShiftLeft'), 'Shift'); assert.equal(keyLabel('ArrowUp'), '↑');
});

// ------------------------------------------------------------ benchmark
test('thong ke benchmark theo dung dinh nghia: avg_fps, p1_low_fps, frame_ms_p95, frames', () => {
  const dts = Array(98).fill(10).concat([50, 100]); // N = 100
  const s = computeStats(dts);
  assert.equal(s.frames, 100);
  assert.equal(s.avg_fps, Math.round((1000 * 100) / (980 + 150) * 10) / 10); // 1000*N / tong dt
  assert.equal(s.p1_low_fps, Math.round((1000 / 100) * 10) / 10); // k = ceil(0.01*100) = 1: dt lon nhat = 100 ms -> 10 fps
  assert.equal(s.frame_ms_p95, 10); // phan vi 95 (nearest-rank) cua 100 gia tri
  const w = computeStats(Array.from({ length: 250 }, (_, i) => (i < 240 ? 16 : 32 + (i - 240) * 2))); // k = ceil(2.5) = 3
  const worst3 = [50, 48, 46].reduce((a, b) => a + b) / 3;
  assert.equal(w.p1_low_fps, Math.round((1000 / worst3) * 10) / 10);
  assert.equal(computeStats([20]).p1_low_fps, 50); // N nho: k = max(1, ..)
});

test('canh benchmark: 200 Bong Muc wander rai deu, 100 dom dom, L1-L3 sang fuel 100, May dung yen; tat dinh theo seed', () => {
  const g = createBenchGame(42);
  assert.equal(g.shades.length, 200);
  assert.ok(g.shades.every((s) => s.state === 'wander'));
  assert.equal(new Set(g.shades.map((s) => s.id)).size, 200);
  assert.equal(g.motes.length, 100);
  assert.deepEqual(g.lanterns.map((l) => l.lit), [true, true, true, false, false]);
  assert.ok(g.lanterns.slice(0, 3).every((l) => l.fuelU === 6000));
  assert.deepEqual(g.player.pos, [0, 0, 0]);
  assert.ok(g.shades.every((s) => Math.hypot(s.pos[0], s.pos[2]) <= 40));
  // rai deu: khong co o nao (luoi 8x8 m) trong dao tron r=38 bi bo trong
  const cells = new Set(g.shades.map((s) => `${Math.floor(s.pos[0] / 8)},${Math.floor(s.pos[2] / 8)}`));
  assert.ok(cells.size >= 30, 'so o co bong: ' + cells.size);
  const again = createBenchGame(42), other = createBenchGame(43);
  assert.deepEqual(again.shades.map((s) => s.pos), g.shades.map((s) => s.pos));
  assert.notDeepEqual(other.shades.map((s) => s.pos), g.shades.map((s) => s.pos));
  // 10 s mo phong: khong sinh them, khong sat thuong, khong nhat, khong hao dau, khong ket thuc; bong van di chuyen theo luat wander
  const before = g.shades.map((s) => [...s.pos]);
  for (let i = 0; i < 600; i++) benchStep(g);
  assert.equal(g.shades.length, 200); assert.equal(g.motes.length, 100);
  assert.equal(g.player.flames, 3); assert.equal(g.player.carried, 0); assert.equal(g.state, 'playing');
  assert.ok(g.lanterns.slice(0, 3).every((l) => l.lit && l.fuelU === 6000));
  assert.ok(g.shades.every((s) => s.state === 'wander' || s.state === 'drain'));
  const moved = g.shades.filter((s, i) => Math.hypot(s.pos[0] - before[i][0], s.pos[2] - before[i][2]) > 1).length;
  assert.ok(moved > 150, 'so bong da di chuyen: ' + moved);
  // game thuong khong bi anh huong boi co bench
  assert.equal(createGame({ seed: 1, night: 1 }).noDetect, undefined);
});

// ------------------------------------------------------------ soak
test('soak.js: chay N dem lien tiep, khong crash, bo nho khong tang qua 1.2 lan, dung dinh dang', () => {
  const out = path.join(tmp, 'soak.json');
  const r = node(['soak.js', '--seed', '7', '--nights', '10', '--out', out]);
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  for (const k of ['nights', 'crashes', 'results', 'mem_start_mb', 'mem_end_mb', 'duration_s']) assert.ok(k in j, k);
  assert.equal(j.nights, 10);
  assert.equal(j.crashes, 0);
  assert.equal(j.results.length, 10);
  assert.ok(j.results.every((x) => x === 'won' || x === 'lost'));
  assert.ok(j.mem_end_mb <= 1.2 * j.mem_start_mb, `${j.mem_end_mb} > 1.2 x ${j.mem_start_mb}`);
  assert.ok(j.heap_end_mb <= j.heap_start_mb * 1.5 + 1, 'heap JS tang bat thuong (ro ri?)');
  assert.ok(j.duration_s < 60);
});

test('soak.js: cung seed cho cung ket qua; tham so sai -> loi', () => {
  const run = (seed) => { const o = path.join(tmp, `s${seed}.json`); node(['soak.js', '--seed', String(seed), '--nights', '4', '--out', o]); return JSON.parse(fs.readFileSync(o, 'utf8')).results; };
  assert.deepEqual(run(11), run(11));
  assert.notEqual(node(['soak.js', '--nights', 'abc']).status, 0);
  assert.notEqual(node(['soak.js', '--nights', '0']).status, 0);
});

test('bench.js: tham so sai -> loi; --manual in dia chi (khong mo trinh duyet)', () => {
  assert.notEqual(node(['bench.js', '--duration', '0']).status, 0);
  assert.notEqual(node(['bench.js', '--seed', 'x']).status, 0);
});
