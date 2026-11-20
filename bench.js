#!/usr/bin/env node
// Benchmark: node bench.js --seed 42 --duration 30 --out bench.json
// Mo Chrome/Edge (khong can cai them gi), tai canh benchmark chuan (index.html?bench=1) o 1280x720, tat vsync,
// do duration giay sau 3 giay khoi dong roi ghi bench.json va thoat voi ma 0.
//   --manual         khong mo trinh duyet; in dia chi de tu mo trong trinh duyet cua ban
//   --browser <duong dan>  hoac bien moi truong BENCH_BROWSER: dung trinh duyet Chromium khac
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawn, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createAppServer } from './src/server.js';
import { computeStats } from './src/benchstats.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
function arg(name, def) { const i = argv.indexOf(name); return i < 0 ? def : argv[i + 1]; }
function fail(msg, code = 1) { process.stderr.write(msg + '\n'); process.exit(code); }

const seed = Number(arg('--seed', 42));
const duration = Number(arg('--duration', 30));
const out = arg('--out', 'bench.json');
const manual = argv.includes('--manual');
if (!Number.isInteger(seed)) fail('--seed phải là số nguyên');
if (!(duration > 0)) fail('--duration phải > 0 (giây)');
const WARMUP_S = 3;
const startedAtMs = performance.timeOrigin; // luc tien trinh bat dau (epoch ms)

function findBrowser() {
  const env = arg('--browser', process.env.BENCH_BROWSER);
  if (env) return fs.existsSync(env) ? env : null;
  const pf = process.env['ProgramFiles'], pf86 = process.env['ProgramFiles(x86)'], local = process.env.LOCALAPPDATA;
  const list = process.platform === 'win32'
    ? [pf && `${pf}\\Google\\Chrome\\Application\\chrome.exe`, pf86 && `${pf86}\\Google\\Chrome\\Application\\chrome.exe`, local && `${local}\\Google\\Chrome\\Application\\chrome.exe`,
      pf86 && `${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`, pf && `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`]
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Chromium.app/Contents/MacOS/Chromium']
      : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge', '/snap/bin/chromium'];
  return list.filter(Boolean).find((p) => fs.existsSync(p)) ?? null;
}

// ----- do RSS cua cac tien trinh trinh duyet (nhan dien bang thu muc user-data-dir rieng)
function sampleMemMb(token) {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      const ps = `$t='${token}'; (Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*$t*" } | Measure-Object -Property WorkingSetSize -Sum).Sum`;
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { timeout: 8000 }, (e, so) => {
        const v = Number(String(so).trim());
        resolve(!e && Number.isFinite(v) && v > 0 ? v / 1048576 : null);
      });
    } else {
      execFile('ps', ['-eo', 'rss=,args='], { timeout: 8000, maxBuffer: 1 << 24 }, (e, so) => {
        if (e) return resolve(null);
        let kb = 0;
        for (const line of String(so).split('\n')) if (line.includes(token)) kb += Number(line.trim().split(/\s+/)[0]) || 0;
        resolve(kb > 0 ? kb / 1024 : null);
      });
    }
  });
}

let browser = null, tmpDir = null, memTimer = null, peakMem = null, finished = false;
function cleanup() {
  clearInterval(memTimer);
  try {
    if (browser && !browser.killed) {
      if (process.platform === 'win32') spawn('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore' });
      else browser.kill('SIGKILL');
    }
  } catch { /* da thoat */ }
  if (tmpDir) setTimeout(() => { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* bo qua */ } }, 1500);
}

const result = await new Promise((resolve) => {
  const server = createAppServer({
    root, dataDir: path.join(os.tmpdir(), 'ddl-bench-data'),
    async extra(req, res, url) {
      if (url !== '/__bench' || req.method !== 'POST') return false;
      const chunks = [];
      for await (const c of req) chunks.push(c);
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { resolve(null); }
      return true;
    },
  });
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    const url = `http://127.0.0.1:${port}/index.html?bench=1&seed=${seed}&duration=${duration}`;
    if (manual) {
      console.log('Mở địa chỉ này trong Chrome/Edge (cửa sổ 1280×720, nên tắt vsync):\n  ' + url);
    } else {
      const exe = findBrowser();
      if (!exe) fail('Không tìm thấy Chrome/Edge/Chromium. Đặt BENCH_BROWSER=<đường dẫn> hoặc chạy với --manual.');
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-bench-'));
      const flags = [`--user-data-dir=${tmpDir}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync',
        '--window-size=1280,720', '--window-position=0,0', '--disable-frame-rate-limit', '--disable-gpu-vsync',
        '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', `--app=${url}`];
      console.log(`Chạy benchmark: ${path.basename(exe)} · ${duration}s đo sau ${WARMUP_S}s khởi động…`);
      browser = spawn(exe, flags, { stdio: 'ignore', detached: false });
      browser.on('error', (e) => fail('Không mở được trình duyệt: ' + e.message));
      const token = path.basename(tmpDir);
      memTimer = setInterval(async () => {
        const m = await sampleMemMb(token);
        if (m !== null && (peakMem === null || m > peakMem)) peakMem = m;
      }, 2500);
    }
    setTimeout(() => { if (!finished) fail(`Hết thời gian chờ kết quả benchmark (${Math.round(duration + 90)} s).`); }, (duration + 90) * 1000).unref();
  });
});
finished = true;
cleanup();
if (!result || !Array.isArray(result.dts) || result.dts.length === 0) fail('Trang benchmark không trả về số đo hợp lệ.');

const stats = computeStats(result.dts);
const report = {
  contract_version: '1.3',
  avg_fps: stats.avg_fps,
  p1_low_fps: stats.p1_low_fps,
  frame_ms_p95: stats.frame_ms_p95,
  frames: stats.frames,
  load_ms: Math.max(0, Math.round(result.first_frame_epoch_ms - startedAtMs)),
  peak_mem_mb: peakMem === null ? null : Math.round(peakMem),
  vsync_off: !manual, // khi tu mo (--manual) khong the dam bao tat vsync
  renderer: result.renderer,
  os: `${os.type()} ${os.release()} ${os.arch()}`,
  // thong tin them de doc duoc so do
  seed, duration_s: duration, warmup_s: WARMUP_S, window: result.inner, shades: 200, motes: 100,
  peak_mem_note: peakMem === null
    ? 'Không đo được bộ nhớ tiến trình trình duyệt.'
    : 'Tổng working set / RSS của mọi tiến trình trình duyệt khởi chạy bởi bench.js (có tính trùng bộ nhớ dùng chung), lấy mẫu mỗi 2.5 s, giá trị lớn nhất.',
};
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
process.exit(0);
