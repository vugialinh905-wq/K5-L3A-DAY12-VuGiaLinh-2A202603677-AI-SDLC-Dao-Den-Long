#!/usr/bin/env node
// Che do headless theo Test Contract v1.1.
// node src/headless.js --seed 1 --night 1|2|3 [--scenario f.json] [--inputs f.json] --ticks N --out o.jsonl [--snapshot-every 10]
import fs from 'node:fs';
import { createGame, step, snapshot, drainEvents, makeInputFeeder, validateInputs, ContractError } from './core.js';

function fail(code, msg) {
  process.stderr.write(msg + '\n');
  process.exit(code);
}

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) fail(1, 'tham so la: ' + k);
    a[k.slice(2)] = argv[++i];
  }
  return a;
}

function readJson(path, what) {
  let txt;
  try { txt = fs.readFileSync(path, 'utf8'); } catch (e) { fail(2, `khong doc duoc ${what}: ${e.message}`); }
  try { return JSON.parse(txt); } catch (e) { fail(2, `${what} khong phai JSON hop le: ${e.message}`); }
}

function intArg(v, name, def) {
  if (v === undefined) { if (def === undefined) fail(1, `thieu --${name}`); return def; }
  if (!/^-?\d+$/.test(v)) fail(1, `--${name} phai la so nguyen`);
  return parseInt(v, 10);
}

const args = parseArgs(process.argv.slice(2));
const seed = intArg(args.seed, 'seed', 1);
const night = intArg(args.night, 'night', 1);
const ticks = intArg(args.ticks, 'ticks');
const every = intArg(args['snapshot-every'], 'snapshot-every', 10);
if (![1, 2, 3].includes(night)) fail(1, '--night phai la 1, 2 hoac 3');
if (ticks < 0) fail(1, '--ticks phai >= 0');
if (every < 1) fail(1, '--snapshot-every phai >= 1');
if (!args.out) fail(1, 'thieu --out');

let scenario = {};
let inputs = { frames: [] };
if (args.scenario) scenario = readJson(args.scenario, 'scenario');
if (args.inputs) inputs = readJson(args.inputs, 'inputs');

let game;
try {
  validateInputs(inputs);
  game = createGame({ seed, night, scenario });
} catch (e) {
  if (e instanceof ContractError) fail(2, 'dau vao sai dinh dang: ' + e.message);
  throw e;
}

const feed = makeInputFeeder(inputs);
const lines = [];
const push = (o) => lines.push(JSON.stringify(o));
push(snapshot(game)); // tick 0: sau khi dung scenario, truoc input
push({ type: 'event', tick: 0, name: 'night_start', data: { night } });

let lastSnap = 0;
for (let k = 0; k < ticks && game.state === 'playing'; k++) {
  step(game, feed(k));
  for (const e of drainEvents(game)) push(e);
  if (game.tick % every === 0) { push(snapshot(game)); lastSnap = game.tick; }
}
if (lastSnap !== game.tick) push(snapshot(game));
push({ type: 'end', ticks: game.tick, state: game.state, score: game.score });

try { fs.writeFileSync(args.out, lines.join('\n') + '\n'); } catch (e) { fail(1, 'khong ghi duoc --out: ' + e.message); }
process.exit(0);
