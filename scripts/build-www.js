// Web files ko www/ me copy karta hai (sirf wahi jo app me chahiye). Repo ki root file change nahi hoti.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'www');
const SKIP_DIR = new Set(['node_modules', 'android', 'www', 'scripts', '.git', '.github', 'push-worker']);
const SKIP_EXT = new Set(['.md', '.bat', '.keystore', '.jks', '.gs', '.apk', '.aab', '.zip']);
const SKIP_FILES = new Set(['package.json', 'package-lock.json', 'capacitor.config.js', 'firebase.json',
  'firestore.rules', '_headers', 'sitemap.xml', 'robots.txt', 'OWNER_CLOUD_FUNCTIONS_optional.js', '.gitignore']);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
let n = 0;
(function walk(dir, rel) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIR.has(e.name) && !e.name.startsWith('.')) walk(path.join(dir, e.name), path.join(rel, e.name)); continue; }
    if (SKIP_FILES.has(e.name) || SKIP_EXT.has(path.extname(e.name).toLowerCase())) continue;
    if (/^WhatsApp Image/i.test(e.name)) continue;
    fs.mkdirSync(path.join(OUT, rel), { recursive: true });
    fs.copyFileSync(path.join(dir, e.name), path.join(OUT, rel, e.name)); n++;
  }
})(ROOT, '');
// App me service worker ki zaroorat nahi (files app ke andar hi hain; SW purani cache atka deta hai).
const idx = path.join(OUT, 'index.html');
let h = fs.readFileSync(idx, 'utf8');
const marker = "if ('serviceWorker' in navigator) {\n    let swRegistration = null;";
if (h.includes(marker)) { h = h.replace(marker, "if (false && 'serviceWorker' in navigator) {\n    let swRegistration = null;"); fs.writeFileSync(idx, h); console.log('SW registration disabled in app copy'); }
else console.warn('WARN: SW marker not found — index.html me SW code badla hai, app me SW chalu rahega');
console.log('www ready:', n, 'files');
