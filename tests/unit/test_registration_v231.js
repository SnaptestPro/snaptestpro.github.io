// v231 — Registration (pehle register, baad me roll shuffle + publish) + exam se jodna. Plain Node.
const fs = require('fs'), path = require('path'), assert = require('assert');
const R = p => fs.readFileSync(path.join(__dirname, '..', '..', p), 'utf8');
let n = 0; const T = (name, fn) => { try { fn(); n++; console.log('  PASS ' + name); } catch (e) { console.log('  FAIL ' + name + '\n   ' + (e.stack || e)); process.exitCode = 1; } };
const { pure: P } = require('../../exam-registration.js');
const { pure: RO } = require('../../exam-roster.js');
const mk = (i, g) => ({ name: 'Stu' + String(i).padStart(3, '0'), mobile: '98' + String(10000000 + i), group: g || (i % 3 === 0 ? 'Inst A' : i % 3 === 1 ? 'Inst B' : 'Inst C'), classId: 'class_10', cls: 'Class 10' });
const people = N => Array.from({ length: N }, (_, i) => mk(i + 1));

T('register karte waqt roll NAHI milta; duplicate/galat mobile skip', () => {
  const r = P.addDraft([], [...people(5), mk(1), { name: 'x', mobile: '12345' }]);
  assert.strictEqual(r.added, 5); assert.strictEqual(r.skipped, 2); assert.ok(r.list.every(e => !e.roll));
});
T('3000 se zyada par TOO_MANY', () => {
  const r = P.addDraft(P.addDraft([], people(3000)).list, [mk(99999)]); assert.strictEqual(r.error.code, 'TOO_MANY');
});
T('pehli baar publish: rolls ek poori permutation 1..N, har student ko alag', () => {
  const d = P.addDraft([], people(120)).list, a = P.assignRolls(d, { rollDigits: 3 });
  assert.strictEqual(a.assigned, 120);
  const rolls = a.list.map(e => parseInt(e.roll, 10)).sort((x, y) => x - y);
  assert.deepStrictEqual(rolls, Array.from({ length: 120 }, (_, i) => i + 1));
  assert.ok(a.list.every(e => e.roll.length === 3));
});
T('shuffle: institute-wise cluster nahi (naam ke order se roll alag, institute roll-order me mix)', () => {
  const d = P.addDraft([], people(150)).list, a = P.assignRolls(d, { rollDigits: 3 });
  // naam-order me roll sequence 1..N jaisa nahi hona chahiye
  const inOrder = d.map(e => parseInt(a.list.find(x => x.mobile === e.mobile).roll, 10));
  const sorted = inOrder.slice().sort((x, y) => x - y);
  assert.notDeepStrictEqual(inOrder, sorted);
  // roll-order me ek hi institute ke lagatar 8+ students nahi (random me practically impossible)
  let run = 1, max = 1; for (let i = 1; i < a.list.length; i++) { run = a.list[i].group === a.list[i - 1].group ? run + 1 : 1; max = Math.max(max, run); }
  assert.ok(max < 8, 'max same-group run ' + max);
});
T('rng inject: deterministic; alag rng alag shuffle (crypto default bhi chalta hai)', () => {
  let s = 1; const rng = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const d = P.addDraft([], people(30)).list;
  const a1 = P.assignRolls(d, { rollDigits: 2, rng: (() => { let q = 7; return () => { q = (q * 48271) % 2147483647; return (q - 1) / 2147483646; }; })() });
  const a2 = P.assignRolls(d, { rollDigits: 2, rng });
  assert.notDeepStrictEqual(a1.list.map(e => e.mobile), a2.list.map(e => e.mobile));
  const c = P.assignRolls(d, { rollDigits: 2 }); assert.strictEqual(c.assigned, 30);
});
T('digits kam hon to DIGITS_FULL, kuch assign nahi', () => {
  const d = P.addDraft([], people(120)).list, a = P.assignRolls(d, { rollDigits: 2 });
  assert.strictEqual(a.error.code, 'DIGITS_FULL'); assert.ok(a.list.every(e => !e.roll));
});
T('publish ke baad naya student: purane roll nahi badalte, naya roll bacha hua unique; retired dobara nahi milta', () => {
  const d = P.addDraft([], people(20)).list, a = P.assignRolls(d, { rollDigits: 3 });
  const before = Object.fromEntries(a.list.map(e => [e.mobile, e.roll]));
  const more = P.addDraft(a.list, [mk(500), mk(501), mk(502)]).list;
  const b = P.assignRolls(more, { rollDigits: 3, retired: ['021', '022'] });
  assert.strictEqual(b.assigned, 3);
  b.list.forEach(e => { if (before[e.mobile]) assert.strictEqual(e.roll, before[e.mobile]); });
  const rolls = b.list.map(e => e.roll); assert.strictEqual(new Set(rolls).size, 23);
  b.list.filter(e => !before[e.mobile]).forEach(e => { assert.ok(parseInt(e.roll, 10) > 20); assert.ok(!['021', '022'].includes(e.roll)); });
});
T('parseLines: mobile, naam+mobile, space wale number, unknown', () => {
  const find = m => m === '9811111111' ? { name: 'Known', classId: 'class_10', cls: 'Class 10' } : null;
  const r = P.parseLines('9811111111\nRahul Kumar, 98765 43210\n9822222222\nSita 9833333333', find);
  assert.deepStrictEqual(r.people.map(p => p.name + ':' + p.mobile), ['Known:9811111111', 'Rahul Kumar:9876543210', 'Sita:9833333333']);
  assert.deepStrictEqual(r.unknown, ['9822222222']);
});
T('groupsOf unique sorted', () => assert.deepStrictEqual(P.groupsOf(people(9)), ['Inst A', 'Inst B', 'Inst C']));
T('exam se jodna: roll registration wale hi, set exam ke sets se roll se; scanIgnoreSet par set null', () => {
  const a = P.assignRolls(P.addDraft([], people(10)).list, { rollDigits: 2 });
  const x = RO.fromRegistration(a.list, { sets: 3 });
  assert.strictEqual(x.list.length, 10); assert.strictEqual(x.nextRoll, 11);
  x.list.forEach((e, i) => { assert.strictEqual(e.set, 'ABC'[(parseInt(e.roll, 10) - 1) % 3]); });
  // roll-order me adjacent sets alag
  for (let i = 1; i < x.list.length; i++) assert.notStrictEqual(x.list[i].set, x.list[i - 1].set);
  assert.ok(RO.fromRegistration(a.list, { sets: 3, scanIgnoreSet: true }).list.every(e => e.set === null));
  assert.strictEqual(RO.fromRegistration(a.list, { sets: 1 }).list[0].set, null);
});
T('jodne ke baad scan verify: registered roll ok, anon roll NOT_REGISTERED', () => {
  const a = P.assignRolls(P.addDraft([], people(10)).list, { rollDigits: 2 });
  const x = RO.fromRegistration(a.list, { sets: 1 }), Rr = { list: x.list, by: RO.indexList(x.list) };
  const e = x.list[3];
  assert.strictEqual(RO.verify(Rr, { sets: 1 }, { roll: e.roll, id: 'z' }, [], '').level, 'ok');
  assert.strictEqual(RO.verify(Rr, { sets: 1 }, { roll: '99', id: 'z' }, [], '').code === undefined, true);
  assert.strictEqual(RO.verify(Rr, { sets: 1 }, { roll: '99', id: 'z' }, [], '').issues[0].code, 'NOT_REGISTERED');
});
T('admit card par Set kahin nahi', () => {
  assert.ok(!/setLetter/.test(R('admit-card.js')));
  assert.ok(!/EXAM SET/.test(R('admit-card.js')));
  assert.ok(!/setLetter/.test(R('exam-registration.js')));
  const ro = R('exam-roster.js'); assert.ok(!/cardFor[\s\S]{0,400}setLetter/.test(ro.slice(ro.indexOf('function cardFor'), ro.indexOf('function cardFor') + 600)));
});
T('wiring: hub button, create form select, loader, sw, rules, flag, hooks', () => {
  const idx = R('index.html'); assert.ok(/__examgrOpenRegSafe/.test(idx) && /id="examgr-add-reg"/.test(idx));
  assert.ok(/__examgrOpenRegSafe\s*=/.test(R('inline/index-inline-06.js')) && /exam-registration\.js\?v=\d+/.test(R('inline/index-inline-06.js')));
  assert.ok(/"\/exam-registration\.js"/.test(R('sw.js')));
  const rl = R('firestore.rules'); assert.ok(/match \/examRegistrations\/\{regId\}/.test(rl) && /match \/roster\/\{rid\}/.test(rl));
  assert.ok(/registration:\s*true/.test(R('app-config.js')));
  const em = R('exam-manager.js'); assert.ok(/SnapRoster\.fillRegSelect/.test(em) && /SnapRoster\.linkRegistration\(u,rg\)/.test(em));
});
T('XSS: naya module innerHTML se dynamic data nahi likhta', () => {
  assert.ok(!/innerHTML|insertAdjacentHTML|document\.write/.test(R('exam-registration.js')));
});
console.log('registration v231 tests passed: ' + n);
