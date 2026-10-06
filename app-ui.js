/* v149 — student app shell: header, Home polish, Tests search, Analysis/More pages, bottom nav */
(function () {
  "use strict";
  function ready(f) { document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", f) : f(); }
  function $(i) { return document.getElementById(i); }
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
      return '<div class="ph"><button data-a="menu">☰</button><b>Analysis</b></div><div class="sn-perf"><div><b>Overall Performance</b><p>' + (p === null ? "Test dene ke baad yahan aapka score dikhega." : "Keep it up! Your performance is improving.") + '</p></div><div class="sn-ring" style="--p:' + (p || 0) * 3.6 + 'deg"><span>' + (p === null ? "–" : p + "%") + '</span></div></div><div class="sn-tiles">' +
        tl.map(function (x) { return '<button class="sn-tile" data-id="' + x.act + '"><div class="i" style="background:' + x.bg + '">' + x.ic + "</div><b>" + x.t + "</b><small>" + x.s + "</small></button>"; }).join("") + "</div>" +
        [["🥧", "#e0e9ff", "Chapter Wise Performance", "Weak & Strong topics", "my-progress-card"], ["📊", "#ece9ff", "Performance Analysis", "Detailed subject analysis", "my-progress-card"]].map(function (x) { return '<button class="sn-row" data-id="' + x[4] + '"><div class="i" style="background:' + x[1] + '">' + x[0] + "</div><div>" + x[2] + "<small>" + x[3] + "</small></div></button>"; }).join("") +
        '<button class="sn-row sn-gold" data-id="my-result-detail-card"><div class="i" style="background:#fff">🏆</div><div>Better Analysis = Better Learning</div></button>';
    },
    more: function () {
      var r = [["🏆", "#fff0cc", "Result Sheet", "Full class result & ranking", "student-results-card"], ["🧊", "#dbeafe", "Solids Lab", "3D Learning Zone", "student-solids-lab-card"], ["⚙️", "#e5e7eb", "Settings", "App Preferences", "student-settings-card"], ["🎧", "#dbeafe", "Help & Support", "Need help? Contact us", "help"], ["ℹ️", "#dbeafe", "About App", "SnapTestPro v1.0", "about"]];
      return '<div class="ph"><button data-a="menu">☰</button><b>More</b></div>' + r.map(function (x) { return '<button class="sn-row" data-id="' + x[4] + '"><div class="i" style="background:' + x[1] + '">' + x[0] + "</div><div>" + x[2] + "<small>" + x[3] + "</small></div></button>"; }).join("") + '<div class="sn-banner"><div>Dream Big<br>Prepare Smart</div><span>🎓</span></div>';
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
    r.insertAdjacentHTML("afterbegin", '<div class="sn-r"><span>🏆</span><div><small>Your Latest Rank</small><b>' + n + "</b><small>in your class</small></div></div>" + (p === null ? "" : '<div class="sn-r g"><div><small>Avg. Score</small><b>' + p + "%</b><small>(All tests)</small></div></div>"));
    r.dataset.sn = String(r.textContent.length);
  }

  ready(function () {
    var form = $("student-form"), home = $("student-dashboard-home"); if (!form || !home || $("sn-nav")) return;
    // bottom nav + page container
    var nav = document.createElement("div"); nav.id = "sn-nav";
    nav.innerHTML = [["home", "🏠", "Home"], ["tests", "📝", "Tests"], ["analysis", "📊", "Analysis"], ["more", "⋯", "More"]].map(function (i) { return '<button type="button" data-k="' + i[0] + '"><span>' + i[1] + "</span>" + i[2] + "</button>"; }).join("");
    form.appendChild(nav);
    var pg = document.createElement("div"); pg.id = "sn-page"; document.body.appendChild(pg);
    mark("home");
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
    top.innerHTML = '<button class="ic" data-a="m">☰</button><div class="lg"><img src="icon-512-maskable.png" alt=""><div><b>SnapTestPro</b><small>Smart Practice • Better Result</small></div></div><button class="ic" data-a="b">🔔</button><button class="av" data-a="u">👤</button>';
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
    Object.keys(sub).forEach(function (i) { var c = cs[i]; if (!c) return; var ic = c.querySelector(".cd-icon-circle"), s = c.querySelector(".cd-card-sub"); ic && (ic.textContent = sub[i][0]); s && (s.textContent = sub[i][1]); });
    var q = document.createElement("div"); q.className = "sn-quote"; q.innerHTML = "<span>💡</span><span>“Success is the result of consistent effort.”</span>";
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
