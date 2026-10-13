// Fails if a local file listed in sw.js urlsToCache is missing from the build output (www/) or the repo root.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const base = process.argv[2] ? path.resolve(process.argv[2]) : (fs.existsSync(path.join(ROOT, 'www')) ? path.join(ROOT, 'www') : ROOT);
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const m = sw.match(/urlsToCache\s*=\s*\[([^\]]*)\]/);
if (!m) { console.error('urlsToCache not found in sw.js'); process.exit(1); }
const list = (m[1].match(/"[^"]+"/g) || []).map(x => x.slice(1, -1)).filter(u => u.startsWith('/'));
const missing = list.filter(u => u !== '/' && !fs.existsSync(path.join(base, u.slice(1))));
if (missing.length) { console.error('Precache files missing in ' + base + ':\n  ' + missing.join('\n  ')); process.exit(1); }
console.log(`precache OK: ${list.length} entries exist in ${base}`);
