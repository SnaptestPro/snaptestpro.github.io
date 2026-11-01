// v276: Reports -> "Total Result Sheet" JPG (offline students ka marksheet WhatsApp group me bhejne ke liye).
// resultSheetModel = pure data layer (sort, tie-aware rank, names, paging); plus wiring checks (buttons, roster.nameOf).
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const root = path.join(__dirname, '..', '..');
const src = fs.readFileSync(path.join(root, 'exam-manager.js'), 'utf8');
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
const ctx = { Math, Number, Array, String };
vm.createContext(ctx); vm.runInContext([grab('atLim'), grab('effMax'), grab('resultSheetModel')].join('\n'), ctx);
const model = vm.runInContext('resultSheetModel', ctx);
let pass = 0; const T = (n, f) => { try { f(); pass++; console.log('  PASS ' + n); } catch (e) { console.log('  FAIL ' + n + '\n   ' + (e.stack || e)); process.exitCode = 1; } };
const eq = (a, b) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b)); // vm arrays are cross-realm -> compare as JSON
const exam = { questions: 100 };
const R = (roll, marks, extra) => Object.assign({ roll, marks, correct: 0, wrong: 0, blank: 0, totalQuestions: 100 }, extra || {});

T('sorted by marks desc; ties share the same rank (1,2,2,4)', () => {
  const m = model(exam, [R('1', 40), R('2', 70), R('3', 55), R('4', 55), R('5', 10)], null, 40);
  eq(m.rows.map(r => r.roll), ['2', '3', '4', '1', '5']);
  eq(m.rows.map(r => r.rank), [1, 2, 2, 4, 5]);
});
T('does not mutate the input array', () => {
  const rows = [R('1', 1), R('2', 9)]; model(exam, rows, null, 40);
  eq(rows.map(r => r.roll), ['1', '2']);
});
T('names come from nameOf(roll); hasNames only when at least one found; throwing nameOf is safe', () => {
  const m = model(exam, [R('01', 5), R('02', 4)], r => (r === '01' ? 'Ravi' : ''), 40);
  assert.strictEqual(m.rows[0].name, 'Ravi'); assert.strictEqual(m.rows[1].name, ''); assert.strictEqual(m.hasNames, true);
  assert.strictEqual(model(exam, [R('01', 5)], null, 40).hasNames, false);
  assert.strictEqual(model(exam, [R('01', 5)], () => { throw new Error('x'); }, 40).hasNames, false);
});
T('percentage uses effective max (attemptLimit) and total questions', () => {
  const m = model({ questions: 100, attemptLimit: 50 }, [R('1', 25)], null, 40);
  assert.strictEqual(m.rows[0].max, 50); assert.strictEqual(m.rows[0].pct, 50);
  const m2 = model({ questions: 100 }, [R('1', 30, { totalQuestions: 60 })], null, 40);
  assert.strictEqual(m2.rows[0].max, 60); assert.strictEqual(m2.rows[0].pct, 50);
});
T('paging: 45 rows -> 40 + 5, nothing lost or duplicated', () => {
  const rows = Array.from({ length: 45 }, (_, i) => R(String(i + 1), i));
  const m = model(exam, rows, null, 40);
  eq(m.pages.map(p => p.length), [40, 5]);
  assert.strictEqual(new Set(m.pages.flat().map(r => r.roll)).size, 45);
});
T('empty / missing / junk input does not throw', () => {
  assert.strictEqual(model(exam, [], null, 40).pages.length, 0);
  assert.strictEqual(model(exam, null, null, 40).rows.length, 0);
  const m = model(exam, [{ roll: null, marks: 'abc' }], null, 0);
  assert.strictEqual(m.rows[0].roll, '—'); assert.strictEqual(m.rows[0].marks, 0); assert.strictEqual(m.pages.length, 1);
  assert.strictEqual(model(exam, [{ roll: '1', marks: 3, setLetter: 'B' }], null, 40).hasSet, true);
});
T('wiring: both buttons exist in index.html and are bound in exam-manager.js', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  ['examgr-rs-img-btn', 'examgr-rs-share-btn'].forEach(id => { assert.ok(html.includes('id="' + id + '"'), id + ' missing in index.html'); assert.ok(src.includes('c("' + id + '")'), id + ' not bound'); });
  assert.ok(src.includes('window.examgrResultSheetImage'));
});
T('roster exposes nameOf(id, roll)', () => {
  const rs = fs.readFileSync(path.join(root, 'exam-roster.js'), 'utf8');
  assert.ok(/nameOf:\s*function\s*\(id,\s*roll\)/.test(rs));
});
console.log(pass + ' passed');
