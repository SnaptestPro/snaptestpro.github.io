/* v231 — Exam Registration (SnapReg): test banne se PEHLE students register + roll shuffle + admit card publish.
   Flow:  📝 Registration banao -> students jodo (roll abhi NAHI bante) -> jab chaho "Publish":
          sabke Roll No RANDOM shuffle hokar bante hain (institute-wise cluster nahi) + Admit Card student app me + PDF.
          Baad me Exam banao -> "Registration se jodein" -> wahi roll/students exam roster me aa jaate hain (exam-roster.js linkRegistration).
   Admit card par SET nahi chhapta (set sirf scan-verification ke liye roll se nikalta hai).
   Data:  examRegistrations/{id}               = { name,date,time,reportTime,venue,notes,rollDigits,published,count,instituteId,instituteName }
          examRegistrations/{id}/roster/main   = { list:[{name,mobile,classId,cls,group,roll?}], retired:[roll,...] }
          studentAdmitCards/{regId}_{mobile}   = student ko dikhne wala card (publish par bantा hai)
   Kill-switch: SNAP_CONFIG.registration=false (ya roster=false) -> panel nahi khulta. */
(function (root) {
  "use strict";
  var REGS = "examRegistrations", CARDS = "studentAdmitCards", MAX = 3000;

  /* ======================= PURE LOGIC (tests me bhi chalta hai) ======================= */
  function pad(n, d) { return String(n).padStart(d, "0"); }
  function cleanMobile(m) { return String(m || "").replace(/\D/g, "").slice(-10); }
  function digitsOf(v) { return Math.max(1, Math.min(5, Number(v) || 3)); }
  /* crypto se random (predictable nahi); tests me rng inject hota hai */
  function makeRng() {
    var c = typeof globalThis !== "undefined" && globalThis.crypto;
    if (c && c.getRandomValues) return function () { var a = new Uint32Array(1); c.getRandomValues(a); return a[0] / 4294967296; };
    return Math.random;
  }
  function byName(a, b) { return String(a.name || "").localeCompare(String(b.name || ""), "en", { sensitivity: "base" }); }
  function byRoll(a, b) { return (parseInt(a.roll, 10) || 0) - (parseInt(b.roll, 10) || 0); }

  /* students ko draft me jodo (roll NAHI milta). people:[{name,mobile,classId,cls,group}] -> {list,added,skipped,error} */
  function addDraft(existing, people) {
    var list = (existing || []).slice(), have = {}, skipped = 0, fresh = [];
    list.forEach(function (e) { have[e.mobile] = 1; });
    (people || []).forEach(function (p) {
      var m = cleanMobile(p.mobile);
      if (m.length !== 10 || have[m]) { skipped++; return; }
      have[m] = 1;
      fresh.push({ name: String(p.name || "").trim().slice(0, 60) || "Student", mobile: m, classId: p.classId || null, cls: String(p.cls || "").slice(0, 40), group: String(p.group || "").trim().slice(0, 40) });
    });
    if (list.length + fresh.length > MAX) return { list: list, added: 0, skipped: skipped, error: { code: "TOO_MANY", max: MAX } };
    fresh.sort(byName);
    return { list: list.concat(fresh), added: fresh.length, skipped: skipped, error: null };
  }

  /* Jinke paas roll nahi hai unhe roll do.
     - PEHLI baar (kisi ke paas roll nahi): 1..N ka poora shuffle (permutation) — sab institute mix, koi pattern nahi.
       Roll 1..N compact rehte hain, isliye roll-order me baithne par sets (A,B,C...) baari-baari aate hain.
     - BAAD me (publish ke baad naya student): bache hue numbers me se RANDOM; hataye gaye (retired) roll dobara nahi milte.
     opts:{rollDigits, rng, retired:[...]}  -> {list,assigned,error}; list roll se sorted jab sabko roll mil jaye */
  function assignRolls(list, opts) {
    opts = opts || {};
    var rng = opts.rng || makeRng(), digits = digitsOf(opts.rollDigits), cap = Math.pow(10, digits) - 1;
    var used = {}, retired = {}, need = [], out = (list || []).map(function (e) { var c = {}; for (var k in e) c[k] = e[k]; return c; });
    (opts.retired || []).forEach(function (r) { retired[parseInt(r, 10)] = 1; });
    var haveAny = false;
    out.forEach(function (e, i) { if (e.roll) { used[parseInt(e.roll, 10)] = 1; haveAny = true; } else need.push(i); });
    if (!need.length) return { list: out.sort(byRoll), assigned: 0, error: null };
    var pool = [], n, first = !haveAny;
    if (first) { if (need.length > cap) return { list: list, assigned: 0, error: { code: "DIGITS_FULL", need: String(need.length).length } }; for (n = 1; n <= need.length; n++) pool.push(n); }
    else { for (n = 1; n <= cap; n++) if (!used[n] && !retired[n]) pool.push(n); if (pool.length < need.length) return { list: list, assigned: 0, error: { code: "DIGITS_FULL", need: digits + 1 } }; }
    for (var i = 0; i < need.length; i++) {
      var j = i + Math.floor(rng() * (pool.length - i)), t = pool[i]; pool[i] = pool[j]; pool[j] = t;
      out[need[i]].roll = pad(pool[i], digits);
    }
    return { list: out.sort(byRoll), assigned: need.length, error: null };
  }
  function groupsOf(list) {
    var seen = {}, out = [];
    (list || []).forEach(function (e) { var g = e.group || ""; if (g && !seen[g]) { seen[g] = 1; out.push(g); } });
    return out.sort();
  }
  /* textarea se: "9876543210" / "Rahul Kumar, 9876543210" / "9876543210, 9876543211".
     find(mobile) -> registered student ya null. -> {people:[{name,mobile,classId,cls}], unknown:[mobile]} */
  function parseLines(text, find) {
    var people = [], unknown = [];
    String(text || "").split(/\r?\n/).forEach(function (line) {
      line = line.trim(); if (!line) return;
      var mobiles = [], names = [];
      if (/[A-Za-z\u0900-\u097F]/.test(line)) {
        line.split(/[,;\t|]+/).forEach(function (tk) {
          var dg = tk.replace(/\D/g, ""); if (dg.length >= 10) mobiles.push(dg.slice(-10));
          var nm = tk.replace(/[\d+()\-]/g, " ").replace(/\s+/g, " ").trim(); if (nm) names.push(nm);
        });
      } else line.split(/[\s,;]+/).forEach(function (tk) { var dg = tk.replace(/\D/g, ""); if (dg.length >= 10) mobiles.push(dg.slice(-10)); });
      mobiles.forEach(function (m) {
        var s = find ? find(m) : null, given = mobiles.length === 1 ? names.join(" ") : "";
        if (s) people.push({ name: given || s.name, mobile: m, classId: s.classId || null, cls: s.cls || "" });
        else if (given) people.push({ name: given, mobile: m, classId: null, cls: "" });
        else unknown.push(m);
      });
    });
    return { people: people, unknown: unknown };
  }
  function csvCell(v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }
  var pure = { pad: pad, cleanMobile: cleanMobile, addDraft: addDraft, assignRolls: assignRolls, groupsOf: groupsOf, parseLines: parseLines, makeRng: makeRng, csvCell: csvCell, MAX: MAX };
  if (typeof module !== "undefined" && module.exports) module.exports = { pure: pure };
  if (typeof document === "undefined") return;

  /* ======================= BROWSER PART ======================= */
  var S = { regs: [], reg: null, R: null, sel: {}, q: "", tq: "", cls: "", pdfGroup: "" }, OV = null;
  function on() { return !(root.SNAP_CONFIG && (root.SNAP_CONFIG.registration === false || root.SNAP_CONFIG.roster === false)); }
  function DB() { return typeof root.getDB === "function" ? root.getDB() : null; }
  function FV() { return root.firebase.firestore.FieldValue; }
  function students() { try { return typeof allStudentsCache !== "undefined" && Array.isArray(allStudentsCache) ? allStudentsCache : []; } catch (e) { return []; } }
  function iidNow() { try { return typeof getCurrentAdminInstituteId === "function" ? getCurrentAdminInstituteId() : null; } catch (e) { return null; } }
  function classLabel(id) { var o = (root.SAVYA_CLASS_OPTIONS || []).filter(function (x) { return x.id === id; })[0]; return o ? o.label : ""; }
  function photoOf(m) { var s = students().filter(function (x) { return x.mobile === m; })[0]; return s && s.photoDataUrl ? s.photoDataUrl : null; }
  function h(t, a, c) {
    var e = document.createElement(t);
    if (a) for (var k in a) { if (k === "class") e.className = a[k]; else if (k === "text") e.textContent = a[k]; else if (k.slice(0, 2) === "on") e[k] = a[k]; else e.setAttribute(k, a[k]); }
    (c || []).forEach(function (x) { if (x != null) e.appendChild(typeof x === "string" ? document.createTextNode(x) : x); });
    return e;
  }
  function $(id) { return document.getElementById(id); }
  function note(msg) { var n = $("reg-notice"); if (!n) return; n.textContent = msg || ""; n.hidden = !msg; }
  function prettyDate(d) { return root.SnapAdmit && root.SnapAdmit.prettyDate ? root.SnapAdmit.prettyDate(d) : String(d || ""); }
  function safeName(s) { return String(s || "registration").replace(/[^\w-]+/g, "-").slice(0, 50); }

  /* ---------- Firestore ---------- */
  function loadRegs() {
    var d = DB(); if (!d) return Promise.resolve([]);
    var iid = iidNow(), q = iid ? d.collection(REGS).where("instituteId", "==", iid) : d.collection(REGS);
    return q.get().then(function (snap) {
      S.regs = snap.docs.map(function (x) { var v = x.data(); v.id = x.id; return v; }).sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); });
      return S.regs;
    }).catch(function (e) { note("❌ Registrations load nahi hue: " + (e.code || e.message || e)); return []; });
  }
  function loadReg(id) {
    var d = DB(), ref = d.collection(REGS).doc(id);
    return Promise.all([ref.get(), ref.collection("roster").doc("main").get()]).then(function (r) {
      if (!r[0].exists) throw new Error("Registration nahi mili.");
      S.reg = r[0].data(); S.reg.id = id;
      var v = r[1].exists ? r[1].data() : {}; S.R = { list: v.list || [], retired: v.retired || [] };
    });
  }
  function saveRoster() {
    var d = DB(), reg = S.reg; if (!d) { alert("Firebase se connect nahi ho paya — internet check karein."); return Promise.resolve(false); }
    var ref = d.collection(REGS).doc(reg.id);
    return ref.collection("roster").doc("main").set({ list: S.R.list, retired: S.R.retired, updatedAt: FV().serverTimestamp() })
      .then(function () { reg.count = S.R.list.length; return ref.update({ count: reg.count, updatedAt: FV().serverTimestamp() }); })
      .then(function () { return true; }).catch(function (e) { alert("Save nahi ho paya: " + (e.message || e)); return false; });
  }
  function patchReg(p) {
    var d = DB(); if (!d) return Promise.resolve(false);
    var o = {}; for (var k in p) o[k] = p[k]; o.updatedAt = FV().serverTimestamp();
    return d.collection(REGS).doc(S.reg.id).update(o).then(function () { for (var k in p) S.reg[k] = p[k]; return true; }).catch(function (e) { alert("Save nahi ho paya: " + (e.message || e)); return false; });
  }
  function instName(reg) {
    if (reg.instituteName) return Promise.resolve(reg.instituteName);
    var n = ""; try { n = typeof getCachedAdminInstituteName === "function" ? getCachedAdminInstituteName() : ""; } catch (e) {}
    if (n) return Promise.resolve(n);
    var d = DB(), iid = reg.instituteId || iidNow(); if (!d || !iid) return Promise.resolve("");
    return d.collection("institutes").doc(iid).get().then(function (s) { return s.exists && s.data().name || ""; }).catch(function () { return ""; });
  }
  function cardFor(reg, en, inst) {
    return { examId: reg.id, registrationId: reg.id, instituteName: inst || reg.instituteName || "", examName: reg.name || "", className: en.cls || "", date: reg.date || "", time: reg.time || "", reportTime: reg.reportTime || "", venue: reg.venue || "", notes: reg.notes || "", name: en.name, roll: en.roll, mobile: en.mobile };
  }
  /* cards likho (400/batch). Batch fail ho (jaise dusre institute ka student) to ek-ek karke; fail ginti return */
  function writeCards(reg, list, inst) {
    var d = DB(), iid = reg.instituteId || iidNow(), failed = 0, chain = Promise.resolve();
    function docOf(en) { var c = cardFor(reg, en, inst); c.instituteId = iid || null; c.issuedAt = FV().serverTimestamp(); return [d.collection(CARDS).doc(reg.id + "_" + en.mobile), c]; }
    for (var i = 0; i < list.length; i += 400) (function (part) {
      chain = chain.then(function () {
        var b = d.batch(); part.forEach(function (en) { var x = docOf(en); b.set(x[0], x[1]); });
        return b.commit().catch(function () {
          var k = Promise.resolve();
          part.forEach(function (en) { k = k.then(function () { var x = docOf(en); return x[0].set(x[1]).catch(function () { failed++; }); }); });
          return k;
        });
      });
    })(list.slice(i, i + 400));
    return chain.then(function () { return failed; });
  }

  /* ---------- actions ---------- */
  function createReg() {
    var name = ($("reg-new-name").value || "").trim(), date = $("reg-new-date").value || "", d = DB();
    if (!name) { note("⚠️ Registration ka naam likhein."); return; }
    if (!d) { alert("Firebase se connect nahi ho paya — internet check karein."); return; }
    var iid = iidNow(), ref = d.collection(REGS).doc(), cn = ""; try { cn = typeof getCachedAdminInstituteName === "function" ? getCachedAdminInstituteName() : ""; } catch (e) {}
    var doc = { name: name, date: date, time: "", reportTime: "", venue: "", notes: "", rollDigits: digitsOf($("reg-new-digits").value), published: false, count: 0, instituteName: cn || "", createdAt: FV().serverTimestamp(), updatedAt: FV().serverTimestamp() };
    if (iid) doc.instituteId = iid;
    note("⏳ Ban rahi hai...");
    ref.set(doc).then(function () { $("reg-new-name").value = ""; return openReg(ref.id); }).catch(function (e) { note("❌ Registration nahi bani: " + (e.code || e.message || e)); });
  }
  function openReg(id) {
    note("⏳ Load ho raha hai...");
    return loadReg(id).then(function () { S.sel = {}; S.q = ""; S.tq = ""; S.pdfGroup = ""; showView("cur"); note(""); renderCur(); }).catch(function (e) { note("❌ " + (e.message || e)); });
  }
  function deleteReg(r) {
    if (!confirm("\"" + (r.name || "Registration") + "\" delete karein?" + (r.published ? "\nStudents ke published Admit Card bhi hat jayenge. (Is se jude exams ka roster waisa hi rahega.)" : ""))) return;
    var d = DB(); if (!d) return;
    note("⏳ Delete ho raha hai...");
    d.collection(REGS).doc(r.id).collection("roster").doc("main").get().then(function (s) {
      var list = s.exists ? (s.data().list || []) : [], chain = Promise.resolve();
      if (r.published) for (var i = 0; i < list.length; i += 400) (function (part) { chain = chain.then(function () { var b = d.batch(); part.forEach(function (en) { b.delete(d.collection(CARDS).doc(r.id + "_" + en.mobile)); }); return b.commit().catch(function () {}); }); })(list.slice(i, i + 400));
      return chain;
    }).then(function () { return d.collection(REGS).doc(r.id).collection("roster").doc("main").delete().catch(function () {}); })
      .then(function () { return d.collection(REGS).doc(r.id).delete(); })
      .then(function () { note("🗑️ Registration delete ho gayi."); return refreshList(); }).catch(function (e) { note("❌ Delete nahi hua: " + (e.code || e.message || e)); });
  }
  function addPeople(people) {
    var reg = S.reg, R = S.R, before = {}; R.list.forEach(function (e) { before[e.mobile] = 1; });
    var res = addDraft(R.list, people);
    if (res.error) { note("⚠️ Ek registration me max " + res.error.max + " students."); return; }
    var list = res.list;
    if (reg.published) {
      var a = assignRolls(list, { rollDigits: reg.rollDigits, retired: R.retired });
      if (a.error) { note("⚠️ Roll digits kam hain — itne students ke liye digits badhane padenge."); return; }
      list = a.list;
    }
    R.list = list;
    saveRoster().then(function (ok) {
      if (!ok) return; S.sel = {};
      var fresh = R.list.filter(function (e) { return !before[e.mobile]; });
      var msg = "✅ " + res.added + " student jude" + (res.skipped ? " (" + res.skipped + " pehle se the / galat mobile)" : "") + ".";
      if (reg.published && fresh.length) {
        return instName(reg).then(function (inst) { return writeCards(reg, fresh, inst); }).then(function (failed) {
          note(msg + " Naye students ko bache hue numbers me se random roll mil gaya aur card bhej diya" + (failed ? " (" + failed + " ke card app me nahi pahunch paye — PDF/WhatsApp se dein)" : "") + ".");
        }).then(renderCur);
      }
      note(msg + " Roll No Publish karte waqt shuffle hokar milenge."); renderCur();
    });
  }
  function removeEntry(en) {
    var reg = S.reg, R = S.R;
    if (!confirm((en.roll ? "Roll " + en.roll + " — " : "") + en.name + " ko hata dein?" + (reg.published ? "\nIska admit card bhi delete hoga aur ye roll dobara kisi ko nahi milega." : ""))) return;
    R.list = R.list.filter(function (x) { return x.mobile !== en.mobile; });
    if (reg.published && en.roll) { R.retired = R.retired.concat([en.roll]); var d = DB(); if (d) d.collection(CARDS).doc(reg.id + "_" + en.mobile).delete().catch(function () {}); }
    saveRoster().then(function (ok) { if (ok) { renderCur(); note("🗑️ " + en.name + " hata diya." + (reg.published ? " Is registration se jude exam me 'Sync' dabayein." : "")); } });
  }
  function readDetails() { var g = function (k) { return ($("reg-f-" + k).value || "").trim(); }; return { date: $("reg-f-date").value || "", time: g("time"), reportTime: g("reportTime"), venue: g("venue"), notes: g("notes") }; }
  function saveDetails() {
    var reg = S.reg, p = readDetails(); if (!reg.published) p.rollDigits = digitsOf($("reg-f-digits").value);
    patchReg(p).then(function (ok) { if (ok) { note("✅ Details save ho gaye." + (reg.published ? " Students ko naya card dikhane ke liye \"Update\" (Publish) dabayein." : "")); renderCur(); } });
  }
  function publish() {
    var reg = S.reg, R = S.R, d = DB();
    if (!R.list.length) { note("⚠️ Pehle students jodein."); return; }
    if (!d) { alert("Firebase se connect nahi ho paya."); return; }
    var p = readDetails(); if (!reg.published) p.rollDigits = digitsOf($("reg-f-digits").value);
    var pending = R.list.filter(function (e) { return !e.roll; }).length, first = !reg.published;
    var msg = first ? R.list.length + " students ko RANDOM roll number mil jayenge (sab institute/class mix) aur Admit Card unke app me aa jayega.\n\nPublish ke baad roll kabhi nahi badlenge. Aage badhein?" : (pending ? pending + " bina-roll wale students ko roll dekar " : "") + R.list.length + " students ke Admit Card update karein?";
    if (!confirm(msg)) return;
    var a = assignRolls(R.list, { rollDigits: p.rollDigits || reg.rollDigits, retired: R.retired });
    if (a.error) { note("⚠️ Roll digits kam hain — " + a.error.need + " ya zyada digits chunein."); return; }
    note("⏳ Roll shuffle + Admit cards ban rahe hain...");
    var prevList = R.list; R.list = a.list;
    patchReg(p).then(function (ok) { if (!ok) throw new Error("details save nahi hue"); return saveRoster(); })
      .then(function (ok) { if (!ok) throw new Error("roster save nahi hua"); return instName(reg); })
      .then(function (inst) { return writeCards(reg, R.list, inst).then(function (failed) { return patchReg({ published: true, publishedAt: Date.now(), instituteName: inst || reg.instituteName || "" }).then(function () { return failed; }); }); })
      .then(function (failed) {
        note("🚀 " + R.list.length + " students ke Roll No shuffle hokar publish ho gaye." + (failed ? " ⚠️ " + failed + " students ke card app me nahi pahunch paye (dusre institute ke / account nahi) — unhe PDF ya WhatsApp se dein." : " Student app → Admit Card me dikhega.") + " Ab \"📄 PDF\" se print/WhatsApp kar sakte hain.");
        renderCur();
      }).catch(function (e) { R.list = prevList; note("❌ Publish nahi hua: " + (e.code || e.message || e)); renderCur(); });
  }
  function pdfList() { var g = S.pdfGroup; return S.R.list.filter(function (e) { return e.roll && (!g || e.group === g); }).sort(byRoll); }
  function printPdf() {
    var reg = S.reg, list = pdfList();
    if (!reg.published || !list.length) { note("⚠️ Pehle Publish karein (roll no tabhi bante hain)."); return; }
    var PER = 60, total = list.length, parts = Math.ceil(total / PER), tag = S.pdfGroup ? "-" + safeName(S.pdfGroup) : "";
    note("⏳ PDF ban rahi hai (jsPDF load ho raha hai)...");
    Promise.resolve(root.__ensureLib ? root.__ensureLib("jspdf") : null).catch(function () {}).then(function () { return instName(reg); }).then(function (inst) {
      if (!root.jspdf || !root.jspdf.jsPDF) throw new Error("PDF library load nahi hui — internet check karein.");
      var chain = Promise.resolve();
      for (var p = 0; p < parts; p++) (function (pi) {
        chain = chain.then(function () {
          var slice = list.slice(pi * PER, pi * PER + PER), pdf = new root.jspdf.jsPDF({ unit: "mm", format: "a4", orientation: "portrait" }), k = Promise.resolve();
          slice.forEach(function (en, i) {
            k = k.then(function () {
              return root.SnapAdmit.render(cardFor(reg, en, inst), photoOf(en.mobile), 0.8).then(function (cv) {
                if (i > 0 && i % 2 === 0) pdf.addPage();
                pdf.addImage(cv.toDataURL("image/jpeg", 0.8), "JPEG", 0, (i % 2) * 148.5, 210, 148.5);
                if (i % 10 === 0) note("⏳ PDF " + (pi + 1) + "/" + parts + " — " + (pi * PER + i + 1) + "/" + total + " cards...");
                return new Promise(function (r) { setTimeout(r, 0); });
              });
            });
          });
          return k.then(function () { pdf.save(safeName(reg.name) + tag + "-admit-cards" + (parts > 1 ? "-part" + (pi + 1) : "") + ".pdf"); });
        });
      })(p);
      return chain;
    }).then(function () { note("✅ " + total + " admit cards ki PDF download ho gayi (A4 par 2 card, roll ke order me)."); }).catch(function (e) { note("❌ PDF nahi bani: " + (e.message || e)); });
  }
  function csvDownload() {
    var reg = S.reg, rows = [["Roll No", "Name", "Mobile", "Class", "Group"]];
    S.R.list.slice().sort(function (a, b) { return a.roll ? (b.roll ? byRoll(a, b) : -1) : (b.roll ? 1 : byName(a, b)); }).forEach(function (e) { rows.push([e.roll || "", e.name, e.mobile, e.cls || "", e.group || ""]); });
    var blob = new Blob(["\ufeff" + rows.map(function (r) { return r.map(csvCell).join(","); }).join("\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = safeName(reg.name) + "-roll-list.csv"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function waLink(en) {
    var reg = S.reg, t = "Namaste " + en.name + ", " + (reg.name || "exam") + (reg.date ? " (" + prettyDate(reg.date) + ")" : "") + " ka Admit Card ready hai. Roll No: " + en.roll + ". SnapTest app me \"Admit Card\" se dekhein/download karein.";
    return "https://wa.me/91" + en.mobile + "?text=" + encodeURIComponent(t);
  }

  /* ---------- render ---------- */
  function stat(label, val, cls) { return h("div", { class: "ros-stat " + (cls || "") }, [h("strong", { text: String(val) }), h("span", { text: label })]); }
  function refreshList() { return loadRegs().then(renderList); }
  function renderList() {
    var box = $("reg-list"); if (!box) return; box.textContent = "";
    if (!S.regs.length) { box.appendChild(h("div", { class: "examgr-empty", text: "Abhi koi Registration nahi hai. Upar naam likhkar banayein — phir students jodein." })); return; }
    S.regs.forEach(function (r) {
      box.appendChild(h("div", { class: "examgr-report-row ros-row reg-row" }, [
        h("div", { class: "ros-rn reg-main", role: "button", tabindex: "0", onclick: function () { openReg(r.id); } }, [
          h("strong", { text: r.name || "Registration" }),
          h("small", { text: (r.date ? prettyDate(r.date) + " • " : "") + (Number(r.count) || 0) + " students • " + digitsOf(r.rollDigits) + " digit roll" })]),
        h("span", { class: "ros-pill " + (r.published ? "ok" : ""), text: r.published ? "✅ Published" : "Draft" }),
        h("button", { type: "button", class: "ros-ic", title: "Delete", onclick: function () { deleteReg(r); } }, ["🗑️"])
      ]));
    });
  }
  function renderPicker() {
    var box = $("reg-picker"); if (!box || !S.R) return; box.textContent = "";
    var all = students(), q = S.q.trim().toLowerCase(), have = {}; S.R.list.forEach(function (e) { have[e.mobile] = 1; });
    var list = all.filter(function (s) {
      if (S.cls && s.classId !== S.cls) return false;
      return !q || String(s.name || "").toLowerCase().indexOf(q) >= 0 || String(s.mobile || "").indexOf(q) >= 0;
    });
    box.appendChild(h("div", { class: "muted-text", text: list.length + " students" + (all.length ? "" : " — pehle Records → Directory se load karein") }));
    list.slice(0, 150).forEach(function (s) {
      var inR = !!have[s.mobile], cb = h("input", { type: "checkbox" }); cb.checked = !!S.sel[s.mobile] || inR; cb.disabled = inR;
      cb.onchange = function () { if (cb.checked) S.sel[s.mobile] = s; else delete S.sel[s.mobile]; renderPickCount(); };
      box.appendChild(h("label", { class: "ros-pick" + (inR ? " in" : "") }, [cb, h("span", { text: (s.name || "Student") + " — " + s.mobile + (classLabel(s.classId) ? " • " + classLabel(s.classId) : "") + (inR ? " ✓" : "") })]));
    });
    if (list.length > 150) box.appendChild(h("div", { class: "muted-text", text: "Pehle 150 dikh rahe hain — search ya class se narrow karein." }));
    renderPickCount();
  }
  function renderPickCount() { var b = $("reg-add-btn"); if (b) b.textContent = "➕ " + Object.keys(S.sel).length + " chune hue add karein"; }
  function renderTable() {
    var box = $("reg-table"); if (!box || !S.R) return; box.textContent = "";
    var reg = S.reg, q = S.tq.trim().toLowerCase(), list = S.R.list.slice().sort(function (a, b) { return a.roll && b.roll ? byRoll(a, b) : byName(a, b); });
    if (!list.length) { box.appendChild(h("div", { class: "examgr-empty", text: "Abhi koi student register nahi hua. Upar se jodein." })); return; }
    var rows = list.filter(function (e) { return !q || e.name.toLowerCase().indexOf(q) >= 0 || String(e.roll || "").indexOf(q) >= 0 || e.mobile.indexOf(q) >= 0 || String(e.group || "").toLowerCase().indexOf(q) >= 0; });
    rows.slice(0, 300).forEach(function (e) {
      box.appendChild(h("div", { class: "examgr-report-row ros-row" }, [
        h("span", { class: "ros-roll", text: e.roll || "—" }),
        h("div", { class: "ros-rn" }, [h("strong", { text: e.name }), h("small", { text: e.mobile + (e.group ? " • " + e.group : "") })]),
        reg.published && e.roll ? h("button", { type: "button", class: "ros-ic", title: "Admit card dekhein", onclick: function () { instName(reg).then(function (n) { root.SnapAdmit.preview(cardFor(reg, e, n), photoOf(e.mobile)); }); } }, ["🎫"]) : null,
        reg.published && e.roll ? h("a", { class: "ros-ic", title: "WhatsApp", href: waLink(e), target: "_blank", rel: "noopener" }, ["💬"]) : null,
        h("button", { type: "button", class: "ros-ic", title: "Hatayein", onclick: function () { removeEntry(e); } }, ["🗑️"])
      ]));
    });
    if (rows.length > 300) box.appendChild(h("div", { class: "muted-text", text: "Pehle 300 dikh rahe hain — search use karein." }));
  }
  function renderCur() {
    var reg = S.reg, R = S.R; if (!reg || !R) return;
    $("reg-sub").textContent = (reg.name || "Registration") + (reg.date ? " • " + prettyDate(reg.date) : "") + " • " + (reg.published ? "✅ Published" : "Draft (roll abhi nahi bane)");
    var box = $("reg-stats"); box.textContent = "";
    var pend = R.list.filter(function (e) { return !e.roll; }).length, gs = groupsOf(R.list);
    box.appendChild(stat("Registered", R.list.length)); box.appendChild(stat("Roll mila", R.list.length - pend, reg.published ? "ok" : "")); box.appendChild(stat("Groups", gs.length)); box.appendChild(stat("Roll digits", digitsOf(reg.rollDigits)));
    ["time", "reportTime", "venue", "notes"].forEach(function (k) { var el = $("reg-f-" + k); if (el && document.activeElement !== el) el.value = reg[k] || ""; });
    var de = $("reg-f-date"); if (de && document.activeElement !== de) de.value = reg.date || "";
    var dg = $("reg-f-digits"); if (dg) { dg.value = String(digitsOf(reg.rollDigits)); dg.disabled = !!reg.published; }
    var pb = $("reg-publish-btn"); if (pb) pb.textContent = reg.published ? "🔄 Update (naye cards bhejein)" : "🎲 Roll shuffle karke Publish";
    var pg = $("reg-pdf-group"); if (pg) { pg.textContent = ""; pg.appendChild(h("option", { value: "", text: "Sab students" })); gs.forEach(function (g) { pg.appendChild(h("option", { value: g, text: "Group: " + g })); }); pg.value = S.pdfGroup; }
    var ph = $("reg-pub-hint"); if (ph) ph.textContent = reg.published ? "Roll lock ho chuke hain. Naya student jodoge to use bache hue numbers me se random roll milega." : "Abhi roll nahi bane. Test se 1–2 din pehle jab chahein tab Publish dabayein.";
    var cb = $("reg-pdf-btn"); if (cb) cb.disabled = !reg.published;
    renderPicker(); renderTable();
  }
  function showView(v) { $("reg-view-list").style.display = v === "list" ? "" : "none"; $("reg-view-cur").style.display = v === "cur" ? "" : "none"; }

  /* ---------- build ---------- */
  function build() {
    if (OV) return;
    function sec(title, kids, open) { var d = h("details", open ? { open: "" } : {}, [h("summary", { text: title })].concat(kids)); d.className = "ros-sec"; return d; }
    function field(id, label, tag, ph, type) { var i = h(tag || "input", { id: "reg-f-" + id, placeholder: ph || "" }); if (type) i.type = type; if (tag === "textarea") i.rows = 3; return h("label", { class: "ros-field" }, [h("span", { text: label }), i]); }
    var clsSel = h("select", { id: "reg-cls", onchange: function () { S.cls = this.value; renderPicker(); } });
    var dig = h("select", { id: "reg-f-digits" }); [1, 2, 3, 4, 5].forEach(function (n) { dig.appendChild(h("option", { value: String(n), text: n + " digit" + (n > 1 ? "s" : "") })); });
    var ndig = h("select", { id: "reg-new-digits" }); [2, 3, 4, 5].forEach(function (n) { ndig.appendChild(h("option", Object.assign({ value: String(n), text: n + " digit roll" }, n === 3 ? { selected: "" } : {}))); });
    var pdfg = h("select", { id: "reg-pdf-group", onchange: function () { S.pdfGroup = this.value; } });
    var listView = h("div", { id: "reg-view-list" }, [
      h("p", { class: "muted-text", text: "Test banane se pehle yahin students register karein. Roll No aur Admit Card tab bante hain jab aap Publish dabate hain — phir Exam banate waqt \"Registration se jodein\" chunein." }),
      h("div", { class: "ros-sec reg-new" }, [
        h("label", { class: "ros-field" }, [h("span", { text: "Naya Registration (test ka naam)" }), h("input", { id: "reg-new-name", placeholder: "jaise: Mock Test Nov 2026" })]),
        h("div", { class: "ros-ctl" }, [h("input", { id: "reg-new-date", type: "date" }), ndig]),
        h("button", { type: "button", class: "btn-primary", text: "➕ Registration banayein", onclick: createReg })
      ]),
      h("div", { id: "reg-list" })
    ]);
    var curView = h("div", { id: "reg-view-cur", style: "display:none" }, [
      h("button", { type: "button", class: "btn-secondary reg-back", text: "← Saari Registrations", onclick: function () { showView("list"); note(""); refreshList(); } }),
      h("div", { class: "test-analysis-meta", id: "reg-sub" }),
      h("div", { class: "ros-stats", id: "reg-stats" }),
      sec("👥 1. Students register karein", [
        h("div", { class: "ros-ctl" }, [clsSel, h("input", { type: "search", placeholder: "Naam / mobile se dhoondhein", oninput: function () { S.q = this.value; renderPicker(); } })]),
        h("label", { class: "ros-field" }, [h("span", { text: "Group / Institute ka naam (optional — jo bhi abhi add karenge un par lagega)" }), h("input", { id: "reg-group", placeholder: "jaise: ABC Coaching ya Batch 1" })]),
        h("div", { id: "reg-picker", class: "ros-picker" }),
        h("div", { class: "ros-btnrow" }, [
          h("button", { type: "button", class: "btn-secondary", text: "Sab chunein", onclick: function () { document.querySelectorAll("#reg-picker input:not(:disabled)").forEach(function (c) { if (!c.checked) c.click(); }); } }),
          h("button", { type: "button", class: "btn-primary", id: "reg-add-btn", text: "➕ Add karein", onclick: function () { addFromPicker(); } })]),
        h("label", { class: "ros-field" }, [h("span", { text: "Ya paste karein — har line me ek: mobile  ya  Naam, mobile (bahar ke / dusre institute ke students ke liye naam zaroori)" }), h("textarea", { id: "reg-paste", rows: "4" })]),
        h("button", { type: "button", class: "btn-secondary", text: "➕ Paste kiye hue add karein", onclick: addFromText })
      ], true),
      sec("📋 Registered students", [h("input", { type: "search", placeholder: "Naam / roll / mobile / group", oninput: function () { S.tq = this.value; renderTable(); } }), h("div", { id: "reg-table" })], true),
      sec("🎫 2. Admit Card details & Publish", [
        field("date", "Exam ki Date", "input", "", "date"), field("time", "Exam Time", "input", "jaise 10:00 AM – 1:00 PM"), field("reportTime", "Reporting Time", "input", "jaise 9:30 AM"), field("venue", "Venue / Center", "input", "Hall / Room / Address"),
        field("notes", "Instructions (khaali = default)", "textarea", ""),
        h("label", { class: "ros-field" }, [h("span", { text: "Roll No kitne digit ka (Publish ke baad badal nahi sakta)" }), dig]),
        h("p", { class: "muted-text", id: "reg-pub-hint" }),
        h("div", { class: "ros-btnrow" }, [
          h("button", { type: "button", class: "btn-secondary", text: "💾 Details save", onclick: saveDetails }),
          h("button", { type: "button", class: "btn-primary", id: "reg-publish-btn", text: "🎲 Publish", onclick: publish })]),
        h("label", { class: "ros-field" }, [h("span", { text: "PDF kiske liye (group-wise bhi nikal sakte hain — har institute ko apna)" }), pdfg]),
        h("div", { class: "ros-btnrow" }, [
          h("button", { type: "button", class: "btn-secondary", id: "reg-pdf-btn", text: "📄 Admit Card PDF", onclick: printPdf }),
          h("button", { type: "button", class: "btn-secondary", text: "⬇️ Roll list CSV", onclick: csvDownload })])
      ])
    ]);
    var sheet = h("div", { class: "test-analysis-sheet ros-sheet" }, [
      h("button", { type: "button", class: "test-analysis-close", text: "✕", "aria-label": "Band karein", onclick: close }),
      h("div", { class: "test-analysis-title", text: "📝 Exam Registration" }),
      h("p", { class: "examgr-notice", id: "reg-notice", hidden: "" }),
      listView, curView
    ]);
    OV = h("div", { id: "reg-overlay", class: "test-analysis-overlay examgr-overlay-full hidden" }, [sheet]);
    OV.addEventListener("click", function (e) { if (e.target === OV) close(); });
    document.body.appendChild(OV);
  }
  function fillClassSel() {
    var sel = $("reg-cls"); if (!sel) return; sel.textContent = "";
    sel.appendChild(h("option", { value: "", text: "Saari classes" }));
    (root.SAVYA_CLASS_OPTIONS || []).forEach(function (o) { sel.appendChild(h("option", { value: o.id, text: o.label })); });
    sel.value = S.cls;
  }
  function addFromPicker() {
    var g = ($("reg-group").value || "").trim(), arr = Object.keys(S.sel).map(function (k) { var s = S.sel[k]; return { name: s.name, mobile: s.mobile, classId: s.classId || null, cls: classLabel(s.classId), group: g || classLabel(s.classId) }; });
    if (!arr.length) { note("⚠️ Pehle students chunein."); return; }
    addPeople(arr);
  }
  function addFromText() {
    var g = ($("reg-group").value || "").trim(), all = students();
    var r = parseLines($("reg-paste").value, function (m) { var s = all.filter(function (x) { return x.mobile === m; })[0]; return s ? { name: s.name, classId: s.classId || null, cls: classLabel(s.classId) } : null; });
    if (!r.people.length) { note(r.unknown.length ? "⚠️ Ye mobile registered students me nahi mile — \"Naam, mobile\" likhkar dein: " + r.unknown.slice(0, 5).join(", ") : "⚠️ Sahi 10-digit mobile number likhein."); return; }
    r.people.forEach(function (p) { p.group = g || p.cls || ""; });
    $("reg-paste").value = "";
    if (r.unknown.length) note("⚠️ Inka naam nahi mila, chhod diye: " + r.unknown.slice(0, 5).join(", ") + (r.unknown.length > 5 ? " …" : ""));
    addPeople(r.people);
  }
  function close() { if (OV) OV.classList.add("hidden"); }
  function open() {
    if (!on()) { alert("Registration feature band hai."); return; }
    build(); fillClassSel(); OV.classList.remove("hidden"); showView("list"); note("");
    if (!$("reg-new-date").value) $("reg-new-date").value = new Date().toISOString().slice(0, 10);
    if (typeof root.ensureAllStudentsCache === "function") Promise.resolve(root.ensureAllStudentsCache()).catch(function () {});
    $("reg-list").textContent = "⏳ Load ho raha hai..."; refreshList();
  }
  root.SnapReg = { pure: pure, open: open };
})(typeof window !== "undefined" ? window : globalThis);
