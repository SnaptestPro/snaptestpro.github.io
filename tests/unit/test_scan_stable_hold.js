// Scan Sheet capture gate: 4 corners must be STEADY (~0.9s) before auto-capture, jitter restarts the hold,
// a single-tick flicker does not, and a persistently shaky hand still captures within ~2.5s (relaxed tolerance).
// Runs the real Ct()/_egSpread()/vn() from exam-manager.js against scripted corner detections.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'exam-manager.js'), 'utf8');
function grab(name) {
  const start = src.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'function not found: ' + name);
  let i = src.indexOf('{', start), d = 0, inStr = null, esc = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return src.slice(start, i + 1); }
  }
  throw new Error('unbalanced ' + name);
}
const KEYS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const BASE = { 'top-left': [200, 300], 'top-right': [1240, 300], 'bottom-left': [200, 1620], 'bottom-right': [1240, 1620] };
const VW = 1440, VH = 1920;
function simulate(frameFn, maxMs = 6000, onCap) {
  let now = 0, captured = null, calls = 0;
  const ea = KEYS.map(k => ({ dataset: { marker: k }, classList: { add() {}, remove() {}, contains() { return false; } }, querySelector() { return null; } }));
  const ctx = {
    Math, performance: { now: () => now }, HTMLMediaElement: { HAVE_CURRENT_DATA: 2 }, requestAnimationFrame: () => 1,
    c: () => ({ classList: { contains: () => false } }), B: { readyState: 4, videoWidth: VW, videoHeight: VH },
    xn: () => ({ videoWidth: VW, videoHeight: VH, scale: 1, offsetX: 0, offsetY: 0 }),
    Re: { width: 0, height: 0, getContext: () => ({ drawImage() {} }) },
    pn: (u) => ({ corner: u, key: u.dataset.marker }),
    aa: (s, f) => { const p = ctx.__cur && ctx.__cur[f.key]; return p ? { x: p[0] * 0.5, y: p[1] * 0.5 } : null; }, // 720-wide detection space
    bn: (f, m, t, r) => (m ? { x: m.x / r, y: m.y / r } : null),
    Nn: () => 100, Ke() {}, Fn: (pts) => { captured = { t: now, pts }; onCap && onCap(captured); }, _cap: () => 2000, document: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {} }) }) },
  };
  vm.createContext(ctx);
  vm.runInContext([
    'let dt=0,Ae=0,fe=[],Me=-Infinity,ht=0,Je=false,ae=null,be=null,_shMax=0,_shOk=false,_stSince=0,_foundSince=0,_prevFresh=null,_miss=0,_retryNote="",_infK="";',
    'const pa=220,ya=2,_HOLD=500,_e={},kn=6,wn=["top-left","top-right","bottom-left","bottom-right"];',
    grab('vn'), grab('_egSpread'), grab('Ct'),
  ].join('\n'), ctx);
  ctx.ea = ea;
  // ea is referenced as a free variable inside Ct -> expose through the context
  vm.runInContext('var ea = this.ea;', ctx);
  for (now = 1000; now < 1000 + maxMs && !captured; now += 16) { // ~60fps rAF
    ctx.__cur = frameFn(now - 1000);
    vm.runInContext('Ct()', ctx);
  }
  return captured ? captured.t - 1000 : null;
}
const jit = (amp) => () => (Math.random() * 2 - 1) * amp;
function frames(over) { return (t) => { const o = {}; KEYS.forEach((k, i) => { const j = over.jitter ? over.jitter(t, k) : [0, 0]; o[k] = [BASE[k][0] + j[0], BASE[k][1] + j[1]]; }); return over.drop ? over.drop(t, o) : o; }; }
let pass = 0; const T = (n, f) => { try { f(); pass++; console.log('  PASS ' + n); } catch (e) { console.log('  FAIL ' + n + '\n   ' + (e.stack || e)); process.exitCode = 1; } };
T('steady hand (±1px) captures after ~0.5–0.9s, not instantly', () => {
  for (let r = 0; r < 20; r++) { const t = simulate(frames({ jitter: () => [jit(1)(), jit(1)()] })); assert.ok(t !== null && t >= 450 && t <= 900, 'capture time ' + t); }
});
T('hand moving continuously never captures while moving', () => {
  const t = simulate(frames({ jitter: (t) => [t * 0.2, t * 0.1] }), 4000); assert.strictEqual(t, null);
});
T('moderate tremor (±0.4% of width) still captures, within ≤2.2s', () => {
  for (let r = 0; r < 20; r++) { const t = simulate(frames({ jitter: () => [jit(0.004 * VW)(), jit(0.004 * VW)()] })); assert.ok(t !== null && t <= 2200, 'capture time ' + t); }
});
T('single missed corner tick does NOT restart the hold', () => {
  const t = simulate(frames({ drop: (t, o) => { if (t > 400 && t < 520) delete o['top-left']; return o; } })); assert.ok(t !== null && t <= 900, 'capture time ' + t);
});
T('two corners lost for >2 ticks restarts the hold (captures later than steady)', () => {
  const t = simulate(frames({ drop: (t, o) => { if (t > 300 && t < 700) { delete o['bottom-right']; delete o['top-left']; } return o; } })); assert.ok(t !== null && t >= 1000, 'capture time ' + t);
});
T('sheet jumps mid-hold → hold restarts from the jump', () => {
  const t = simulate(frames({ jitter: (t) => (t > 300 ? [60, 40] : [0, 0]) })); assert.ok(t !== null && t >= 750, 'capture time ' + t);
});
T('only 3 corners ever visible -> still captures fast and 4th corner is inferred exactly', () => {
  for (const miss of KEYS) {
    let got = null;
    const t = simulate(frames({ drop: (t, o) => { delete o[miss]; return o; } }), 6000, (c) => { got = c; });
    assert.ok(t !== null && t >= 450 && t <= 900, miss + ' capture time ' + t);
    assert.ok(Math.hypot(got.pts[miss].x - BASE[miss][0], got.pts[miss].y - BASE[miss][1]) < 1.5, 'inferred ' + miss + ' ' + JSON.stringify(got.pts[miss]));
  }
});
console.log(pass + ' passed');
