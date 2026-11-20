// Server tinh toi gian + API bang xep hang. Dung chung cho serve.js (choi) va bench.js (do hieu nang).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { addEntry, makeEntry, sanitizeEntries } from './leaderboard.js';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
};
const STATIC_OK = /^\/(index\.html|src\/|vendor\/|docs\/img\/)/;

export const leaderboardFile = (dataDir) => path.join(dataDir, 'leaderboard.json');

export function loadLeaderboard(dataDir) {
  try { return sanitizeEntries(JSON.parse(fs.readFileSync(leaderboardFile(dataDir), 'utf8'))); } catch { return []; }
}

export function saveLeaderboard(dataDir, entries) {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = leaderboardFile(dataDir), tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ entries }, null, 2));
  fs.renameSync(tmp, file); // ghi nguyen tu: tat giua chung khong lam hong file
}

function readBody(req, limit = 8192) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('Dữ liệu quá lớn')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };

// extra(req, res, url) -> true neu da xu ly (dung cho /__bench)
export function createAppServer({ root, dataDir, extra }) {
  let writing = Promise.resolve(); // tuan tu hoa cac lan ghi bang xep hang
  return http.createServer(async (req, res) => {
    try {
      const url = decodeURIComponent(req.url.split('?')[0]);
      if (extra && (await extra(req, res, url))) return;
      if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
      if (url === '/api/leaderboard') {
        if (req.method === 'GET') { json(res, 200, { entries: loadLeaderboard(dataDir) }); return; }
        if (req.method === 'POST') {
          let body;
          try { body = JSON.parse(await readBody(req)); } catch { json(res, 400, { error: 'JSON không hợp lệ' }); return; }
          let entry;
          try { entry = makeEntry(body ?? {}); } catch (e) { json(res, 400, { error: e.message }); return; }
          writing = writing.then(() => {
            const { entries, rank } = addEntry(loadLeaderboard(dataDir), entry);
            saveLeaderboard(dataDir, entries);
            json(res, 200, { entry, entries, rank });
          }).catch((e) => json(res, 500, { error: e.message }));
          await writing;
          return;
        }
        json(res, 405, { error: 'Method not allowed' });
        return;
      }
      const rel = url === '/' ? '/index.html' : url;
      const file = path.normalize(path.join(root, rel));
      if (!file.startsWith(root) || !STATIC_OK.test(rel)) { res.writeHead(404); res.end('Not found'); return; }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
        res.end(data);
      });
    } catch (e) {
      json(res, 500, { error: e.message });
    }
  });
}
