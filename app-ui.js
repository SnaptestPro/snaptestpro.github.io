/* v148 — student bottom navigation + greeting (existing goStudentSection/backToStudentDashboard use hota hai) */
(function () {
  "use strict";
  function ready(f) { document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", f) : f(); }
  var MENUS = {
    analysis: { t: "Analysis", items: [["🧾", "Mera Result", "Apna detailed result", "my-result-detail-card"], ["📈", "My Progress", "Score trend dekhein", "my-progress-card"], ["❌", "My Mistakes", "Galat sawaal revise karein", "my-mistakes-card"], ["🏆", "Result Sheet", "Class result & ranking", "student-results-card"]] },
    more: { t: "More", items: [["📐", "Solids Lab", "3D Learning Zone", "student-solids-lab-card"], ["⚙️", "Settings", "Profile aur logout", "student-settings-card"]] }
  };
  function go(id) { try { typeof goStudentSection === "function" && goStudentSection(id); } catch (e) { console.warn(e); } window.scrollTo(0, 0); }
  function mark(k) { document.querySelectorAll("#sn-nav button").forEach(function (b) { b.classList.toggle("on", b.dataset.k === k); }); }
  function closeSheet() { var s = document.getElementById("sn-sheet"), g = document.getElementById("sn-sheet-bg"); if (s) s.style.display = g.style.display = "none"; }
  function openSheet(k) {
    var m = MENUS[k], s = document.getElementById("sn-sheet"), g = document.getElementById("sn-sheet-bg");
    s.innerHTML = "<h4>" + m.t + "</h4>" + m.items.map(function (i) { return '<button data-id="' + i[3] + '"><span>' + i[0] + "</span><div>" + i[1] + "<small>" + i[2] + "</small></div></button>"; }).join("");
    s.style.display = g.style.display = "block";
    s.querySelectorAll("button").forEach(function (b) { b.onclick = function () { closeSheet(); mark(k); go(b.dataset.id); }; });
  }
  ready(function () {
    var form = document.getElementById("student-form"); if (!form || document.getElementById("sn-nav")) return;
    var nav = document.createElement("div"); nav.id = "sn-nav";
    nav.innerHTML = [["home", "🏠", "Home"], ["tests", "📝", "Tests"], ["analysis", "📊", "Analysis"], ["more", "⋯", "More"]].map(function (i) { return '<button type="button" data-k="' + i[0] + '"><span>' + i[1] + "</span>" + i[2] + "</button>"; }).join("");
    form.appendChild(nav);
    var bg = document.createElement("div"); bg.id = "sn-sheet-bg"; bg.onclick = closeSheet; document.body.appendChild(bg);
    var sh = document.createElement("div"); sh.id = "sn-sheet"; document.body.appendChild(sh);
    mark("home");
    nav.querySelectorAll("button").forEach(function (b) {
      b.onclick = function () {
        var k = b.dataset.k;
        if (k === "home") { mark(k); try { backToStudentDashboard(); } catch (e) {} window.scrollTo(0, 0); }
        else if (k === "tests") { mark(k); go("student-form-fields-anchor"); }
        else openSheet(k);
      };
    });
    var back = document.getElementById("student-back-btn");
    back && back.addEventListener("click", function () { mark("home"); });
    // greeting + promo text
    var h = document.querySelector("#student-dashboard-home .cd-hero h2"), nm = document.getElementById("cd-student-name");
    if (h && nm) { var hr = new Date().getHours(), g = hr < 12 ? "Good Morning" : hr < 17 ? "Good Afternoon" : "Good Evening"; h.innerHTML = '<small style="font-weight:600;color:#64748b;font-size:.8rem">' + g + ',</small><br>'; h.appendChild(nm); }
    var p = document.querySelector("#student-dashboard-home .cd-hero p"); p && (p.textContent = "Keep learning, keep growing!");
    var ph = document.querySelector(".cd-promo h3"), pp = document.querySelector(".cd-promo p");
    ph && (ph.textContent = "Dream Big, Prepare Smart"); pp && (pp.textContent = "Daily practice se apna score boost karein.");
  });
})();
