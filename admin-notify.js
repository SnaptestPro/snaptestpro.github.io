/* v155 — Admin: students ko Notification bhejna + naya test publish hone par auto-notification.
   Data: institutes/{instituteId}/notifications/{id}  (firestore.rules me naya match — deploy zaroori)
   Student side: app-ui.js bell -> Notifications page ye docs padhta hai. */
(function () {
  "use strict";
  function $(i) { return document.getElementById(i); }
  function db() { return window.vishnuFirebase && window.vishnuFirebase.enabled ? window.vishnuFirebase.db : null; }
  function inst() { try { return typeof getCurrentAdminInstituteId === "function" ? getCurrentAdminInstituteId() : null; } catch (e) { return null; } }
  function col() { var d = db(), i = inst(); return d && i ? d.collection("institutes").doc(i).collection("notifications") : null; }
  function ts() { return firebase.firestore.FieldValue.serverTimestamp(); }
  function email() { try { var a = typeof getAuth === "function" ? getAuth() : null; return (a && a.currentUser && a.currentUser.email) || ""; } catch (e) { return ""; } }
  function ago(ms) { var m = Math.floor((Date.now() - ms) / 60000); return m < 1 ? "Abhi" : m < 60 ? m + " min pehle" : m < 1440 ? Math.floor(m / 60) + " ghante pehle" : Math.floor(m / 1440) + " din pehle"; }

  // 1) Naya test publish hote hi auto-notification (ek test ke liye sirf ek baar: doc id = t_<testId>)
  function hookSave() {
    if (typeof window.saveTestOnline !== "function" || window.saveTestOnline.__an) return;
    var orig = window.saveTestOnline;
    var w = async function (id, t) {
      var r = await orig.apply(this, arguments);
      try {
        var c = t && t.isDraft === false && col();
        if (c) c.doc("t_" + id).set({ type: "test", testId: String(id), title: "Naya Test Publish Hua!", body: (t.title || "Ek naya test") + " ab available hai", createdAt: ts(), createdBy: email() }).then(function () { window.SnapPush && window.SnapPush.send("t_" + id); }).catch(function () { /* pehle se bhej chuke hain (edit) — ignore */ });
      } catch (e) {}
      return r;
    };
    w.__an = 1; window.saveTestOnline = w;
  }

  // 2) Overlay: notification likhna + purani list
  function build() {
    if ($("an-ov")) return;
    var o = document.createElement("div"); o.id = "an-ov";
    o.style.cssText = "position:fixed;inset:0;z-index:99998;background:rgba(15,27,61,.5);display:none;align-items:center;justify-content:center;padding:14px;box-sizing:border-box";
    o.innerHTML = '<div style="background:#fff;border-radius:20px;width:100%;max-width:480px;max-height:90vh;overflow:auto;padding:16px;box-sizing:border-box">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><h3 style="margin:0;font-size:1.05rem">🔔 Notification Bhejein</h3><button type="button" id="an-x" style="background:none;border:0;font-size:1.3rem;cursor:pointer">✕</button></div>' +
      '<p class="muted-text" style="margin:0 0 10px;font-size:.78rem">Aapke institute ke sabhi students ko dikhega (unke app ke Notifications mein).</p>' +
      '<input id="an-title" maxlength="80" placeholder="Title (jaise: Kal test hai)" style="width:100%;box-sizing:border-box;margin-bottom:8px">' +
      '<textarea id="an-body" maxlength="300" rows="3" placeholder="Message likhein..." style="width:100%;box-sizing:border-box;margin-bottom:8px"></textarea>' +
      '<button type="button" id="an-send" class="btn-primary" style="width:100%">📤 Students ko bhejein</button>' +
      '<p id="an-st" class="muted-text" style="margin:8px 0 0;font-size:.8rem"></p>' +
      '<h4 style="margin:14px 0 6px;font-size:.9rem">Pehle bheje gaye</h4><div id="an-list"></div></div>';
    document.body.appendChild(o);
    o.onclick = function (e) { if (e.target === o) close(); };
    $("an-x").onclick = close;
    $("an-send").onclick = send;
  }
  function close() { var o = $("an-ov"); o && (o.style.display = "none"); }
  function st(m) { var e = $("an-st"); e && (e.textContent = m); }
  function open() {
    build(); $("an-ov").style.display = "flex"; st(""); loadList();
  }
  function send() {
    var c = col(), t = $("an-title").value.trim(), b = $("an-body").value.trim();
    if (!c) return st("❌ Institute pehchaan nahi hua — admin dobara login karein.");
    if (!t || !b) return st("⚠️ Title aur message dono bharein.");
    var btn = $("an-send"); btn.disabled = true; st("⏳ Bhej rahe hain...");
    c.add({ type: "admin", title: t, body: b, createdAt: ts(), createdBy: email() }).then(function (ref) {
      window.SnapPush && window.SnapPush.send(ref.id);
      $("an-title").value = ""; $("an-body").value = ""; st("✅ Bhej diya gaya!"); btn.disabled = false; loadList();
    }).catch(function (e) {
      btn.disabled = false;
      st(/permission/i.test(String(e && e.message)) ? "❌ Permission nahi mili — naya firestore.rules deploy karein." : "❌ Nahi bhej paaye: " + ((e && e.message) || e));
    });
  }
  function loadList() {
    var c = col(), box = $("an-list"); if (!c || !box) return;
    box.textContent = "Loading...";
    c.orderBy("createdAt", "desc").limit(20).get().then(function (s) {
      box.textContent = "";
      if (s.empty) { box.textContent = "Abhi koi notification nahi bheji gayi."; box.style.cssText = "font-size:.8rem;color:#64748b"; return; }
      s.forEach(function (d) {
        var x = d.data(), ms = x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : Date.now();
        var r = document.createElement("div"); r.style.cssText = "display:flex;gap:8px;align-items:flex-start;border:1px solid #e4ebfb;border-radius:12px;padding:8px 10px;margin-bottom:6px";
        var tx = document.createElement("div"); tx.style.cssText = "flex:1;min-width:0;font-size:.82rem";
        var b1 = document.createElement("b"); b1.textContent = x.title || ""; var p = document.createElement("div"); p.textContent = x.body || ""; p.style.color = "#475569";
        var sm = document.createElement("small"); sm.textContent = (x.type === "test" ? "📝 Auto (test) • " : "") + ago(ms); sm.style.color = "#94a3b8";
        tx.append(b1, p, sm);
        var del = document.createElement("button"); del.type = "button"; del.textContent = "🗑️"; del.style.cssText = "background:none;border:0;cursor:pointer;font-size:1.05rem";
        del.onclick = function () { if (confirm("Ye notification delete karein? Students ki list se bhi hat jayegi.")) d.ref.delete().then(loadList).catch(function () { st("❌ Delete nahi hua."); }); };
        r.append(tx, del); box.appendChild(r);
      });
    }).catch(function (e) { box.textContent = /permission/i.test(String(e && e.message)) ? "Naya firestore.rules deploy karein." : "List load nahi hui."; });
  }

  function init() {
    hookSave();
    var grid = document.querySelector("#admin-dashboard-home .cd-grid");
    if (grid && !$("an-card")) {
      var b = document.createElement("button"); b.type = "button"; b.id = "an-card"; b.className = "cd-card cd-gold";
      b.innerHTML = '<div class="cd-card-top"><div class="cd-icon-circle">🔔</div><span class="cd-badge">Students</span></div><div class="cd-card-title">Notification</div><div class="cd-card-sub">Students ko message bhejein</div><div class="cd-card-bottom"><span class="cd-arrow-btn">→</span></div>';
      b.onclick = open; grid.appendChild(b);
    }
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
})();
