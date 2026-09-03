/* ══════════════════════════════════════════════════════════════════
   SnapTest Pro — STUDENT + ADMIN ID CARD  (v111 + v112)
   ══════════════════════════════════════════════════════════════════
   Ye file script.js ke baad load hoti hai aur usi ke globals ($, getDB,
   getAuth, getStudentSession, normalizeMobile, STUDENTS_COLLECTION,
   renderStudentDpPhoto, getCurrentAdminInstituteId,
   ensureAdminInstituteResolved, window.SAVYA_CLASS_OPTIONS) reuse karti
   hai — koi bhi cheez dobara define nahi ki gayi.

   Kya banaya gaya hai:
   1) Student ka Settings → ek asli University/Institute jaisa dark+gold
      ID Card — Naam, ID Number (Institute-code + Serial No), Class,
      Academic Session (live-calculated, kabhi stored nahi hota), Issue
      Date (registration date), aur "Owner of Institute" signature.
      Dono corner-logo Admin ke uploaded institute-logo se aate hain —
      student sirf apni beech wali photo hi badal sakta hai (jo pehle
      se hi Settings mein thi — DP feature, bas ab ID Card ke andar
      hai).
   2) Admin ka Settings → wahi card design, bas ID Number/Class/
      Academic Session ke bina — Naam (khud edit kar sakta hai) + apni
      photo. Corner-logo par click karke Admin apne institute ka logo
      upload kar sakta hai — turant sabhi students ke ID card par bhi
      dikhta hai (dono ek hi field — institutes/{id}.logoDataUrl —
      use karte hain).
   3) Har student ko ek Institute-wide unique Serial Number — pehli
      baar ID Card khulte hi (ya registration ke turant baad) ek
      Firestore TRANSACTION se assign hota hai
      (institutes/{id}.studentSerialCounter ko atomically +1 karke),
      taaki do students ko kabhi ek jaisa number na mile, chahe dono
      ek hi second mein register/pehli-baar-Settings-kholein.
   4) (v112) "Owner of Institute" signature ab COACHING ka naam nahi,
      balki institute ke ASLI owner (insaan) ka naam dikhati hai —
      `institutes/{id}.ownerName`, jo Owner Panel se set/edit hota hai
      (owner-panel.js → ownerSetInstituteOwnerName). Naam set na ho to
      "-" dikhta hai (Owner Panel mein bhi ⚠️ ke saath highlighted
      rehta hai jab tak set na ho jaaye).
   ══════════════════════════════════════════════════════════════════ */
(function () {

  function setText(sel, txt) {
    const el = $(sel);
    if (el) el.textContent = (txt === null || txt === undefined || txt === "") ? "-" : txt;
  }

  function setImgOrFallback(imgSel, fallbackSel, dataUrl) {
    const img = $(imgSel);
    const fallback = $(fallbackSel);
    if (img) { img.src = dataUrl || ""; img.style.display = dataUrl ? "block" : "none"; }
    if (fallback) fallback.style.display = dataUrl ? "none" : "flex";
  }

  /* ── Academic Session — HAMESHA live-calculated, kabhi Firestore
     mein save nahi hota. Indian coaching/school convention: session
     April se shuru hokar agle saal March mein khatam hoti hai — isliye
     Jan-Mar mein login karne par pichhle saal wali session dikhti hai
     (jaise Feb 2026 mein "2025-26"), aur April 2026 se "2026-27" ho
     jaayegi. Ye function jab bhi call ho, us waqt ke hisaab se sahi
     session return karta hai — admin/student ko kabhi khud update
     nahi karna padta. ── */
  function computeAcademicSession(d) {
    d = d || new Date();
    const y = d.getFullYear();
    const startYear = d.getMonth() >= 3 ? y : y - 1; // April(3) se naya session
    return startYear + "-" + String(startYear + 1).slice(-2);
  }

  /* ── Institute-code — sample ID card ("CU12345678") jaisa short
     prefix, institute ke naam se hi nikalta hai (koi alag setting nahi
     rakhi — naam badalne par ID Number bhi apne aap update ho jaata
     hai). Multi-word naam → har word ka pehla akshar (max 4). Single
     word → pehle 3 akshar. ── */
  function deriveInstituteCode(name) {
    const words = String(name || "").trim().split(/\s+/).filter(Boolean);
    let code = "";
    if (words.length >= 2) code = words.slice(0, 4).map(w => w[0]).join("");
    else if (words.length === 1) code = words[0].slice(0, 3);
    code = code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return code || "STU";
  }

  function formatIdNumber(instituteName, serialNo) {
    if (!serialNo) return "-";
    return deriveInstituteCode(instituteName) + String(serialNo).padStart(4, "0");
  }

  function formatIssueDate(ts) {
    let d = null;
    if (ts && typeof ts.toDate === "function") d = ts.toDate();
    else if (ts instanceof Date) d = ts;
    if (!d || isNaN(d.getTime())) return "-";
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return String(d.getDate()).padStart(2, "0") + " " + months[d.getMonth()] + " " + d.getFullYear();
  }

  /* ── Purane students/admins ke paas createdAt na ho (bahut purana
     legacy account) to ek baar "idCardIssuedAt" stamp kar dete hain,
     taaki Issue Date hamesha kuch-na-kuch sahi dikhaye, aur dobara
     har baar wahi purani date hi dikhe (naya-naya "aaj ki tareekh"
     nahi, jo galat lagega). ── */
  async function ensureIssuedAt(db, collectionName, docId, data) {
    if (data && data.createdAt) return data.createdAt;
    if (data && data.idCardIssuedAt) return data.idCardIssuedAt;
    const now = firebase.firestore.Timestamp.now();
    try {
      await db.collection(collectionName).doc(docId).set({ idCardIssuedAt: now }, { merge: true });
    } catch (e) { console.warn("[idcard] issuedAt stamp failed", e); }
    return now;
  }

  /* ── Serial Number — institute-wide counter, Firestore TRANSACTION
     se atomically assign hota hai (race-condition-proof: do students
     ek hi second mein pehli baar khole to bhi alag-alag number
     milenge). Ek baar assign hone ke baad student doc mein hamesha ke
     liye save ho jaata hai — dobara kabhi nahi badalta. ── */
  async function getOrAssignStudentSerial(db, instituteId, mobile) {
    const studentRef = db.collection(STUDENTS_COLLECTION).doc(mobile);
    const instRef = db.collection("institutes").doc(instituteId);
    return db.runTransaction(async (tx) => {
      const studentSnap = await tx.get(studentRef);
      const existing = studentSnap.exists ? studentSnap.data().serialNo : null;
      if (existing) return existing;
      const instSnap = await tx.get(instRef);
      const current = (instSnap.exists && instSnap.data().studentSerialCounter) || 0;
      const next = current + 1;
      tx.update(instRef, { studentSerialCounter: next });
      tx.set(studentRef, { serialNo: next }, { merge: true });
      return next;
    });
  }
  window.SavyaIdCard_getOrAssignStudentSerial = getOrAssignStudentSerial; // debug/manual use ke liye

  /* ══════════════════════════════════════════════════
     STUDENT ID CARD
     ══════════════════════════════════════════════════ */
  async function renderStudentIdCard() {
    const session = (typeof getStudentSession === "function") ? getStudentSession() : null;
    if (!session) return;

    // Session se turant (bina kisi wait ke) jo mil sake, dikha do.
    setText("#student-dp-name", session.name);
    setText("#student-dp-mobile", session.mobile);
    setText("#idcard-session", computeAcademicSession());

    const db = (typeof getDB === "function") ? getDB() : null;
    if (!db) return;

    try {
      const mobile = normalizeMobile(session.mobile);
      const studentSnap = await db.collection(STUDENTS_COLLECTION).doc(mobile).get();
      const sdata = studentSnap.exists ? studentSnap.data() : {};

      if (typeof renderStudentDpPhoto === "function") renderStudentDpPhoto(sdata.photoDataUrl || "");
      setText("#student-dp-name", sdata.name || session.name);

      // Class label — "Class:" field-label ke saath sirf number/naam
      // dikhana hai (jaise "10"), "Class 10" poora nahi — warna card
      // par "Class: Class 10" jaisa "Class" do baar likha dikhta hai.
      const classId = sdata.classId || session.classId || null;
      const classOpt = (window.SAVYA_CLASS_OPTIONS || []).find(c => c.id === classId);
      const classRaw = classOpt ? classOpt.label : (classId || "-");
      setText("#idcard-class", classRaw.replace(/^Class\s+/i, ""));

      // Institute (naam + logo + ASLI Owner ka naam — signature ke liye)
      const instituteId = sdata.instituteId || session.instituteId || null;
      let instName = "", instLogo = "", instOwnerName = "";
      if (instituteId) {
        try {
          const instSnap = await db.collection("institutes").doc(instituteId).get();
          if (instSnap.exists) {
            instName = instSnap.data().name || "";
            instLogo = instSnap.data().logoDataUrl || "";
            instOwnerName = instSnap.data().ownerName || "";
          }
        } catch (e) { console.warn("[idcard] institute fetch failed", e); }
      }
      setText("#idcard-inst-name", instName || "-");
      setText("#idcard-sign-name", instOwnerName || "-");
      setImgOrFallback("#idcard-inst-logo-left-img", "#idcard-inst-logo-left-fallback", instLogo);
      setImgOrFallback("#idcard-inst-logo-right-img", "#idcard-inst-logo-right-fallback", instLogo);

      // Serial No → ID Number (missing ho to yahin turant assign kar dete hain)
      // (v113) DEBUG: agar assign fail ho, ab "-" ki jagah asli error
      // seedha card par dikhta hai — taaki DevTools/console khole bina
      // hi pata chal jaaye ki wajah kya hai (permission, missing
      // instituteId, network, waghera). Ek baar sahi wajah pata chal
      // jaaye aur fix ho jaaye, is debug-text ko wapas hata denge.
      let serialNo = sdata.serialNo || null;
      if (!serialNo) {
        if (!instituteId) {
          setText("#idcard-id-number", "⚠️ No instituteId on student");
        } else {
          try {
            serialNo = await getOrAssignStudentSerial(db, instituteId, mobile);
            setText("#idcard-id-number", formatIdNumber(instName, serialNo));
          } catch (e) {
            console.warn("[idcard] serial assign failed", e);
            setText("#idcard-id-number", "⚠️ " + (e && e.code ? e.code + ": " : "") + (e && e.message ? e.message : String(e)));
          }
        }
      } else {
        setText("#idcard-id-number", formatIdNumber(instName, serialNo));
      }

      // Issue date
      const issuedAt = await ensureIssuedAt(db, STUDENTS_COLLECTION, mobile, sdata);
      setText("#idcard-issue-date", formatIssueDate(issuedAt));
    } catch (e) {
      console.warn("[renderStudentIdCard] failed", e);
    }
  }
  window.renderStudentIdCard = renderStudentIdCard;

  /* ══════════════════════════════════════════════════
     ADMIN ID CARD
     ══════════════════════════════════════════════════ */
  function renderAdminDpPhoto(dataUrl) {
    // Yahan fallback ek poora block hai (icon+text), koi single span
    // nahi — isliye setImgOrFallback() reuse nahi kiya, seedha dono
    // element (#admin-dp-preview img, #admin-dp-placeholder div) toggle
    // karte hain (student wale student-dp-placeholder jaisa hi).
    const img = $("#admin-dp-preview");
    const placeholder = $("#admin-dp-placeholder");
    if (img) { img.src = dataUrl || ""; img.style.display = dataUrl ? "block" : "none"; }
    if (placeholder) placeholder.style.display = dataUrl ? "none" : "flex";
  }

  async function renderAdminIdCard() {
    const db = (typeof getDB === "function") ? getDB() : null;
    const auth = (typeof getAuth === "function") ? getAuth() : null;
    const email = auth && auth.currentUser && auth.currentUser.email;
    if (!db || !email) return;

    setText("#admin-idcard-name", "Loading...");
    setText("#admin-idcard-inst-name", "Loading...");

    try {
      if (typeof ensureAdminInstituteResolved === "function") await ensureAdminInstituteResolved();
      const instituteId = (typeof getCurrentAdminInstituteId === "function") ? getCurrentAdminInstituteId() : null;

      const adminSnap = await db.collection("admins").doc(email).get();
      const adata = adminSnap.exists ? adminSnap.data() : {};
      renderAdminDpPhoto(adata.photoDataUrl || "");
      setText("#admin-idcard-name", adata.name || "— Naam Set Karein ✏️");

      let instName = "", instLogo = "", instOwnerName = "";
      if (instituteId) {
        try {
          const instSnap = await db.collection("institutes").doc(instituteId).get();
          if (instSnap.exists) {
            instName = instSnap.data().name || "";
            instLogo = instSnap.data().logoDataUrl || "";
            instOwnerName = instSnap.data().ownerName || "";
          }
        } catch (e) { console.warn("[idcard] institute fetch (admin) failed", e); }
      }
      setText("#admin-idcard-inst-name", instName || "-");
      setText("#admin-idcard-sign-name", instOwnerName || "-");
      setImgOrFallback("#admin-idcard-logo-left-img", "#admin-idcard-logo-left-fallback", instLogo);
      setImgOrFallback("#admin-idcard-logo-right-img", "#admin-idcard-logo-right-fallback", instLogo);

      const issuedAt = await ensureIssuedAt(db, "admins", email, adata);
      setText("#admin-idcard-issue-date", formatIssueDate(issuedAt));
    } catch (e) {
      console.warn("[renderAdminIdCard] failed", e);
    }
  }
  window.renderAdminIdCard = renderAdminIdCard;

  // ── Admin apni khud ki photo (DP) badal sakta hai — bilkul
  // handleStudentDpPhotoChange jaisa hi tareeka (canvas resize + JPEG
  // compress, seedha Firestore doc mein base64). ──
  function handleAdminDpPhotoChange(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const db = (typeof getDB === "function") ? getDB() : null;
    const auth = (typeof getAuth === "function") ? getAuth() : null;
    const email = auth && auth.currentUser && auth.currentUser.email;
    const statusEl = $("#admin-dp-photo-status");
    if (!email) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        const maxW = 360;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        let quality = 0.8;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        while (dataUrl.length > 350000 && quality > 0.4) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }
        renderAdminDpPhoto(dataUrl);
        if (!db) { if (statusEl) statusEl.textContent = "⚠️ Internet/Firebase connection nahi hai — dobara try karein."; return; }
        if (statusEl) statusEl.textContent = "⏳ Save ho raha hai...";
        try {
          await db.collection("admins").doc(email).set({ photoDataUrl: dataUrl }, { merge: true });
          if (statusEl) statusEl.textContent = "✅ Photo save ho gaya.";
        } catch (err) {
          console.error(err);
          if (statusEl) statusEl.textContent = "❌ Photo save nahi hua: " + (err.message || err);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
  window.handleAdminDpPhotoChange = handleAdminDpPhotoChange;

  // ── Admin apna Naam set/badal sakta hai (ID Card ke "Name" field
  // ke liye — Admin doc mein pehle koi personal naam field thi hi
  // nahi, sirf email/instituteName). Simple prompt() — isi codebase
  // mein aur bhi kai jagah (Change Password, Institute rename waghera)
  // yahi tareeka use hota hai. ──
  async function handleAdminNameEdit() {
    const db = (typeof getDB === "function") ? getDB() : null;
    const auth = (typeof getAuth === "function") ? getAuth() : null;
    const email = auth && auth.currentUser && auth.currentUser.email;
    if (!db || !email) return;
    const currentEl = $("#admin-idcard-name");
    const current = currentEl && !currentEl.textContent.startsWith("—") ? currentEl.textContent : "";
    const val = prompt("Apna naam likhein (ID Card par yahi dikhega):", current);
    if (val === null) return;
    const trimmed = val.trim();
    if (!trimmed) { alert("⚠️ Naam khaali nahi ho sakta."); return; }
    try {
      await db.collection("admins").doc(email).set({ name: trimmed }, { merge: true });
      setText("#admin-idcard-name", trimmed);
    } catch (e) {
      console.error(e);
      alert("❌ Naam save nahi hua: " + (e.message || e));
    }
  }
  window.handleAdminNameEdit = handleAdminNameEdit;

  // ── Institute Logo upload — Admin ke ID Card ke dono corner-logo
  // par click karne se khulta hai. PNG format mein hi rakha jaata hai
  // (JPEG NAHI) taaki logo ka transparent background dark card par
  // sahi dikhe. Bahut bada/complex PNG ho to progressively chhota
  // karte jaate hain jab tak size safe na ho jaaye. ──
  function handleInstituteLogoChange(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const db = (typeof getDB === "function") ? getDB() : null;
    const instituteId = (typeof getCurrentAdminInstituteId === "function") ? getCurrentAdminInstituteId() : null;
    const statusEl = $("#admin-institute-logo-status");
    if (!instituteId) { if (statusEl) statusEl.textContent = "⚠️ Institute abhi resolve nahi hua — thodi der baad try karein."; return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        const maxW = 300;
        const scale = Math.min(1, maxW / img.width);
        let canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);

        let dataUrl = canvas.toDataURL("image/png");
        let attempts = 0;
        while (dataUrl.length > 700000 && attempts < 3) {
          const nw = Math.max(1, Math.round(canvas.width * 0.7));
          const nh = Math.max(1, Math.round(canvas.height * 0.7));
          const c2 = document.createElement("canvas");
          c2.width = nw; c2.height = nh;
          c2.getContext("2d").drawImage(canvas, 0, 0, nw, nh);
          canvas = c2;
          dataUrl = canvas.toDataURL("image/png");
          attempts++;
        }
        if (dataUrl.length > 900000) {
          if (statusEl) statusEl.textContent = "⚠️ Ye image bahut bhaari hai — chhota/simple logo try karein.";
          return;
        }

        setImgOrFallback("#admin-idcard-logo-left-img", "#admin-idcard-logo-left-fallback", dataUrl);
        setImgOrFallback("#admin-idcard-logo-right-img", "#admin-idcard-logo-right-fallback", dataUrl);

        if (!db) { if (statusEl) statusEl.textContent = "⚠️ Internet/Firebase connection nahi hai."; return; }
        if (statusEl) statusEl.textContent = "⏳ Save ho raha hai...";
        try {
          await db.collection("institutes").doc(instituteId).set({ logoDataUrl: dataUrl }, { merge: true });
          if (statusEl) statusEl.textContent = "✅ Logo save ho gaya — sabhi students ke ID Card par turant dikhega.";
        } catch (err) {
          console.error(err);
          if (statusEl) statusEl.textContent = "❌ Logo save nahi hua: " + (err.message || err);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
  window.handleInstituteLogoChange = handleInstituteLogoChange;

  window.SavyaIdCard = {
    renderStudentIdCard,
    renderAdminIdCard,
    getOrAssignStudentSerial,
    computeAcademicSession,
    formatIdNumber
  };
})();
