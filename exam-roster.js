(function () {
  "use strict";

  const ROSTERS = "examRegistrations";
  const STUDENT_CARDS = "studentExamRegistrations";
  const PAGE_SIZE = 100;
  const MAX_RENDERED_STUDENTS = 250;
  let exam = null;
  let instituteId = "";
  let instituteName = "";
  let students = [];
  let rosterPage = [];
  let rosterCursor = null;
  let rosterHasMore = false;
  let busy = false;
  let scanSequence = 0;

  const $ = function (id) { return document.getElementById(id); };
  const database = function () { return typeof getDB === "function" ? getDB() : null; };
  const safeText = function (value) { return value == null ? "" : String(value); };
  const cleanMobile = function (value) {
    const raw = safeText(value).replace(/\D/g, "");
    return typeof normalizeMobile === "function" ? normalizeMobile(raw) : raw;
  };
  const rollDigitsNeeded = function (roll) { return Math.max(1, String(Math.max(0, Number(roll) || 0)).length); };
  const formatRoll = function (roll, digits) {
    const value = String(Math.max(0, Number(roll) || 0));
    return value.padStart(Math.max(1, Math.min(5, Number(digits) || 2)), "0");
  };
  const canonicalRoll = function (value) {
    const digits = safeText(value).replace(/\D/g, "");
    if (!digits || digits.length > 5) return null;
    const number = Number(digits);
    return Number.isSafeInteger(number) && number > 0 && number <= 99999 ? number : null;
  };
  const classLabel = function (id) {
    const option = (window.SAVYA_CLASS_OPTIONS || []).find(function (item) { return item.id === id; });
    return option ? option.label : safeText(id);
  };
  const docId = function (id, mobile) { return `${id}_${mobile}`; };
  const cardDocId = function (id, mobile) { return `${mobile}_${id}`; };
  const fieldValue = function () { return firebase.firestore.FieldValue; };

  function make(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  }

  function status(message, isError) {
    const node = $("examgr-roster-status");
    if (!node) return;
    node.textContent = message || "";
    node.classList.toggle("is-error", !!isError);
    node.hidden = !message;
  }

  function mount() {
    const grid = document.querySelector("#examgr-details-overlay .examgr-actions-grid");
    if (!grid || $("examgr-roster-open")) return;

    const button = make("button", "examgr-action-btn");
    button.type = "button";
    button.id = "examgr-roster-open";
    button.innerHTML = "<span>🎟️</span>Roster &amp; Admit Cards";
    button.addEventListener("click", open);
    grid.append(button);

    const overlay = document.createElement("div");
    overlay.id = "examgr-roster-overlay";
    overlay.className = "test-analysis-overlay examgr-overlay-full hidden";
    overlay.innerHTML = `
      <div class="test-analysis-sheet examgr-roster-sheet" role="dialog" aria-modal="true" aria-labelledby="examgr-roster-title">
        <button type="button" class="test-analysis-close" id="examgr-roster-close" aria-label="Close">✕</button>
        <div class="test-analysis-title" id="examgr-roster-title">👥 Exam Roster</div>
        <p class="muted-text" id="examgr-roster-intro"></p>
        <div class="examgr-roster-summary" id="examgr-roster-summary"></div>
        <div class="examgr-roster-meta">
          <div class="field-row"><label for="examgr-roster-venue">Exam centre / venue</label><input id="examgr-roster-venue" type="text" maxlength="160" placeholder="Centre ka naam aur address"></div>
          <div class="field-row"><label for="examgr-roster-reporting">Reporting time</label><input id="examgr-roster-reporting" type="time"></div>
          <div class="field-row examgr-roster-instructions-row"><label for="examgr-roster-instructions">Admit card instructions</label><textarea id="examgr-roster-instructions" rows="2" maxlength="600" placeholder="Photo ID aur pen saath laayein…"></textarea></div>
          <button type="button" class="btn-secondary" id="examgr-roster-details-save">Exam details save karein</button>
        </div>
        <p id="examgr-roster-status" class="examgr-notice" aria-live="polite" hidden></p>
        <div class="examgr-roster-publish-row">
          <button type="button" class="btn-primary" id="examgr-roster-publish">🎟️ Admit Cards publish karein</button>
          <button type="button" class="btn-secondary" id="examgr-roster-export">⬇️ Roster CSV</button>
        </div>
        <div class="examgr-roster-picker">
          <div class="examgr-roster-section-title">Students register karein</div>
          <div class="examgr-roster-filters">
            <label>Class <select id="examgr-roster-class"></select></label>
            <label>Name ya mobile <input type="search" id="examgr-roster-search" placeholder="Search students"></label>
            <button type="button" class="btn-secondary" id="examgr-roster-refresh-students">🔄 Students refresh</button>
          </div>
          <p class="muted-text" id="examgr-roster-match-count"></p>
          <div class="examgr-roster-list" id="examgr-roster-student-list"></div>
          <div class="examgr-roster-pick-actions">
            <button type="button" class="btn-secondary" id="examgr-roster-select-visible">Visible sab select karein</button>
            <button type="button" class="btn-primary" id="examgr-roster-register-selected">Selected register karein</button>
            <button type="button" class="btn-secondary" id="examgr-roster-register-filtered">Filtered sab register karein</button>
          </div>
        </div>
        <div class="examgr-roster-section-title">Registered students</div>
        <div class="examgr-roster-list" id="examgr-roster-registered-list"></div>
        <button type="button" class="btn-secondary" id="examgr-roster-more" hidden>Agli 100 entries</button>
      </div>`;
    document.body.append(overlay);
    $("examgr-roster-close").addEventListener("click", close);
    overlay.addEventListener("click", function (event) { if (event.target === overlay) close(); });
    $("examgr-roster-class").addEventListener("change", renderStudentChoices);
    $("examgr-roster-search").addEventListener("input", renderStudentChoices);
    $("examgr-roster-select-visible").addEventListener("click", selectVisible);
    $("examgr-roster-register-selected").addEventListener("click", function () { registerStudents(selectedStudents()); });
    $("examgr-roster-register-filtered").addEventListener("click", function () { registerStudents(filteredStudents()); });
    $("examgr-roster-refresh-students").addEventListener("click", loadStudents);
    $("examgr-roster-details-save").addEventListener("click", saveExamDetails);
    $("examgr-roster-publish").addEventListener("click", publishAdmitCards);
    $("examgr-roster-export").addEventListener("click", exportRoster);
    $("examgr-roster-more").addEventListener("click", function () { loadRosterPage(false); });
    $("examgr-roster-registered-list").addEventListener("click", removeRegistrationClick);
  }

  function open() {
    mount();
    const active = typeof window.examgrGetCurrentExam === "function" ? window.examgrGetCurrentExam() : null;
    if (!active || !active.id) {
      alert("Pehle Exam Manager mein ek exam kholein.");
      return;
    }
    exam = active;
    const store = database();
    if (!store) { alert("Firebase se connect nahi ho paaya. Internet check karein."); return; }
    status("Institute aur students load ho rahe hain…");
    $("examgr-roster-intro").textContent = `${exam.examName || "Exam"} · ${exam.date || "Date not set"}`;
    $("examgr-roster-venue").value = exam.venue || "";
    $("examgr-roster-reporting").value = exam.reportingTime || "";
    $("examgr-roster-instructions").value = exam.admitCardInstructions || "";
    $("examgr-roster-overlay").classList.remove("hidden");
    resolveInstitute().then(function () { return Promise.all([loadStudents(), loadRosterPage(true)]); }).then(function () {
      renderSummary();
      status("");
    }).catch(function (error) {
      console.warn("[exam-roster] open failed:", error);
      status("Roster load nahi hua: " + (error.message || String(error)), true);
    });
  }

  function close() {
    $("examgr-roster-overlay")?.classList.add("hidden");
    status("");
  }

  async function resolveInstitute() {
    if (typeof ensureAdminInstituteResolved === "function") await ensureAdminInstituteResolved();
    instituteId = safeText(exam.instituteId || (typeof getCurrentAdminInstituteId === "function" ? getCurrentAdminInstituteId() : ""));
    if (!instituteId) throw new Error("Aapka institute resolve nahi hua. Dobara login karke try karein.");
    const store = database();
    const snap = await store.collection("institutes").doc(instituteId).get();
    instituteName = snap.exists ? safeText(snap.data().name || instituteId) : instituteId;
    if (!exam.instituteId) {
      await store.collection("examManagerExams").doc(exam.id).update({ instituteId: instituteId });
      exam.instituteId = instituteId;
    }
  }

  async function loadStudents() {
    const store = database();
    if (!store || !instituteId) return;
    status("Institute ke students load ho rahe hain…");
    const snapshot = await store.collection("students").where("instituteId", "==", instituteId).get();
    students = snapshot.docs.map(function (doc) {
      const data = doc.data() || {};
      return { mobile: cleanMobile(doc.id), name: safeText(data.name).trim(), classId: safeText(data.classId), instituteId: safeText(data.instituteId) };
    }).filter(function (student) { return student.mobile && student.name && student.instituteId === instituteId; });
    students.sort(function (a, b) { return a.name.localeCompare(b.name) || a.mobile.localeCompare(b.mobile); });
    renderClassOptions();
    renderStudentChoices();
    status("");
  }

  function renderClassOptions() {
    const select = $("examgr-roster-class");
    if (!select) return;
    const options = window.SAVYA_CLASS_OPTIONS || [];
    select.replaceChildren();
    const all = document.createElement("option");
    all.value = "";
    all.textContent = "Sabhi Classes";
    select.append(all);
    options.forEach(function (item) {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.label;
      select.append(option);
    });
    select.value = exam.classId || "";
  }

  function filteredStudents() {
    const classId = $("examgr-roster-class")?.value || "";
    const query = ($("examgr-roster-search")?.value || "").trim().toLowerCase();
    return students.filter(function (student) {
      return (!classId || student.classId === classId) && (!query || student.name.toLowerCase().includes(query) || student.mobile.includes(query));
    });
  }

  function renderStudentChoices() {
    const container = $("examgr-roster-student-list");
    const count = $("examgr-roster-match-count");
    if (!container || !count) return;
    const matches = filteredStudents();
    count.textContent = `${matches.length} students match karte hain. List mein pehle ${Math.min(matches.length, MAX_RENDERED_STUDENTS)} dikh rahe hain; “Filtered sab register karein” poore filter par chalega.`;
    container.replaceChildren();
    if (!matches.length) {
      container.append(make("p", "empty-state", "Is class/search mein koi institute-registered student nahi mila."));
      return;
    }
    matches.slice(0, MAX_RENDERED_STUDENTS).forEach(function (student) {
      const row = make("label", "examgr-roster-student-row");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.mobile = student.mobile;
      checkbox.setAttribute("aria-label", `${student.name}, ${student.mobile}`);
      row.append(checkbox);
      const description = make("span", "examgr-roster-student-copy");
      description.append(make("strong", "", student.name));
      description.append(make("small", "", `${classLabel(student.classId) || "Class not set"} · ${student.mobile}`));
      row.append(description);
      container.append(row);
    });
  }

  function selectVisible() {
    $("examgr-roster-student-list")?.querySelectorAll('input[type="checkbox"]').forEach(function (input) { input.checked = true; });
  }

  function selectedStudents() {
    const selected = new Set(Array.from($("examgr-roster-student-list")?.querySelectorAll('input[type="checkbox"]:checked') || []).map(function (input) { return input.dataset.mobile; }));
    return students.filter(function (student) { return selected.has(student.mobile); });
  }

  async function registerStudents(candidates) {
    if (busy || !exam || !instituteId) return;
    const unique = Array.from(new Map(candidates.map(function (student) { return [student.mobile, student]; })).values());
    if (!unique.length) { status("Pehle kam se kam ek student select karein.", true); return; }
    if (unique.length > 99999) { status("OMR roll number 5 digits tak support karta hai; ek exam mein 99,999 se zyada students register nahi ho sakte.", true); return; }
    if (!confirm(`${unique.length} students ko “${exam.examName || "is exam"}” ke liye register karein? Roll numbers apne aap assign honge.`)) return;
    const originalDigits = Math.max(1, Number(exam.rollDigits) || 2);
    busy = true;
    toggleControls(true);
    let added = 0;
    try {
      for (let start = 0; start < unique.length; start += 100) {
        const chunk = unique.slice(start, start + 100);
        added += await registerChunk(chunk);
        status(`Registration chal rahi hai… ${Math.min(start + chunk.length, unique.length)}/${unique.length} checked · ${added} naye students registered`);
      }
      await refreshExamState();
      if (exam.admitCardsPublished && Number(exam.rollDigits) > originalDigits) await syncPublishedCardDetails();
      await loadRosterPage(true);
      renderSummary();
      status(`✅ ${added} naye students register hue. ${unique.length - added} pehle se registered the; unke roll numbers wahi rahe.`);
    } catch (error) {
      console.error("[exam-roster] registration failed:", error);
      status("Registration ruk gayi: " + (error.message || String(error)) + " Dobara chalane par pehle se registered students skip ho jayenge.", true);
    } finally {
      busy = false;
      toggleControls(false);
    }
  }

  async function registerChunk(chunk) {
    const store = database();
    const examRef = store.collection("examManagerExams").doc(exam.id);
    const refs = chunk.map(function (student) { return store.collection(ROSTERS).doc(docId(exam.id, student.mobile)); });
    return store.runTransaction(async function (transaction) {
      const examSnap = await transaction.get(examRef);
      if (!examSnap.exists) throw new Error("Exam record nahi mila.");
      const savedExam = examSnap.data() || {};
      if (savedExam.instituteId !== instituteId) throw new Error("Exam ab is institute se linked nahi hai.");
      const registrationSnaps = await Promise.all(refs.map(function (ref) { return transaction.get(ref); }));
      let nextRoll = Math.max(1, Number(savedExam.nextRollNumber) || 1);
      let registered = Math.max(0, Number(savedExam.registeredStudentCount) || 0);
      let digits = Math.max(1, Math.min(5, Number(savedExam.rollDigits) || 2));
      const newCount = registrationSnaps.filter(function (snapshot) { return !snapshot.exists; }).length;
      digits = Math.max(digits, rollDigitsNeeded(nextRoll + Math.max(0, newCount - 1)));
      let added = 0;
      chunk.forEach(function (student, index) {
        if (registrationSnaps[index].exists) return;
        if (nextRoll > 99999) throw new Error("99,999 roll numbers assign ho chuke hain; 5-digit OMR limit poori ho gayi.");
        const roll = nextRoll++;
        const className = classLabel(student.classId) || "";
        const fields = {
          examId: exam.id,
          instituteId: instituteId,
          instituteName: instituteName,
          mobile: student.mobile,
          studentName: student.name,
          classId: student.classId || null,
          className: className,
          examName: safeText(savedExam.examName || exam.examName || "Exam"),
          examDate: safeText(savedExam.date || exam.date || ""),
          rollNumber: roll,
          rollDigits: digits,
          venue: safeText(savedExam.venue || ""),
          reportingTime: safeText(savedExam.reportingTime || ""),
          instructions: safeText(savedExam.admitCardInstructions || ""),
          registeredAt: fieldValue().serverTimestamp()
        };
        transaction.set(refs[index], fields);
        if (savedExam.admitCardsPublished === true) {
          const cardRef = store.collection(STUDENT_CARDS).doc(cardDocId(exam.id, student.mobile));
          transaction.set(cardRef, Object.assign({}, fields, { admitCardPublished: true, publishedAt: fieldValue().serverTimestamp() }));
        }
        added++;
      });
      if (added) {
        transaction.update(examRef, {
          nextRollNumber: nextRoll,
          registeredStudentCount: registered + added,
          students: registered + added,
          rollDigits: digits,
          updatedAt: fieldValue().serverTimestamp()
        });
      }
      return added;
    });
  }

  async function loadRosterPage(reset) {
    const store = database();
    if (!store || !exam || !instituteId) return;
    const list = $("examgr-roster-registered-list");
    if (reset) {
      rosterPage = [];
      rosterCursor = null;
      rosterHasMore = false;
      list?.replaceChildren(make("p", "muted-text", "Registered students load ho rahe hain…"));
    }
    let query = store.collection(ROSTERS).where("examId", "==", exam.id).where("instituteId", "==", instituteId).orderBy("rollNumber").limit(PAGE_SIZE);
    if (!reset && rosterCursor) query = query.startAfter(rosterCursor);
    const snapshot = await query.get();
    const rows = snapshot.docs.map(function (doc) { return Object.assign({ id: doc.id }, doc.data()); });
    rosterPage = reset ? rows : rosterPage.concat(rows);
    rosterCursor = snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : rosterCursor;
    rosterHasMore = snapshot.docs.length === PAGE_SIZE;
    renderRosterRows();
    const more = $("examgr-roster-more");
    if (more) more.hidden = !rosterHasMore;
  }

  function renderRosterRows() {
    const list = $("examgr-roster-registered-list");
    if (!list) return;
    list.replaceChildren();
    if (!rosterPage.length) {
      list.append(make("p", "empty-state", "Abhi is exam ke liye koi student register nahi hai."));
      return;
    }
    rosterPage.forEach(function (student) {
      const row = make("div", "examgr-roster-registered-row");
      const detail = make("span", "examgr-roster-student-copy");
      detail.append(make("strong", "", `${formatRoll(student.rollNumber, exam.rollDigits)} · ${student.studentName || "Student"}`));
      detail.append(make("small", "", `${student.className || "Class not set"} · ${student.mobile || ""}`));
      row.append(detail);
      const remove = make("button", "btn-secondary examgr-roster-remove", "Remove");
      remove.type = "button";
      remove.dataset.registrationId = student.id;
      remove.dataset.mobile = student.mobile;
      remove.dataset.roll = safeText(student.rollNumber);
      remove.setAttribute("aria-label", `Remove ${student.studentName || "student"} from this exam`);
      row.append(remove);
      list.append(row);
    });
  }

  async function removeRegistrationClick(event) {
    const button = event.target.closest("[data-registration-id]");
    if (!button || busy) return;
    const mobile = button.dataset.mobile;
    const roll = Number(button.dataset.roll);
    if (!confirm(`Roll No. ${formatRoll(roll, exam.rollDigits)} ko is exam ki roster se hata dein? Roll number dobara kisi ko nahi diya jayega.`)) return;
    busy = true;
    toggleControls(true);
    try {
      const store = database();
      const examRef = store.collection("examManagerExams").doc(exam.id);
      const rosterRef = store.collection(ROSTERS).doc(button.dataset.registrationId);
      const cardRef = store.collection(STUDENT_CARDS).doc(cardDocId(exam.id, mobile));
      await store.runTransaction(async function (transaction) {
        const [examSnap, rowSnap] = await Promise.all([transaction.get(examRef), transaction.get(rosterRef)]);
        if (!examSnap.exists || !rowSnap.exists) return;
        const count = Math.max(0, Number(examSnap.data().registeredStudentCount) || 0);
        transaction.delete(rosterRef);
        transaction.delete(cardRef);
        transaction.update(examRef, { registeredStudentCount: Math.max(0, count - 1), students: Math.max(0, count - 1), updatedAt: fieldValue().serverTimestamp() });
      });
      await refreshExamState();
      await loadRosterPage(true);
      renderSummary();
      status("Student ko roster se remove kar diya.");
    } catch (error) {
      status("Student remove nahi hua: " + (error.message || String(error)), true);
    } finally {
      busy = false;
      toggleControls(false);
    }
  }

  async function refreshExamState() {
    const snapshot = await database().collection("examManagerExams").doc(exam.id).get();
    if (snapshot.exists) exam = Object.assign({ id: exam.id }, snapshot.data());
    if (typeof window.examgrRefreshCurrentExam === "function") await window.examgrRefreshCurrentExam();
  }

  async function syncPublishedCardDetails() {
    await forEachRegistrationPage(async function (rows) {
      const batch = database().batch();
      rows.forEach(function (row) {
        batch.set(database().collection(ROSTERS).doc(row.id), { rollDigits: Number(exam.rollDigits) || 2 }, { merge: true });
        batch.set(database().collection(STUDENT_CARDS).doc(cardDocId(exam.id, row.mobile)), { rollDigits: Number(exam.rollDigits) || 2 }, { merge: true });
      });
      await batch.commit();
    });
  }

  function renderSummary() {
    const count = Math.max(0, Number(exam.registeredStudentCount) || 0);
    const digits = Math.max(1, Math.min(5, Number(exam.rollDigits) || 2));
    const summary = $("examgr-roster-summary");
    summary.replaceChildren();
    summary.append(make("strong", "", `${count} registered`));
    const highest = Math.max(0, (Number(exam.nextRollNumber) || 1) - 1);
    summary.append(make("span", "", count ? `Auto roll no: ${formatRoll(1, digits)}–${formatRoll(highest, digits)}` : "Auto roll no: not assigned"));
    summary.append(make("span", "", `${digits}-digit OMR roll`));
    const publish = $("examgr-roster-publish");
    if (publish) publish.textContent = exam.admitCardsPublished ? "✅ Admit Cards publish ho chuke hain" : "🎟️ Admit Cards publish karein";
    if (publish) publish.disabled = !!exam.admitCardsPublished;
    const title = $("examgr-roster-title");
    if (title) title.textContent = `👥 ${exam.examName || "Exam"} — Roster`;
    const intro = $("examgr-roster-intro");
    if (intro) intro.textContent = `${exam.className || "All classes"} · ${exam.date || "Date not set"} · Institute: ${instituteName}`;
  }

  async function saveExamDetails() {
    if (busy || !exam) return;
    const values = {
      venue: ($("examgr-roster-venue").value || "").trim(),
      reportingTime: $("examgr-roster-reporting").value || "",
      admitCardInstructions: ($("examgr-roster-instructions").value || "").trim()
    };
    busy = true;
    toggleControls(true);
    status("Exam details aur admit cards update ho rahe hain…");
    try {
      await database().collection("examManagerExams").doc(exam.id).update(Object.assign({}, values, { updatedAt: fieldValue().serverTimestamp() }));
      exam = Object.assign({}, exam, values);
      await forEachRegistrationPage(async function (rows) {
        const batch = database().batch();
        rows.forEach(function (row) {
          const common = Object.assign({}, values, { examName: safeText(exam.examName), examDate: safeText(exam.date), className: safeText(row.className), instituteName: instituteName });
          batch.set(database().collection(ROSTERS).doc(row.id), common, { merge: true });
          if (exam.admitCardsPublished) batch.set(database().collection(STUDENT_CARDS).doc(cardDocId(exam.id, row.mobile)), common, { merge: true });
        });
        await batch.commit();
      });
      await refreshExamState();
      renderSummary();
      status("✅ Admit card ke exam details save ho gaye.");
    } catch (error) {
      console.error("[exam-roster] detail update failed:", error);
      status("Details save nahi hue: " + (error.message || String(error)), true);
    } finally {
      busy = false;
      toggleControls(false);
    }
  }

  async function publishAdmitCards() {
    if (busy || !exam || exam.admitCardsPublished) return;
    const count = Math.max(0, Number(exam.registeredStudentCount) || 0);
    if (!count) { status("Pehle students ko exam roster mein register karein.", true); return; }
    if (!confirm(`${count} personalized admit cards students ke accounts mein publish karein?`)) return;
    busy = true;
    toggleControls(true);
    let published = 0;
    try {
      status(`Admit cards publish ho rahe hain… 0/${count}`);
      await forEachRegistrationPage(async function (rows) {
        const batch = database().batch();
        rows.forEach(function (row) {
          batch.set(database().collection(STUDENT_CARDS).doc(cardDocId(exam.id, row.mobile)), cardRecord(row), { merge: true });
        });
        await batch.commit();
        published += rows.length;
        status(`Admit cards publish ho rahe hain… ${published}/${count}`);
      });
      await database().collection("examManagerExams").doc(exam.id).update({
        admitCardsPublished: true,
        admitCardPublishStatus: "published",
        admitCardsPublishedAt: fieldValue().serverTimestamp(),
        updatedAt: fieldValue().serverTimestamp()
      });
      exam.admitCardsPublished = true;
      exam.admitCardPublishStatus = "published";
      renderSummary();
      status(`✅ ${published} admit cards publish ho gaye. Students apne dashboard ke “Admit Cards” section mein print kar sakte hain.`);
    } catch (error) {
      console.error("[exam-roster] publish failed:", error);
      status(`Publish ${published}/${count} tak hua. Error: ${error.message || String(error)}. Dobara dabane par process wahi cards update karke complete karega.`, true);
    } finally {
      busy = false;
      toggleControls(false);
    }
  }

  function cardRecord(row) {
    return {
      examId: exam.id,
      instituteId: instituteId,
      instituteName: instituteName,
      mobile: row.mobile,
      studentName: row.studentName,
      className: row.className || "",
      rollNumber: Number(row.rollNumber),
      rollDigits: Math.max(1, Math.min(5, Number(exam.rollDigits) || 2)),
      examName: safeText(exam.examName || "Exam"),
      examDate: safeText(exam.date || ""),
      venue: safeText(exam.venue || ""),
      reportingTime: safeText(exam.reportingTime || ""),
      instructions: safeText(exam.admitCardInstructions || ""),
      admitCardPublished: true,
      publishedAt: fieldValue().serverTimestamp()
    };
  }

  async function forEachRegistrationPage(callback) {
    let cursor = null;
    for (;;) {
      let query = database().collection(ROSTERS).where("examId", "==", exam.id).where("instituteId", "==", instituteId).orderBy("rollNumber").limit(200);
      if (cursor) query = query.startAfter(cursor);
      const snapshot = await query.get();
      if (snapshot.empty) return;
      const rows = snapshot.docs.map(function (doc) { return Object.assign({ id: doc.id }, doc.data()); });
      await callback(rows);
      cursor = snapshot.docs[snapshot.docs.length - 1];
      if (snapshot.docs.length < 200) return;
    }
  }

  async function exportRoster() {
    if (busy || !exam) return;
    busy = true;
    toggleControls(true);
    status("Poora roster export ke liye load ho raha hai…");
    const rows = [];
    try {
      await forEachRegistrationPage(async function (page) { rows.push.apply(rows, page); });
      const headings = ["Roll Number", "Student Name", "Mobile", "Class", "Institute", "Exam", "Exam Date"];
      const csvCell = function (value) { return '"' + safeText(value).replace(/"/g, '""') + '"'; };
      const lines = [headings].concat(rows.map(function (row) {
        return [formatRoll(row.rollNumber, exam.rollDigits), row.studentName, row.mobile, row.className, instituteName, exam.examName, exam.date];
      })).map(function (row) { return row.map(csvCell).join(","); });
      const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${fileSlug(exam.examName)}-roster.csv`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      status(`✅ ${rows.length} roster entries CSV mein download hue.`);
    } catch (error) {
      status("Roster export nahi hua: " + (error.message || String(error)), true);
    } finally {
      busy = false;
      toggleControls(false);
    }
  }

  function fileSlug(value) { return safeText(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "exam"; }

  function toggleControls(disabled) {
    ["examgr-roster-details-save", "examgr-roster-publish", "examgr-roster-export", "examgr-roster-refresh-students", "examgr-roster-select-visible", "examgr-roster-register-selected", "examgr-roster-register-filtered", "examgr-roster-more"].forEach(function (id) {
      const node = $(id);
      if (node) node.disabled = !!disabled || id === "examgr-roster-publish" && !!(exam && exam.admitCardsPublished);
    });
    $("examgr-roster-registered-list")?.querySelectorAll("button").forEach(function (button) { button.disabled = !!disabled; });
  }

  function similarity(left, right) {
    const normalize = function (value) { return safeText(value).toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim(); };
    const a = normalize(left), b = normalize(right);
    if (!a || !b) return null;
    const previous = Array.from({ length: b.length + 1 }, function (_, i) { return i; });
    for (let i = 1; i <= a.length; i++) {
      let diagonal = previous[0];
      previous[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const old = previous[j];
        previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
        diagonal = old;
      }
    }
    return 1 - previous[b.length] / Math.max(a.length, b.length);
  }

  async function findRegistration(examId, roll) {
    const store = database();
    if (!store) throw new Error("Firebase connection nahi hai; registered student verify nahi ho paaya.");
    const inst = typeof getCurrentAdminInstituteId === "function" ? getCurrentAdminInstituteId() : instituteId;
    if (!inst) throw new Error("Institute resolve nahi hua; registered student verify nahi ho paaya.");
    const query = await store.collection(ROSTERS)
      .where("instituteId", "==", inst)
      .where("examId", "==", examId)
      .where("rollNumber", "==", roll)
      .limit(2).get();
    if (query.size > 1) return { duplicate: true };
    return query.empty ? null : query.docs[0].data();
  }

  async function showDetected(examId, rawRoll, ocrName) {
    const message = $("examgr-scan-roster-match");
    if (!message || !examId) return;
    message.hidden = false;
    const sequence = ++scanSequence;
    try {
      const store = database();
      if (!store) throw new Error("Firebase connection nahi hai; registered student verify nahi ho paaya.");
      const examSnap = await store.collection("examManagerExams").doc(examId).get();
      if (sequence !== scanSequence) return;
      const count = examSnap.exists ? Number(examSnap.data().registeredStudentCount) || 0 : 0;
      if (!count) {
        message.textContent = "ℹ️ Is exam ka registered roster abhi khali hai; legacy scan jaari rahega.";
        message.className = "examgr-scan-roster-match";
        return;
      }
      const roll = canonicalRoll(rawRoll);
      if (!roll) throw new Error("Registered roster ke liye roll number read karna zaroori hai.");
      message.textContent = `🔎 Roll ${safeText(rawRoll)} ki roster se jaanch ho rahi hai…`;
      message.className = "examgr-scan-roster-match";
      const registered = await findRegistration(examId, roll);
      if (sequence !== scanSequence) return;
      if (registered && registered.duplicate) throw new Error("Is roll number ke liye duplicate registrations mile. Admin roster check karein.");
      if (!registered) throw new Error(`Roll No. ${formatRoll(roll, examSnap.data().rollDigits)} is exam ke roster mein registered nahi hai.`);
      const score = similarity(ocrName, registered.studentName);
      const matchText = score == null ? "Naam OCR available nahi" : score < 0.45 ? `Naam OCR mismatch (${safeText(ocrName)})` : "Naam OCR match";
      message.textContent = `${score != null && score < 0.45 ? "⚠️" : "✅"} Registered: ${registered.studentName} · Roll ${formatRoll(roll, registered.rollDigits || examSnap.data().rollDigits)} · ${matchText}`;
      message.className = `examgr-scan-roster-match${score != null && score < 0.45 ? " is-error" : " is-ok"}`;
    } catch (error) {
      if (sequence !== scanSequence) return;
      message.textContent = "⚠️ " + (error.message || String(error));
      message.className = "examgr-scan-roster-match is-error";
    }
  }

  async function verifyBeforeSave(examId, rawRoll, ocrName) {
    const roll = canonicalRoll(rawRoll);
    if (!roll) {
      const store = database();
      const snapshot = store && await store.collection("examManagerExams").doc(examId).get();
      const count = snapshot && snapshot.exists ? Number(snapshot.data().registeredStudentCount) || 0 : 0;
      if (!count) return { ok: true, student: null };
      return { ok: false, message: "Registered exam roster ke liye roll number scan karein. Scanner Settings mein Roll No reading ON honi chahiye." };
    }
    const store = database();
    if (!store) return { ok: false, message: "Internet/Firebase connection nahi hai; registration verify nahi ho paaya, result save nahi hua." };
    try {
      const examSnap = await store.collection("examManagerExams").doc(examId).get();
      if (!examSnap.exists) return { ok: false, message: "Exam record verify nahi ho paaya; result save nahi hua." };
      const examData = examSnap.data() || {};
      if (!(Number(examData.registeredStudentCount) > 0)) return { ok: true, student: null };
      const registered = await findRegistration(examId, roll);
      if (registered && registered.duplicate) return { ok: false, message: "Is roll number ke liye duplicate registrations hain. Admin roster check karein." };
      if (!registered) return { ok: false, message: `Roll No. ${formatRoll(roll, examData.rollDigits)} registered roster mein nahi mila. Edit karke roll sahi karein ya admin se registration check karwayein.` };
      const score = similarity(ocrName, registered.studentName);
      if (score != null && score < 0.45 && !confirm(`⚠️ Name mismatch\n\nSheet OCR: ${ocrName}\nRegistered name: ${registered.studentName}\n\nRoll number match hua hai. Naam verify karke is result ko isi student ke saath save karein?`)) {
        return { ok: false, message: "Naam mismatch ki wajah se result save nahi kiya. Sheet dobara check karein." };
      }
      return { ok: true, student: {
        studentName: registered.studentName,
        mobile: registered.mobile,
        rollNumber: registered.rollNumber,
        nameMatch: score == null ? null : score >= 0.45
      } };
    } catch (error) {
      console.warn("[exam-roster] scan check failed:", error);
      return { ok: false, message: "Roster verify nahi ho paaya, isliye result save nahi hua. Connection/index check karke dobara try karein." };
    }
  }

  mount();
  window.examRosterShowDetected = showDetected;
  window.examRosterVerifyScan = verifyBeforeSave;
  window.examRosterMinDigits = function (activeExam) {
    const count = Number(activeExam && activeExam.registeredStudentCount) || 0;
    return count ? Math.max(1, rollDigitsNeeded(Number(activeExam.nextRollNumber || count + 1) - 1)) : 1;
  };
  window.examRosterRollDigitsChanged = async function (examId, digits) {
    if (!exam || exam.id !== examId || !exam.admitCardsPublished) return;
    exam.rollDigits = Number(digits) || exam.rollDigits;
    await syncPublishedCardDetails();
  };
})();
