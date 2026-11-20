// Choi ban web:  node serve.js   ->  http://localhost:8080
// Xuat bang xep hang:  node serve.js --export-leaderboard out.json   ({"entries":[...]}, top 10 dung thu tu)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppServer, loadLeaderboard } from './src/server.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DDL_DATA_DIR ? path.resolve(process.env.DDL_DATA_DIR) : path.join(root, 'data');
const args = process.argv.slice(2);
const argOf = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

if (args.includes('--export-leaderboard')) {
  const out = argOf('--export-leaderboard');
  if (!out || out.startsWith('--')) { process.stderr.write('Thiếu đường dẫn: --export-leaderboard <file.json>\n'); process.exit(1); }
  try {
    fs.writeFileSync(out, JSON.stringify({ entries: loadLeaderboard(dataDir) }, null, 2) + '\n');
  } catch (e) { process.stderr.write('Không ghi được file xuất: ' + e.message + '\n'); process.exit(1); }
  process.exit(0);
}

const port = Number(argOf('--port')) || Number(process.env.PORT) || 8080;
createAppServer({ root, dataDir }).listen(port, () => console.log(`Dao Den Long: http://localhost:${port}`));
