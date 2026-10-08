/* v153 — Analysis cleanup, proper Settings/Help/About, header-button submit bug fix.
   v149 — student app shell: header, Home polish, Tests search, Analysis/More pages, bottom nav */
(function () {
  "use strict";
  function ready(f) { document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", f) : f(); }
  function $(i) { return document.getElementById(i); }
  var IC = {"home": "M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z", "doc": "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M9 13h6 M9 17h6", "chart": "M5 21V11 M12 21V4 M19 21v-7", "grid": "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z", "menu": "M4 6h16 M4 12h16 M4 18h16", "bell": "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 0 1-3.4 0", "user": "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8", "trophy": "M8 21h8 M12 17v4 M7 4h10v5a5 5 0 0 1-10 0z M7 6H4v2a3 3 0 0 0 3 3 M17 6h3v2a3 3 0 0 1-3 3", "cube": "M12 2l9 5v10l-9 5-9-5V7z M12 12l9-5 M12 12v10 M12 12L3 7", "gear": "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z", "headset": "M3 18v-6a9 9 0 0 1 18 0v6 M21 19a2 2 0 0 1-2 2h-1v-6h3z M3 19a2 2 0 0 0 2 2h1v-6H3z", "info": "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 16v-4 M12 8h.01", "receipt": "M6 2h12v20l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6", "trend": "M3 17l6-6 4 4 8-8 M15 7h6v6", "x": "M18 6L6 18 M6 6l12 12", "pie": "M21 12A9 9 0 1 1 12 3v9z M15 3.5A9 9 0 0 1 20.5 9H15z", "target": "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "cap": "M22 10L12 5 2 10l10 5z M6 12v5c3 2 9 2 12 0v-5", "back": "M15 18l-6-6 6-6", "phone": "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z", "mail": "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M22 6l-10 7L2 6", "chat": "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", "trash": "M3 6h18 M8 6V4h8v2 M6 6l1 14h10l1-14", "bulb": "M9 18h6 M10 22h4 M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"};
  var EM = { "🏆": ["trophy", "#f59e0b"], "🧊": ["cube", "#3b82f6"], "⚙️": ["gear", "#64748b"], "🎧": ["headset", "#3b82f6"], "ℹ️": ["info", "#3b82f6"], "🧾": ["receipt", "#6d5dfc"], "📈": ["trend", "#0ea5a4"], "❌": ["x", "#ef4444"], "🥧": ["pie", "#3b82f6"], "📊": ["chart", "#7c5cfc"], "📄": ["doc", "#2f6bf2"], "🎯": ["target", "#a855f7"], "💡": ["bulb", "#f59e0b"], "📞": ["phone", "#16a34a"], "✉️": ["mail", "#2563eb"], "💬": ["chat", "#22c55e"] };
  function svg(n, z, c) { return '<span class="sn-i" style="' + (z ? "width:" + z + "px;height:" + z + "px;" : "") + (c ? "color:" + c : "") + '"><svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + IC[n] + '"/></svg></span>'; }
  function E(e, z) { var m = EM[e]; return m ? svg(m[0], z, m[1]) : e; }
  function fixNav() { var n = $("sn-nav"); n && n.offsetHeight > 0 && document.documentElement.style.setProperty("--snh", n.offsetHeight + "px"); }
  function go(id) { try { typeof goStudentSection === "function" && goStudentSection(id); } catch (e) { console.warn(e); } window.scrollTo(0, 0); }
  function toast(m) { var b = document.createElement("div"); b.textContent = m; b.style.cssText = "position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#1e1b4b;color:#fff;padding:10px 18px;border-radius:22px;font-size:.82rem;z-index:99999;max-width:86vw;text-align:center"; document.body.appendChild(b); setTimeout(function () { b.remove(); }, 2200); }
  function mark(k) { document.querySelectorAll("#sn-nav button").forEach(function (b) { b.classList.toggle("on", b.dataset.k === (k === "help" || k === "about" ? "more" : k === "notifs" ? "home" : k)); }); }
  function hidePage() { var p = $("sn-page"); curPage = ""; p && (p.style.display = "none"); }
  var __C = window.SNAP_CONFIG || {}, APP_VER = (__C.version || "1.0") + " (build " + (__C.build || "155") + ")", SUPPORT_PHONE = __C.supportPhone || "9525208263", SUPPORT_EMAIL = __C.supportEmail || "vishnu1234stm@gmail.com";
  /* ---------- Notifications (bell) ----------
     Local: is device par live-publish hook se. Server: institutes/{id}/notifications (admin ne bheji / naya test). */
  var NK = "sn_notif_srv_local", SK = "sn_notif_srv", SEEN = "sn_notif_seen", CLR = "sn_notif_clear", SRV = [], lastFetch = 0, curPage = "";
  function lsj(k, d) { try { return JSON.parse(localStorage.getItem(k) || "") || d; } catch (e) { return d; } }
  function nGet() { return lsj(NK, []); }
  function nSet(a) { try { localStorage.setItem(NK, JSON.stringify(a.slice(0, 30))); } catch (e) {} }
  SRV = lsj(SK, []);
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function ago(t) { var m = Math.floor((Date.now() - t) / 60000); return m < 1 ? "Abhi" : m < 60 ? m + " min pehle" : m < 1440 ? Math.floor(m / 60) + " ghante pehle" : Math.floor(m / 1440) + " din pehle"; }
  function nAll() {
    var bodies = {}; SRV.forEach(function (n) { bodies[n.b] = 1; });
    var clr = +localStorage.getItem(CLR) || 0;
    return SRV.concat(nGet().filter(function (n) { return !bodies[n.b]; })).filter(function (n) { return n.ts > clr; }).sort(function (a, b) { return b.ts - a.ts; }).slice(0, 30);
  }
  function nDot() { var d = document.querySelector("#sn-top .sn-dot"), seen = +localStorage.getItem(SEEN) || 0; d && (d.style.display = nAll().some(function (n) { return n.ts > seen; }) ? "block" : "none"); }
  function nAdd(title, body) { var a = nGet(); a.unshift({ t: title, b: body, ts: Date.now() }); nSet(a); nDot(); }
  function nRefresh(force) {
    var now = Date.now(); if (!force && now - lastFetch < 60000) return Promise.resolve();
    var ss = null; try { ss = typeof getStudentSession === "function" ? getStudentSession() : null; } catch (e) {}
    var vf = window.vishnuFirebase; if (!ss || !ss.instituteId || !vf || !vf.enabled || !vf.db) return Promise.resolve();
    lastFetch = now;
    return Promise.resolve(vf.authReady).catch(function () {}).then(function () {
      return vf.db.collection("institutes").doc(ss.instituteId).collection("notifications").orderBy("createdAt", "desc").limit(15).get();
    }).then(function (q) {
      var a = []; q.forEach(function (d) { var x = d.data(); a.push({ id: d.id, t: x.title || "", b: x.body || "", ts: x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : Date.now() }); });
      SRV = a; try { localStorage.setItem(SK, JSON.stringify(a)); } catch (e) {} nDot();
    }).catch(function () { lastFetch = 0; });
  }
  function me() { return window._selfRankStudent || null; }
  function pct() { var s = me(); return s && s.totalMaxScore ? Math.round(100 * s.totalScore / s.totalMaxScore) : null; }

  // saved text size turant lagao (flash na ho)
  try { var _ts = localStorage.getItem("sn_textsize"); _ts && (document.documentElement.style.fontSize = _ts + "%"); } catch (e) {}

  var T = function (ic, bg, t, s, act) { return { ic: ic, bg: bg, t: t, s: s, act: act }; };
  var PAGES = {
    analysis: function () {
      var p = pct(), tl = [
        T("🧾", "#e8e7ff", "Mera Result", "View your result", "my-result-detail-card"), T("📈", "#d9f7f3", "My Progress", "Track your growth", "my-progress-card"),
        T("❌", "#ffe4e4", "My Mistakes", "Learn from mistakes", "my-mistakes-card"), T("🏆", "#fff0cc", "My Rank", "See your position", "student-results-card")];
      return '<div class="ph"><button data-a="menu">' + svg("menu") + '</button><b>Analysis</b></div><div class="sn-perf"><div><b>Overall Performance</b><p>' + (p === null ? "Test dene ke baad yahan aapka score dikhega." : "Keep it up! Your performance is improving.") + '</p></div><div class="sn-ring" style="--p:' + (p || 0) * 3.6 + 'deg"><span>' + (p === null ? "–" : p + "%") + '</span></div></div><div class="sn-tiles">' +
        tl.map(function (x) { return '<button class="sn-tile" data-id="' + x.act + '"><div class="i" style="background:' + x.bg + '">' + E(x.ic) + "</div><b>" + x.t + "</b><small>" + x.s + "</small></button>"; }).join("") + "</div>" +
        '<button class="sn-row sn-gold" data-id="my-result-detail-card"><div class="i" style="background:#fff">' + E("🏆") + '</div><div>Better Analysis = Better Learning</div></button>';
    },
    more: function () {
      var r = [["🏆", "#fff0cc", "Result Sheet", "Full class result & ranking", "student-results-card"], ["🧊", "#dbeafe", "Solids Lab", "3D Learning Zone", "student-solids-lab-card"], ["⚙️", "#e5e7eb", "Settings", "App Preferences", "student-settings-card"], ["🎧", "#dbeafe", "Help & Support", "Need help? Contact us", "help"], ["ℹ️", "#dbeafe", "About App", "Version " + APP_VER, "about"]];
      return '<div class="ph"><button data-a="menu">' + svg("menu") + '</button><b>More</b></div>' + r.map(function (x) { return '<button class="sn-row" data-id="' + x[4] + '"><div class="i" style="background:' + x[1] + '">' + E(x[0]) + "</div><div>" + x[2] + "<small>" + x[3] + "</small></div></button>"; }).join("") + '<div class="sn-banner"><div>Dream Big<br>Prepare Smart</div>' + svg("cap") + '</div>';
    },
    notifs: function () {
      var a = nAll(), mx = a.reduce(function (m, n) { return Math.max(m, n.ts); }, +localStorage.getItem(SEEN) || 0);
      try { localStorage.setItem(SEEN, String(mx)); } catch (e) {} nDot();
      return '<div class="ph"><button type="button" data-a="back">' + svg("back") + '</button><b>Notifications</b>' + (a.length ? '<button type="button" data-a="clear" style="color:#ef4444">' + svg("trash") + "</button>" : "") + "</div>" +
        (a.length ? a.map(function (n) { return '<button type="button" class="sn-row" data-id="student-form-fields-anchor"><div class="i" style="background:#fff0cc">' + E("🏆") + "</div><div>" + esc(n.t) + "<small>" + esc(n.b) + " • " + ago(n.ts) + "</small></div></button>"; }).join("") :
          '<div class="sn-faq" style="text-align:center"><b>Abhi koi notification nahi hai</b><p>Naya test ya admin ka message yahan dikhega.</p></div>');
    },
    help: function () {
      var c = [["📞", "#dcfce7", "Call karein", SUPPORT_PHONE, "tel:" + SUPPORT_PHONE], ["💬", "#dcfce7", "WhatsApp karein", "Chat par turant madad", "https://wa.me/91" + SUPPORT_PHONE + "?text=" + encodeURIComponent("Namaste, mujhe SnapTestPro app mein madad chahiye.")], ["✉️", "#dbeafe", "Email karein", SUPPORT_EMAIL, "mailto:" + SUPPORT_EMAIL + "?subject=" + encodeURIComponent("SnapTestPro Support")]];
      var faq = [["Test start nahi ho raha?", "Internet check karein, phir Settings → \"Cache saaf karke refresh\" dabayein."], ["Naya test list mein nahi dikh raha?", "Tests tab kholkar refresh karein ya app dobara kholein."], ["Password bhool gaye?", "Login screen par \"Forgot Password\" use karein, ya Admin se sampark karein."]];
      return '<div class="ph"><button type="button" data-a="back">' + svg("back") + '</button><b>Help & Support</b></div><div class="sn-perf"><div><b>Koi problem hai?</b><p>Neeche diye gaye number ya email par seedha contact karein.</p></div>' + svg("headset", 48, "#fff") + '</div>' +
        c.map(function (x) { return '<a class="sn-row" href="' + x[4] + '"><div class="i" style="background:' + x[1] + '">' + E(x[0]) + "</div><div>" + x[2] + "<small>" + x[3] + "</small></div></a>"; }).join("") +
        '<div class="sn-h">Aksar poochhe jaane wale sawaal</div>' + faq.map(function (x) { return '<div class="sn-faq"><b>' + x[0] + "</b><p>" + x[1] + "</p></div>"; }).join("");
    },
    about: function () {
      return '<div class="ph"><button type="button" data-a="back">' + svg("back") + '</button><b>About App</b></div><div class="sn-about"><img src="icon-512-maskable.png" alt=""><b>SnapTestPro</b><small>Smart Practice • Better Result</small><span>Version ' + APP_VER + '</span></div>' +
        '<div class="sn-faq"><b>Ye app kya karta hai?</b><p>Online tests, practice mode, result &amp; rank, galat sawaalon ki revision aur 3D Solids Lab — sab ek jagah.</p></div>' +
        '<a class="sn-row" href="mailto:' + SUPPORT_EMAIL + '"><div class="i" style="background:#dbeafe">' + E("🎧") + "</div><div>Help & Support<small>" + SUPPORT_PHONE + " • " + SUPPORT_EMAIL + "</small></div></a>";
    }
  };
  function showPage(k, from) {
    var p = $("sn-page"); curPage = k; p.innerHTML = PAGES[k](); p.style.display = "block"; p.scrollTop = 0; mark(k);
    p.querySelectorAll("button[data-id]").forEach(function (b) {
      b.type = "button";
      b.onclick = function (ev) {
        ev.preventDefault();
        var id = b.dataset.id;
        if (id === "help" || id === "about") return showPage(id, "more");
        hidePage(); go(id);
      };
    });
    var m = p.querySelector('[data-a="menu"]'); m && (m.type = "button", m.onclick = function (ev) { ev.preventDefault(); showPage("more"); });
    var bk = p.querySelector('[data-a="back"]');
    bk && (bk.type = "button", bk.onclick = function (ev) { ev.preventDefault(); if (from === "settings") { hidePage(); mark("home"); go("student-settings-card"); } else if (from === "home") { hidePage(); mark("home"); } else showPage("more"); });
    var cl = p.querySelector('[data-a="clear"]');
    cl && (cl.type = "button", cl.onclick = function (ev) { ev.preventDefault(); var mx = nAll().reduce(function (m, n) { return Math.max(m, n.ts); }, 0); try { localStorage.setItem(CLR, String(mx)); } catch (e) {} nDot(); showPage("notifs", "home"); });
  }
  window.snShowPage = showPage;


  /* ---------- Settings: app ke liye zaroori sab options ---------- */
  var wakeLock = null;
  function wakeCheck() {
    var ex = $("exam-screen"), on = ex && !ex.classList.contains("hidden") && localStorage.getItem("sn_wake") === "1";
    if (!on) { if (wakeLock) { try { wakeLock.release(); } catch (e) {} wakeLock = null; } return; }
    if (wakeLock || !navigator.wakeLock) return;
    wakeLock = true;
    navigator.wakeLock.request("screen").then(function (l) { wakeLock = l; l.addEventListener("release", function () { if (wakeLock === l) wakeLock = null; }); }).catch(function () { wakeLock = null; });
  }
  function buildSettings() {
    var card = $("student-settings-card"); if (!card || $("sn-set")) return;
    var wakeOK = !!navigator.wakeLock, ts = localStorage.getItem("sn_textsize") || "100", wake = localStorage.getItem("sn_wake") === "1";
    function row(ic, bg, t, sm, a) { return '<button type="button" class="sn-row" data-s="' + a + '"><div class="i" style="background:' + bg + '">' + E(ic) + "</div><div>" + t + "<small>" + sm + "</small></div></button>"; }
    var d = document.createElement("div"); d.id = "sn-set";
    d.innerHTML =
      '<div class="sn-h">🎨 Appearance</div>' +
      '<div class="sn-srow"><div><b>Theme</b><small>App ka rang badlein</small></div><button type="button" class="btn-secondary" data-s="theme">Chunein</button></div>' +
      '<div class="sn-srow"><div><b>Text size</b><small>Padhne mein aasani ke liye</small></div><div class="sn-seg" id="sn-ts">' +
      [["90", "Chhota"], ["100", "Normal"], ["112", "Bada"]].map(function (x) { return '<button type="button" data-v="' + x[0] + '"' + (x[0] === ts ? ' class="on"' : "") + ">" + x[1] + "</button>"; }).join("") + "</div></div>" +
      (wakeOK ? '<div class="sn-h">📝 Exam</div><div class="sn-srow"><div><b>Exam ke dauran screen on rakhein</b><small>Test dete waqt screen apne aap band nahi hogi</small></div><label class="sn-sw"><input type="checkbox" id="sn-wake"' + (wake ? " checked" : "") + "><i></i></label></div>" : "") +
      '<div class="sn-h">📱 App & Data</div>' +
      row("📈", "#d9f7f3", "Update check karein", "Latest version ke liye", "update") +
      row("⚙️", "#e5e7eb", "Cache saaf karke refresh", "Dikkat aaye to try karein (login bana rahega)", "cache") +
      '<div class="sn-h">🎧 Help & About</div>' +
      row("🎧", "#dbeafe", "Help & Support", "Call / WhatsApp / Email", "help") +
      row("ℹ️", "#dbeafe", "About App", "Version " + APP_VER, "about");
    var notif = $("push-notify-toggle-btn"), anchor = notif && notif.parentNode;
    anchor && anchor.parentNode === card ? anchor.after(d) : card.appendChild(d);
    var lo = $("student-logout-btn"); lo && card.appendChild(lo); // Logout sabse neeche

    d.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("button"); if (!b) return;
      e.preventDefault();
      if (b.dataset.v) {
        localStorage.setItem("sn_textsize", b.dataset.v); document.documentElement.style.fontSize = b.dataset.v + "%";
        d.querySelectorAll("#sn-ts button").forEach(function (x) { x.classList.toggle("on", x === b); }); return;
      }
      var a = b.dataset.s;
      if (a === "theme") { window.ThemeManager && ThemeManager.togglePicker(); }
      else if (a === "help" || a === "about") { window.snShowPage(a, "settings"); }
      else if (a === "update") {
        if (!navigator.serviceWorker) return toast("Is device par update check available nahi hai.");
        toast("⏳ Update check ho raha hai...");
        navigator.serviceWorker.getRegistration().then(function (r) {
          if (!r) return toast("✅ Aap latest version par hain");
          return r.update().then(function () {
            if (r.installing || r.waiting) { toast("⬆️ Naya version mil gaya — reload ho raha hai"); setTimeout(function () { location.reload(); }, 1200); }
            else toast("✅ Aap latest version par hain");
          });
        }).catch(function () { toast("Update check nahi ho paya — internet check karein."); });
      }
      else if (a === "cache") {
        if (!confirm("Cache saaf karke app refresh karein? Aapka login bana rahega.")) return;
        toast("⏳ Saaf ho raha hai...");
        (window.caches ? caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }) : Promise.resolve()).then(function () { location.reload(); }, function () { location.reload(); });
      }
    });
    var w = $("sn-wake"); w && w.addEventListener("change", function () { localStorage.setItem("sn_wake", w.checked ? "1" : "0"); wakeCheck(); });
    var ex = $("exam-screen"); ex && wakeOK && new MutationObserver(wakeCheck).observe(ex, { attributes: true, attributeFilter: ["class"] });
    document.addEventListener("visibilitychange", function () { document.visibilityState === "visible" && wakeCheck(); });
  }

  function enhanceRank() {
    var r = document.querySelector(".cd-self-rank"); if (!r || r.dataset.sn === String(r.textContent.length)) return;
    var n = (r.querySelector(".cd-self-rank-badge") || {}).textContent || "", p = pct();
    var old = r.querySelectorAll(":scope > :not(.sn-r)"); old.forEach(function (e) { e.style.display = "none"; });
    r.querySelectorAll(".sn-r").forEach(function (e) { e.remove(); });
    r.insertAdjacentHTML("afterbegin", '<div class="sn-r">' + E("🏆", 30) + '<div><small>Your Latest Rank</small><b>' + n + "</b><small>in your class</small></div></div>" + (p === null ? "" : '<div class="sn-r g"><div><small>Avg. Score</small><b>' + p + "%</b><small>(All tests)</small></div></div>"));
    r.dataset.sn = String(r.textContent.length);
  }

  ready(function () {
    var form = $("student-form"), home = $("student-dashboard-home"); if (!form || !home || $("sn-nav")) return;
    // Bug fix: <form> ke andar bina type wala button submit ban jata hai -> "Pehle upar se test select karein" alert.
    // Capture phase me type=button laga do (click ke default action se pehle) — kisi bhi button ke liye.
    form.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("button"); b && !b.hasAttribute("type") && (b.type = "button"); }, true);
    // bottom nav + page container
    var nav = document.createElement("div"); nav.id = "sn-nav";
    nav.innerHTML = [["home", "home", "Home"], ["tests", "doc", "Tests"], ["analysis", "chart", "Analysis"], ["more", "grid", "More"]].map(function (i) { return '<button type="button" data-k="' + i[0] + '">' + svg(i[1]) + i[2] + "</button>"; }).join("");
    form.appendChild(nav);
    var pg = document.createElement("div"); pg.id = "sn-page"; document.body.appendChild(pg);
    mark("home"); fixNav(); setTimeout(fixNav, 600); window.addEventListener("resize", fixNav);
    nav.querySelectorAll("button").forEach(function (b) {
      b.onclick = function () {
        var k = b.dataset.k; hidePage();
        if (k === "home") { mark(k); try { backToStudentDashboard(); } catch (e) {} window.scrollTo(0, 0); }
        else if (k === "tests") { mark(k); go("student-form-fields-anchor"); }
        else showPage(k);
      };
    });
    var back = $("student-back-btn"); back && back.addEventListener("click", function () { mark("home"); hidePage(); });

    // header
    var top = document.createElement("div"); top.id = "sn-top";
    top.innerHTML = '<button type="button" class="ic" data-a="m">' + svg("menu") + '</button><div class="lg"><img src="icon-512-maskable.png" alt=""><div><b>SnapTestPro</b><small>Smart Practice • Better Result</small></div></div><button type="button" class="ic" data-a="b" style="color:#f59e0b">' + svg("bell") + '</button><button type="button" class="av" data-a="u">' + svg("user") + '</button>';
    home.insertBefore(top, home.firstChild);
    top.querySelector('[data-a="m"]').onclick = function (ev) { ev.preventDefault(); showPage("more"); };
    top.querySelector('[data-a="b"]').onclick = function (ev) { ev.preventDefault(); showPage("notifs", "home"); nRefresh(true).then(function () { curPage === "notifs" && showPage("notifs", "home"); }); };
    var bell = top.querySelector('[data-a="b"]'); bell.style.position = "relative"; bell.insertAdjacentHTML("beforeend", '<i class="sn-dot"></i>'); nDot();
    setTimeout(function () { nRefresh(); }, 3000); setTimeout(function () { nRefresh(); }, 15000);
    document.addEventListener("visibilitychange", function () { document.visibilityState === "visible" && nRefresh(); });
    // naya test publish hone par list me jodo (push-notifications.js ke hook se)
    if (window.SavyaPush && !window.SavyaPush.__sn) {
      var orig = window.SavyaPush.notifyTestPublished; window.SavyaPush.__sn = 1;
      window.SavyaPush.notifyTestPublished = function (t) { try { nAdd("Naya Test Publish Hua!", (t || "Ek naya test") + " ab available hai"); } catch (e) {} return orig && orig.apply(this, arguments); };
    }
    top.querySelector('[data-a="u"]').onclick = function (ev) { ev.preventDefault(); go("student-settings-card"); };

    // greeting
    var h = home.querySelector(".cd-hero h2"), nm = $("cd-student-name");
    if (h && nm) { var hr = new Date().getHours(); h.innerHTML = '<small style="font-weight:600;color:#475569;font-size:.85rem">' + (hr < 12 ? "Good Morning," : hr < 17 ? "Good Afternoon," : "Good Evening,") + "</small><br><b></b> " + (hr < 17 ? "☀️" : "🌙"); h.querySelector("b").appendChild(nm); }
    var hp = home.querySelector(".cd-hero p"); hp && (hp.innerHTML = "Keep learning, keep growing!<br><span style='font-size:.72rem'>Small steps every day lead to big results.</span>");

    // quick action cards: text + order as in mockup
    var cs = home.querySelectorAll(".cd-grid .cd-card"), sub = { 0: ["📄", "Begin your exam now"], 1: ["🎯", "Improve your skills"], 5: ["❌", "Learn from errors"], 4: ["📊", "Track your growth"] };
    Object.keys(sub).forEach(function (i) { var c = cs[i]; if (!c) return; var ic = c.querySelector(".cd-icon-circle"), s = c.querySelector(".cd-card-sub"); ic && (ic.innerHTML = E(sub[i][0])); s && (s.textContent = sub[i][1]); });
    var q = document.createElement("div"); q.className = "sn-quote"; q.innerHTML = E("💡") + "<span>“Success is the result of consistent effort.”</span>";
    var grid = home.querySelector(".cd-grid"); grid && grid.after(q);

    // Tests tab: search box
    var list = $("test-cards-list");
    if (list && !$("sn-search")) {
      var inp = document.createElement("input"); inp.id = "sn-search"; inp.type = "search"; inp.placeholder = "Search tests...";
      inp.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); inp.blur(); } };
      inp.oninput = function () { var v = inp.value.trim().toLowerCase(); Array.prototype.forEach.call(list.children, function (c) { c.style.display = !v || c.textContent.toLowerCase().indexOf(v) >= 0 ? "" : "none"; }); };
      list.parentNode.insertBefore(inp, $("test-category-tabs") || list);
    }

    buildSettings();

    // rank card enhance (podium async render)
    var wrap = $("cd-podium-wrap"); wrap && new MutationObserver(function () { enhanceRank(); }).observe(wrap, { childList: true, subtree: true });
    setInterval(enhanceRank, 2500); enhanceRank();
  });
})();
