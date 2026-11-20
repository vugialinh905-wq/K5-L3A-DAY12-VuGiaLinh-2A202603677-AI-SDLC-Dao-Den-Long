// Tao goi phat hanh web tinh tu commit hien tai: node scripts/make-release.mjs  ->  dist/dao-den-long-v<version>-web.zip
// Dung `git archive` nen chi gom file da commit (khong lan du lieu cuc bo, node_modules, bench tam).
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
const name = `dao-den-long-v${version}-web`;
fs.mkdirSync('dist', { recursive: true });
const files = ['index.html', 'src', 'vendor', 'serve.js', 'package.json', 'README.md', 'LICENSE', 'CREDITS.md', 'CHANGELOG.md', 'bench.json', 'soak.json', 'docs/img'];
const r = spawnSync('git', ['archive', '--format=zip', `--prefix=${name}/`, '-o', `dist/${name}.zip`, 'HEAD', '--', ...files], { stdio: 'inherit' });
if (r.status !== 0) { console.error('git archive that bai'); process.exit(1); }
console.log(`Da tao dist/${name}.zip (${(fs.statSync(`dist/${name}.zip`).size / 1048576).toFixed(2)} MB). Giai nen roi chay: node serve.js`);
