/* OWNER READS MONITOR (v236) — Owner App ka "Reads" tab.
   Poori site (student + admin + owner + Worker) ke Firestore reads: kab, kis collection se, kis function/line se.
   Saath me Firebase ka asli number (Cloud Monitoring) — dono ka farak "gap" ke roop me.
   Data: Worker /owner/reads/summary | detail | actual  (setup: docs/READS_MONITOR.md) */
(function () {
  "use strict";
  var $ = function (i) { return document.getElementById(i); };
  function esc(x) { return (window.ownerEsc ? window.ownerEsc(x) : String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; })); }
  var RANGES = [[60, "1 ghanta"], [360, "6 ghante"], [1440, "24 ghante"], [10080, "7 din"]];
  var st = { minutes: 60, sum: null, act: null, actErr: "", err: "", busy: false, sel: null, detail: null };
  var ROLE = { student: "👨‍🎓 Student", admin: "🧑‍🏫 Admin", owner: "👑 Owner", worker: "☁️ Worker" };
  var KIND = { get: "query get", doc: "doc get", listen: "listener (pehla)", "listen+": "listener (badlav)", count: "count query" };
  var fmt = function (n) { n = +n || 0; return n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n >= 1e4 ? (n / 1e3).toFixed(1) + "K" : n.toLocaleString("en-IN"); };
  function ist(min, withDate) {
    var d = new Date(min * 60000), o = { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false };
    if (withDate) { o.day = "2-digit"; o.month = "short"; }
    return d.toLocaleString("en-IN", o);
  }
  function call(path) { return window.ownerWorkerCall(path, "GET"); }

  /* spike = bucket jahan reads aam se bahut zyada */
  function spikes(series) {
    var v = series.map(function (x) { return +x.n || 0; }).filter(function (n) { return n > 0; }).sort(function (a, b) { return a - b; });
    var med = v.length ? v[Math.floor(v.length / 2)] : 0, thr = Math.max(500, med * 4);
    return series.filter(function (x) { return x.n >= thr; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
  }

  function chart(sum, act) {
    var step = sum.step, a = {}, i, max = 1, W = 320, H = 110, pad = 2;
    var ts = [], t0 = sum.from - (sum.from % step), t1 = (act && act.until) ? act.until : sum.to;
    for (var t = t0; t <= sum.to; t += step) ts.push(t);
    var tr = {}; sum.series.forEach(function (x) { tr[x.t] = x.n; });
    if (act) act.series.forEach(function (x) { var k = x.t - (x.t % step); a[k] = (a[k] || 0) + x.n; });
    ts.forEach(function (t) { max = Math.max(max, tr[t] || 0, a[t] || 0); });
    var bw = Math.max(1, (W - pad * 2) / ts.length), svg = '<svg viewBox="0 0 ' + W + " " + (H + 16) + '" width="100%" role="img" aria-label="Reads graph">';
    ts.forEach(function (t, k) {
      var x = pad + k * bw, h = Math.round(((tr[t] || 0) / max) * H), sel = st.sel && st.sel.t === t;
      svg += '<rect x="' + x.toFixed(1) + '" y="' + (H - h) + '" width="' + Math.max(0.8, bw - 0.6).toFixed(1) + '" height="' + h + '" fill="' + (sel ? "#dc2626" : "#4f46e5") + '" data-t="' + t + '"/>';
    });
    if (act && act.series.length) {
      var pts = ts.filter(function (t) { return a[t] != null; }).map(function (t, k) { return (pad + ts.indexOf(t) * bw + bw / 2).toFixed(1) + "," + (H - Math.round((a[t] / max) * H)); });
      if (pts.length) svg += '<polyline fill="none" stroke="#f59e0b" stroke-width="1.6" points="' + pts.join(" ") + '"/>';
    }
    svg += '<text x="' + pad + '" y="' + (H + 12) + '" font-size="8" fill="#64748b">' + ist(ts[0], sum.step >= 60) + '</text>';
    svg += '<text x="' + (W - pad) + '" y="' + (H + 12) + '" font-size="8" fill="#64748b" text-anchor="end">' + ist(ts[ts.length - 1], sum.step >= 60) + " IST</text></svg>";
    return '<div style="font-size:.66rem;color:#64748b;margin-bottom:4px">Ek bar = ' + (step >= 60 ? step / 60 + " ghanta" : step + " minute") + ' (peak ' + fmt(max) + ') · <span style="color:#4f46e5">■</span> app/Worker ne ginti · <span style="color:#f59e0b">━</span> Firebase asli</div>' + svg;
  }
  function table(rows, cols) {
    if (!rows.length) return '<div style="font-size:.75rem;color:#64748b;padding:6px 0">Abhi koi data nahi</div>';
    return '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.72rem">' + rows.map(function (r) {
      return "<tr>" + cols.map(function (c, i) { return '<td style="padding:5px 4px;border-bottom:1px solid #eef0f4;' + (i === cols.length - 1 ? "text-align:right;font-weight:700;white-space:nowrap" : "word-break:break-word") + '">' + c(r) + "</td>"; }).join("") + "</tr>";
    }).join("") + "</table></div>";
  }
  var siteCell = function (r) { return '<code style="font-size:.68rem">' + esc(r.site) + "</code>"; };
  var collCell = function (r) { return esc(r.coll || "?") + ' <span style="color:#64748b">' + esc(KIND[r.kind] || r.kind) + "</span>"; };

  function gapHtml(sum, act) {
    if (st.actErr) return '<div class="oa-sum" style="background:#fef3c7;color:#92400e">⚠️ Firebase ka asli number nahi aa paaya: ' + esc(st.actErr) + "</div>";
    if (!act) return "";
    var tr = 0, limit = act.until; sum.series.forEach(function (x) { if (x.t + sum.step <= limit) tr += x.n; });
    var real = act.total, gap = real - tr, pct = real ? Math.round((Math.abs(gap) / real) * 100) : 0;
    var ok = pct <= 10, col = ok ? "#dcfce7;color:#166534" : "#fee2e2;color:#991b1b";
    return '<div class="oa-sum" style="background:' + col + ';display:block"><b>Firebase asli: ' + fmt(real) + "</b> · hamari ginti: <b>" + fmt(tr) + "</b> · farak: <b>" + (gap >= 0 ? "-" : "+") + fmt(Math.abs(gap)) + " (" + pct + "%)</b>" +
      '<div style="font-size:.68rem;margin-top:4px;font-weight:400">' + (ok ? "Mel theek hai." : (gap > 0 ? "Firebase me zyada reads hain: purani app/APK jisme tracker nahi, Firebase Console/export, ya listener resume. 'Build' wali list me purane build dekhein." : "Hamari ginti zyada hai: listener resume me Firebase kam bill karta hai.")) +
      " Monitoring me 3-5 minute ki der hoti hai, isliye aakhri kuch minute ka farak normal hai.</div></div>";
  }

  function render() {
    var box = $("oa-reads-body"); if (!box) return;
    var h = '<div class="oa-row2" style="flex-wrap:wrap;gap:6px;margin:0 0 10px">' + RANGES.map(function (r) {
      return '<button type="button" class="oa-pill" data-r="' + r[0] + '" style="' + (st.minutes === r[0] ? "background:#4f46e5;color:#fff" : "") + '">' + r[1] + "</button>";
    }).join("") + '<button type="button" class="oa-pill" data-act="refresh">' + (st.busy ? "⏳" : "🔄 Refresh") + "</button></div>";
    if (st.err) {
      h += '<div class="oa-sum" style="background:#fee2e2;color:#991b1b;display:block">⚠️ ' + esc(st.err) + (/READS_DB|501/.test(st.err) ? '<div style="font-size:.7rem;margin-top:4px">Setup: Cloudflare → D1 → database banayein → Worker → Bindings → D1, naam <b>READS_DB</b>. Poori guide: docs/READS_MONITOR.md</div>' : "") + "</div>";
    } else if (st.sum) {
      var s = st.sum;
      h += '<div class="oa-card" style="margin:0 0 10px"><h3>Total reads (hamari ginti) <span style="margin-left:auto;font-size:1rem">' + fmt(s.total.n) + "</span></h3>" +
        '<div style="font-size:.7rem;color:#64748b;margin:2px 0 8px">' + fmt(s.total.c) + " requests · " + esc(ist(s.from, true)) + " se " + esc(ist(s.to, true)) + " IST</div>" + chart(s, st.act) + "</div>";
      h += gapHtml(s, st.act);
      var sp = spikes(s.series);
      h += '<div class="oa-card" style="margin:0 0 10px"><h3>⚡ Jhatke (spikes)</h3>' + (sp.length ? '<div style="font-size:.68rem;color:#64748b;margin:2px 0 6px">Kisi par dabayein — wahi waqt ka poora karan khulega</div>' + sp.map(function (x) {
        return '<button type="button" data-sp="' + x.t + '" class="owner-mini-btn" style="margin:2px 4px 2px 0;' + (st.sel && st.sel.t === x.t ? "background:#dc2626;color:#fff" : "") + '">' + esc(ist(x.t, s.step >= 60)) + " · " + fmt(x.n) + "</button>";
      }).join("") : '<div style="font-size:.75rem;color:#16a34a;padding:6px 0">Is range me koi jhatka nahi ✅</div>') + '<div id="oa-reads-detail">' + detailHtml() + "</div></div>";
      h += '<div class="oa-card" style="margin:0 0 10px"><h3>Kaun padh raha hai</h3>' + table(s.byRole, [function (r) { return esc(ROLE[r.role] || r.role); }, function (r) { return fmt(r.c) + " req"; }, function (r) { return fmt(r.n); }]) + "</div>";
      h += '<div class="oa-card" style="margin:0 0 10px"><h3>Kis collection se</h3>' + table(s.byColl, [collCell, function (r) { return fmt(r.n); }]) + "</div>";
      h += '<div class="oa-card" style="margin:0 0 10px"><h3>Kis wajah se (function@file:line)</h3>' + table(s.bySite, [function (r) { return (ROLE[r.role] || r.role) + "<br>" + siteCell(r) + "<br>" + collCell(r); }, function (r) { return fmt(r.n); }]) + "</div>";
      h += '<div class="oa-card" style="margin:0 0 10px"><h3>Institute-wise</h3>' + table(s.byInst, [function (r) { return esc(r.inst); }, function (r) { return fmt(r.n); }]) + '<div style="font-size:.66rem;color:#64748b;margin-top:4px">Sirf wahi reads jinke path me institute hai.</div></div>';
      h += '<div class="oa-card" style="margin:0 0 10px"><h3>App build-wise</h3>' + table(s.byBuild, [function (r) { return r.build === "w" ? "☁️ Worker" : r.build === "?" ? "pata nahi" : "build " + esc(r.build); }, function (r) { return fmt(r.n); }]) + '<div style="font-size:.66rem;color:#64748b;margin-top:4px">Purana build zyada padh raha ho to wahi phone/APK update karwayein.</div></div>';
    } else h += '<div style="font-size:.78rem;color:#64748b;padding:14px 0">Load ho raha hai…</div>';
    box.innerHTML = h;
  }
  function detailHtml() {
    if (!st.sel) return "";
    if (!st.detail) return '<div style="font-size:.75rem;color:#64748b;padding:8px 0">Dekh raha hoon…</div>';
    if (st.detail.error) return '<div style="font-size:.75rem;color:#991b1b;padding:8px 0">' + esc(st.detail.error) + "</div>";
    var d = st.detail, tot = d.rows.reduce(function (s, r) { return s + r.n; }, 0);
    return '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #eef0f4"><b style="font-size:.76rem">' + esc(ist(d.from, true)) + " – " + esc(ist(d.to + 1, true)) + " IST · " + fmt(tot) + " reads</b>" +
      table(d.rows, [function (r) { return esc(ist(r.bucket)) + " · " + (ROLE[r.role] || r.role) + (r.build !== "w" ? " · b" + esc(r.build) : "") + "<br>" + siteCell(r) + "<br>" + collCell(r) + (r.inst ? ' <span style="color:#64748b">· ' + esc(r.inst) + "</span>" : ""); }, function (r) { return fmt(r.n); }]) + "</div>";
  }

  function load() {
    if (st.busy) return; st.busy = true; st.err = ""; st.actErr = ""; st.act = null; render();
    var m = st.minutes;
    call("/owner/reads/summary?minutes=" + m).then(function (s) { st.sum = s; st.sel = null; st.detail = null; }).catch(function (e) { st.err = e.message || String(e); st.sum = null; })
      .then(function () { render(); return st.err ? null : call("/owner/reads/actual?minutes=" + m).then(function (a) { st.act = a; }).catch(function (e) { st.actErr = e.message || String(e); }); })
      .then(function () { st.busy = false; render(); });
  }
  function pickSpike(t) {
    if (!st.sum) return;
    st.sel = { t: +t }; st.detail = null; render();
    call("/owner/reads/detail?from=" + (+t) + "&to=" + (+t + st.sum.step - 1)).then(function (d) { st.detail = d; }).catch(function (e) { st.detail = { error: e.message || String(e) }; }).then(render);
  }
  function wire() {
    var v = $("oa-v-reads"); if (!v || v.__w) return; v.__w = 1;
    v.addEventListener("click", function (e) {
      var b = e.target.closest("[data-r],[data-act],[data-sp]"); if (!b) { var rc = e.target.closest("rect[data-t]"); if (rc && st.sum) { var t = +rc.getAttribute("data-t"); if (st.sum.series.some(function (x) { return x.t === t; })) pickSpike(t); } return; }
      if (b.hasAttribute("data-r")) { st.minutes = +b.getAttribute("data-r"); load(); }
      else if (b.getAttribute("data-act") === "refresh") load();
      else if (b.hasAttribute("data-sp")) pickSpike(b.getAttribute("data-sp"));
    });
  }
  /* tab khulne par ek baar load */
  window.ouiReadsOpen = function () { wire(); if (!st.sum && !st.busy) load(); else render(); };
  window.__readsMonitor = { spikes: spikes, state: st };
})();
