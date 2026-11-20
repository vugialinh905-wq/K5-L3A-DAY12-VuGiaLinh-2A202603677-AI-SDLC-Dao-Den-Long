#!/usr/bin/env node
// Soak test: chay headless N Dem lien tiep trong cung mot tien trinh (Dem 1 -> 2 -> 3 xoay vong).
// node soak.js --seed 7 --nights 10 --out soak.json
// Dem thu i (i = 1..N) dung seed (seed + i). Input ngau nhien theo seed: moi 30 tick chon lai huong di chuyen;
// moi tick xac suat 5% nhay, 3% luot, 2% toa sang, 10% tuong tac.
import fs from 'node:fs';
import v8 from 'node:v8';
import vm from 'node:vm';
import { createGame, step, mulberry32, TUNING } from './src/core.js';

function fail(msg) { process.stderr.write(msg + '\n'); process.exit(1); }
function arg(name, def) {
  const i = process.argv.indexOf(name);
  if (i < 0) return def;
  const v = process.argv[i + 1];
  if (v === undefined || v.startsWith('--')) fail(`Thiếu giá trị cho ${name}`);
  return v;
}
const int = (name, def) => {
  const v = arg(name, undefined);
  if (v === undefined) return def;
  if (!/^-?\d+$/.test(v)) fail(`${name} phải là số nguyên`);
  return parseInt(v, 10);
};

const seed = int('--seed', 7);
const nights = int('--nights', 10);
const out = arg('--out', 'soak.json');
if (nights < 1) fail('--nights phải ≥ 1');

// Ep GC truoc khi do RSS de so lieu on dinh (khong anh huong luat choi)
v8.setFlagsFromString('--expose-gc');
const gc = vm.runInNewContext('gc');
const rssMb = () => { gc(); return process.memoryUsage().rss / 1048576; };
const heapMb = () => { gc(); return process.memoryUsage().heapUsed / 1048576; };
const r1 = (n) => Math.round(n * 10) / 10;

const NIGHT_S = { 1: TUNING.night1_duration_s, 2: TUNING.night2_duration_s, 3: TUNING.night3_duration_s };
const t0 = process.hrtime.bigint();
let crashes = 0;
const results = [];
let memStart = null, heapStart = null;
let game = null;
const WARMUP_TICKS = 9000; // moi Dem (1, 2, 3) chay 3000 tick

// Lam nong (JIT) luc tai Dem dau: RSS cua Node tang ~9 MB (bo bien dich, arena) o lan chay dau tien du heap JS khong doi.
// Chay mot van bo di cho ca 3 ban do (seed rieng, khong anh huong ket qua) roi moi do mem_start.
function warmUp() {
  const rng = mulberry32(12345);
  const inp = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  for (const night of [1, 2, 3]) {
    const g = createGame({ seed: 1, night, scenario: { player: { carried: 10, flames: 99 }, random_drifters: true } });
    for (let k = 0; k < WARMUP_TICKS / 3 && g.state === 'playing'; k++) {
      if (k % 30 === 0) { const a = rng() * Math.PI * 2; inp.move = [Math.cos(a), Math.sin(a)]; }
      inp.jump = rng() < 0.05; inp.dash = rng() < 0.03; inp.pulse = rng() < 0.02; inp.interact = rng() < 0.1;
      step(g, inp);
      g.events.length = 0;
    }
  }
}

function runNight(i) {
  const night = ((i - 1) % 3) + 1;
  const nightSeed = seed + i;
  if (memStart === null) warmUp();
  game = createGame({ seed: nightSeed, night });
  if (memStart === null) { memStart = rssMb(); heapStart = heapMb(); } // sau khi tai (va lam nong) xong Dem dau tien
  const rng = mulberry32(nightSeed ^ 0x9e3779b9); // input ngau nhien rieng, khong dung rng cua game
  const maxTicks = NIGHT_S[night] * 60 + 1;
  let move = [0, 0];
  const input = { move, cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  for (let k = 0; k < maxTicks && game.state === 'playing'; k++) {
    if (k % 30 === 0) { const a = rng() * Math.PI * 2; input.move = [Math.cos(a), Math.sin(a)]; }
    input.jump = rng() < 0.05;
    input.dash = rng() < 0.03;
    input.pulse = rng() < 0.02;
    input.interact = rng() < 0.1;
    step(game, input);
    game.events.length = 0; // khong tich su kien (nhu ban web xu ly xong la bo)
  }
  return game.state === 'won' ? 'won' : 'lost';
}

for (let i = 1; i <= nights; i++) {
  try {
    results.push(runNight(i));
  } catch (e) {
    crashes += 1;
    results.push('crash');
    process.stderr.write(`Đêm ${i} bị lỗi: ${e.stack || e}\n`);
  }
}
// Reset Dem cuoi: bo tham chieu va dung lai Dem moi, roi do bo nho
game = null;
game = createGame({ seed: seed + nights, night: ((nights - 1) % 3) + 1 });
const memEnd = rssMb();
const heapEnd = heapMb();
const duration = Number(process.hrtime.bigint() - t0) / 1e9;

const report = { nights, crashes, results, mem_start_mb: r1(memStart ?? memEnd), mem_end_mb: r1(memEnd), duration_s: r1(duration),
  // so do them de doc: heap JS (khong ro ri neu gan nhu phang) va so tick lam nong
  heap_start_mb: r1(heapStart ?? heapEnd), heap_end_mb: r1(heapEnd), warmup_ticks: WARMUP_TICKS };
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify(report) + '\n');
process.exit(0); // exit 0 ke ca khi co crash: ket qua nam trong crashes
