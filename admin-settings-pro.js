/* Admin Settings (proper app jaisa): Profile, Notifications, Help & Support, About, App & Data, Privacy, Logout.
   Purane Settings cards (ID Card, Join Code, Password...) jaise the waise rehte hain — ye unke UPAR judta hai. */
(function () {
  "use strict";
  var C = function () { return window.SNAP_CONFIG || {}; };
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var digits = function (s) { return String(s || "").replace(/\D/g, "").slice(-10); };

  function css() {
    if ($("asp-css")) return;
    var st = document.createElement("style"); st.id = "asp-css";
    st.textContent =
      ".asp-wrap{margin-bottom:12px}.asp-h{font-weight:800;font-size:1.05rem;margin:2px 0 8px;color:var(--text,#0f172a)}" +
      ".asp-row{display:flex;align-items:center;gap:12px;width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:12px 14px;margin-bottom:8px;text-align:left;cursor:pointer;font:inherit;color:#0f172a}" +
      ".asp-row:active{transform:scale(.99)}.asp-ic{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.15rem;flex:none}" +
      ".asp-tx{flex:1;min-width:0}.asp-tx b{display:block;font-size:.95rem}.asp-tx small{display:block;color:#64748b;font-size:.78rem;margin-top:1px}.asp-ch{color:#94a3b8;font-size:1.2rem}" +
      "#asp-page{position:fixed;inset:0;z-index:99990;background:#f8fafc;overflow:auto;display:none;-webkit-overflow-scrolling:touch}" +
      "#asp-page .asp-top{position:sticky;top:0;background:#fff;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:10px;padding:12px 14px;z-index:2}" +
      "#asp-page .asp-top button{border:0;background:#eef2ff;border-radius:10px;width:38px;height:38px;font-size:1.1rem;cursor:pointer}" +
      "#asp-page .asp-body{padding:14px;max-width:640px;margin:0 auto}.asp-card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:14px;margin-bottom:10px}" +
      ".asp-card p{margin:6px 0 0;color:#475569;font-size:.88rem;line-height:1.5}.asp-kv{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px dashed #e2e8f0;font-size:.88rem}.asp-kv:last-child{border:0}.asp-kv span{color:#64748b}.asp-kv b{text-align:right;word-break:break-all}" +
      ".asp-act{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.asp-btn{flex:1;min-width:120px;text-align:center;text-decoration:none;border:0;border-radius:12px;padding:11px 12px;font-weight:700;font-size:.9rem;cursor:pointer;background:#4f46e5;color:#fff}.asp-btn.g{background:#16a34a}.asp-btn.o{background:#eef2ff;color:#3730a3}.asp-btn.r{background:#fee2e2;color:#b91c1c}" +
      ".asp-ok{color:#15803d;font-weight:700}.asp-bad{color:#b91c1c;font-weight:700}" +
      "body.dark-mode .asp-row,body.dark-mode .asp-card,[data-theme=dark] .asp-row,[data-theme=dark] .asp-card{background:#1e293b;color:#e2e8f0;border-color:#334155}" +
      "body.dark-mode #asp-page,[data-theme=dark] #asp-page{background:#0f172a;color:#e2e8f0}body.dark-mode #asp-page .asp-top,[data-theme=dark] #asp-page .asp-top{background:#1e293b;border-color:#334155}";
    document.head.appendChild(st);
  }

  function toast(m) { try { var b = document.createElement("div"); b.textContent = m; b.style.cssText = "position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#0f172a;color:#fff;padding:10px 16px;border-radius:12px;font-size:.85rem;z-index:2147483647;max-width:88vw;text-align:center"; document.body.appendChild(b); setTimeout(function () { b.remove(); }, 2600); } catch (e) {} }

  function user() { try { return (typeof getAuth === "function" && getAuth() && getAuth().currentUser) || null; } catch (e) { return null; } }
  function instId() { try { return typeof getCurrentAdminInstituteId === "function" ? getCurrentAdminInstituteId() : null; } catch (e) { return null; } }
  var instCache = null;
  function loadInst() {
    if (instCache) return Promise.resolve(instCache);
    var id = instId(), db = typeof getDB === "function" ? getDB() : null;
    if (!id || !db) return Promise.resolve({});
    return db.collection("institutes").doc(id).get().then(function (d) { instCache = d.exists ? d.data() : {}; return instCache; }).catch(function () { return {}; });
  }

  /* ---------- pages ---------- */
  var pages = {
    profile: function (done) {
      var u = user() || {}, id = instId();
      loadInst().then(function (i) {
        done("Profile & Institute",
          '<div class="asp-card">' +
          kv("Admin Email", u.email || "—") + kv("Email verified", u.emailVerified ? '<span class="asp-ok">✅ Haan</span>' : '<span class="asp-bad">⚠️ Nahi</span>') +
          kv("Institute", esc(i.name || "—")) + kv("Institute ID", esc(id || "—")) +
          kv("Status", i.active === false ? '<span class="asp-bad">Deactivated</span>' : '<span class="asp-ok">Active</span>') +
          '</div><div class="asp-card"><b>ID Card / Logo</b><p>Apna photo, naam aur institute logo neeche ke "Aapka ID Card" section me badlein.</p><div class="asp-act"><button type="button" class="asp-btn o" data-go="idcard">ID Card par jaayein</button></div></div>');
      });
    },
    notif: function (done) {
      var url = "https://cool-thunder-a280.vishnu1234stm.workers.dev";
      done("Notifications",
        '<div class="asp-card"><b>Students ko notification</b><p>App band hone par bhi students ke phone par aati hai (free push system).</p>' +
        '<div class="asp-act"><button type="button" class="asp-btn g" data-go="sendnotif">🔔 Notification bhejein</button></div></div>' +
        '<div class="asp-card"><b>Push service status</b><div class="asp-kv"><span>Server</span><b id="asp-push-st">Check ho raha hai…</b></div>' +
        '<p>Agar ❌ dikhe to Owner se contact karein. Students ko notification tabhi milegi jab unhone naya app install karke ek baar login kiya ho aur permission Allow ki ho.</p></div>');
      fetch(url, { method: "GET" }).then(function (r) { return r.json(); }).then(function (j) { var e = $("asp-push-st"); if (e) e.innerHTML = j && j.ok ? '<span class="asp-ok">✅ Chalu hai</span>' : '<span class="asp-bad">❌ Jawab galat</span>'; }).catch(function () { var e = $("asp-push-st"); if (e) e.innerHTML = '<span class="asp-bad">❌ Connect nahi hua</span>'; });
    },
    help: function (done) {
      var c = C(), ph = digits(c.supportPhone), wa = digits(c.supportWhatsapp || c.supportPhone), em = c.supportEmail || "";
      var acts = "";
      if (ph) acts += '<a class="asp-btn" href="tel:+91' + ph + '">📞 Call</a>';
      if (wa) acts += '<a class="asp-btn g" target="_blank" rel="noopener" href="https://wa.me/91' + wa + '?text=' + encodeURIComponent("Namaste, SnapTestPro Admin se madad chahiye.") + '">💬 WhatsApp</a>';
      if (em) acts += '<a class="asp-btn o" href="mailto:' + esc(em) + '?subject=' + encodeURIComponent("SnapTestPro Admin Support") + '">✉️ Email</a>';
      var faqs = (c.adminFaqs || []).map(function (f) { return '<div class="asp-card"><b>' + esc(f[0]) + '</b><p>' + esc(f[1]) + '</p></div>'; }).join("");
      done("Help & Support",
        '<div class="asp-card"><b>Koi problem hai?</b><p>Owner / Developer se seedha contact karein.' + (c.supportHours ? "<br>🕒 " + esc(c.supportHours) : "") + '</p>' +
        (acts ? '<div class="asp-act">' + acts + '</div>' : "") + '</div>' + (faqs ? '<div class="asp-h" style="margin-top:14px">Aam sawal</div>' + faqs : ""));
    },
    about: function (done) {
      var c = C();
      done("About App",
        '<div class="asp-card" style="text-align:center"><img src="icon-512-maskable.png" alt="" style="width:76px;height:76px;border-radius:18px"><div style="font-weight:800;font-size:1.2rem;margin-top:8px">' + esc(c.appName || "SnapTestPro") + '</div><p>' + esc(c.tagline || "") + '</p></div>' +
        '<div class="asp-card">' + kv("Version", esc((c.version || "") + (c.build ? " (build " + esc(c.build) + ")" : ""))) + (c.ownerName ? kv("Developer / Owner", esc(c.ownerName)) : "") + (c.website ? kv("Website", esc(c.website)) : "") + '</div>' +
        legal());
    },
    data: function (done) {
      done("App & Data",
        '<div class="asp-card"><b>Update check</b><p>Latest version laga hua hai ya nahi dekhein.</p><div class="asp-act"><button type="button" class="asp-btn" data-go="update">📈 Update check karein</button></div></div>' +
        '<div class="asp-card"><b>Cache saaf karke refresh</b><p>Kuch purana ya adhura dikhe to ye karein. Aapka login bana rahega.</p><div class="asp-act"><button type="button" class="asp-btn o" data-go="cache">⚙️ Cache saaf karein</button></div></div>' +
        '<div class="asp-card"><b>Question Bank dobara load karein</b><p>Agar doosre admin ne questions jode hon aur yahan na dikhein to ye dabayein (Firestore reads lagenge).</p><div class="asp-act"><button type="button" class="asp-btn o" data-go="bank">🔄 Bank refresh</button></div></div>' +
        '<div class="asp-card"><b>Bank students ke liye publish karein</b><p>Students ko bank Firestore ke bajay Cloudflare se milta hai (reads 0). Normally ye apne-aap hota hai; kabhi na ho to yahan dabayein.</p><div class="asp-act"><button type="button" class="asp-btn g" data-go="pub">⬆️ Bank publish karein</button></div></div>');
    },
    privacy: function (done) { done("Privacy & Terms", legal(true)); }
  };
  function legal(only) {
    var c = C(), a = "";
    if (c.privacyUrl) a += '<a class="asp-btn o" target="_blank" rel="noopener" href="' + esc(c.privacyUrl) + '">🔒 Privacy Policy</a>';
    if (c.termsUrl) a += '<a class="asp-btn o" target="_blank" rel="noopener" href="' + esc(c.termsUrl) + '">📄 Terms</a>';
    var txt = '<div class="asp-card"><b>Aapka data</b><p>Students ka naam, mobile, results aur tests sirf aapke institute ke liye hain aur Firebase (Google) par surakshit rakhe jaate hain. Kisi doosre institute ko ye data nahi dikhta.</p>' + (a ? '<div class="asp-act">' + a + '</div>' : "") + '</div>';
    return only || a ? txt : "";
  }
  function kv(k, v) { return '<div class="asp-kv"><span>' + k + '</span><b>' + v + '</b></div>'; }

  /* ---------- page shell ---------- */
  function openPage(key) {
    var f = pages[key]; if (!f) return;
    var pg = $("asp-page");
    if (!pg) { pg = document.createElement("div"); pg.id = "asp-page"; document.body.appendChild(pg); }
    pg.style.display = "block"; pg.innerHTML = '<div class="asp-top"><button type="button" data-go="back">←</button><b>…</b></div><div class="asp-body"></div>';
    f(function (title, html) { if (pg.style.display === "none") return; pg.querySelector(".asp-top b").textContent = title; pg.querySelector(".asp-body").innerHTML = html; });
  }
  function closePage() { var pg = $("asp-page"); if (pg) pg.style.display = "none"; }

  document.addEventListener("click", function (ev) {
    var t = ev.target.closest ? ev.target.closest("[data-asp],[data-go]") : null; if (!t) return;
    var k = t.getAttribute("data-asp"), g = t.getAttribute("data-go");
    if (k) { ev.preventDefault(); openPage(k); return; }
    if (g === "back") { ev.preventDefault(); closePage(); return; }
    ev.preventDefault();
    if (g === "idcard") { closePage(); var el = $("admin-idcard-outer"); el && el.scrollIntoView({ behavior: "smooth", block: "center" }); }
    else if (g === "sendnotif") { closePage(); var card = document.querySelector('[onclick*="an-open"],[data-an],#an-open-btn') || document.querySelector('[id^="an-"]'); if (typeof goAdmin === "function") { try { backToAdminDashboard(); } catch (e) {} } toast("Dashboard par '🔔 Notification' card dabayein"); }
    else if (g === "update") { toast("⏳ Update check ho raha hai..."); if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) navigator.serviceWorker.getRegistration().then(function (r) { if (!r) return toast("✅ Aap latest version par hain"); return r.update().then(function () { if (r.installing || r.waiting) { toast("⬆️ Naya version mil gaya — reload ho raha hai"); setTimeout(function () { location.reload(); }, 1200); } else toast("✅ Aap latest version par hain"); }); }).catch(function () { toast("Update check nahi ho paya"); }); else toast("✅ Aap latest version par hain"); }
    else if (g === "cache") { toast("⏳ Cache saaf ho raha hai..."); var keep = {}; try { Object.keys(localStorage).forEach(function (k2) { if (/session|auth|firebase|savya_student|admin/i.test(k2)) keep[k2] = localStorage.getItem(k2); }); } catch (e) {}
      Promise.resolve(window.caches && caches.keys ? caches.keys().then(function (ks) { return Promise.all(ks.map(function (k2) { return caches.delete(k2); })); }) : 0).then(function () { return navigator.serviceWorker && navigator.serviceWorker.getRegistrations ? navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.update(); })); }) : 0; }).catch(function () {}).then(function () { try { localStorage.removeItem("savya_bank_cache"); localStorage.removeItem("snap_bank_sync_ts"); } catch (e) {} setTimeout(function () { location.reload(); }, 600); }); }
    else if (g === "pub") { toast("⏳ Publish ho raha hai..."); if (window.publishBankManual) window.publishBankManual().then(function (m) { toast(m); }); else toast("Available nahi"); }
    else if (g === "bank") { if (window.refreshBankNow) { window.refreshBankNow(); toast("🔄 Bank refresh chalu ho gaya"); } else toast("Bank refresh available nahi"); }
  });

  /* ---------- menu inject ---------- */
  function row(ic, bg, t, s, k) { return '<button type="button" class="asp-row" data-asp="' + k + '"><span class="asp-ic" style="background:' + bg + '">' + ic + '</span><span class="asp-tx"><b>' + t + '</b><small>' + s + '</small></span><span class="asp-ch">›</span></button>'; }
  function mount() {
    try {
      var box = $("settings-box"); if (!box) return; css();
      var m = $("asp-menu");
      if (!m) {
        m = document.createElement("div"); m.id = "asp-menu"; m.className = "asp-wrap";
        m.innerHTML = '<div class="asp-h">⚙️ Settings</div>' +
          row("👤", "#e0e7ff", "Profile & Institute", "Email, institute, status", "profile") +
          row("🔔", "#fef3c7", "Notifications", "Students ko push bhejna, status", "notif") +
          row("📱", "#d9f7f3", "App & Data", "Update, cache, bank refresh", "data") +
          row("🎧", "#dbeafe", "Help & Support", "Call / WhatsApp / Email, FAQ", "help") +
          row("ℹ️", "#e5e7eb", "About App", "Version " + esc((C().version || "") + (C().build ? " (" + C().build + ")" : "")), "about") +
          row("🔒", "#fce7f3", "Privacy & Terms", "Aapke data ke baare me", "privacy") +
          '<button type="button" class="asp-row" id="asp-logout" style="border-color:#fecaca"><span class="asp-ic" style="background:#fee2e2">🚪</span><span class="asp-tx"><b style="color:#b91c1c">Logout</b><small>Is device se admin logout</small></span></button>';
        var first = box.querySelector(".card"); if (first && first.nextSibling) box.insertBefore(m, first.nextSibling); else box.insertBefore(m, box.firstChild);
        $("asp-logout").addEventListener("click", function () { var b = $("admin-logout-btn"); if (b) b.click(); else toast("Logout button nahi mila"); });
      }
    } catch (e) { console.warn("[asp] mount fail", e); }
  }
  window.SnapAdminSettings = { mount: mount, open: openPage };
  function hook() {
    var o = window.renderAdminSettingsEmail;
    if (typeof o === "function" && !o.__asp) { var w = function () { var r = o.apply(this, arguments); mount(); return r; }; w.__asp = 1; window.renderAdminSettingsEmail = w; }
    var box = $("settings-box"); if (box && !box.classList.contains("hidden")) mount();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hook); else hook();
  setTimeout(hook, 800); setTimeout(hook, 2500);
})();
