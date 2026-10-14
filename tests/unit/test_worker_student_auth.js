// Phase 4 — Worker student auth tests (mock KV + mock Firestore). Run: node tests/unit/test_worker_student_auth.js
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert'), crypto = require('crypto');
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const SA = { project_id: 'demo-test', client_email: 'sa@demo-test.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
const store = new Map();   // "col/doc" -> {k: stringValue|bool}
const kvm = new Map();
const KV = { async get(k, t) { const v = kvm.get(k); if (v === undefined) return null; return t === 'json' ? JSON.parse(v) : v; }, async put(k, v) { kvm.set(k, v); }, async delete(k) { kvm.delete(k); } };
const enc = (o) => { const f = {}; for (const k in o) f[k] = typeof o[k] === 'boolean' ? { booleanValue: o[k] } : { stringValue: String(o[k]) }; return f; };
const sdoc = (p, o) => store.set(p, o);
global.fetch = async (url, init = {}) => {
  url = String(url);
  if (url.startsWith('https://oauth2.googleapis.com/token')) return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }));
  const m = url.match(/\/documents\/([^?]+)(\?(.*))?$/); if (!m) throw new Error('unexpected fetch ' + url);
  const p = decodeURIComponent(m[1]);
  if (!init.method || init.method === 'GET') { const d = store.get(p); return d ? new Response(JSON.stringify({ fields: enc(d) })) : new Response('{}', { status: 404 }); }
  if (init.method === 'PATCH') {
    const cur = store.get(p) || {}, body = JSON.parse(init.body).fields || {}, mask = (m[3] || '').split('&').map((x) => decodeURIComponent(x.split('=')[1]));
    for (const k of mask) { if (body[k]) cur[k] = body[k].stringValue !== undefined ? body[k].stringValue : (body[k].booleanValue !== undefined ? body[k].booleanValue : body[k].timestampValue); else delete cur[k]; }
    store.set(p, cur); return new Response('{}');
  }
  throw new Error('bad method');
};
(async () => {
  const tmp = path.join(os.tmpdir(), 'worker_under_test.mjs');
  fs.copyFileSync(path.join(__dirname, '..', '..', 'push-worker', 'worker.js'), tmp);
  const W = (await import('file://' + tmp + '?v=' + Date.now())).default;
  const env = { SERVICE_ACCOUNT_JSON: JSON.stringify(SA), BANK_KV: KV, PBKDF2_ITER: '10000' };
  const ORIG = 'https://snaptestpro.github.io';
  const call = (p, body, o = {}) => W.fetch(new Request('https://w.test' + p, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: o.origin === undefined ? ORIG : o.origin, 'CF-Connecting-IP': o.ip || '1.1.1.1' }, body: JSON.stringify(body) }), o.env || env, { waitUntil() {} });
  const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
  let n = 0; const t = async (name, fn) => { try { await fn(); n++; console.log('  PASS ' + name); } catch (e) { console.log('  FAIL ' + name + '\n   ' + (e.stack || e)); process.exitCode = 1; } };
  const reset = () => { store.clear(); kvm.clear(); };

  await t('register -> PBKDF2 hash stored (no plain/sha256), then login works and returns custom token with claims', async () => {
    reset(); sdoc('students/9876543210', { name: 'Ravi', instituteId: 'inst_A', classId: 'c1', hasPin: true });
    let r = await call('/student/register', { mobile: '9876543210', password: 'Secret#77', pin: '4321' }); assert.strictEqual(r.status, 200);
    const sec = store.get('studentSecrets/9876543210'); assert.ok(sec.pw.startsWith('pbkdf2$')); assert.ok(sec.pin.startsWith('pbkdf2$')); assert.ok(!sec.hash);
    r = await call('/student/login', { mobile: '9876543210', password: 'Secret#77' }); const j = await r.json(); assert.strictEqual(r.status, 200); assert.strictEqual(j.token.split('.').length, 3);
    const claims = JSON.parse(Buffer.from(j.token.split('.')[1], 'base64url').toString()); assert.strictEqual(claims.uid, 's_9876543210'); assert.strictEqual(claims.claims.mobile, '9876543210'); assert.strictEqual(claims.claims.instituteId, 'inst_A');
    assert.strictEqual(j.student.name, 'Ravi');
  });
  await t('wrong password -> 401 generic; 5th failure locks (429 + retryAfter); even right password blocked while locked', async () => {
    reset(); sdoc('students/9000000001', { name: 'A', instituteId: 'i' }); sdoc('studentSecrets/9000000001', { hash: sha('right-pass') });
    for (let i = 0; i < 5; i++) { const r = await call('/student/login', { mobile: '9000000001', password: 'bad' + i }); assert.strictEqual(r.status, 401); assert.strictEqual((await r.json()).error, 'Mobile number ya password galat hai.'); }
    const r = await call('/student/login', { mobile: '9000000001', password: 'right-pass' }); assert.strictEqual(r.status, 429); assert.ok((await r.json()).retryAfter > 0);
  });
  await t('unknown mobile gives the SAME error as wrong password (no account enumeration)', async () => {
    reset(); const r = await call('/student/login', { mobile: '9111111111', password: 'whatever1' }); assert.strictEqual(r.status, 401); assert.strictEqual((await r.json()).error, 'Mobile number ya password galat hai.');
  });
  await t('successful login resets the failure counter', async () => {
    reset(); sdoc('students/9000000002', { name: 'B', instituteId: 'i' }); sdoc('studentSecrets/9000000002', { hash: sha('good-pass') });
    for (let i = 0; i < 3; i++) await call('/student/login', { mobile: '9000000002', password: 'x' + i });
    assert.strictEqual((await call('/student/login', { mobile: '9000000002', password: 'good-pass' })).status, 200);
    assert.ok(!kvm.has('rl:m:9000000002'));
  });
  await t('legacy SHA-256 user logs in once and is silently upgraded to PBKDF2 (hash kept by default)', async () => {
    reset(); sdoc('students/9000000003', { name: 'C', instituteId: 'i' }); sdoc('studentSecrets/9000000003', { hash: sha('old-pass1'), pinHash: sha('1111') });
    assert.strictEqual((await call('/student/login', { mobile: '9000000003', password: 'old-pass1' })).status, 200);
    const s = store.get('studentSecrets/9000000003'); assert.ok(s.pw.startsWith('pbkdf2$')); assert.ok(s.hash, 'legacy hash kept until DELETE_LEGACY_HASH=1');
    assert.strictEqual((await call('/student/login', { mobile: '9000000003', password: 'old-pass1' })).status, 200);   // now via PBKDF2
  });
  await t('DELETE_LEGACY_HASH=1 removes the unsalted hash after upgrade', async () => {
    reset(); sdoc('students/9000000004', { name: 'D', instituteId: 'i' }); sdoc('studentSecrets/9000000004', { hash: sha('old-pass2') });
    assert.strictEqual((await call('/student/login', { mobile: '9000000004', password: 'old-pass2' }, { env: { ...env, DELETE_LEGACY_HASH: '1' } })).status, 200);
    assert.ok(!store.get('studentSecrets/9000000004').hash);
  });
  await t('CORS: foreign origin is rejected (403), allowed origins + capacitor/localhost pass', async () => {
    reset(); assert.strictEqual((await call('/student/login', { mobile: '9000000005', password: 'x' }, { origin: 'https://evil.example' })).status, 403);
    assert.notStrictEqual((await call('/student/login', { mobile: '9000000005', password: 'x' }, { origin: 'https://localhost' })).status, 403);
    const r = await call('/student/login', { mobile: '9000000005', password: 'x' }, { origin: 'http://localhost:5500' }); assert.strictEqual(r.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5500');
  });
  await t('register rejects weak/short passwords and bad PIN', async () => {
    reset(); for (const pw of ['123456', 'abc', 'password', 'aaaaaaaa']) assert.strictEqual((await call('/student/register', { mobile: '9222222222', password: pw, pin: '1234' })).status, 400);
    assert.strictEqual((await call('/student/register', { mobile: '9222222222', password: 'Good#pass1', pin: '12' })).status, 400);
  });
  await t('reset-with-pin: wrong PIN locked after 5, right PIN resets password and old password stops working', async () => {
    reset(); sdoc('students/9333333333', { name: 'E', instituteId: 'i' }); sdoc('studentSecrets/9333333333', { hash: sha('oldpw12'), pinHash: sha('2468') });
    assert.strictEqual((await call('/student/reset-with-pin', { mobile: '9333333333', pin: '2468', newPassword: 'New#pass99' })).status, 200);
    assert.strictEqual((await call('/student/login', { mobile: '9333333333', password: 'New#pass99' })).status, 200);
    assert.strictEqual((await call('/student/login', { mobile: '9333333333', password: 'oldpw12' })).status, 401);
    for (let i = 0; i < 5; i++) await call('/student/reset-with-pin', { mobile: '9333333333', pin: '000' + i, newPassword: 'Other#pass1' });
    assert.strictEqual((await call('/student/reset-with-pin', { mobile: '9333333333', pin: '2468', newPassword: 'Other#pass1' })).status, 429);
  });
  await t('IP limit: 20 failures from one IP across different mobiles -> 429', async () => {
    reset(); let last; for (let i = 0; i < 21; i++) last = await call('/student/login', { mobile: '90000' + String(10000 + i), password: 'x' }, { ip: '9.9.9.9' });
    assert.strictEqual(last.status, 429);
  });
  console.log('\n' + n + ' passed'); fs.unlinkSync(tmp);
})();
