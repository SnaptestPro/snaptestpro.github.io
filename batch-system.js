/* SnapTest Pro — Batch Management System v1
   Admin Panel (batches, live classes, recordings, notes, PPT, students, announcements) + Student "Batch" section.
   Data: institutes/{instituteId}/batches/{batchId}  +  .../items/{itemId}  +  .../members/{mobile}
   Free-tier safe: koi Firebase Storage / Cloud Functions nahi — files ke liye link (Drive/YouTube/URL). */
(function () {
  "use strict";
  var CFG = window.SNAP_CONFIG || {};
  var NOTE_TYPES = [["Notes", "note"], ["Handwritten Notes", "note"], ["Worksheet", "material"], ["Question Bank", "material"], ["Important Questions", "material"], ["Formula Sheet", "material"], ["Previous Year Paper", "material"], ["Reference Document", "material"]];
  var CLASSES = ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12", "Foundation", "Other"];

  function $(s, r) { return (r || document).querySelector(s); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function DB() { var v = window.vishnuFirebase; return v && v.enabled ? v.db : null; }
  function FV() { return firebase.firestore.FieldValue; }
  function authReady() { var v = window.vishnuFirebase; return Promise.resolve(v && v.authReady).catch(function () {}); }
  function toast(m) { var b = document.createElement("div"); b.className = "bm-toast"; b.textContent = m; document.body.appendChild(b); setTimeout(function () { b.remove(); }, 2800); }
  function ms(t) { return !t ? 0 : t.toMillis ? t.toMillis() : new Date(t).getTime(); }
  function fdate(t) { if (!t) return "—"; return new Date(ms(t)).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  function rnd(n) { var a = new Uint8Array(n), s = ""; crypto.getRandomValues(a); a.forEach(function (x) { s += "abcdefghijkmnpqrstuvwxyz23456789"[x % 32]; }); return s; }
  function okUrl(u) { return /^https:\/\/[^\s]+$/i.test(u || ""); }
  function liveUrl(room, name) { return "https://" + (CFG.liveDomain || "meet.jit.si") + "/" + room + (name ? "#userInfo.displayName=%22" + encodeURIComponent(name) + "%22&config.prejoinPageEnabled=false" : ""); }

  /* link -> in-app preview url (sirf wahi jo browser sach me dikha sakta hai) */
  function embed(u) {
    var m;
    if ((m = u.match(/drive\.google\.com\/file\/d\/([^/]+)/))) return { t: "frame", u: "https://drive.google.com/file/d/" + m[1] + "/preview" };
    if ((m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|live\/))([\w-]{6,})/))) return { t: "frame", u: "https://www.youtube.com/embed/" + m[1] };
    if (/\.(mp4|webm|m3u8)(\?|$)/i.test(u)) return { t: "video", u: u };
    if (/\.(pdf|pptx?|docx?|xlsx?)(\?|$)/i.test(u)) return { t: "frame", u: "https://docs.google.com/viewer?embedded=true&url=" + encodeURIComponent(u) };
    return { t: "link", u: u };
  }
  function viewer(title, url) {
    var e = embed(url), v = document.createElement("div"); v.className = "bm-viewer";
    v.innerHTML = '<div class="vt"><b>' + esc(title) + '</b><button data-o>Open ↗</button><button data-x>✕</button></div>' +
      (e.t === "video" ? '<video controls autoplay playsinline src="' + esc(e.u) + '"></video>' : e.t === "frame" ? '<iframe allow="autoplay; fullscreen" allowfullscreen src="' + esc(e.u) + '"></iframe>' :
        '<div style="color:#fff;padding:24px;text-align:center">Is link ka preview in-app nahi ho sakta.<br><br><a style="color:#93c5fd" target="_blank" rel="noopener" href="' + esc(url) + '">Browser me kholein</a></div>');
    v.querySelector("[data-x]").onclick = function () { v.remove(); };
    v.querySelector("[data-o]").onclick = function () { window.open(url, "_blank", "noopener"); };
    document.body.appendChild(v);
  }
  function bref(inst, id) { var c = DB().collection("institutes").doc(inst).collection("batches"); return id ? c.doc(id) : c; }
  function stBadge(it) {
    if (it.kind === "class") return it.status === "live" ? '<span class="bm-badge bm-live">LIVE</span>' : it.status === "completed" ? '<span class="bm-badge">Completed</span>' : it.status === "cancelled" ? '<span class="bm-badge r">Cancelled</span>' : '<span class="bm-badge b">Upcoming</span>';
    if (it.kind === "recording") return { processing: '<span class="bm-badge o">Processing</span>', ready: '<span class="bm-badge p">Ready for Review</span>', published: '<span class="bm-badge g">Published</span>', unpublished: '<span class="bm-badge">Unpublished</span>', failed: '<span class="bm-badge r">Failed</span>' }[it.status] || "";
    return it.published ? '<span class="bm-badge g">Published</span>' : '<span class="bm-badge">Draft</span>';
  }

  /* =================== ADMIN =================== */
  var A = { inst: null, batches: [], items: {}, students: null, view: "dash", f: {} };
  function adminEmail() { try { return (window.vishnuFirebase.auth.currentUser.email || "").toLowerCase(); } catch (e) { return ""; } }
  function audit(action, ref) { try { bref(A.inst).parent.collection("auditLogs").add({ action: action, ref: ref || "", by: adminEmail(), at: FV().serverTimestamp() }); } catch (e) {} }
  function allItems() { var a = []; Object.keys(A.items).forEach(function (b) { a = a.concat(A.items[b]); }); return a; }
  function batchName(id) { var b = A.batches.filter(function (x) { return x.id === id; })[0]; return b ? b.name : "—"; }

  function openAdmin() {
    if (typeof isAdminLoggedIn === "function" && !isAdminLoggedIn()) return;
    if (!DB()) return toast("Firebase connection nahi hai");
    toast("Loading…");
    Promise.resolve(typeof ensureAdminInstituteResolved === "function" ? ensureAdminInstituteResolved() : null).then(function () {
      A.inst = typeof getCurrentAdminInstituteId === "function" ? getCurrentAdminInstituteId() : null;
      if (!A.inst) return toast("Institute resolve nahi hua — dobara try karein");
      buildAdmin(); return loadAll().then(function () { adminGo("dash"); }).catch(function (e) { console.warn(e); $("#bm-main").innerHTML = '<div class="bm-empty">Data load nahi hua (' + esc(e.code || e.message) + '). Firestore Rules publish kiye? NOTES padhein.</div>'; });
    });
  }
  function loadAll() {
    return authReady().then(function () { return bref(A.inst).get(); }).then(function (q) {
      A.batches = q.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }); A.items = {};
      return Promise.all(A.batches.map(function (b) { return bref(A.inst, b.id).collection("items").get().then(function (s) { A.items[b.id] = s.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }); }); }));
    });
  }
  var NAV = [["dash", "🏠", "Dashboard"], ["batches", "🎓", "Batch Management"], ["class", "🔴", "Live Classes"], ["recording", "🎬", "Recorded Lectures"], ["note", "📄", "Notes & Study Material"], ["ppt", "📊", "PPT / Presentations"], ["tests", "📝", "Tests & Assignments"], ["students", "👥", "Students"], ["announcement", "📢", "Announcements"]];
  function buildAdmin() {
    var o = $("#bm-admin"); o && o.remove();
    o = document.createElement("div"); o.id = "bm-admin";
    o.innerHTML = '<aside class="bm-side"><div class="bm-logo"><img src="icon-512-maskable.png" alt="">SnapTest Pro</div>' +
      NAV.map(function (n) { return '<button class="bm-nav" data-v="' + n[0] + '"><span>' + n[1] + '</span>' + n[2] + '</button>'; }).join("") +
      '<button class="bm-nav" data-v="exit"><span>⬅️</span>Admin Home</button><div class="bm-me">' + esc(adminEmail()) + '<br>Admin</div></aside>' +
      '<main class="bm-main"><div class="bm-top"><button class="bm-burger" id="bm-burger">☰</button><h2 id="bm-title"></h2><span id="bm-topact"></span></div><div id="bm-main"></div></main>';
    document.body.appendChild(o);
    $("#bm-burger").onclick = function () { o.classList.toggle("open"); };
    o.querySelectorAll(".bm-nav").forEach(function (b) { b.onclick = function () { o.classList.remove("open"); b.dataset.v === "exit" ? o.remove() : (A.f = {}, adminGo(b.dataset.v)); }; });
  }
  function adminGo(v) {
    A.view = v; var t = (NAV.filter(function (n) { return n[0] === v; })[0] || [0, 0, "Dashboard"])[2];
    $("#bm-title").textContent = t; $("#bm-topact").innerHTML = "";
    document.querySelectorAll("#bm-admin .bm-nav").forEach(function (b) { b.classList.toggle("on", b.dataset.v === v); });
    var m = $("#bm-main");
    ({ dash: vDash, batches: vBatches, students: vStudents, tests: vTests })[v] ? ({ dash: vDash, batches: vBatches, students: vStudents, tests: vTests })[v](m) : vItems(m, v);
  }
  function topBtn(label, fn) { var s = $("#bm-topact"); s.innerHTML = '<button class="bm-btn">' + label + '</button>'; s.firstChild.onclick = fn; }

  function vDash(m) {
    var all = allItems(), now = new Date(), d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(), d1 = d0 + 864e5;
    var live = all.filter(function (i) { return i.kind === "class" && (i.status === "live" || (i.status === "upcoming" && ms(i.scheduledAt) >= d0 && ms(i.scheduledAt) < d1)); });
    var students = A.batches.reduce(function (s, b) { return s + (b.enrolledCount || 0); }, 0);
    var st = [["Total Batches", A.batches.length], ["Total Enrollments", students], ["Live Classes Today", live.length], ["Recorded Lectures", all.filter(function (i) { return i.kind === "recording"; }).length],
      ["Active Batches", A.batches.filter(function (b) { return b.status === "active"; }).length], ["Uploaded Notes", all.filter(function (i) { return i.kind === "note" || i.kind === "material"; }).length], ["Uploaded PPTs", all.filter(function (i) { return i.kind === "ppt"; }).length], ["Announcements", all.filter(function (i) { return i.kind === "announcement"; }).length]];
    var max = Math.max.apply(null, [1].concat(A.batches.map(function (b) { return b.enrolledCount || 0; })));
    var recent = all.slice().sort(function (a, b) { return ms(b.createdAt) - ms(a.createdAt); }).slice(0, 6);
    m.innerHTML = '<div class="bm-stats">' + st.map(function (s) { return '<div class="bm-stat"><small>' + s[0] + '</small><b>' + s[1] + '</b></div>'; }).join("") + '</div>' +
      '<div class="bm-grid2"><div class="bm-card"><h3>Today\'s Live Classes</h3>' + (live.length ? live.map(function (i) { return '<div class="bm-row"><div class="g"><b>' + esc(i.title) + '</b><small>' + esc(batchName(i.batchId)) + ' • ' + fdate(i.scheduledAt) + '</small></div>' + stBadge(i) + '</div>'; }).join("") : '<div class="bm-empty">Aaj koi live class schedule nahi hai.</div>') + '</div>' +
      '<div class="bm-card"><h3>Recent Activity</h3>' + (recent.length ? recent.map(function (i) { return '<div class="bm-row"><div class="g"><b>' + esc(i.title) + '</b><small>' + esc(i.kind) + ' • ' + esc(batchName(i.batchId)) + '</small></div><small>' + fdate(i.createdAt) + '</small></div>'; }).join("") : '<div class="bm-empty">Abhi koi activity nahi.</div>') + '</div></div>' +
      '<div class="bm-card"><h3>Students per Batch</h3>' + (A.batches.length ? '<div class="bm-bars">' + A.batches.slice(0, 8).map(function (b) { return '<div><i style="height:' + Math.round(100 * (b.enrolledCount || 0) / max) + '%"></i>' + (b.enrolledCount || 0) + '<br>' + esc((b.name || "").slice(0, 10)) + '</div>'; }).join("") + '</div>' : '<div class="bm-empty">Pehle ek batch banayein.</div>') + '</div>';
  }

  /* ---------- generic modal form ---------- */
  function form(title, fields, vals, save) {
    var md = document.createElement("div"); md.className = "bm-modal";
    md.innerHTML = '<div class="bm-sheet"><h3>' + esc(title) + '</h3><div class="bm-form">' + fields.map(function (f) {
      var v = vals[f.k] == null ? "" : vals[f.k], id = 'bmf_' + f.k, inp;
      if (f.t === "select") inp = '<select id="' + id + '">' + f.o.map(function (o) { var ov = Array.isArray(o) ? o[0] : o, ol = Array.isArray(o) ? o[1] : o; return '<option value="' + esc(ov) + '"' + (String(v) === String(ov) ? " selected" : "") + '>' + esc(ol) + '</option>'; }).join("") + '</select>';
      else if (f.t === "textarea") inp = '<textarea id="' + id + '" rows="3">' + esc(v) + '</textarea>';
      else inp = '<input id="' + id + '" type="' + (f.t || "text") + '" value="' + esc(v) + '" placeholder="' + esc(f.p || "") + '">';
      return '<label>' + esc(f.l) + (f.r ? " *" : "") + '</label>' + inp + (f.h ? '<div class="bm-note">' + f.h + '</div>' : "");
    }).join("") + '<div class="acts"><button class="bm-btn sec" data-c>Cancel</button><button class="bm-btn" data-s>Save</button></div></div></div>';
    document.body.appendChild(md);
    md.querySelector("[data-c]").onclick = function () { md.remove(); };
    md.querySelector("[data-s]").onclick = function () {
      var out = {}, bad = "";
      fields.forEach(function (f) { var v = md.querySelector("#bmf_" + f.k).value.trim(); out[f.k] = v; if (f.r && !v && !bad) bad = f.l + " zaroori hai"; });
      if (bad) return toast(bad);
      var btn = md.querySelector("[data-s]"); btn.disabled = true;
      Promise.resolve(save(out)).then(function (ok) { ok === false ? (btn.disabled = false) : md.remove(); }).catch(function (e) { console.warn(e); btn.disabled = false; toast("Save nahi hua: " + (e.code || e.message)); });
    };
  }
  function sure(msg) { return confirm(msg); }

  /* ---------- Batches ---------- */
  function subjOf(b) { return Array.isArray(b.subjects) ? b.subjects : []; }
  function vBatches(m) {
    topBtn("+ Create Batch", function () { batchForm(null); });
    var q = (A.f.q || "").toLowerCase(), s = A.f.s || "all";
    var rows = A.batches.filter(function (b) { return (s === "all" || b.status === s) && (!q || (b.name + b.code).toLowerCase().indexOf(q) > -1); }).sort(function (a, b) { return ms(b.createdAt) - ms(a.createdAt); });
    m.innerHTML = '<div class="bm-tools"><input id="bm-q" placeholder="Search batch…" value="' + esc(A.f.q || "") + '"><select id="bm-s">' + [["all", "All"], ["active", "Active"], ["inactive", "Inactive"], ["upcoming", "Upcoming"]].map(function (o) { return '<option value="' + o[0] + '"' + (s === o[0] ? " selected" : "") + '>' + o[1] + '</option>'; }).join("") + '</select></div>' +
      '<div class="bm-tablewrap"><table class="bm-table"><tr><th>Batch</th><th>Class</th><th>Subjects</th><th>Teacher</th><th>Students</th><th>Status</th><th>Created</th><th>Actions</th></tr>' +
      (rows.length ? rows.map(function (b) { return '<tr><td><b>' + esc(b.name) + '</b><br><small>' + esc(b.code || "") + '</small></td><td>' + esc(b.classLabel || "") + '</td><td>' + esc(subjOf(b).join(", ")) + '</td><td>' + esc((b.teachers || []).join(", ")) + '</td><td>' + (b.enrolledCount || 0) + (b.limit ? "/" + b.limit : "") + '</td><td><span class="bm-badge ' + (b.status === "active" ? "g" : b.status === "upcoming" ? "b" : "") + '">' + esc(b.status) + '</span></td><td>' + fdate(b.createdAt).split(",")[0] + '</td><td><div class="bm-act">' +
        '<button class="bm-btn sec sm" data-a="content" data-id="' + b.id + '">Content</button><button class="bm-btn sec sm" data-a="stu" data-id="' + b.id + '">Students</button><button class="bm-btn sec sm" data-a="edit" data-id="' + b.id + '">Edit</button><button class="bm-btn sec sm" data-a="tog" data-id="' + b.id + '">' + (b.status === "active" ? "Deactivate" : "Activate") + '</button><button class="bm-btn red sm" data-a="del" data-id="' + b.id + '">Delete</button></div></td></tr>'; }).join("") : '<tr><td colspan="8"><div class="bm-empty">Koi batch nahi mila. "+ Create Batch" dabayein.</div></td></tr>') + '</table></div>';
    $("#bm-q").oninput = function () { A.f.q = this.value; var p = this.selectionStart; vBatches(m); var n = $("#bm-q"); n.focus(); n.setSelectionRange(p, p); };
    $("#bm-s").onchange = function () { A.f.s = this.value; vBatches(m); };
    m.querySelectorAll("[data-a]").forEach(function (b) { b.onclick = function () { batchAct(b.dataset.a, b.dataset.id); }; });
  }
  function batchForm(b) {
    var v = b ? Object.assign({}, b, { subjectsTxt: subjOf(b).join(", "), teachersTxt: (b.teachers || []).join(", "), sd: b.startDate || "", ed: b.endDate || "" }) : { status: "active", type: "hybrid", sd: "", ed: "" };
    form(b ? "Edit Batch" : "Create New Batch", [
      { k: "name", l: "Batch Name", r: 1, p: "Class 10th - Board 2026" }, { k: "code", l: "Batch Code", p: "C10-B26" },
      { k: "classLabel", l: "Class / Grade", t: "select", o: CLASSES }, { k: "subjectsTxt", l: "Subjects (comma se alag)", r: 1, p: "Maths, Science, SST" },
      { k: "desc", l: "Description", t: "textarea" }, { k: "teachersTxt", l: "Teachers (naam, comma se alag)", p: "Vikash Sir, Pooja Ma'am" },
      { k: "sd", l: "Start Date", t: "date", r: 1 }, { k: "ed", l: "End Date", t: "date", r: 1 },
      { k: "type", l: "Batch Type", t: "select", o: [["live", "Live Batch"], ["recorded", "Recorded Batch"], ["hybrid", "Hybrid (Live + Recorded)"]] },
      { k: "limit", l: "Enrollment Limit (khaali = unlimited)", t: "number" }, { k: "status", l: "Status", t: "select", o: ["active", "inactive", "upcoming"] }
    ], v, function (o) {
      if (o.ed < o.sd) { toast("End Date, Start Date se pehle nahi ho sakti"); return false; }
      var data = { name: o.name, code: o.code, classLabel: o.classLabel, subjects: o.subjectsTxt.split(",").map(function (x) { return x.trim(); }).filter(Boolean), desc: o.desc, teachers: o.teachersTxt.split(",").map(function (x) { return x.trim(); }).filter(Boolean), startDate: o.sd, endDate: o.ed, type: o.type, limit: o.limit ? Math.max(1, +o.limit) : 0, status: o.status, published: o.status !== "inactive", instituteId: A.inst, updatedAt: FV().serverTimestamp() };
      var p = b ? bref(A.inst, b.id).update(data) : bref(A.inst).add(Object.assign(data, { enrolledCount: 0, createdAt: FV().serverTimestamp(), createdBy: adminEmail() }));
      return p.then(function () { audit(b ? "batch.update" : "batch.create", b ? b.id : data.name); toast("✅ Batch save ho gaya"); return loadAll().then(function () { adminGo("batches"); }); });
    });
  }
  function batchAct(a, id) {
    var b = A.batches.filter(function (x) { return x.id === id; })[0]; if (!b) return;
    if (a === "edit") return batchForm(b);
    if (a === "content") { A.f = { batch: id }; return adminGo("class"); }
    if (a === "stu") { A.f = { batch: id }; return adminGo("students"); }
    if (a === "tog") { var on = b.status !== "active"; return bref(A.inst, id).update({ status: on ? "active" : "inactive", published: on, updatedAt: FV().serverTimestamp() }).then(function () { audit("batch." + (on ? "activate" : "deactivate"), id); return loadAll(); }).then(function () { adminGo("batches"); }); }
    if (a === "del") {
      var n = (A.items[id] || []).length;
      if (n || b.enrolledCount) return alert("Is batch me " + n + " content aur " + (b.enrolledCount || 0) + " students hain.\nSafe policy: pehle content/students hatayein, ya batch ko Deactivate karein (data surakshit rahega).");
      if (!sure('Batch "' + b.name + '" permanently delete karein? Ye undo nahi hoga.')) return;
      bref(A.inst, id).delete().then(function () { audit("batch.delete", id); return loadAll(); }).then(function () { adminGo("batches"); });
    }
  }

  /* ---------- Items (class / recording / notes / ppt / announcement) ---------- */
  var KIND_OF = { class: ["class"], recording: ["recording"], note: ["note", "material"], ppt: ["ppt"], announcement: ["announcement"] };
  function vItems(m, v) {
    if (!A.batches.length) { m.innerHTML = '<div class="bm-card bm-empty">Pehle "Batch Management" me ek batch banayein.</div>'; return; }
    var kinds = KIND_OF[v], q = (A.f.q || "").toLowerCase(), bf = A.f.batch || "all";
    topBtn(v === "recording" ? "+ Add Recording" : v === "class" ? "+ Schedule Class" : "+ Add", function () { itemForm(v, null); });
    var rows = allItems().filter(function (i) { return kinds.indexOf(i.kind) > -1 && (bf === "all" || i.batchId === bf) && (!q || (i.title || "").toLowerCase().indexOf(q) > -1); }).sort(function (a, b) { return (ms(b.scheduledAt) || ms(b.createdAt)) - (ms(a.scheduledAt) || ms(a.createdAt)); });
    m.innerHTML = '<div class="bm-tools"><select id="bm-bf"><option value="all">All Batches</option>' + A.batches.map(function (b) { return '<option value="' + b.id + '"' + (bf === b.id ? " selected" : "") + '>' + esc(b.name) + '</option>'; }).join("") + '</select><input id="bm-q" placeholder="Search…" value="' + esc(A.f.q || "") + '"></div>' +
      '<div class="bm-tablewrap"><table class="bm-table"><tr><th>Title</th><th>Batch</th><th>Subject</th><th>' + (v === "class" ? "Schedule" : "Date") + '</th><th>Status</th><th>Actions</th></tr>' +
      (rows.length ? rows.map(function (i) { return '<tr><td><b>' + esc(i.title) + '</b>' + (i.cat ? '<br><small>' + esc(i.cat) + '</small>' : "") + '</td><td>' + esc(batchName(i.batchId)) + '</td><td>' + esc(i.subject || "—") + '</td><td>' + fdate(i.scheduledAt || i.createdAt) + '</td><td>' + stBadge(i) + '</td><td><div class="bm-act">' + itemActs(i) + '</div></td></tr>'; }).join("") : '<tr><td colspan="6"><div class="bm-empty">Abhi kuch nahi hai. Upar "+" se jodein.</div></td></tr>') + '</table></div>' +
      (v === "recording" ? '<div class="bm-note">ℹ️ Recording tabhi "Ready" hoti hai jab aap uska valid link (YouTube unlisted / Google Drive / direct video URL) jodte hain. Bina link ke koi recording "saved" nahi maani jaati.</div>' : "");
    $("#bm-bf").onchange = function () { A.f.batch = this.value; vItems(m, v); };
    $("#bm-q").oninput = function () { A.f.q = this.value; var p = this.selectionStart; vItems(m, v); var n = $("#bm-q"); n.focus(); n.setSelectionRange(p, p); };
    m.querySelectorAll("[data-a]").forEach(function (b) { b.onclick = function () { itemAct(b.dataset.a, b.dataset.b, b.dataset.id, v); }; });
  }
  function itemActs(i) {
    var a = function (k, l, c) { return '<button class="bm-btn ' + (c || "sec") + ' sm" data-a="' + k + '" data-b="' + i.batchId + '" data-id="' + i.id + '">' + l + '</button>'; }, h = "";
    if (i.kind === "class") {
      if (i.status === "upcoming") h += a("golive", "▶ Go Live", "");
      if (i.status === "live") h += a("rejoin", "Rejoin") + a("end", "■ End Class", "red");
      if (i.status === "upcoming") h += a("cancel", "Cancel");
    }
    if (i.url) h += a("view", "View");
    if (i.kind === "recording") {
      if (i.status === "ready" || i.status === "unpublished") h += a("pub", "Publish", "");
      if (i.status === "published") h += a("unpub", "Unpublish");
      if (i.status === "processing") h += a("fail", "Mark Failed");
      if (i.status === "failed") h += a("retry", "Retry");
    } else if (i.kind !== "class") h += a(i.published ? "unpub" : "pub", i.published ? "Unpublish" : "Publish", i.published ? "sec" : "");
    return h + a("edit", "Edit") + a("del", "Delete", "red");
  }
  function itemForm(v, it) {
    var kind = it ? it.kind : KIND_OF[v][0], bs = A.batches.map(function (b) { return [b.id, b.name]; });
    var f = [{ k: "batchId", l: "Batch", t: "select", o: bs, r: 1 }, { k: "title", l: kind === "announcement" ? "Title" : "Title", r: 1 }];
    if (kind === "note" || kind === "material") f.push({ k: "cat", l: "Type", t: "select", o: NOTE_TYPES.map(function (x) { return x[0]; }) });
    if (kind !== "announcement") f.push({ k: "subject", l: "Subject" }, { k: "chapter", l: "Chapter" });
    f.push({ k: "desc", l: kind === "announcement" ? "Message" : "Description", t: "textarea", r: kind === "announcement" });
    if (kind === "class") f.push({ k: "dt", l: "Date & Time", t: "datetime-local", r: 1 }, { k: "durationMin", l: "Duration (minutes)", t: "number" }, { k: "teacher", l: "Teacher" });
    if (kind === "recording") f.push({ k: "durationMin", l: "Duration (minutes)", t: "number" }, { k: "teacher", l: "Teacher" }, { k: "url", l: "Recording Link (https)", h: "YouTube unlisted / Google Drive (share: anyone with link) / direct .mp4" });
    if (kind === "note" || kind === "material" || kind === "ppt") f.push({ k: "url", l: "File Link (https)", r: 1, h: "Google Drive (anyone with link) ya direct PDF/PPT URL. File Firebase me store nahi hoti — sirf link." });
    var vals = it ? Object.assign({}, it, { dt: it.scheduledAt ? new Date(ms(it.scheduledAt) - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : "" }) : { batchId: A.f.batch || (A.batches[0] || {}).id, cat: "Notes" };
    form((it ? "Edit " : "Add ") + kind, f, vals, function (o) {
      if (o.url && !okUrl(o.url)) { toast("Link https:// se shuru hona chahiye"); return false; }
      if (kind === "class" && !it && new Date(o.dt).getTime() < Date.now() - 36e5) { toast("Past ka time schedule nahi ho sakta"); return false; }
      var data = { batchId: o.batchId, instituteId: A.inst, kind: kind, title: o.title, desc: o.desc || "", subject: o.subject || "", chapter: o.chapter || "", updatedAt: FV().serverTimestamp() };
      if (kind === "note" || kind === "material") { data.cat = o.cat; data.kind = NOTE_TYPES.filter(function (x) { return x[0] === o.cat; })[0][1]; }
      if (o.url !== undefined) data.url = o.url;
      if (kind === "class") { data.scheduledAt = firebase.firestore.Timestamp.fromDate(new Date(o.dt)); data.durationMin = +o.durationMin || 60; data.teacher = o.teacher || ""; if (!it) { data.status = "upcoming"; data.published = true; } }
      if (kind === "recording") { data.durationMin = +o.durationMin || 0; data.teacher = o.teacher || ""; if (o.url && (!it || it.status === "processing" || it.status === "failed")) data.status = "ready"; if (!it) { data.status = o.url ? "ready" : "processing"; data.published = false; } }
      if (kind === "announcement" && !it) data.published = true;
      if (!it && kind !== "class" && kind !== "recording" && kind !== "announcement") data.published = false;
      var col = bref(A.inst, o.batchId).collection("items");
      var p = it ? bref(A.inst, it.batchId).collection("items").doc(it.id).update(data) : col.add(Object.assign(data, { createdAt: FV().serverTimestamp(), createdBy: adminEmail() }));
      return p.then(function () { audit("item." + (it ? "update" : "create"), kind); toast("✅ Save ho gaya"); return loadAll().then(function () { adminGo(v); }); });
    });
  }
  function itemRef(b, id) { return bref(A.inst, b).collection("items").doc(id); }
  function itemAct(a, b, id, v) {
    var it = (A.items[b] || []).filter(function (x) { return x.id === id; })[0]; if (!it) return;
    var done = function (msg) { return function () { audit("item." + a, id); msg && toast(msg); return loadAll().then(function () { adminGo(v); }); }; }, upd = function (d) { d.updatedAt = FV().serverTimestamp(); return itemRef(b, id).update(d); };
    if (a === "edit") return itemForm(v, it);
    if (a === "view") return viewer(it.title, it.url);
    if (a === "del") { if (!sure('"' + it.title + '" delete karein? Ye undo nahi hoga.')) return; return itemRef(b, id).delete().then(done("Delete ho gaya")); }
    if (a === "pub") { if (it.kind === "recording" && !it.url) return toast("Pehle recording ka valid link jodein (Edit)"); return upd(it.kind === "recording" ? { status: "published", published: true } : { published: true }).then(done("Published")); }
    if (a === "unpub") return upd(it.kind === "recording" ? { status: "unpublished", published: false } : { published: false }).then(done("Unpublished"));
    if (a === "fail") return upd({ status: "failed" }).then(done());
    if (a === "retry") return upd({ status: "processing" }).then(done());
    if (a === "cancel") return upd({ status: "cancelled" }).then(done());
    if (a === "golive") {
      if (!sure('"' + it.title + '" abhi live shuru karein?\n\nLive Jitsi room me hoga. Pehle jo join karta hai wo moderator banta hai.')) return;
      var room = "snp" + rnd(14); return upd({ status: "live", liveRoom: room, published: true, startedAt: FV().serverTimestamp() }).then(done()).then(function () { window.open(liveUrl(room, "Teacher"), "_blank", "noopener"); });
    }
    if (a === "rejoin") return window.open(liveUrl(it.liveRoom, "Teacher"), "_blank", "noopener");
    if (a === "end") {
      if (!sure("Class khatam karein?")) return;
      var has = (A.items[b] || []).some(function (x) { return x.kind === "recording" && x.classId === id; });
      return upd({ status: "completed", liveRoom: FV().delete(), endedAt: FV().serverTimestamp() }).then(function () {
        if (has) return;
        return bref(A.inst, b).collection("items").add({ batchId: b, instituteId: A.inst, kind: "recording", classId: id, title: it.title, desc: it.desc || "", subject: it.subject || "", chapter: it.chapter || "", teacher: it.teacher || "", status: "processing", published: false, createdAt: FV().serverTimestamp(), createdBy: adminEmail(), updatedAt: FV().serverTimestamp() });
      }).then(done("Class khatam. Recording 'Processing' me hai — Recorded Lectures me uska link jodein."));
    }
  }

  /* ---------- Students / enrollment ---------- */
  function vStudents(m) {
    var go = function () {
      var q = (A.f.q || "").toLowerCase(), bf = A.f.batch || "all";
      var rows = A.students.filter(function (s) { return (bf === "all" || (s.batchIds || []).indexOf(bf) > -1) && (!q || (s.name + s.mobile).toLowerCase().indexOf(q) > -1); }).slice(0, 200);
      m.innerHTML = '<div class="bm-tools"><select id="bm-bf"><option value="all">All Students</option>' + A.batches.map(function (b) { return '<option value="' + b.id + '"' + (bf === b.id ? " selected" : "") + '>In: ' + esc(b.name) + '</option>'; }).join("") + '</select><input id="bm-q" placeholder="Name / mobile search…" value="' + esc(A.f.q || "") + '"></div>' +
        '<div class="bm-tablewrap"><table class="bm-table"><tr><th>Name</th><th>Mobile</th><th>Batches</th><th>Action</th></tr>' + (rows.length ? rows.map(function (s) { return '<tr><td><b>' + esc(s.name) + '</b></td><td>' + esc(s.mobile) + '</td><td>' + esc((s.batchIds || []).map(batchName).join(", ") || "—") + '</td><td><button class="bm-btn sec sm" data-m="' + esc(s.mobile) + '">Manage Batches</button></td></tr>'; }).join("") : '<tr><td colspan="4"><div class="bm-empty">Koi student nahi mila.</div></td></tr>') + '</table></div><div class="bm-note">Sirf aapke institute ke students dikhte hain. Max 200 dikhaye gaye — search use karein.</div>';
      $("#bm-bf").onchange = function () { A.f.batch = this.value; vStudents(m); };
      $("#bm-q").oninput = function () { A.f.q = this.value; var p = this.selectionStart; go(); var n = $("#bm-q"); n.focus(); n.setSelectionRange(p, p); };
      m.querySelectorAll("[data-m]").forEach(function (b) { b.onclick = function () { enrollForm(b.dataset.m); }; });
    };
    if (A.students) return go();
    m.innerHTML = '<div class="bm-empty">Loading students…</div>';
    authReady().then(function () { return DB().collection("students").where("instituteId", "==", A.inst).limit(500).get(); }).then(function (q) { A.students = q.docs.map(function (d) { return Object.assign({ mobile: d.id }, d.data()); }); go(); }).catch(function (e) { m.innerHTML = '<div class="bm-empty">Students load nahi hue (' + esc(e.code || e.message) + ')</div>'; });
  }
  function enrollForm(mobile) {
    var s = A.students.filter(function (x) { return x.mobile === mobile; })[0], cur = s.batchIds || [], md = document.createElement("div"); md.className = "bm-modal";
    md.innerHTML = '<div class="bm-sheet"><h3>' + esc(s.name) + ' — Batches</h3><div class="bm-form">' + (A.batches.length ? A.batches.map(function (b) { return '<label style="display:flex;gap:8px;align-items:center;font-size:.86rem"><input type="checkbox" style="width:auto" value="' + b.id + '"' + (cur.indexOf(b.id) > -1 ? " checked" : "") + '>' + esc(b.name) + (b.limit ? ' <small>(' + (b.enrolledCount || 0) + '/' + b.limit + ')</small>' : "") + '</label>'; }).join("") : '<div class="bm-empty">Pehle batch banayein.</div>') + '<div class="acts"><button class="bm-btn sec" data-c>Cancel</button><button class="bm-btn" data-s>Save</button></div></div></div>';
    document.body.appendChild(md);
    md.querySelector("[data-c]").onclick = function () { md.remove(); };
    md.querySelector("[data-s]").onclick = function () {
      var sel = [].map.call(md.querySelectorAll("input:checked"), function (i) { return i.value; }), add = sel.filter(function (x) { return cur.indexOf(x) < 0; }), rem = cur.filter(function (x) { return sel.indexOf(x) < 0; });
      for (var k = 0; k < add.length; k++) { var bb = A.batches.filter(function (x) { return x.id === add[k]; })[0]; if (bb && bb.limit && (bb.enrolledCount || 0) >= bb.limit) return toast('"' + bb.name + '" ki limit poori ho chuki hai'); }
      var db = DB(), sref = db.collection("students").doc(mobile), step = Promise.resolve();
      if (add.length) step = step.then(function () { var wb = db.batch(); wb.update(sref, { batchIds: FV().arrayUnion.apply(FV(), add) }); add.forEach(function (id) { wb.set(bref(A.inst, id).collection("members").doc(mobile), { mobile: mobile, name: s.name || "", instituteId: A.inst, enrolledAt: FV().serverTimestamp(), by: adminEmail() }); wb.update(bref(A.inst, id), { enrolledCount: FV().increment(1) }); }); return wb.commit(); });
      if (rem.length) step = step.then(function () { var wb = db.batch(); wb.update(sref, { batchIds: FV().arrayRemove.apply(FV(), rem) }); rem.forEach(function (id) { wb.delete(bref(A.inst, id).collection("members").doc(mobile)); wb.update(bref(A.inst, id), { enrolledCount: FV().increment(-1) }); }); return wb.commit(); });
      step.then(function () { s.batchIds = sel; audit("enroll.update", mobile); md.remove(); toast("✅ Enrollment update hua"); return loadAll(); }).then(function () { adminGo("students"); }).catch(function (e) { toast("Nahi hua: " + (e.code || e.message)); });
    };
  }
  function vTests(m) {
    m.innerHTML = '<div class="bm-card"><h3>Tests & Assignments</h3><p style="font-size:.86rem;color:#475569">Tests aapke maujooda SnapTest Pro test engine se hi chalte hain (duplicate nahi banaya gaya). Test banakar publish karein — students use Tests tab me dekhte hain.</p><button class="bm-btn" id="bm-gt">Existing Tests kholein</button><p class="bm-note">Batch-wise test assignment aur assignment submissions agle phase me.</p></div>';
    $("#bm-gt").onclick = function () { $("#bm-admin").remove(); typeof goAdmin === "function" && goAdmin("tests"); };
  }

  /* =================== STUDENT =================== */
  var S = { batches: [], items: {}, mine: [], cur: null, tab: "overview" };
  function sess() { try { return getStudentSession(); } catch (e) { return null; } }
  function openStudent() {
    var s = sess(); if (!s) return;
    var o = $("#bm-student"); if (!o) { o = document.createElement("div"); o.id = "bm-student"; document.body.appendChild(o); }
    o.classList.remove("bm-hidden"); setNav(true); S.cur = null;
    o.innerHTML = '<div class="bm-sh"><b>My Batches</b></div><div class="bm-empty">Loading…</div>';
    loadMine().then(sHome).catch(function (e) { console.warn(e); o.innerHTML = '<div class="bm-sh"><b>My Batches</b></div><div class="bm-empty">Batches load nahi hue. Internet check karein.</div>'; });
  }
  function closeStudent() { var o = $("#bm-student"); o && o.classList.add("bm-hidden"); setNav(false); }
  function setNav(on) { var n = $("#sn-nav"); if (!n) return; n.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", on && b.dataset.k === "batch"); }); }
  function loadMine() {
    var s = sess(), db = DB(); if (!db) return Promise.reject();
    return authReady().then(function () { return Promise.resolve(typeof ensureMyInstituteId === "function" ? ensureMyInstituteId() : s.instituteId); }).then(function (inst) {
      S.inst = inst; if (!inst) { S.batches = []; return; }
      return db.collection("students").doc(String(s.mobile)).get().then(function (d) {
        S.mine = (d.exists && d.data().batchIds) || [];
        return Promise.all(S.mine.map(function (id) { return bref(inst, id).get().then(function (b) { return b.exists ? Object.assign({ id: b.id }, b.data()) : null; }).catch(function () { return null; }); }));
      }).then(function (bs) {
        S.batches = bs.filter(function (b) { return b && b.published; });
        return Promise.all(S.batches.map(function (b) { return bref(inst, b.id).collection("items").where("published", "==", true).get().then(function (q) { S.items[b.id] = q.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }); }).catch(function () { S.items[b.id] = []; }); }));
      });
    });
  }
  function liveOf(b) { return (S.items[b.id] || []).filter(function (i) { return i.kind === "class" && i.status === "live" && i.liveRoom; })[0]; }
  function nextOf(b) { var n = Date.now() - 36e5; return (S.items[b.id] || []).filter(function (i) { return i.kind === "class" && i.status === "upcoming" && ms(i.scheduledAt) >= n; }).sort(function (a, c) { return ms(a.scheduledAt) - ms(c.scheduledAt); })[0]; }
  function sHome() {
    var o = $("#bm-student"), live = S.batches.map(liveOf).filter(Boolean);
    o.innerHTML = '<div class="bm-sh"><b>My Batches</b><button data-x>✕</button></div>' +
      (live.length ? '<div class="bm-next"><div>🔴 <b>Live Now:</b> ' + esc(live[0].title) + '</div><button data-j="' + live[0].batchId + '">Join Now</button></div>' : "") +
      (S.batches.length ? S.batches.map(function (b) { var l = liveOf(b), n = nextOf(b); return '<div class="bm-bcard" data-b="' + b.id + '"><span class="bm-tag"' + (l ? ' style="background:#ef4444"' : "") + '>' + (l ? "Live Now" : { live: "Live Batch", recorded: "Recorded", hybrid: "Hybrid" }[b.type] || "Batch") + '</span><b>' + esc(b.name) + '</b><small>' + esc(subjOf(b).join(" • ")) + '</small><div class="bm-meta"><span>👥 ' + (b.enrolledCount || 0) + (b.limit ? "/" + b.limit : "") + '</span><span>' + (n ? "⏰ " + fdate(n.scheduledAt) : "Koi upcoming class nahi") + '</span></div></div>'; }).join("") :
        '<div class="bm-empty">Abhi aap kisi batch me enrolled nahi hain.<br>Apne institute admin se enroll karwayein.</div>');
    o.querySelector("[data-x]").onclick = function () { closeStudent(); var h = $('#sn-nav [data-k="home"]'); h && h.click(); };
    o.querySelectorAll("[data-b]").forEach(function (c) { c.onclick = function () { S.tab = "overview"; sBatch(c.dataset.b); }; });
    var j = o.querySelector("[data-j]"); j && (j.onclick = function () { joinLive(live[0]); });
  }
  function joinLive(c) { var s = sess(); window.open(liveUrl(c.liveRoom, s && s.name), "_blank", "noopener"); }
  var TABS = [["overview", "Overview"], ["class", "Live Classes"], ["recording", "Recorded"], ["note", "Notes"], ["material", "Study Material"], ["ppt", "PPT"], ["tests", "Tests"], ["announcement", "Announcements"]];
  function sBatch(id) {
    var b = S.batches.filter(function (x) { return x.id === id; })[0], o = $("#bm-student"); if (!b) return sHome(); S.cur = id;
    var its = S.items[id] || [], l = liveOf(b), n = nextOf(b);
    var body = "", tab = S.tab;
    if (tab === "overview") body = '<div class="bm-bhero"><b>' + esc(b.name) + '</b><p>' + esc(b.desc || subjOf(b).join(" • ")) + '</p></div>' + (l ? '<div class="bm-next"><div>🔴 Live: ' + esc(l.title) + '</div><button data-j>Join Now</button></div>' : n ? '<div class="bm-next"><div>Next Live Class<br><b>' + fdate(n.scheduledAt) + '</b></div></div>' : "") +
      '<div class="bm-qa">' + [["class", "🔴", "Live"], ["recording", "🎬", "Recorded"], ["note", "📄", "Notes"], ["ppt", "📊", "PPT"]].map(function (q) { return '<button data-t="' + q[0] + '"><span>' + q[1] + '</span>' + q[2] + ' (' + its.filter(function (i) { return i.kind === q[0]; }).length + ')</button>'; }).join("") + '</div>' +
      (b.teachers && b.teachers.length ? '<div class="bm-list" style="margin-top:12px"><b style="font-size:.9rem">Batch Teachers</b><div style="margin-top:6px">' + b.teachers.map(function (t) { return '<span class="bm-badge b" style="margin:0 6px 6px 0;font-size:.78rem">👨‍🏫 ' + esc(t) + '</span>'; }).join("") + '</div></div>' : "");
    else if (tab === "tests") body = '<div class="bm-list"><div class="bm-item"><div class="ic">📝</div><div class="g"><b>Tests</b><small>Aapke tests SnapTest Pro ke Tests section me hain</small></div><button class="go" data-tests>Open</button></div></div>';
    else {
      var list = its.filter(function (i) { return tab === "note" ? i.kind === "note" : i.kind === tab; }).sort(function (a, c) { return (ms(c.scheduledAt) || ms(c.createdAt)) - (ms(a.scheduledAt) || ms(a.createdAt)); });
      body = '<div class="bm-list">' + (list.length ? list.map(function (i) { var ic = { class: "🔴", recording: "🎬", note: "📄", material: "📚", ppt: "📊", announcement: "📢" }[i.kind];
        return '<div class="bm-item"><div class="ic">' + ic + '</div><div class="g"><b>' + esc(i.title) + '</b><small>' + esc([i.subject, i.chapter].filter(Boolean).join(" • ") || (i.cat || "")) + (i.kind === "class" ? " • " + fdate(i.scheduledAt) : "") + '</small>' + (i.kind === "announcement" ? '<small style="display:block;margin-top:4px;color:#334155">' + esc(i.desc) + '</small>' : "") + '</div>' +
          (i.kind === "class" ? (i.status === "live" && i.liveRoom ? '<button class="go" style="background:#ef4444" data-live="' + i.id + '">Join</button>' : '<span class="bm-badge ' + (i.status === "completed" ? "" : "b") + '">' + (i.status === "completed" ? "Done" : i.status === "cancelled" ? "Cancelled" : "Upcoming") + '</span>') : i.url ? '<button class="go" data-v="' + i.id + '">' + (i.kind === "recording" ? "▶ Play" : "View") + '</button>' : "") + '</div>'; }).join("") : '<div class="bm-empty">Yahan abhi kuch publish nahi hua.</div>') + '</div>';
    }
    o.innerHTML = '<div class="bm-sh"><button data-back>←</button><b>' + esc(b.name) + '</b></div><div class="bm-tabs">' + TABS.map(function (t) { return '<button data-tab="' + t[0] + '"' + (t[0] === tab ? ' class="on"' : "") + '>' + t[1] + '</button>'; }).join("") + '</div>' + body;
    o.querySelector("[data-back]").onclick = sHome;
    o.querySelectorAll("[data-tab]").forEach(function (t) { t.onclick = function () { S.tab = t.dataset.tab; sBatch(id); }; });
    o.querySelectorAll("[data-t]").forEach(function (t) { t.onclick = function () { S.tab = t.dataset.t; sBatch(id); }; });
    var j = o.querySelector("[data-j]"); j && (j.onclick = function () { joinLive(l); });
    o.querySelectorAll("[data-live]").forEach(function (x) { x.onclick = function () { joinLive(its.filter(function (i) { return i.id === x.dataset.live; })[0]); }; });
    o.querySelectorAll("[data-v]").forEach(function (x) { x.onclick = function () { var i = its.filter(function (k) { return k.id === x.dataset.v; })[0]; viewer(i.title, i.url); }; });
    var tb = o.querySelector("[data-tests]"); tb && (tb.onclick = function () { closeStudent(); typeof goStudentSection === "function" && goStudentSection("student-form-fields-anchor"); });
  }

  /* =================== hooks into existing app =================== */
  function hook() {
    var nav = $("#sn-nav");
    if (nav && !nav.querySelector('[data-k="batch"]')) {
      var b = document.createElement("button"); b.type = "button"; b.dataset.k = "batch";
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>Batch';
      nav.insertBefore(b, nav.children[1] || null);
      b.addEventListener("click", function (e) { e.stopPropagation(); openStudent(); });
      nav.addEventListener("click", function (e) { var t = e.target.closest("button"); if (t && t.dataset.k !== "batch") closeStudent(); }, true);
    }
    var sg = $("#student-dashboard-home .cd-grid");
    if (sg && !sg.querySelector("[data-bm]")) { var c = document.createElement("button"); c.type = "button"; c.className = "cd-card cd-purple"; c.dataset.bm = "1"; c.innerHTML = '<div class="cd-card-top"><div class="cd-icon-circle">🎓</div><span class="cd-badge">New</span></div><div class="cd-card-title">My Batches</div><div class="cd-card-sub">Live, recordings, notes</div><div class="cd-card-bottom"><span class="cd-arrow-btn">→</span></div>'; c.onclick = function (e) { e.preventDefault(); openStudent(); }; sg.appendChild(c); }
    var ag = $("#admin-dashboard-home .cd-grid");
    if (ag && !ag.querySelector("[data-bm]")) { var d = document.createElement("button"); d.type = "button"; d.className = "cd-card cd-indigo"; d.dataset.bm = "1"; d.innerHTML = '<div class="cd-card-top"><div class="cd-icon-circle">🎓</div><span class="cd-badge">New</span></div><div class="cd-card-title">Batch Management</div><div class="cd-card-sub">Batches, live classes, recordings, notes</div><div class="cd-card-bottom"><span class="cd-arrow-btn">→</span></div>'; d.onclick = openAdmin; ag.appendChild(d); }
  }
  setInterval(hook, 1500);
  window.SnapBatch = { openAdmin: openAdmin, openStudent: openStudent };
})();
