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
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

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

  const at = await googleAccessToken(sa);
  const docUrl = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents/institutes/' +
    encodeURIComponent(instituteId) + '/notifications/' + encodeURIComponent(notifId);
  const dr = await fetch(docUrl, { headers: { Authorization: 'Bearer ' + at } });
  if (dr.status === 404) throw new HttpErr(404, 'Notification doc nahi mili');
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

  const topic = 'inst_' + instituteId.replace(/[^a-zA-Z0-9\-_.~%]/g, '_');
  const fr = await fetch('https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send', {
    method: 'POST', headers: { Authorization: 'Bearer ' + at, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: {
      topic,
      notification: { title: s('title').slice(0, 100) || 'SnapTest Pro', body: s('body').slice(0, 300) },
      data: { instituteId, notifId, type: s('type') || 'admin' },
      android: { priority: 'HIGH', ttl: '86400s', notification: { sound: 'default' } }
    } })
  });
  if (!fr.ok) throw new HttpErr(502, 'FCM fail ' + fr.status + ' ' + (await fr.text()).slice(0, 200));
  return { ok: true };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'POST') return json({ ok: true, service: 'snaptestpro-push' });
    try { return json(await handle(request, env)); }
    catch (e) { return json({ ok: false, error: e.message || String(e) }, e.status || 500); }
  }
};
