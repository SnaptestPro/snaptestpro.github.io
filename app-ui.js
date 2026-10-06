/* v149 — student app shell: header, Home polish, Tests search, Analysis/More pages, bottom nav */
(function () {
  "use strict";
  function ready(f) { document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", f) : f(); }
  function $(i) { return document.getElementById(i); }
  var IC = {"home": "M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z", "doc": "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M9 13h6 M9 17h6", "chart": "M5 21V11 M12 21V4 M19 21v-7", "grid": "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z", "menu": "M4 6h16 M4 12h16 M4 18h16", "bell": "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 0 1-3.4 0", "user": "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8", "trophy": "M8 21h8 M12 17v4 M7 4h10v5a5 5 0 0 1-10 0z M7 6H4v2a3 3 0 0 0 3 3 M17 6h3v2a3 3 0 0 1-3 3", "cube": "M12 2l9 5v10l-9 5-9-5V7z M12 12l9-5 M12 12v10 M12 12L3 7", "gear": "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z", "headset": "M3 18v-6a9 9 0 0 1 18 0v6 M21 19a2 2 0 0 1-2 2h-1v-6h3z M3 19a2 2 0 0 0 2 2h1v-6H3z", "info": "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 16v-4 M12 8h.01", "receipt": "M6 2h12v20l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6", "trend": "M3 17l6-6 4 4 8-8 M15 7h6v6", "x": "M18 6L6 18 M6 6l12 12", "pie": "M21 12A9 9 0 1 1 12 3v9z M15 3.5A9 9 0 0 1 20.5 9H15z", "target": "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "cap": "M22 10L12 5 2 10l10 5z M6 12v5c3 2 9 2 12 0v-5", "bulb": "M9 18h6 M10 22h4 M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"};
  var EM = { "🏆": ["trophy", "#f59e0b"], "🧊": ["cube", "#3b82f6"], "⚙️": ["gear", "#64748b"], "🎧": ["headset", "#3b82f6"], "ℹ️": ["info", "#3b82f6"], "🧾": ["receipt", "#6d5dfc"], "📈": ["trend", "#0ea5a4"], "❌": ["x", "#ef4444"], "🥧": ["pie", "#3b82f6"], "📊": ["chart", "#7c5cfc"], "📄": ["doc", "#2f6bf2"], "🎯": ["target", "#a855f7"], "💡": ["bulb", "#f59e0b"] };
  function svg(n, z, c) { return '<span class="sn-i" style="' + (z ? "width:" + z + "px;height:" + z + "px;" : "") + (c ? "color:" + c : "") + '"><svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + IC[n] + '"/></svg></span>'; }
  function E(e, z) { var m = EM[e]; return m ? svg(m[0], z, m[1]) : e; }
  function fixNav() { var n = $("sn-nav"); n && n.offsetHeight > 0 && document.documentElement.style.setProperty("--snh", n.offsetHeight + "px"); }
  function go(id) { try { typeof goStudentSection === "function" && goStudentSection(id); } catch (e) { console.warn(e); } window.scrollTo(0, 0); }
  function toast(m) { var b = document.createElement("div"); b.textContent = m; b.style.cssText = "position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#1e1b4b;color:#fff;padding:10px 18px;border-radius:22px;font-size:.82rem;z-index:99999;max-width:86vw;text-align:center"; document.body.appendChild(b); setTimeout(function () { b.remove(); }, 2200); }
  function mark(k) { document.querySelectorAll("#sn-nav button").forEach(function (b) { b.classList.toggle("on", b.dataset.k === k); }); }
  function hidePage() { var p = $("sn-page"); p && (p.style.display = "none"); }
  function me() { return window._selfRankStudent || null; }
  function pct() { var s = me(); return s && s.totalMaxScore ? Math.round(100 * s.totalScore / s.totalMaxScore) : null; }

  var T = function (ic, bg, t, s, act) { return { ic: ic, bg: bg, t: t, s: s, act: act }; };
  var PAGES = {
    analysis: function () {
      var p = pct(), tl = [
        T("🧾", "#e8e7ff", "Mera Result", "View your result", "my-result-detail-card"), T("📈", "#d9f7f3", "My Progress", "Track your growth", "my-progress-card"),
        T("❌", "#ffe4e4", "My Mistakes", "Learn from mistakes", "my-mistakes-card"), T("🏆", "#fff0cc", "My Rank", "See your position", "student-results-card")];
      return '<div class="ph"><button data-a="menu">' + svg("menu") + '</button><b>Analysis</b></div><div class="sn-perf"><div><b>Overall Performance</b><p>' + (p === null ? "Test dene ke baad yahan aapka score dikhega." : "Keep it up! Your performance is improving.") + '</p></div><div class="sn-ring" style="--p:' + (p || 0) * 3.6 + 'deg"><span>' + (p === null ? "–" : p + "%") + '</span></div></div><div class="sn-tiles">' +
        tl.map(function (x) { return '<button class="sn-tile" data-id="' + x.act + '"><div class="i" style="background:' + x.bg + '">' + E(x.ic) + "</div><b>" + x.t + "</b><small>" + x.s + "</small></button>"; }).join("") + "</div>" +
        [["🥧", "#e0e9ff", "Chapter Wise Performance", "Weak & Strong topics", "my-progress-card"], ["📊", "#ece9ff", "Performance Analysis", "Detailed subject analysis", "my-progress-card"]].map(function (x) { return '<button class="sn-row" data-id="' + x[4] + '"><div class="i" style="background:' + x[1] + '">' + E(x[0]) + "</div><div>" + x[2] + "<small>" + x[3] + "</small></div></button>"; }).join("") +
        '<button class="sn-row sn-gold" data-id="my-result-detail-card"><div class="i" style="background:#fff">' + E("🏆") + '</div><div>Better Analysis = Better Learning</div></button>';
    },
    more: function () {
      var r = [["🏆", "#fff0cc", "Result Sheet", "Full class result & ranking", "student-results-card"], ["🧊", "#dbeafe", "Solids Lab", "3D Learning Zone", "student-solids-lab-card"], ["⚙️", "#e5e7eb", "Settings", "App Preferences", "student-settings-card"], ["🎧", "#dbeafe", "Help & Support", "Need help? Contact us", "help"], ["ℹ️", "#dbeafe", "About App", "SnapTestPro v1.0", "about"]];
      return '<div class="ph"><button data-a="menu">' + svg("menu") + '</button><b>More</b></div>' + r.map(function (x) { return '<button class="sn-row" data-id="' + x[4] + '"><div class="i" style="background:' + x[1] + '">' + E(x[0]) + "</div><div>" + x[2] + "<small>" + x[3] + "</small></div></button>"; }).join("") + '<div class="sn-banner"><div>Dream Big<br>Prepare Smart</div>' + svg("cap") + '</div>';
    }
  };
  function showPage(k) {
    var p = $("sn-page"); p.innerHTML = PAGES[k](); p.style.display = "block"; p.scrollTop = 0; mark(k);
    p.querySelectorAll("[data-id]").forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.id;
        if (id === "help") return toast("Madad ke liye apne Teacher/Admin se sampark karein.");
        if (id === "about") return toast("SnapTestPro • Smart Practice, Better Result");
        hidePage(); go(id);
      };
    });
    var m = p.querySelector('[data-a="menu"]'); m && (m.onclick = function () { showPage("more"); });
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
    top.innerHTML = '<button class="ic" data-a="m">' + svg("menu") + '</button><div class="lg"><img src="icon-512-maskable.png" alt=""><div><b>SnapTestPro</b><small>Smart Practice • Better Result</small></div></div><button class="ic" data-a="b" style="color:#f59e0b">' + svg("bell") + '</button><button class="av" data-a="u">' + svg("user") + '</button>';
    home.insertBefore(top, home.firstChild);
    top.querySelector('[data-a="m"]').onclick = function () { showPage("more"); };
    top.querySelector('[data-a="b"]').onclick = function () { toast("Abhi koi nayi notification nahi hai."); };
    top.querySelector('[data-a="u"]').onclick = function () { go("student-settings-card"); };

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
      inp.oninput = function () { var v = inp.value.trim().toLowerCase(); Array.prototype.forEach.call(list.children, function (c) { c.style.display = !v || c.textContent.toLowerCase().indexOf(v) >= 0 ? "" : "none"; }); };
      list.parentNode.insertBefore(inp, $("test-category-tabs") || list);
    }

    // rank card enhance (podium async render)
    var wrap = $("cd-podium-wrap"); wrap && new MutationObserver(function () { enhanceRank(); }).observe(wrap, { childList: true, subtree: true });
    setInterval(enhanceRank, 2500); enhanceRank();
  });
})();
