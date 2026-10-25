// v236 — owner-reads.js: jhatke pakadna, gap dikhana, 501 par setup hint. Chhota fake DOM (jsdom ki zaroorat nahi).
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '../../owner-reads.js'), 'utf8');
function run(handler) {
  const els = { 'oa-reads-body': { innerHTML: '' }, 'oa-v-reads': { addEventListener() {} } };
  const win = { ownerEsc: (x) => String(x).replace(/</g, '&lt;'), ownerWorkerCall: (p) => handler(p), document: { getElementById: (i) => els[i] } };
  const ctx = vm.createContext(Object.assign(win, { window: win, document: win.document, Date, Math, JSON, Promise, String, Object, Array, console, setTimeout }));
  vm.runInContext(src, ctx); return { win, els };
}
(async () => {
  const T = Math.floor(Date.now() / 60000) - 60, series = []; for (let i = 0; i < 60; i++) series.push({ t: T + i, n: i === 30 ? 17000 : 40, c: 3 });
  const sum = { ok: true, from: T, to: T + 59, step: 1, total: { n: 17000 + 59 * 40, c: 180 }, series, byRole: [{ role: 'admin', n: 17000, c: 4 }], byColl: [{ coll: 'questionBank', kind: 'listen', n: 17000, c: 2 }],
    bySite: [{ role: 'admin', site: 'syncBank@script.js:99', coll: 'questionBank', kind: 'listen', n: 17000, c: 2 }], byInst: [], byBuild: [{ build: '234', n: 17000 }] };
  const { win, els } = run(async (p) => p.includes('summary') ? sum : { ok: true, step: 1, until: T + 59, total: 17100, series: [{ t: T + 30, n: 17000 }] });
  win.window.ouiReadsOpen(); await new Promise((r) => setTimeout(r, 20));
  const h = els['oa-reads-body'].innerHTML;
  assert(h.includes('Jhatke') && h.includes('data-sp="' + (T + 30) + '"'), 'jhatka list me hona chahiye');
  assert(h.includes('syncBank@script.js:99') && h.includes('Firebase asli'), 'karan + Firebase mel dikhna chahiye');
  assert(h.includes('build 234'), 'build-wise');
  // setup na ho
  const r2 = run(async () => { throw new Error('READS_DB (D1) binding Worker me nahi hai'); });
  r2.win.window.ouiReadsOpen(); await new Promise((r) => setTimeout(r, 20));
  assert(r2.els['oa-reads-body'].innerHTML.includes('READS_DB') && r2.els['oa-reads-body'].innerHTML.includes('READS_MONITOR.md'));
  // spikes(): shaant data me jhatka nahi
  assert.strictEqual(win.window.__readsMonitor.spikes(series.map((x) => ({ t: x.t, n: 30 }))).length, 0);
  console.log('test_owner_reads_ui_v236 OK');
})().catch((e) => { console.error(e); process.exit(1); });
