/* SnapTest Pro — FREE push relay (Cloudflare Workers, free plan, card nahi chahiye).
   Admin app notification Firestore me likhta hai -> phir ye Worker ko bulata hai ->
   Worker FCM se us institute ke sabhi students ke phone par push bhejta hai (app band ho tab bhi).

   Secrets/vars (Cloudflare dashboard > Worker > Settings > Variables and Secrets):
     SERVICE_ACCOUNT_JSON  (Secret)  Firebase service-account key ki poori JSON
     PROJECT_ID            (Text)    optional — khaali ho to JSON se le leta hai
*/
const te = new TextEncoder(), td = new TextDecoder();
const RS = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
const JWK_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Bank-Count, Range' };

const b64u = (buf) => { let s = ''; for (const c of new Uint8Array(buf)) s += String.fromCharCode(c); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = (s) => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s), o = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) o[i] = b.charCodeAt(i); return o; };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
class HttpErr extends Error { constructor(status, msg) { super(msg); this.status = status; } }

async function verifyIdToken(token, projectId) {
  const p = String(token || '').split('.');
  if (p.length !== 3) throw new HttpErr(401, 'Bad token');
  const header = JSON.parse(td.decode(unb64u(p[0]))), payload = JSON.parse(td.decode(unb64u(p[1])));
  if (header.alg !== 'RS256') throw new HttpErr(401, 'Bad token alg');
  const jwks = await (await fetch(JWK_URL, { cf: { cacheTtl: 3600, cacheEverything: true } })).json();
  const jwk = (jwks.keys || []).find((k) => k.kid === header.kid);
  if (!jwk) throw new HttpErr(401, 'Unknown key');
  const key = await crypto.subtle.importKey('jwk', jwk, RS, false, ['verify']);
  const ok = await crypto.subtle.verify(RS.name, key, unb64u(p[2]), te.encode(p[0] + '.' + p[1]));
  const now = Math.floor(Date.now() / 1000);
  if (!ok || payload.aud !== projectId || payload.iss !== 'https://securetoken.google.com/' + projectId ||
      !payload.sub || payload.exp < now || payload.iat > now + 300) throw new HttpErr(401, 'Token invalid');
  return payload;
}

let cached = { token: '', exp: 0 };
async function googleAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  if (cached.token && cached.exp - 60 > now) return cached.token;
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const key = await crypto.subtle.importKey('pkcs8', unb64u(pem), RS, false, ['sign']);
  const head = b64u(te.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const body = b64u(te.encode(JSON.stringify({
    iss: sa.client_email, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore'
  })));
  const sig = b64u(await crypto.subtle.sign(RS.name, key, te.encode(head + '.' + body)));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + head + '.' + body + '.' + sig
  });
  const j = await r.json();
  if (!j.access_token) throw new HttpErr(500, 'Service account token fail: ' + (j.error_description || j.error || r.status));
  cached = { token: j.access_token, exp: now + (j.expires_in || 3600) };
  return cached.token;
}

const topicSafe = (x) => String(x).replace(/[^a-zA-Z0-9\-_.~%]/g, '_');
const batchTopic = (inst, b) => 'bat_' + topicSafe(inst) + '_' + topicSafe(b);

async function handle(request, env) {
  if (!env.SERVICE_ACCOUNT_JSON) throw new HttpErr(500, 'SERVICE_ACCOUNT_JSON secret set nahi hai');
  const sa = JSON.parse(env.SERVICE_ACCOUNT_JSON);
  const projectId = env.PROJECT_ID || sa.project_id;
  let req; try { req = JSON.parse(await request.text()); } catch (e) { throw new HttpErr(400, 'Bad JSON'); }
  const instituteId = String(req.instituteId || ''), notifId = String(req.notifId || '');
  if (!instituteId || !notifId || /[\/\s]/.test(instituteId + notifId) || instituteId.length > 120 || notifId.length > 120) throw new HttpErr(400, 'Bad ids');

  const user = await verifyIdToken(req.idToken, projectId);
  const email = String(user.email || '').toLowerCase();
  if (!email) throw new HttpErr(403, 'Admin email login chahiye');

  if (typeof req.title === 'string' && req.title.trim()) return await pushDirect(env, sa, projectId, email, instituteId, notifId, req);   // v170: 0 Firestore reads
  const at = await googleAccessToken(sa);
  const docUrl = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents/institutes/' +
    encodeURIComponent(instituteId) + '/notifications/' + encodeURIComponent(notifId);
  const dr = await fetch(docUrl, { headers: { Authorization: 'Bearer ' + at } });
  if (dr.status === 404) throw new HttpErr(404, 'Notification doc nahi mili');
  if (dr.status === 429) throw new HttpErr(503, 'Firestore ka aaj ka quota khatam hai — 12:30 PM IST ke baad push chalega');
  if (!dr.ok) throw new HttpErr(502, 'Firestore read fail ' + dr.status);
  const f = (await dr.json()).fields || {};
  const s = (k) => (f[k] && f[k].stringValue) || '';

  // Sirf wahi admin push kar sakta hai jisne ye doc banaya (Firestore rules ke hisaab se sirf us institute ka admin bana sakta hai)
  if (!s('createdBy') || s('createdBy').toLowerCase() !== email) throw new HttpErr(403, 'Aap is notification ke creator nahi hain');
  const created = f.createdAt && f.createdAt.timestampValue ? Date.parse(f.createdAt.timestampValue) : 0;
  if (!created || Date.now() - created > 15 * 60 * 1000) throw new HttpErr(409, 'Notification purani hai');
  if (f.pushedAt) return { ok: true, already: true };

  // Pehle mark karo (duplicate push na ho), phir bhejo
  const mk = await fetch(docUrl + '?updateMask.fieldPaths=pushedAt&currentDocument.exists=true', {
    method: 'PATCH', headers: { Authorization: 'Bearer ' + at, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { pushedAt: { timestampValue: new Date().toISOString() } } })
  });
  if (!mk.ok) throw new HttpErr(502, 'Mark fail ' + mk.status);

  // v169: notification par batchId ho to push sirf us batch ke students ko (topic bat_<inst>_<batch>), warna poore institute ko
  const batchId = s('batchId');
  const topic = batchId ? batchTopic(instituteId, batchId) : 'inst_' + topicSafe(instituteId);
  const fr = await fetch('https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send', {
    method: 'POST', headers: { Authorization: 'Bearer ' + at, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: {
      topic,
      notification: { title: s('title').slice(0, 100) || 'SnapTest Pro', body: s('body').slice(0, 300) },
      data: { instituteId, notifId, type: s('type') || 'admin', ...(batchId ? { batchId } : {}) },
      android: { priority: 'HIGH', ttl: '86400s', notification: { sound: 'default', channel_id: 'snap_updates' } }
    } })
  });
  if (!fr.ok) throw new HttpErr(502, 'FCM fail ' + fr.status + ' ' + (await fr.text()).slice(0, 200));
  return { ok: true };
}

/* ---------- Question bank: admin ek baar publish kare, students Firestore ke bajay yahan se padhein (0 Firestore reads) ----------
   Setup: Cloudflare > Workers & Pages > KV > Create namespace "snaptest-bank"; Worker > Settings > Bindings > Add > KV namespace,
   Variable name: BANK_KV.   (Optional) Variable OWNER_EMAILS = "owner@gmail.com,admin2@gmail.com" — default: vishnu1234stm@gmail.com (owner) aur vishnu1234stmp@gmail.com (legacy admin). */
async function isAdminEmail(env, projectId, at, email) {
  // Owner emails (OWNER_EMAILS) ke liye Firestore check nahi — quota khatam ho tab bhi chale
  const owners = String(env.OWNER_EMAILS || 'vishnu1234stm@gmail.com,vishnu1234stmp@gmail.com').toLowerCase().split(',').map((x) => x.trim()).filter(Boolean);
  if (owners.indexOf(email) >= 0) return true;
  const url = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents/admins/' + encodeURIComponent(email);
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + at } });
  let active = null;
  if (r.ok) { const f = ((await r.json()).fields) || {}; if (f.active && 'booleanValue' in f.active) active = f.active.booleanValue; }
  else if (r.status === 429) throw new HttpErr(503, 'Firestore ka aaj ka quota khatam hai — kal subah (12:30 PM IST ke baad) try karein');
  else if (r.status !== 404) throw new HttpErr(502, 'Admin check fail ' + r.status);
  return active === true;
}

async function handleBank(request, env, pathname) {
  if (!env.BANK_KV) throw new HttpErr(500, 'BANK_KV binding set nahi hai');
  if (request.method === 'GET' && pathname === '/bank/meta') {
    const m = await env.BANK_KV.get('bank_meta');
    return new Response(m || JSON.stringify({ exists: false }), { headers: { 'Content-Type': 'application/json', ...CORS } });
  }
  if (request.method === 'GET' && pathname === '/bank') {
    // ETag = publish time: browser 304 se bank dobara download nahi karta; 1 ghanta fresh + 7 din stale-while-revalidate
    let etag = '';
    try { const m = JSON.parse((await env.BANK_KV.get('bank_meta')) || '{}'); if (m.updatedAt) etag = '"b' + m.updatedAt + '"'; } catch (e) {}
    const H = { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=604800', ...CORS, 'Access-Control-Expose-Headers': 'ETag' };
    if (etag) { H.ETag = etag; if (request.headers.get('If-None-Match') === etag) return new Response(null, { status: 304, headers: H }); }
    const body = await env.BANK_KV.get('bank', { type: 'stream' });
    if (!body) return json({ ok: false, error: 'bank abhi publish nahi hua' }, 404);
    return new Response(body, { headers: H });
  }
  if (request.method === 'PUT' && pathname === '/bank') {
    if (!env.SERVICE_ACCOUNT_JSON) throw new HttpErr(500, 'SERVICE_ACCOUNT_JSON secret set nahi hai');
    const sa = JSON.parse(env.SERVICE_ACCOUNT_JSON), projectId = env.PROJECT_ID || sa.project_id;
    const auth = request.headers.get('Authorization') || '';
    const user = await verifyIdToken(auth.replace(/^Bearer\s+/i, ''), projectId);
    const email = String(user.email || '').toLowerCase();
    if (!email) throw new HttpErr(403, 'Admin email login chahiye');
    const at = await googleAccessToken(sa);
    if (!(await isAdminEmail(env, projectId, at, email))) throw new HttpErr(403, 'Aap admin nahi hain');
    const buf = await request.arrayBuffer();
    if (buf.byteLength < 2 || buf.byteLength > 24 * 1024 * 1024) throw new HttpErr(413, 'Bank size galat (max 24MB)');
    const u8 = new Uint8Array(buf); let end = u8.length - 1;
    while (end > 0 && (u8[end] === 10 || u8[end] === 13 || u8[end] === 32)) end--;
    if (u8[0] !== 91 || u8[end] !== 93) throw new HttpErr(400, 'Bank JSON array nahi hai');
    await env.BANK_KV.put('bank', buf);
    await env.BANK_KV.put('bank_meta', JSON.stringify({ exists: true, updatedAt: Date.now(), count: Number(request.headers.get('X-Bank-Count')) || 0, bytes: buf.byteLength, by: email }));
    return json({ ok: true, bytes: buf.byteLength });
  }
  throw new HttpErr(404, 'Not found');
}

/* ---------- App update broadcast: GitHub Actions -> admin / student phones (FCM topics app_admin, app_student) ----------
   Secret: BROADCAST_SECRET (Cloudflare Worker > Settings > Variables and Secrets) — wahi GitHub repo secret me bhi. */
async function handleBroadcast(request, env) {
  if (request.method !== 'POST') throw new HttpErr(405, 'POST chahiye');
  if (!env.BROADCAST_SECRET) throw new HttpErr(500, 'BROADCAST_SECRET set nahi hai');
  if (!env.SERVICE_ACCOUNT_JSON) throw new HttpErr(500, 'SERVICE_ACCOUNT_JSON secret set nahi hai');
  let req; try { req = JSON.parse(await request.text()); } catch (e) { throw new HttpErr(400, 'Bad JSON'); }
  const a = te.encode(String(req.secret || '')), b = te.encode(String(env.BROADCAST_SECRET));
  let diff = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] || 0) ^ (b[i] || 0);
  if (diff !== 0) throw new HttpErr(403, 'Secret galat hai');
  const aud = String(req.audience || 'both').toLowerCase();
  const topics = aud === 'admin' ? ['app_admin'] : aud === 'student' ? ['app_student'] : ['app_admin', 'app_student'];
  const title = String(req.title || 'SnapTest Pro').slice(0, 100), body = String(req.body || 'App me naya update aaya hai.').slice(0, 300);
  const kind = req.kind === 'apk' ? 'apk' : 'web';
  const sa = JSON.parse(env.SERVICE_ACCOUNT_JSON), projectId = env.PROJECT_ID || sa.project_id, at = await googleAccessToken(sa);
  for (const topic of topics) {
    const fr = await fetch('https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send', {
      method: 'POST', headers: { Authorization: 'Bearer ' + at, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { topic, notification: { title, body }, data: { type: 'app_update', kind, audience: aud },
        android: { priority: 'HIGH', ttl: '86400s', notification: { sound: 'default', channel_id: 'snap_updates' } } } })
    });
    if (!fr.ok) throw new HttpErr(502, 'FCM fail ' + fr.status + ' ' + (await fr.text()).slice(0, 200));
  }
  return { ok: true, sent: topics };
}


/* ---------- Owner alerts: app me koi bhi problem (error/quota/slow) -> owner ko automatic notification ----------
   Client (error-reporter.js) POST /alert bhejta hai. Worker: validate -> rate-limit -> dedup -> owner ko push.
   Owner tak 2 raaste (jo bhi set ho):  (1) FCM topic "owner_alerts" (owner Android app me)  (2) Telegram bot (optional, sabse pakka)
   Optional secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.  History: BANK_KV me key "alerts" (last 60) — Owner Panel > App Alerts. */
const alertCache = () => caches.default;
async function cacheCount(key, ttl) {
  const req = new Request('https://alert-cache.local/' + key), c = alertCache(), hit = await c.match(req);
  const n = hit ? (parseInt(await hit.text(), 10) || 0) : 0;
  await c.put(req, new Response(String(n + 1), { headers: { 'Cache-Control': 'max-age=' + ttl } }));
  return n + 1;
}
async function sha(str) { const d = await crypto.subtle.digest('SHA-256', te.encode(str)); return b64u(d).slice(0, 22); }
const clip = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]+/g, ' ').slice(0, n);

async function handleAlert(request, env) {
  if (request.method !== 'POST') throw new HttpErr(405, 'POST chahiye');
  const raw = await request.text();
  if (raw.length > 4000) throw new HttpErr(413, 'Too big');
  let a; try { a = JSON.parse(raw); } catch (e) { throw new HttpErr(400, 'Bad JSON'); }
  const ip = request.headers.get('CF-Connecting-IP') || 'x';
  const minute = Math.floor(Date.now() / 60000);
  if ((await cacheCount('rl/' + (await sha(ip)) + '/' + minute, 90)) > 8) return { ok: true, limited: true };

  const al = {
    t: Date.now(), type: clip(a.type, 24), sev: ['critical', 'error', 'warn'].indexOf(a.sev) >= 0 ? a.sev : 'error',
    msg: clip(a.msg, 300), src: clip(a.src, 120), stack: clip(a.stack, 500), role: clip(a.role, 12), inst: clip(a.inst, 60),
    plat: clip(a.plat, 8), screen: clip(a.screen, 60), app: clip(a.app, 20), net: clip(a.net, 24), ua: clip(a.ua, 120), ctx: clip(a.ctx, 160),
    online: a.online !== false, up: Number(a.up) || 0
  };
  if (!al.msg) throw new HttpErr(400, 'msg chahiye');
  const fp = await sha(al.type + '|' + al.msg.slice(0, 100) + '|' + al.src.slice(0, 80) + '|' + al.inst);
  const seen = await cacheCount('fp/' + fp, 3 * 3600);        // is alert ko pichhle 3 ghante me kitni baar dekha (is datacenter par)
  al.fp = fp;

  const doPush = seen === 1 && al.sev !== 'warn' && (await cacheCount('cap/' + Math.floor(Date.now() / 3600000), 3700)) <= 40;
  if (seen === 1 && env.BANK_KV) {                            // history sirf pehli baar (KV write bachane ke liye)
    try {
      const cur = JSON.parse((await env.BANK_KV.get('alerts')) || '[]');
      cur.unshift(al); await env.BANK_KV.put('alerts', JSON.stringify(cur.slice(0, 60)));
    } catch (e) {}
  }
  if (!doPush) return { ok: true, pushed: false, seen };

  const icon = al.sev === 'critical' ? '🚨' : al.sev === 'error' ? '⚠️' : 'ℹ️';
  const title = (icon + ' SnapTest ' + al.sev.toUpperCase() + ' • ' + (al.role || 'user') + '/' + (al.plat || 'web')).slice(0, 100);
  const lines = [al.msg, al.src && ('File: ' + al.src), al.screen && ('Screen: ' + al.screen), al.inst && ('Institute: ' + al.inst),
    'App: ' + al.app + ' • Net: ' + (al.net || (al.online ? 'online' : 'offline'))].filter(Boolean);
  const out = { fcm: false, telegram: false };

  try {
    if (env.SERVICE_ACCOUNT_JSON) {
      const sa = JSON.parse(env.SERVICE_ACCOUNT_JSON), projectId = env.PROJECT_ID || sa.project_id, at = await googleAccessToken(sa);
      const fr = await fetch('https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send', {
        method: 'POST', headers: { Authorization: 'Bearer ' + at, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { topic: 'owner_alerts', notification: { title, body: lines.join('\n').slice(0, 300) },
          data: { type: 'owner_alert', sev: al.sev, fp },
          android: { priority: 'HIGH', ttl: '21600s', notification: { sound: 'default', channel_id: 'snap_updates' } } } })
      });
      out.fcm = fr.ok;
    }
  } catch (e) {}
  try {
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
      const tr = await fetch('https://api.telegram.org/bot' + env.TELEGRAM_BOT_TOKEN + '/sendMessage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: title + '\n\n' + lines.join('\n') + (al.stack ? '\n\n' + al.stack.slice(0, 300) : ''), disable_web_page_preview: true })
      });
      out.telegram = tr.ok;
    }
  } catch (e) {}
  return { ok: true, pushed: out.fcm || out.telegram, via: out, seen };
}

async function handleAlertsList(request, env, pathname) {
  if (!env.BANK_KV) throw new HttpErr(500, 'BANK_KV binding set nahi hai');
  if (!env.SERVICE_ACCOUNT_JSON) throw new HttpErr(500, 'SERVICE_ACCOUNT_JSON secret set nahi hai');
  const sa = JSON.parse(env.SERVICE_ACCOUNT_JSON), projectId = env.PROJECT_ID || sa.project_id;
  const user = await verifyIdToken((request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''), projectId);
  const email = String(user.email || '').toLowerCase();
  const owners = String(env.OWNER_EMAILS || 'vishnu1234stm@gmail.com').toLowerCase().split(',').map((x) => x.trim()).filter(Boolean);
  if (owners.indexOf(email) < 0) throw new HttpErr(403, 'Sirf owner');
  if (request.method === 'POST' && pathname === '/alerts/clear') { await env.BANK_KV.put('alerts', '[]'); return { ok: true }; }
  return { ok: true, alerts: JSON.parse((await env.BANK_KV.get('alerts')) || '[]') };
}

/* ---------- SnapLive: apna live + recording (Jitsi/Zoom ke bina) ----------
   Teacher ka device khud record karta hai (MediaRecorder) aur 3-sec ke segments yahan upload karta hai -> R2 bucket.
   Students segments + live.json (manifest) padhkar live dekhte hain; wahi segments baad me recording ban jate hain.
   Setup: R2 bucket banao -> Worker Settings -> Bindings -> R2: variable naam LIVE_R2. (Optional) bucket ko public karo
   aur LIVE_PUBLIC_BASE = https://pub-xxxx.r2.dev rakho (tab segment reads Worker se nahi guzarte = free-plan request limit bachti hai).
   Bina LIVE_PUBLIC_BASE ke segments Worker khud /live/f/... se serve karta hai (chhoti classes ke liye theek). */
const liveKeyOk = (k) => /^[a-f0-9]{48}$/.test(String(k || ''));
const liveFileOk = (f) => /^(live\.json|p\d{1,2}\/(init|\d{1,5})\.webm)$/.test(String(f || ''));
const LIVE_MAX_SEG = 8 * 1024 * 1024;
async function fsGetFields(env, path) {
  const sa = JSON.parse(env.SERVICE_ACCOUNT_JSON), at = await googleAccessToken(sa), pid = env.PROJECT_ID || sa.project_id;
  const r = await fetch('https://firestore.googleapis.com/v1/projects/' + pid + '/databases/(default)/documents/' + path, { headers: { Authorization: 'Bearer ' + at } });
  if (r.status === 404) return null;
  if (!r.ok) throw new HttpErr(502, 'Firestore ' + r.status);
  return (await r.json()).fields || {};
}
/* v170 read-diet: admins/{email} doc 10 minute memory me cache (har live segment / file / push par 1 Firestore read lagta tha).
   Firestore down / quota khatam ho to purana (24 ghante tak ka) cache chalta hai — isliye push aur live quota khatam hone par bhi nahi rukte. */
const adminCache = new Map();
async function adminFields(env, email) {
  const c = adminCache.get(email), now = Date.now();
  if (c && now - c.at < 10 * 60 * 1000) return c.f;
  try {
    const f = await fsGetFields(env, 'admins/' + encodeURIComponent(email));
    if (f) { if (adminCache.size > 300) adminCache.clear(); adminCache.set(email, { f, at: now }); } else adminCache.delete(email);
    return f;
  } catch (e) { if (c && now - c.at < 24 * 3600 * 1000) return c.f; throw e; }
}
const pushSeen = new Map();
async function pushDirect(env, sa, projectId, email, instituteId, notifId, req) {
  const owners = String(env.OWNER_EMAILS || 'vishnu1234stm@gmail.com,vishnu1234stmp@gmail.com').toLowerCase().split(',').map((x) => x.trim());
  const f = await adminFields(env, email), active = !!f && !(f.active && f.active.booleanValue === false), myInst = (f && f.instituteId && f.instituteId.stringValue) || '';
  if (owners.indexOf(email) < 0 && !(active && myInst === instituteId)) throw new HttpErr(403, 'Aap is institute ke admin nahi hain');
  const now = Date.now(); for (const [k, t] of pushSeen) if (now - t > 15 * 60 * 1000) pushSeen.delete(k);
  const dk = instituteId + '/' + notifId; if (pushSeen.has(dk)) return { ok: true, already: true }; pushSeen.set(dk, now);
  const batchId = String(req.batchId || '').slice(0, 120), type = String(req.type || 'admin').slice(0, 30);
  const topic = batchId ? batchTopic(instituteId, batchId) : 'inst_' + topicSafe(instituteId), at = await googleAccessToken(sa);
  const fr = await fetch('https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send', {
    method: 'POST', headers: { Authorization: 'Bearer ' + at, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { topic, notification: { title: String(req.title).slice(0, 100) || 'SnapTest Pro', body: String(req.body || '').slice(0, 300) },
      data: { instituteId, notifId, type, ...(batchId ? { batchId } : {}) }, android: { priority: 'HIGH', ttl: '86400s', notification: { sound: 'default', channel_id: 'snap_updates' } } } })
  });
  if (!fr.ok) { pushSeen.delete(dk); throw new HttpErr(502, 'FCM fail ' + fr.status + ' ' + (await fr.text()).slice(0, 200)); }
  return { ok: true, direct: true };
}
async function liveAdmin(request, env) {
  if (!env.SERVICE_ACCOUNT_JSON) throw new HttpErr(500, 'SERVICE_ACCOUNT_JSON secret set nahi hai');
  const sa = JSON.parse(env.SERVICE_ACCOUNT_JSON), projectId = env.PROJECT_ID || sa.project_id;
  const user = await verifyIdToken((request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''), projectId);
  const email = String(user.email || '').toLowerCase();
  if (!email) throw new HttpErr(401, 'Admin login chahiye');
  const owners = String(env.OWNER_EMAILS || 'vishnu1234stm@gmail.com,vishnu1234stmp@gmail.com').toLowerCase().split(',').map((x) => x.trim());
  const f = await adminFields(env, email);
  const active = !!f && !(f.active && f.active.booleanValue === false);
  if (!active && owners.indexOf(email) < 0) throw new HttpErr(403, 'Sirf admin');
  return { email, instituteId: (f && f.instituteId && f.instituteId.stringValue) || '' };
}
const liveUrlBase = (env, request) => (env.LIVE_PUBLIC_BASE ? String(env.LIVE_PUBLIC_BASE).replace(/\/+$/, '') + '/live' : new URL(request.url).origin + '/live/f');
async function liveGetJson(env, k) { const o = await env.LIVE_R2.get(k); return o ? JSON.parse(await o.text()) : null; }
const liveMayManage = (meta, admin) => !!meta && (meta.email === admin.email || (!!admin.instituteId && meta.instituteId === admin.instituteId));

async function handleLive(request, env, pathname) {
  if (!env.LIVE_R2) throw new HttpErr(501, 'LIVE_R2 (R2 bucket) binding Worker me set nahi hai');
  const url = new URL(request.url);
  if (request.method === 'GET' && pathname.indexOf('/live/f/') === 0) {            // public (capability-URL) read
    const rest = pathname.slice('/live/f/'.length), i = rest.indexOf('/'), key = rest.slice(0, i), file = rest.slice(i + 1);
    if (i < 0 || !liveKeyOk(key) || !liveFileOk(file)) throw new HttpErr(404, 'Not found');
    const o = await env.LIVE_R2.get('live/' + key + '/' + file);
    if (!o) throw new HttpErr(404, 'Not found');
    return new Response(o.body, { headers: { 'Content-Type': file.endsWith('.json') ? 'application/json' : 'video/webm', 'Cache-Control': file.endsWith('.json') ? 'no-cache, max-age=0' : 'public, max-age=31536000, immutable', ...CORS } });
  }
  const admin = await liveAdmin(request, env);
  const q = (k) => url.searchParams.get(k);
  if (request.method === 'POST' && pathname === '/live/start') {
    const b = await request.json().catch(() => ({}));
    if (admin.instituteId && b.instituteId && b.instituteId !== admin.instituteId) throw new HttpErr(403, 'Dusre institute ka class');
    const inst = String(b.instituteId || admin.instituteId || '').slice(0, 80);
    if (b.key) {                                                                      // resume (teacher ka tab/app band ho gaya tha)
      if (!liveKeyOk(b.key)) throw new HttpErr(400, 'Bad key');
      const meta = await liveGetJson(env, 'live/' + b.key + '/meta.json');
      if (!liveMayManage(meta, admin)) throw new HttpErr(404, 'Session nahi mila');
      return json({ ok: true, key: b.key, base: liveUrlBase(env, request), manifest: await liveGetJson(env, 'live/' + b.key + '/live.json') });
    }
    const key = [...crypto.getRandomValues(new Uint8Array(24))].map((x) => x.toString(16).padStart(2, '0')).join('');
    const manifest = { v: 1, status: 'live', startedAt: Date.now(), totalMs: 0, parts: [] };
    await env.LIVE_R2.put('live/' + key + '/meta.json', JSON.stringify({ email: admin.email, instituteId: inst, batchId: String(b.batchId || '').slice(0, 80), classId: String(b.classId || '').slice(0, 80), at: Date.now() }));
    await env.LIVE_R2.put('live/' + key + '/live.json', JSON.stringify(manifest), { httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache, max-age=0' } });
    return json({ ok: true, key, base: liveUrlBase(env, request), manifest });
  }
  const key = q('key') || '';
  if (!liveKeyOk(key)) throw new HttpErr(400, 'Bad key');
  const meta = await liveGetJson(env, 'live/' + key + '/meta.json');
  if (!liveMayManage(meta, admin)) throw new HttpErr(403, 'Is session par aapka haq nahi');
  if (request.method === 'PUT' && pathname === '/live/seg') {
    const part = parseInt(q('part'), 10), n = q('n'), d = Math.max(0, parseInt(q('d'), 10) || 0), t = Math.max(0, parseInt(q('t'), 10) || 0), ps = Math.max(0, parseInt(q('ps'), 10) || 0);
    if (!(part >= 0 && part < 50) || !(n === 'init' || /^\d{1,5}$/.test(n))) throw new HttpErr(400, 'Bad part/n');
    const buf = await request.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > LIVE_MAX_SEG) throw new HttpErr(413, 'Segment size galat');
    await env.LIVE_R2.put('live/' + key + '/p' + part + '/' + n + '.webm', buf, { httpMetadata: { contentType: 'video/webm', cacheControl: 'public, max-age=31536000, immutable' } });
    const m = (await liveGetJson(env, 'live/' + key + '/live.json')) || { v: 1, status: 'live', startedAt: Date.now(), totalMs: 0, parts: [] };
    if (m.status !== 'live') throw new HttpErr(409, 'Class khatam ho chuki hai');
    while (m.parts.length <= part) m.parts.push({ i: m.parts.length, startMs: 0, init: false, segs: [] });
    const P = m.parts[part];
    if (n === 'init') { P.init = true; P.startMs = ps; }
    else if (!P.segs.some((s) => s.n === +n) && P.segs.length < 6000) P.segs.push({ n: +n, t, d });
    const L = m.parts[m.parts.length - 1]; m.totalMs = (L.startMs || 0) + L.segs.reduce((a, s) => a + s.d, 0); m.updatedAt = Date.now();
    await env.LIVE_R2.put('live/' + key + '/live.json', JSON.stringify(m), { httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache, max-age=0' } });
    return json({ ok: true });
  }
  if (request.method === 'POST' && pathname === '/live/end') {
    const b = await request.json().catch(() => ({}));
    const m = (await liveGetJson(env, 'live/' + key + '/live.json')) || { v: 1, parts: [], totalMs: 0 };
    m.status = b.status === 'failed' ? 'failed' : 'ended'; m.endedAt = Date.now();
    await env.LIVE_R2.put('live/' + key + '/live.json', JSON.stringify(m), { httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache, max-age=0' } });
    return json({ ok: true, manifest: m });
  }
  if (request.method === 'POST' && pathname === '/live/delete') {
    let cursor, n = 0;
    do { const l = await env.LIVE_R2.list({ prefix: 'live/' + key + '/', cursor, limit: 500 }); const ks = l.objects.map((o) => o.key); if (ks.length) { await env.LIVE_R2.delete(ks); n += ks.length; } cursor = l.truncated ? l.cursor : null; } while (cursor);
    return json({ ok: true, deleted: n });
  }
  throw new HttpErr(404, 'Unknown live endpoint');
}

/* ---------- v169: Upcoming test reminders (cron) ----------
   Test se ~24 ghante aur ~1 ghanta pehle students ko syllabus ke saath push. Cloudflare > Worker > Settings > Triggers > Cron Triggers: har 15 minute (cron: "every 15 min" = slash-15 star star star star)
   Test ka startTime admin ke local (IST) time me "YYYY-MM-DDTHH:mm" string hota hai; TZ_OFFSET_MIN (default 330 = IST).
   Duplicate roke: notification doc id = rem_<testId>_<24|1>[_<batchId>] — pehle se ho to dobara nahi bhejta. */
const fsStr = (f, k) => (f && f[k] && f[k].stringValue) || '';
async function fcmTopicSend(at, projectId, topic, title, body, data) {
  const fr = await fetch('https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send', {
    method: 'POST', headers: { Authorization: 'Bearer ' + at, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { topic, notification: { title: String(title).slice(0, 100), body: String(body).slice(0, 300) }, data, android: { priority: 'HIGH', ttl: '86400s', notification: { sound: 'default', channel_id: 'snap_updates' } } } })
  });
  return fr.ok;
}
async function sendReminders(env) {
  if (!env.SERVICE_ACCOUNT_JSON) return { ok: false, error: 'SERVICE_ACCOUNT_JSON nahi hai' };
  const sa = JSON.parse(env.SERVICE_ACCOUNT_JSON), projectId = env.PROJECT_ID || sa.project_id;
  const at = await googleAccessToken(sa);
  const base = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents';
  const off = (Number(env.TZ_OFFSET_MIN) || 330) * 60000, nowL = Date.now() + off;            // "local wall-clock" ko UTC-jaisa treat karte hain
  const iso = (ms) => new Date(ms).toISOString().slice(0, 16);
  const qr = await fetch(base + ':runQuery', {
    method: 'POST', headers: { Authorization: 'Bearer ' + at, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'tests' }], limit: 200, where: { compositeFilter: { op: 'AND', filters: [
      { fieldFilter: { field: { fieldPath: 'startTime' }, op: 'GREATER_THAN', value: { stringValue: iso(nowL) } } },
      { fieldFilter: { field: { fieldPath: 'startTime' }, op: 'LESS_THAN_OR_EQUAL', value: { stringValue: iso(nowL + 25 * 3600000) } } }] } } } })
  });
  if (!qr.ok) return { ok: false, error: 'runQuery ' + qr.status };
  const rows = await qr.json(); let sent = 0;
  for (const r of rows) {
    if (!r.document) continue;
    const f = r.document.fields || {}, testId = r.document.name.split('/').pop();
    if (f.isDraft && f.isDraft.booleanValue === true) continue;
    const st = fsStr(f, 'startTime'), inst = fsStr(f, 'instituteId'); if (!st || !inst) continue;
    const stMs = Date.parse(st.slice(0, 16) + ':00Z'); if (isNaN(stMs)) continue;
    const diff = (stMs - nowL) / 60000;
    const kind = diff <= 1440 && diff > 1380 ? '24' : diff <= 60 && diff > 20 ? '1' : '';
    if (!kind) continue;
    const bl = f.batchLinks && f.batchLinks.mapValue && f.batchLinks.mapValue.fields ? Object.keys(f.batchLinks.mapValue.fields) : [];
    const when = new Date(stMs).toLocaleString('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    const sy = fsStr(f, 'syllabus').replace(/\s+/g, ' ').slice(0, 170);
    const title = kind === '24' ? '⏰ Kal Test Hai' : '⏰ Test 1 ghante me shuru';
    const body = (fsStr(f, 'title') || 'Test') + ' — ' + when + (sy ? '\n📚 Syllabus: ' + sy : '');
    const targets = bl.length ? bl : [''];
    for (const b of targets) {
      const nid = 'rem_' + testId + '_' + kind + (b ? '_' + b : '');
      const fields = { type: { stringValue: 'reminder' }, testId: { stringValue: testId }, title: { stringValue: title }, body: { stringValue: body.slice(0, 480) },
        createdAt: { timestampValue: new Date().toISOString() }, createdBy: { stringValue: 'system' }, pushedAt: { timestampValue: new Date().toISOString() } };
      if (b) fields.batchId = { stringValue: b };
      const cr = await fetch(base + '/institutes/' + encodeURIComponent(inst) + '/notifications?documentId=' + encodeURIComponent(nid), {
        method: 'POST', headers: { Authorization: 'Bearer ' + at, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields })
      });
      if (!cr.ok) continue;                                                                   // 409 = pehle bhej chuke
      fetch(base + '/institutes/' + encodeURIComponent(inst) + '/ver/main?updateMask.fieldPaths=notifs', { method: 'PATCH', headers: { Authorization: 'Bearer ' + at, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { notifs: { integerValue: String(Date.now()) } } }) }).catch(() => {});
      const topic = b ? batchTopic(inst, b) : 'inst_' + topicSafe(inst);
      if (await fcmTopicSend(at, projectId, topic, title, body, { instituteId: inst, notifId: nid, type: 'reminder', ...(b ? { batchId: b } : {}) })) sent++;
    }
  }
  return { ok: true, checked: rows.length, sent };
}

/* ---------- v169: SnapFiles — apna file storage (notes / PPT / recording / assignment) ----------
   Firebase Storage / Firestore ke bina, wahi R2 bucket (LIVE_R2) me "files/" folder. Upload sirf admin se; download capability-URL
   (unguessable key; URL sirf us batch ke students ko Firestore item se milta hai). Badi file 8 MB ke tukdon (multipart) me jaati hai, isliye
   Worker ki request-size limit se koi dikkat nahi aur file size ki practical limit nahi (R2 free 10 GB total).
   PUT /files/put?name=&type=  (<= 8MB, ek request) | POST /files/start, PUT /files/part?key=&uid=&n=, POST /files/done, POST /files/abort (badi file)
   POST /files/del {key} | GET /files/f/<inst>/<rand>/<name>  (Range support — video seek / resume) */
const FILE_PART = 8 * 1024 * 1024, FILE_MAX = 20 * 1024 * 1024 * 1024;
const fSeg = (x) => String(x || '').replace(/[^A-Za-z0-9._~-]/g, '_').slice(0, 60) || 'x';
const fName = (n) => String(n || 'file').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '').slice(-100) || 'file';
const fKeyOk = (k) => { const p = String(k || '').split('/'); return p.length === 3 && /^[A-Za-z0-9._~-]{1,60}$/.test(p[0]) && !/^\.+$/.test(p[0]) && /^[a-f0-9]{48}$/.test(p[1]) && /^[A-Za-z0-9._-]{1,100}$/.test(p[2]) && !/^\.+$/.test(p[2]); };
const fNew = (seg, name) => seg + '/' + [...crypto.getRandomValues(new Uint8Array(24))].map((x) => x.toString(16).padStart(2, '0')).join('') + '/' + fName(name);
const fType = (t) => (/^[\w.+-]{1,60}\/[\w.+-]{1,80}$/.test(String(t || '')) ? String(t) : 'application/octet-stream');
const FILE_RISKY = /^(text\/html|application\/xhtml|image\/svg|text\/javascript|application\/javascript|text\/xml|application\/xml)/i;
const fHeaders = (extra) => ({ 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin', 'X-Content-Type-Options': 'nosniff', ...extra });

/* ---------- v171: KV backend — bina card ke (R2 ke liye card chahiye) ----------
   Cloudflare Workers KV free plan (card nahi): 1 GB jagah, ek value max 25 MB. File 8 MB ke tukdon me `fp:<key>:<n>`, details `fm:<key>`.
   Limit: total ~950 MB, ek file max 300 MB (free Worker ke 50-subrequest limit me poori file ek baar me pade). R2 (LIVE_R2) bind ho jaaye to wahi pehle chalega
   (koi limit nahi) aur KV ki purani files bhi padhi / delete hoti rahengi. Binding: FILES_KV (ya pehle se bani BANK_KV — koi naya setup nahi). */
const KV_CAP = 950 * 1024 * 1024, KV_MAX_FILE = 300 * 1024 * 1024;
const kvOf = (env) => env.FILES_KV || env.BANK_KV || null;
const kvUsed = async (kv) => { const u = await kv.get('fu:total', 'json'); return (u && Number(u.bytes)) || 0; };
const kvAdd = async (kv, d) => { await kv.put('fu:total', JSON.stringify({ bytes: Math.max(0, (await kvUsed(kv)) + d) })); };
function fileHdrs(ct, nm, size, start, end, status, etag) {
  const risky = FILE_RISKY.test(ct);
  const H = fHeaders({ 'Content-Type': risky ? 'application/octet-stream' : ct, 'Content-Disposition': (risky ? 'attachment' : 'inline') + "; filename*=UTF-8''" + encodeURIComponent(nm),
    'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=31536000, immutable', 'Content-Length': String(end - start + 1), 'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges' });
  if (etag) H['ETag'] = etag; if (status === 206) H['Content-Range'] = 'bytes ' + start + '-' + end + '/' + size; return H;
}
function parseRange(h, size) {
  const rg = /^bytes=(\d*)-(\d*)$/.exec(h || ''); let start = 0, end = size - 1, status = 200;
  if (rg && (rg[1] !== '' || rg[2] !== '')) {
    if (rg[1] === '') start = Math.max(0, size - Number(rg[2])); else { start = Number(rg[1]); end = rg[2] === '' ? size - 1 : Math.min(Number(rg[2]), size - 1); }
    if (!(start <= end) || start >= size) return null; status = 206;
  }
  return { start, end, status };
}
async function kvServe(request, kv, key, ctx) {
  const meta = await kv.get('fm:' + key, { type: 'json', cacheTtl: 300 }); if (!meta) throw new HttpErr(404, 'Not found');
  const size = meta.size, PS = meta.ps || FILE_PART, total = meta.parts, r = parseRange(request.headers.get('Range'), size);
  if (!r) return new Response(null, { status: 416, headers: fHeaders({ 'Content-Range': 'bytes */' + size }) });
  const nm = (() => { try { return decodeURIComponent(meta.name || ''); } catch (e) { return ''; } })() || key.split('/')[2];
  const H = fileHdrs(meta.type || 'application/octet-stream', nm, size, r.start, r.end, r.status, '"' + key.split('/')[1].slice(0, 16) + '"');
  if (request.method === 'HEAD') return new Response(null, { status: r.status, headers: H });
  const { readable, writable } = new TransformStream(), first = Math.floor(r.start / PS) + 1, last = Math.floor(r.end / PS) + 1;
  const pump = (async () => {
    const w = writable.getWriter();
    try {
      for (let n = first; n <= last; n++) {
        const plen = n < total ? PS : size - (total - 1) * PS, ps = (n - 1) * PS, from = Math.max(r.start, ps) - ps, to = Math.min(r.end, ps + plen - 1) - ps;
        const ab = await kv.get('fp:' + key + ':' + n, { type: 'arrayBuffer', cacheTtl: 3600 }); if (!ab) throw new Error('part missing ' + n);
        await w.write(new Uint8Array(ab, from, to - from + 1));
      }
      await w.close();
    } catch (e) { try { await w.abort(e); } catch (x) {} }
  })();
  if (ctx && ctx.waitUntil) ctx.waitUntil(pump);
  return new Response(readable, { status: r.status, headers: H });
}
async function kvDelete(kv, key) {
  const meta = await kv.get('fm:' + key, 'json'); if (!meta) return false;
  for (let n = 1; n <= (meta.parts || 1); n++) await kv.delete('fp:' + key + ':' + n);
  await kv.delete('fm:' + key); await kvAdd(kv, -(meta.size || 0)); return true;
}
async function handleFilesKV(request, env, pathname, kv, ctx) {
  if ((request.method === 'GET' || request.method === 'HEAD') && pathname.indexOf('/files/f/') === 0) {
    const key = pathname.slice('/files/f/'.length); if (!fKeyOk(key)) throw new HttpErr(404, 'Not found'); return await kvServe(request, kv, key, ctx);
  }
  const admin = await liveAdmin(request, env); admin.seg = fSeg(admin.instituteId || 'owner');
  const url = new URL(request.url), q = (k) => url.searchParams.get(k);
  const mine = (key) => { if (!fKeyOk(key)) throw new HttpErr(400, 'Bad key'); if (key.split('/')[0] !== admin.seg) throw new HttpErr(403, 'Ye file aapke institute ki nahi'); return key; };
  const room = async (add) => { const used = await kvUsed(kv); if (used + add > KV_CAP) throw new HttpErr(507, 'Free storage bhar gaya (' + Math.round(used / 1048576) + ' MB / 1 GB) — purani files delete karein'); return used; };
  const nameOf = (n) => encodeURIComponent(String(n || 'file')).slice(0, 300);
  if (request.method === 'GET' && pathname === '/files/usage') return json({ ok: true, used: await kvUsed(kv), cap: KV_CAP, maxFile: KV_MAX_FILE });
  if (request.method === 'PUT' && pathname === '/files/put') {
    const buf = await request.arrayBuffer();
    if (!buf.byteLength) throw new HttpErr(400, 'Khaali file'); if (buf.byteLength > FILE_PART + 1024) throw new HttpErr(413, 'Badi file tukdon me bhejein');
    await room(buf.byteLength); const key = fNew(admin.seg, q('name'));
    await kv.put('fp:' + key + ':1', buf);
    await kv.put('fm:' + key, JSON.stringify({ size: buf.byteLength, parts: 1, ps: FILE_PART, type: fType(q('type')), name: nameOf(q('name')), by: admin.email, at: Date.now() }));
    await kvAdd(kv, buf.byteLength); return json({ ok: true, key, size: buf.byteLength, used: await kvUsed(kv) });
  }
  if (request.method === 'POST' && pathname === '/files/start') {
    const b = await request.json().catch(() => ({})), size = Number(b.size) || 0;
    if (size > KV_MAX_FILE) throw new HttpErr(413, 'Free storage me ek file max 300 MB — isse badi video ke liye YouTube/Drive link use karein');
    await room(size); return json({ ok: true, key: fNew(admin.seg, b.name), uploadId: 'kv', partSize: FILE_PART });
  }
  if (request.method === 'PUT' && pathname === '/files/part') {
    const key = mine(q('key')), n = parseInt(q('n'), 10);
    if (!(n >= 1 && n <= Math.ceil(KV_MAX_FILE / FILE_PART))) throw new HttpErr(400, 'Bad part');
    const buf = await request.arrayBuffer(); if (!buf.byteLength || buf.byteLength > FILE_PART + 1024) throw new HttpErr(413, 'Part size galat');
    await kv.put('fp:' + key + ':' + n, buf); return json({ ok: true, partNumber: n, etag: String(buf.byteLength) });
  }
  if (request.method === 'POST' && pathname === '/files/done') {
    const b = await request.json().catch(() => ({})), key = mine(b.key), parts = Array.isArray(b.parts) ? b.parts : [];
    if (!parts.length || parts.length > Math.ceil(KV_MAX_FILE / FILE_PART)) throw new HttpErr(400, 'Bad parts');
    const sorted = parts.map((p) => ({ n: Number(p.partNumber), len: parseInt(p.etag, 10) })).sort((x, y) => x.n - y.n); let total = 0;
    sorted.forEach((p, i) => { if (p.n !== i + 1 || !(p.len > 0) || (i < sorted.length - 1 && p.len !== FILE_PART)) throw new HttpErr(400, 'Parts adhoore / galat size'); total += p.len; });
    if (total > KV_MAX_FILE) throw new HttpErr(413, 'File bahut badi');
    await kv.put('fm:' + key, JSON.stringify({ size: total, parts: sorted.length, ps: FILE_PART, type: fType(b.type), name: nameOf(b.name), by: admin.email, at: Date.now() }));
    await kvAdd(kv, total); return json({ ok: true, key, size: total, used: await kvUsed(kv) });
  }
  if (request.method === 'POST' && pathname === '/files/abort') {
    const b = await request.json().catch(() => ({})), key = mine(b.key), c = Math.min(40, Number(b.count) || 0);
    for (let n = 1; n <= c; n++) await kv.delete('fp:' + key + ':' + n); return json({ ok: true });
  }
  if (request.method === 'POST' && pathname === '/files/del') { const b = await request.json().catch(() => ({})); await kvDelete(kv, mine(b.key)); return json({ ok: true }); }
  throw new HttpErr(404, 'Unknown files endpoint');
}

async function handleFiles(request, env, pathname, ctx) {
  if (!env.LIVE_R2) { const kv = kvOf(env); if (kv) return await handleFilesKV(request, env, pathname, kv, ctx); throw new HttpErr(501, 'File storage binding nahi hai — Worker me FILES_KV (free, card nahi) ya LIVE_R2 jodein'); }
  const R = env.LIVE_R2;
  if ((request.method === 'GET' || request.method === 'HEAD') && pathname.indexOf('/files/f/') === 0) {           // public (capability-URL) read
    const key = pathname.slice('/files/f/'.length); if (!fKeyOk(key)) throw new HttpErr(404, 'Not found');
    const head = await R.head('files/' + key); if (!head) { const kv0 = kvOf(env); if (kv0) return await kvServe(request, kv0, key, ctx); throw new HttpErr(404, 'Not found'); }
    const size = head.size, rg = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('Range') || '');
    let status = 200, opt, start = 0, end = size - 1;
    if (rg && (rg[1] !== '' || rg[2] !== '')) {
      if (rg[1] === '') { start = Math.max(0, size - Number(rg[2])); } else { start = Number(rg[1]); end = rg[2] === '' ? size - 1 : Math.min(Number(rg[2]), size - 1); }
      if (!(start <= end) || start >= size) return new Response(null, { status: 416, headers: fHeaders({ 'Content-Range': 'bytes */' + size }) });
      status = 206; opt = { range: { offset: start, length: end - start + 1 } };
    }
    const ct = (head.httpMetadata && head.httpMetadata.contentType) || 'application/octet-stream', risky = FILE_RISKY.test(ct);
    let nm = key.split('/')[2]; try { const m = head.customMetadata && head.customMetadata.name; if (m) nm = decodeURIComponent(m); } catch (e) {}
    const H = fHeaders({ 'Content-Type': risky ? 'application/octet-stream' : ct, 'Content-Disposition': (risky ? 'attachment' : 'inline') + "; filename*=UTF-8''" + encodeURIComponent(nm),
      'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=31536000, immutable', 'ETag': head.httpEtag, 'Content-Length': String(end - start + 1), 'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges' });
    if (status === 206) H['Content-Range'] = 'bytes ' + start + '-' + end + '/' + size;
    if (request.method === 'HEAD') return new Response(null, { status, headers: H });
    const o = await R.get('files/' + key, opt); if (!o) throw new HttpErr(404, 'Not found');
    return new Response(o.body, { status, headers: H });
  }
  const admin = await liveAdmin(request, env); admin.seg = fSeg(admin.instituteId || 'owner');
  const url = new URL(request.url), q = (k) => url.searchParams.get(k);
  const mine = (key) => { if (!fKeyOk(key)) throw new HttpErr(400, 'Bad key'); if (key.split('/')[0] !== admin.seg) throw new HttpErr(403, 'Ye file aapke institute ki nahi'); return key; };
  const meta = (name) => ({ by: admin.email, name: encodeURIComponent(String(name || 'file')).slice(0, 300), at: String(Date.now()) });
  if (request.method === 'PUT' && pathname === '/files/put') {
    const buf = await request.arrayBuffer();
    if (!buf.byteLength) throw new HttpErr(400, 'Khaali file');
    if (buf.byteLength > FILE_PART + 1024) throw new HttpErr(413, 'Badi file tukdon me bhejein');
    const key = fNew(admin.seg, q('name'));
    await R.put('files/' + key, buf, { httpMetadata: { contentType: fType(q('type')) }, customMetadata: meta(q('name')) });
    return json({ ok: true, key, size: buf.byteLength });
  }
  if (request.method === 'POST' && pathname === '/files/start') {
    const b = await request.json().catch(() => ({}));
    if (Number(b.size) > FILE_MAX) throw new HttpErr(413, 'File bahut badi hai');
    const key = fNew(admin.seg, b.name), mp = await R.createMultipartUpload('files/' + key, { httpMetadata: { contentType: fType(b.type) }, customMetadata: meta(b.name) });
    return json({ ok: true, key, uploadId: mp.uploadId, partSize: FILE_PART });
  }
  if (request.method === 'PUT' && pathname === '/files/part') {
    const key = mine(q('key')), n = parseInt(q('n'), 10), uid = String(q('uid') || '');
    if (!(n >= 1 && n <= 10000) || !uid) throw new HttpErr(400, 'Bad part');
    const buf = await request.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > FILE_PART + 1024) throw new HttpErr(413, 'Part size galat');
    const part = await R.resumeMultipartUpload('files/' + key, uid).uploadPart(n, buf);
    return json({ ok: true, partNumber: part.partNumber, etag: part.etag });
  }
  if (request.method === 'POST' && pathname === '/files/done') {
    const b = await request.json().catch(() => ({})), key = mine(b.key);
    const parts = (Array.isArray(b.parts) ? b.parts : []).map((p) => ({ partNumber: Number(p.partNumber), etag: String(p.etag) })).sort((x, y) => x.partNumber - y.partNumber);
    if (!parts.length || parts.length > 10000 || !b.uploadId) throw new HttpErr(400, 'Bad parts');
    const obj = await R.resumeMultipartUpload('files/' + key, String(b.uploadId)).complete(parts);
    return json({ ok: true, key, size: obj.size });
  }
  if (request.method === 'POST' && pathname === '/files/abort') {
    const b = await request.json().catch(() => ({})), key = mine(b.key);
    try { await R.resumeMultipartUpload('files/' + key, String(b.uploadId || '')).abort(); } catch (e) {}
    return json({ ok: true });
  }
  if (request.method === 'POST' && pathname === '/files/del') {
    const b = await request.json().catch(() => ({})), key = mine(b.key);
    await R.delete('files/' + key); try { const kv0 = kvOf(env); kv0 && await kvDelete(kv0, key); } catch (e) {} return json({ ok: true });
  }
  throw new HttpErr(404, 'Unknown files endpoint');
}

export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(sendReminders(env).catch((e) => console.log('reminder fail', e && e.message))); },
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const pathname = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
    try {
      if (pathname === '/bank' || pathname === '/bank/meta') return await handleBank(request, env, pathname);
      if (pathname.indexOf('/live/') === 0) return await handleLive(request, env, pathname);
      if (pathname.indexOf('/files/') === 0) return await handleFiles(request, env, pathname, ctx);
      if (pathname === '/alert') return json(await handleAlert(request, env));
      if (pathname === '/alerts' || pathname === '/alerts/clear') return json(await handleAlertsList(request, env, pathname));
      if (pathname === '/broadcast') return json(await handleBroadcast(request, env));
      if (request.method !== 'POST') return json({ ok: true, service: 'snaptestpro-push' });
      return json(await handle(request, env));
    }
    catch (e) { return json({ ok: false, error: e.message || String(e) }, e.status || 500); }
  }
};
