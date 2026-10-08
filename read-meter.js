/* Firestore READ METER (sirf napne ke liye, kuch badalta nahi).
   Har collection se kitne reads ho rahe hain ye ginta hai (is device par).
   Admin login ke baad neeche-left me 📊 button dikhega. Dabane par table khulti hai. */
(function () {
  "use strict";
  var KEY = "snap_read_meter_v1", data = { since: Date.now(), cols: {} }, dirty = false;
  try { var s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && s.cols) data = s; } catch (e) {}
  function save() { if (!dirty) return; dirty = false; try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} }
  setInterval(save, 2000);
  function label(ref) {
    try {
      var p = ref.path;
      if (!p) { var q = (ref._delegate || ref)._query; p = q && q.path && q.path.canonicalString ? q.path.canonicalString() : ""; }
      if (!p) return "?";
      return p.split("/").filter(function (_, i) { return i % 2 === 0; }).join("/");
    } catch (e) { return "?"; }
  }
  function add(name, kind, n) {
    if (!n) return;
    var c = data.cols[name] || (data.cols[name] = { reads: 0, get: 0, live: 0 });
    c.reads += n; c[kind] += n; dirty = true;
  }
  function wrapGet(proto, isDoc) {
    var orig = proto.get; if (!orig || orig.__m) return;
    proto.get = function () {
      var name = label(this);
      return orig.apply(this, arguments).then(function (snap) {
        try { if (!(snap.metadata && snap.metadata.fromCache)) add(name, "get", isDoc ? 1 : Math.max(snap.size, 1)); } catch (e) {}
        return snap;
      });
    };
    proto.get.__m = 1;
  }
  function wrapSnap(proto, isDoc) {
    var orig = proto.onSnapshot; if (!orig || orig.__m) return;
    proto.onSnapshot = function () {
      var name = label(this), args = Array.prototype.slice.call(arguments), first = true;
      function count(snap) {
        try {
          if (snap.metadata && snap.metadata.fromCache) return;
          if (isDoc) { add(name, "live", 1); return; }
          var n = first ? snap.size : snap.docChanges().length; first = false;
          add(name, "live", Math.max(n, first ? 1 : 0));
        } catch (e) {}
      }
      for (var i = 0; i < args.length; i++) {
        var a = args[i];
        if (typeof a === "function") { (function (idx, fn) { args[idx] = function (snap) { count(snap); return fn.apply(this, arguments); }; })(i, a); break; }
        if (a && typeof a === "object" && typeof a.next === "function") { (function (obj) { var fn = obj.next; args[i] = Object.assign({}, obj, { next: function (snap) { count(snap); return fn.apply(obj, arguments); } }); })(a); break; }
      }
      return orig.apply(this, args);
    };
    proto.onSnapshot.__m = 1;
  }
  function install() {
    try {
      var F = window.firebase && firebase.firestore; if (!F) return false;
      if (F.Query) { wrapGet(F.Query.prototype, false); wrapSnap(F.Query.prototype, false); }
      if (F.DocumentReference) { wrapGet(F.DocumentReference.prototype, true); wrapSnap(F.DocumentReference.prototype, true); }
      return true;
    } catch (e) { console.warn("[read-meter] install fail", e); return false; }
  }
  install();

  /* ---- UI ---- */
  function isAdminUser() { try { var u = window.vishnuFirebase && window.vishnuFirebase.auth && window.vishnuFirebase.auth.currentUser; return !!(u && !u.isAnonymous && u.email); } catch (e) { return false; } }
  var btn, ov;
  function render() {
    save();
    var rows = Object.keys(data.cols).map(function (k) { return [k, data.cols[k]]; }).sort(function (a, b) { return b[1].reads - a[1].reads; });
    var tot = rows.reduce(function (s, r) { return s + r[1].reads; }, 0);
    var h = '<div style="font-weight:700;margin-bottom:6px">📊 Firestore reads (is device par)</div><div style="font-size:.78rem;margin-bottom:8px">Shuru: ' + new Date(data.since).toLocaleString() + '<br><b>Total: ' + tot + '</b></div><table style="width:100%;font-size:.76rem;border-collapse:collapse"><tr style="text-align:left"><th>Collection</th><th>Total</th><th>get</th><th>live</th></tr>';
    rows.forEach(function (r) { h += '<tr style="border-top:1px solid #334155"><td style="word-break:break-all;padding:3px 4px 3px 0">' + r[0] + '</td><td>' + r[1].reads + '</td><td>' + r[1].get + '</td><td>' + r[1].live + '</td></tr>'; });
    var pi = null; try { pi = JSON.parse(localStorage.getItem("snap_bank_pub_info") || "null"); } catch (e) {}
    var pubTxt = pi ? (pi.ok ? "✅ " : "❌ ") + pi.msg + " (" + new Date(pi.ts).toLocaleString() + ")" : "abhi tak nahi hua";
    h += '</table><div style="margin-top:8px;font-size:.76rem">Bank publish: ' + pubTxt + '</div><div style="margin-top:10px;display:flex;gap:8px"><button id="rm-reset" style="flex:1;padding:8px;border-radius:10px;border:0">Reset</button><button id="rm-close" style="flex:1;padding:8px;border-radius:10px;border:0">Band karein</button></div><div style="margin-top:8px;display:flex;gap:8px"><button id="rm-bank" style="flex:1;padding:8px;border-radius:10px;border:0">🔄 Bank refresh</button><button id="rm-exp" style="flex:1;padding:8px;border-radius:10px;border:0">⬇️ Bank export</button></div><div style="margin-top:8px"><button id="rm-pub" style="width:100%;padding:10px;border-radius:10px;border:0;background:#16a34a;color:#fff;font-weight:700">⬆️ Bank publish abhi karein</button></div>';
    ov.innerHTML = h;
    ov.querySelector("#rm-reset").onclick = function () { data = { since: Date.now(), cols: {} }; dirty = true; save(); render(); };
    ov.querySelector("#rm-close").onclick = function () { ov.style.display = "none"; };
    ov.querySelector("#rm-bank").onclick = function () { if (window.refreshBankNow) { window.refreshBankNow(); alert("Bank live sync chalu — reads lagenge (ek baar)."); } };
    ov.querySelector("#rm-pub").onclick = function () { if (!window.publishBankManual) return alert("Available nahi"); this.textContent = "⏳ Ho raha hai..."; var b = this; window.publishBankManual().then(function (m) { b.textContent = "⬆️ Bank publish abhi karein"; alert(m); render(); }); };
    ov.querySelector("#rm-exp").onclick = function () { window.exportBankJson && window.exportBankJson(); };
  }
  function ui() {
    if (!btn) {
      btn = document.createElement("button"); btn.textContent = "📊";
      btn.style.cssText = "position:fixed;left:10px;bottom:70px;z-index:2147483646;width:42px;height:42px;border-radius:50%;border:0;background:#0f172a;color:#fff;font-size:1.1rem;box-shadow:0 4px 14px rgba(0,0,0,.4);display:none";
      ov = document.createElement("div");
      ov.style.cssText = "position:fixed;left:10px;right:10px;bottom:120px;max-height:60vh;overflow:auto;z-index:2147483646;background:#0f172a;color:#fff;border-radius:14px;padding:12px;display:none;box-shadow:0 8px 24px rgba(0,0,0,.45)";
      btn.onclick = function () { if (ov.style.display === "block") ov.style.display = "none"; else { ov.style.display = "block"; render(); } };
      document.body.appendChild(btn); document.body.appendChild(ov);
    }
    btn.style.display = isAdminUser() ? "block" : "none";
  }
  function start() { setInterval(function () { try { ui(); } catch (e) {} }, 2500); }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start();
})();
