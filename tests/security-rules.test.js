/* SnapTest Pro v168 — Security rules tests (Master prompt Rule 7)
   Chalane ke liye (aapke computer par, Java 11+ chahiye):
     npm i -D firebase-tools @firebase/rules-unit-testing firebase
     npx firebase emulators:exec --only firestore,storage "node tests/security-rules.test.js"
   (firebase.json me emulators port optional; default 8080/9199 chalte hain)
   NOTE: ye file mere sandbox me CHALAYI NAHI GAYI (emulator download network se blocked tha) — pehli baar aap chalake dekhein. */
const fs = require("fs");
const assert = require("assert");
const { initializeTestEnvironment, assertSucceeds, assertFails } = require("@firebase/rules-unit-testing");

const A = "inst_A", B = "inst_B", PA = `institutes/${A}`, PB = `institutes/${B}`;
let env, passed = 0, failed = 0;
async function t(name, fn) { try { await fn(); passed++; console.log("  ✅", name); } catch (e) { failed++; console.log("  ❌", name, "\n     ", (e && e.message || e).toString().split("\n")[0]); } }

(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-snaptest",
    firestore: { rules: fs.readFileSync("firestore.rules", "utf8") },
    storage: { rules: fs.readFileSync("storage.rules", "utf8") },
  });

  /* ---------- seed (rules bypass) ---------- */
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore(), set = (p, d) => db.doc(p).set(d);
    await set(`institutes/${A}`, { name: "A", active: true }); await set(`institutes/${B}`, { name: "B", active: true });
    await set("admins/adminA@x.com", { active: true, instituteId: A }); await set("admins/adminB@x.com", { active: true, instituteId: B });
    for (const [P, I] of [[PA, A], [PB, B]]) {
      await set(`${P}/batches/b1`, { name: "Batch", instituteId: I, published: true, status: "active", enrolledCount: 1 });
      await set(`${P}/batches/b1/items/n1`, { kind: "note", title: "Notes", published: true, instituteId: I, batchId: "b1" });
      await set(`${P}/batches/b1/items/draft`, { kind: "note", title: "Draft", published: false, instituteId: I, batchId: "b1" });
      await set(`${P}/batches/b1/files/f1`, { name: "x.pdf", chunks: 1 }); await set(`${P}/batches/b1/files/f1/parts/0`, { i: 0, data: "AA" });
      await set(`${P}/batches/b1/subjects/s1`, { name: "Maths", status: "active", instituteId: I, batchId: "b1" });
      await set(`${P}/batches/b1/assignments/a1`, { title: "HW", published: true, instituteId: I, batchId: "b1" });
    }
    await set(`${PA}/batches/b1/members/9999`, { name: "Rahul" });          // 9999 = A ka enrolled student
    await set("students/9999", { name: "Rahul", instituteId: A, batchIds: ["b1"] });
    await set("students/7777", { name: "NotEnrolled", instituteId: A, batchIds: [] });
    await set("students/8888", { name: "Other", instituteId: B, batchIds: [] });
    for (const m of ["9999", "7777", "8888"]) await set(`studentSecrets/${m}`, { hash: "h" + m });
    await set(`${PA}/batchSettings/security`, { strict: true });             // A strict ON
    await set(`${PB}/batchSettings/security`, { strict: false });            // B strict OFF (legacy)
    await set("studentSessions/uid9999", { mobile: "9999", proof: "h9999" });
    await set("studentSessions/uid7777", { mobile: "7777", proof: "h7777" });
    await set("studentSessions/uid8888", { mobile: "8888", proof: "h8888" });
  });
  const adminA = env.authenticatedContext("ua", { email: "adminA@x.com" }).firestore();
  const adminB = env.authenticatedContext("ub", { email: "adminB@x.com" }).firestore();
  const stuA = env.authenticatedContext("uid9999").firestore();            // enrolled, A
  const stuNotEnrolled = env.authenticatedContext("uid7777").firestore();  // A student, batch ka member nahi
  const stuB = env.authenticatedContext("uid8888").firestore();            // doosre institute ka
  const anon = env.authenticatedContext("nosession").firestore();          // session hi nahi
  const logged = env.unauthenticatedContext().firestore();
  const col = (db, p) => db.collection(p), d = (db, p) => db.doc(p);

  console.log("\nAdmin isolation");
  await t("Admin A apne batch ke draft item padh sakta hai", () => assertSucceeds(d(adminA, `${PA}/batches/b1/items/draft`).get()));
  await t("Admin A apne institute me item bana sakta hai", () => assertSucceeds(d(adminA, `${PA}/batches/b1/items/new1`).set({ kind: "note", title: "N", published: false, instituteId: A, batchId: "b1" })));
  await t("Admin A, Institute B ka draft NAHI padh sakta", () => assertFails(d(adminA, `${PB}/batches/b1/items/draft`).get()));
  await t("Admin A, Institute B ka batch NAHI badal sakta", () => assertFails(d(adminA, `${PB}/batches/b1`).update({ name: "hacked" })));
  await t("Admin A, Institute B me item NAHI bana sakta", () => assertFails(d(adminA, `${PB}/batches/b1/items/x`).set({ kind: "note", title: "x", published: true, instituteId: B, batchId: "b1" })));
  await t("Admin A, Institute B ka subject/teacher/doubt NAHI bana/padh sakta", async () => {
    await assertFails(d(adminA, `${PB}/batches/b1/subjects/hack`).set({ name: "H", status: "active", instituteId: B, batchId: "b1" }));
    await assertFails(d(adminA, `${PB}/teachers/t1`).set({ name: "T", instituteId: B }));
    await assertFails(d(adminA, `${PB}/batches/b1/doubts/x`).get());
  });
  await t("Admin A apne institute me subject + chapter bana sakta hai (parent-child)", async () => {
    await assertSucceeds(d(adminA, `${PA}/batches/b1/subjects/s2`).set({ name: "Science", status: "active", instituteId: A, batchId: "b1" }));
    await assertSucceeds(d(adminA, `${PA}/batches/b1/subjects/s2/chapters/c1`).set({ name: "Ch1", status: "active", instituteId: A, batchId: "b1", subjectId: "s2" }));
  });
  await t("Chapter galat subjectId ke saath REJECT", () => assertFails(d(adminA, `${PA}/batches/b1/subjects/s2/chapters/c2`).set({ name: "Ch2", status: "active", instituteId: A, batchId: "b1", subjectId: "WRONG" })));
  await t("Chapter nonexistent subject ke neeche REJECT", () => assertFails(d(adminA, `${PA}/batches/b1/subjects/ghost/chapters/c1`).set({ name: "Ch", status: "active", instituteId: A, batchId: "b1", subjectId: "ghost" })));
  await t("Admin A teacher profile bana sakta hai", () => assertSucceeds(d(adminA, `${PA}/teachers/t1`).set({ name: "Rohit", instituteId: A })));

  console.log("\nStudent identity (session) binding");
  await t("Sahi proof se session ban jata hai", () => assertSucceeds(env.authenticatedContext("newdev").firestore().doc("studentSessions/newdev").set({ mobile: "9999", proof: "h9999", at: require("firebase/firestore").serverTimestamp() })));
  await t("Galat proof se session REJECT", () => assertFails(env.authenticatedContext("dev2").firestore().doc("studentSessions/dev2").set({ mobile: "9999", proof: "WRONG", at: require("firebase/firestore").serverTimestamp() })));
  await t("Doosre uid ke naam par session REJECT", () => assertFails(env.authenticatedContext("dev3").firestore().doc("studentSessions/someoneElse").set({ mobile: "9999", proof: "h9999", at: require("firebase/firestore").serverTimestamp() })));
  await t("Session doc doosra user NAHI padh sakta", () => assertFails(d(stuB, "studentSessions/uid9999").get()));

  console.log("\nStudent access — Strict institute (A)");
  await t("Enrolled student published item padh sakta hai", () => assertSucceeds(d(stuA, `${PA}/batches/b1/items/n1`).get()));
  await t("Enrolled student draft NAHI padh sakta", () => assertFails(d(stuA, `${PA}/batches/b1/items/draft`).get()));
  await t("Unenrolled (same institute) student item NAHI padh sakta", () => assertFails(d(stuNotEnrolled, `${PA}/batches/b1/items/n1`).get()));
  await t("Unenrolled student batch ka header padh sakta hai (Available list), content nahi", async () => { await assertSucceeds(d(stuNotEnrolled, `${PA}/batches/b1`).get()); await assertFails(col(stuNotEnrolled, `${PA}/batches/b1/items`).where("published", "==", true).get()); });
  await t("Institute B ka student A ka batch/item/file NAHI padh sakta", async () => {
    await assertFails(d(stuB, `${PA}/batches/b1`).get()); await assertFails(d(stuB, `${PA}/batches/b1/items/n1`).get());
    await assertFails(d(stuB, `${PA}/batches/b1/files/f1`).get()); await assertFails(d(stuB, `${PA}/batches/b1/files/f1/parts/0`).get());
  });
  await t("Bina session wala signed-in user A ka content NAHI padh sakta (ID guess)", () => assertFails(d(anon, `${PA}/batches/b1/items/n1`).get()));
  await t("Logged-out (no auth) user kuch NAHI padh sakta", () => assertFails(d(logged, `${PA}/batches/b1/items/n1`).get()));
  await t("Enrolled student apni file chunks padh sakta hai", () => assertSucceeds(d(stuA, `${PA}/batches/b1/files/f1/parts/0`).get()));
  await t("Student kisi ka content likh/delete NAHI kar sakta", async () => { await assertFails(d(stuA, `${PA}/batches/b1/items/n1`).update({ title: "x" })); await assertFails(d(stuA, `${PA}/batches/b1/items/n1`).delete()); });
  await t("Student subjects (active) padh sakta hai, doosre institute ke nahi", async () => { await assertSucceeds(col(stuA, `${PA}/batches/b1/subjects`).where("status", "==", "active").get()); await assertFails(col(stuB, `${PA}/batches/b1/subjects`).where("status", "==", "active").get()); });

  console.log("\nDoubts / Assignments (private)");
  const fv = require("firebase/firestore").serverTimestamp;
  const doubt = (m) => ({ instituteId: A, batchId: "b1", subjectId: "s1", subject: "Maths", chapterId: "", chapter: "", mobile: m, name: "n", text: "help", status: "open", createdAt: fv() });
  await t("Member apna doubt bana sakta hai", () => assertSucceeds(d(stuA, `${PA}/batches/b1/doubts/d1`).set(doubt("9999"))));
  await t("Member doosre ke naam se doubt NAHI bana sakta", () => assertFails(d(stuA, `${PA}/batches/b1/doubts/d2`).set(doubt("7777"))));
  await t("Non-member doubt NAHI bana sakta", () => assertFails(d(stuNotEnrolled, `${PA}/batches/b1/doubts/d3`).set(doubt("7777"))));
  await t("Student apna doubt padh sakta hai", () => assertSucceeds(d(stuA, `${PA}/batches/b1/doubts/d1`).get()));
  await t("Doosra student/institute is doubt ko NAHI padh sakta", async () => { await assertFails(d(stuNotEnrolled, `${PA}/batches/b1/doubts/d1`).get()); await assertFails(d(stuB, `${PA}/batches/b1/doubts/d1`).get()); await assertFails(d(adminB, `${PA}/batches/b1/doubts/d1`).get()); });
  await t("Admin A jawab de sakta hai", () => assertSucceeds(d(adminA, `${PA}/batches/b1/doubts/d1`).update({ answer: "ok", status: "answered" })));
  await t("Student sirf status=resolved kar sakta hai, jawab edit NAHI", async () => { await assertSucceeds(d(stuA, `${PA}/batches/b1/doubts/d1`).update({ status: "resolved" })); await assertFails(d(stuA, `${PA}/batches/b1/doubts/d1`).update({ answer: "fake" })); });
  const sub = (m) => ({ mobile: m, name: "n", text: "ans", url: "", submittedAt: fv(), status: "submitted" });
  await t("Member apna submission kar sakta hai", () => assertSucceeds(d(stuA, `${PA}/batches/b1/assignments/a1/submissions/9999`).set(sub("9999"))));
  await t("Doosre ke naam se submission NAHI", () => assertFails(d(stuA, `${PA}/batches/b1/assignments/a1/submissions/7777`).set(sub("7777"))));
  await t("Doosra student submission NAHI padh sakta", () => assertFails(d(stuNotEnrolled, `${PA}/batches/b1/assignments/a1/submissions/9999`).get()));
  await t("Admin evaluate kar sakta hai; evaluate ke baad student badal NAHI sakta", async () => { await assertSucceeds(d(adminA, `${PA}/batches/b1/assignments/a1/submissions/9999`).update({ marks: 8, status: "evaluated" })); await assertFails(d(stuA, `${PA}/batches/b1/assignments/a1/submissions/9999`).set(sub("9999"))); });

  console.log("\nAttendance");
  await t("Verified session wali haziri v:true ke saath chalti hai", () => assertSucceeds(d(stuA, `${PA}/batches/b1/attendance/c1_9999`).set({ mobile: "9999", name: "n", itemId: "c1", joinedAt: fv(), v: true })));
  await t("Jhooth bolkar v:false (ya doosre ka mobile) REJECT", async () => { await assertFails(d(stuA, `${PA}/batches/b1/attendance/c1_9999`).set({ mobile: "9999", name: "n", itemId: "c1", joinedAt: fv(), v: false })); await assertFails(d(stuA, `${PA}/batches/b1/attendance/c1_7777`).set({ mobile: "7777", name: "n", itemId: "c1", joinedAt: fv(), v: true })); });
  await t("Student attendance list NAHI padh sakta; admin padh sakta hai", async () => { await assertFails(col(stuA, `${PA}/batches/b1/attendance`).get()); await assertSucceeds(col(adminA, `${PA}/batches/b1/attendance`).get()); });

  console.log("\nLegacy (Strict OFF, Institute B) — purana behaviour toota nahi");
  await t("B ka student B ka published item padh sakta hai (strict OFF)", () => assertSucceeds(d(stuB, `${PB}/batches/b1/items/n1`).get()));
  await t("Strict OFF me doubts band (private data)", () => assertFails(d(stuB, `${PB}/batches/b1/doubts/x`).set({ ...doubt("8888"), instituteId: B })));

  console.log("\nStorage");
  const stor = (ctx) => ctx.storage();
  const adminAs = env.authenticatedContext("ua", { email: "adminA@x.com" }), stuAs = env.authenticatedContext("uid9999"), stuBs = env.authenticatedContext("uid8888");
  await env.withSecurityRulesDisabled(async (c) => { await c.storage().ref(`batches/${A}/b1/file.pdf`).putString("hello"); });
  await t("Admin A apne path me upload kar sakta hai", () => assertSucceeds(stor(adminAs).ref(`batches/${A}/b1/new.pdf`).putString("x")));
  await t("Admin A, Institute B ke path me upload NAHI kar sakta", () => assertFails(stor(adminAs).ref(`batches/${B}/b1/evil.pdf`).putString("x")));
  await t("Enrolled student (strict) file padh sakta hai", () => assertSucceeds(stor(stuAs).ref(`batches/${A}/b1/file.pdf`).getMetadata()));
  await t("Doosre institute ka student A ki file NAHI padh sakta", () => assertFails(stor(stuBs).ref(`batches/${A}/b1/file.pdf`).getMetadata()));
  await t("Student upload NAHI kar sakta", () => assertFails(stor(stuAs).ref(`batches/${A}/b1/s.pdf`).putString("x")));

  await env.cleanup();
  console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
