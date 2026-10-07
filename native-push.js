/* Real push (app band ho tab bhi) — FCM topic + free Cloudflare Worker relay.
   Website (browser) par ye kuch nahi karta; sirf Android app me chalta hai.
   STUDENT: login ke baad apne institute ke topic "inst_<id>" ko subscribe.
   ADMIN  : notification save hone ke baad window.SnapPush.send(notifId) Worker ko bulata hai. */
(function () {
  "use strict";
  // ⬇️ Cloudflare Worker deploy karne ke baad uska URL yahan daalein (PUSH_SETUP_FREE_REALTIME.md dekhein)
  var PUSH_WORKER_URL = "https://cool-thunder-a280.vishnu1234stm.workers.dev";

  var OPT_OUT = "savya_push_optout_v1", SUB_KEY = "snap_fcm_topic_v1", ASKED = "snap_fcm_asked_v1";
  function getCap() {
    var w = []; try { if (window.top) w.push(window.top); } catch (e) {}
    try { if (window.parent && window.parent !== window.top) w.push(window.parent); } catch (e) {}
    w.push(window);
    for (var i = 0; i < w.length; i++) { try { var c = w[i].Capacitor; if (c && typeof c.nativePromise === "function") return c; } catch (e) {} }
    return null;
  }
  function toast(m) {
    try { var b = document.createElement("div"); b.textContent = m;
      b.style.cssText = "position:fixed;left:50%;top:18px;transform:translateX(-50%);background:#0f172a;color:#fff;padding:10px 16px;border-radius:14px;font-size:.8rem;z-index:2147483647;max-width:90vw;text-align:center;box-shadow:0 6px 18px rgba(0,0,0,.35);pointer-events:none";
      document.body.appendChild(b); setTimeout(function () { b.remove(); }, 5000); } catch (e) {}
  }
  function topicFor(id) { return "inst_" + String(id).replace(/[^a-zA-Z0-9\-_.~%]/g, "_"); }
  function native(method, opts) { var C = getCap(); return C ? C.nativePromise("FirebaseMessaging", method, opts || {}) : Promise.reject(new Error("no plugin")); }

  /* ---------- Admin: Worker ko bulao ---------- */
  function send(notifId) {
    try {
      var a = typeof getAuth === "function" ? getAuth() : null, u = a && a.currentUser;
      var inst = typeof getCurrentAdminInstituteId === "function" ? getCurrentAdminInstituteId() : null;
      if (!u || !inst || !notifId || /YOUR-SUBDOMAIN/.test(PUSH_WORKER_URL)) { toast("⚠️ Push nahi gaya: " + (!u ? "admin email login nahi hai" : !inst ? "institute id nahi mila" : "Worker URL set nahi")); return Promise.resolve(false); }
      return u.getIdToken().then(function (t) {
        return fetch(PUSH_WORKER_URL, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ idToken: t, instituteId: inst, notifId: String(notifId) }) });
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.ok) { console.warn("[SnapPush] push fail:", j.error); toast("❌ Push fail: " + j.error); } else toast("📲 Push bhej diya gaya"); return !!j.ok;
      }).catch(function (e) { console.warn("[SnapPush] push error", e); toast("❌ Worker tak nahi pahunch paaye: " + ((e && e.message) || e)); return false; });
    } catch (e) { return Promise.resolve(false); }
  }
  window.SnapPush = { send: send };

  /* ---------- Student (sirf Android app) ---------- */
  if (!getCap() || window.top !== window) return;
  var busy = false, lastErr = "", noInst = false;
  async function sync() {
    if (busy) return; busy = true;
    try {
      var s = typeof getStudentSession === "function" ? getStudentSession() : null;
      if (s && !s.instituteId && !noInst) { noInst = true; toast("⚠️ Push: aapke account me institute ID nahi mila"); }
      var want = s && s.instituteId && !localStorage.getItem(OPT_OUT) ? topicFor(s.instituteId) : "";
      var have = localStorage.getItem(SUB_KEY) || "";
      if (want === have) return;
      if (have) { try { await native("unsubscribeFromTopic", { topic: have }); } catch (e) {} localStorage.removeItem(SUB_KEY); }
      if (want) {
        var p = await native("checkPermissions");
        if (p.receive !== "granted") { p = await native("requestPermissions"); }
        if (p.receive !== "granted") { if (lastErr !== "perm") { lastErr = "perm"; toast("⚠️ Notification permission nahi mili — phone Settings me Allow karein"); } return; }
        await native("subscribeToTopic", { topic: want });
        localStorage.setItem(SUB_KEY, want); lastErr = ""; toast("🔔 Push chalu ho gaya");
      }
    } catch (e) { var m = String((e && (e.message || e.errorMessage)) || e); console.warn("[SnapPush] sync", m); if (lastErr !== m) { lastErr = m; toast("❌ Push setup error: " + m.slice(0, 120)); } }
    finally { busy = false; }
  }
  setTimeout(sync, 2500); setInterval(sync, 5000);
})();
