(function () {
  "use strict";

  const COLLECTION = "studentExamRegistrations";
  const SECTION_ID = "student-admit-cards-card";

  function db() {
    return typeof getDB === "function" ? getDB() : null;
  }

  function studentMobile() {
    try {
      const session = typeof getStudentSession === "function" ? getStudentSession() : null;
      const raw = session && (session.mobile || session.phone);
      return typeof normalizeMobile === "function" ? normalizeMobile(raw || "") : String(raw || "").replace(/\D/g, "");
    } catch (_) {
      return "";
    }
  }

  function text(tag, value, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value == null || value === "" ? "—" : String(value);
    return node;
  }

  function addCardButton() {
    const grid = document.querySelector("#student-dashboard-home .cd-grid");
    if (!grid || document.getElementById("student-admit-card-dashboard-link")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.id = "student-admit-card-dashboard-link";
    button.className = "cd-card cd-pink";
    button.innerHTML = '<div class="cd-card-top"><div class="cd-icon-circle">🎟️</div><span class="cd-badge">Exam</span></div><div class="cd-card-title">Admit Cards</div><div class="cd-card-sub">Apne upcoming exams ke cards dekhein</div><div class="cd-card-bottom"><span class="cd-arrow-btn">→</span></div>';
    button.addEventListener("click", function () {
      if (typeof window.goStudentSection === "function") window.goStudentSection(SECTION_ID);
      load();
    });
    grid.appendChild(button);
  }

  function addSection() {
    if (document.getElementById(SECTION_ID)) return;
    const settings = document.getElementById("student-settings-card");
    if (!settings || !settings.parentNode) return;
    const section = document.createElement("section");
    section.id = SECTION_ID;
    section.className = "card hidden admit-cards-section";
    section.innerHTML = '<h2 class="section-title">🎟️ Mere Admit Cards</h2><p class="muted-text">Admin ke publish karte hi aapka exam admit card yahan dikhega.</p><div id="student-admit-cards-list" aria-live="polite"></div><div id="student-admit-card-print-root" hidden></div>';
    settings.parentNode.insertBefore(section, settings);
  }

  function cardRow(record) {
    const row = document.createElement("article");
    row.className = "admit-card-list-item";
    const info = document.createElement("div");
    info.append(text("h3", record.examName || "Exam"));
    info.append(text("p", `${record.examDate || "Date not set"} · ${record.className || "Class not set"}`, "muted-text"));
    info.append(text("p", `Roll No. ${formatRoll(record.rollNumber, record.rollDigits)}`, "admit-card-list-roll"));
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn-primary";
    button.textContent = "Admit Card dekhein / Print karein";
    button.addEventListener("click", function () { printCard(record); });
    row.append(info, button);
    return row;
  }

  function formatRoll(value, digits) {
    const roll = String(value == null ? "" : value).replace(/\D/g, "");
    const width = Math.max(1, Math.min(5, Number(digits) || 2));
    return roll ? roll.padStart(width, "0") : "—";
  }

  function load() {
    addSection();
    const list = document.getElementById("student-admit-cards-list");
    if (!list) return Promise.resolve();
    const mobile = studentMobile();
    if (!mobile) {
      list.replaceChildren(text("p", "Student login session nahi mila. Dobara login karke try karein.", "empty-state"));
      return Promise.resolve();
    }
    const store = db();
    if (!store) {
      list.replaceChildren(text("p", "Internet/Firebase connection nahi hai. Dobara try karein.", "empty-state"));
      return Promise.resolve();
    }
    list.replaceChildren(text("p", "Admit cards load ho rahe hain…", "muted-text"));
    return store.collection(COLLECTION).where("mobile", "==", mobile).get().then(function (snapshot) {
      const records = snapshot.docs.map(function (doc) { return Object.assign({ id: doc.id }, doc.data()); });
      records.sort(function (a, b) { return String(a.examDate || "").localeCompare(String(b.examDate || "")); });
      list.replaceChildren();
      if (!records.length) {
        list.append(text("p", "Abhi aapke liye koi admit card publish nahi hua hai.", "empty-state"));
        return;
      }
      records.forEach(function (record) { list.append(cardRow(record)); });
    }).catch(function (error) {
      console.warn("[admit-cards] load failed:", error);
      list.replaceChildren(text("p", "Admit cards load nahi hue. Internet check karke Refresh karein.", "empty-state"));
      const refresh = document.createElement("button");
      refresh.type = "button";
      refresh.className = "btn-secondary";
      refresh.textContent = "🔄 Refresh";
      refresh.addEventListener("click", load);
      list.append(refresh);
    });
  }

  function printCard(record) {
    const root = document.getElementById("student-admit-card-print-root");
    if (!root) return;
    root.replaceChildren();
    root.hidden = false;

    const card = document.createElement("article");
    card.className = "admit-print-card";
    const header = document.createElement("header");
    header.append(text("div", record.instituteName || "Institute", "admit-print-institute"));
    header.append(text("div", "ADMIT CARD", "admit-print-label"));
    card.append(header);

    card.append(text("h1", record.examName || "Exam", "admit-print-exam"));
    const roll = document.createElement("div");
    roll.className = "admit-print-roll";
    roll.append(text("span", "ROLL NUMBER", "admit-print-caption"));
    roll.append(text("strong", formatRoll(record.rollNumber, record.rollDigits)));
    card.append(roll);

    const details = document.createElement("dl");
    [
      ["Student Name", record.studentName],
      ["Class", record.className],
      ["Exam Date", record.examDate],
      ["Reporting Time", record.reportingTime],
      ["Exam Centre", record.venue],
      ["Mobile", record.mobile ? `••••••${String(record.mobile).slice(-4)}` : "—"]
    ].forEach(function (pair) {
      const group = document.createElement("div");
      group.append(text("dt", pair[0]));
      group.append(text("dd", pair[1]));
      details.append(group);
    });
    card.append(details);
    if (record.instructions) card.append(text("p", record.instructions, "admit-print-instructions"));

    const footer = document.createElement("footer");
    footer.append(text("span", "Candidate signature", "admit-print-signature"));
    footer.append(text("span", "Exam in-charge", "admit-print-signature"));
    card.append(footer);
    root.append(card);

    document.body.classList.add("admit-card-printing");
    window.setTimeout(function () { window.print(); }, 80);
  }

  window.addEventListener("afterprint", function () {
    document.body.classList.remove("admit-card-printing");
    const root = document.getElementById("student-admit-card-print-root");
    if (root) { root.replaceChildren(); root.hidden = true; }
  });

  addCardButton();
  addSection();
  window.AdmitCards = { load: load, formatRoll: formatRoll };
})();
