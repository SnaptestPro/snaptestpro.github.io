# v230 — Admit Card + Roster + Scan Verification

## Flow
1. Exam banayein (Exam Manager). Exam details me naya button **🎫 Admit Card & Roster**.
2. Students chunein (class ke / saare / mobile paste) -> **Roll No + Set automatic** (naam ke order me; profile Roll Number numeric+unique ho to wahi).
3. Time / Venue / Instructions bharein -> **🚀 Publish**: har student ko `studentAdmitCards/{exam}_{mobile}` doc milta hai.
4. Student app -> dashboard **🎫 Admit Card** -> dekhein / Download / Print / Share (offline cache hota hai). Admin **📄 Sab ke Print (PDF)** (A4 par 2 card) aur WhatsApp button bhi.
5. Sheet scan karte waqt roll roster se match hota hai:
   - ✅ Verified: naam + photo dikhta hai, save par student se **auto-link** (result student ke login me).
   - ⚠️ Set admit card se alag / set bubble nahi / duplicate roll / OCR naam mel nahi khata -> auto-save ruk jata hai.
   - ❌ Roll registered nahi / roll nahi padha -> Save par confirm (roll unreadable par block). Override karne par result `anomaly` ke saath save.
6. Panel ke section 3 me: scanned/absent, anomalies list, **Absentees auto-fill**, **Attendance CSV**.

## Files
Naye: `exam-roster.js` (admin, lazy: exam-manager ke saath), `admit-card.js` (student + shared renderer), `tests/unit/test_roster_admit_v230.js`.
Badle: `exam-manager.js` (13 chhote hooks, `window.SnapRoster` na ho to purana behaviour), `index.html`, `inline/index-inline-06.js`, `sw.js`, `exam-manager.css`, `app-config.js` (kill-switch `roster`, `admitCard`), `firestore.rules`.

## ZAROORI deploy steps
1. **Firestore rules publish karein** (firestore.rules) — warna roster save aur admit card publish "permission denied" dega.
2. Changed files GitHub par upload; `npm run stamp` se version/cache bump (sw.js precache me 2 nayi files judi hain).
3. Pages deploy ke baad Settings -> "Cache saaf karke refresh".

## Limits / dhyan
- Max 3000 students per exam (roster ek doc). Roster = 1 read per scan session; admit card = student ka 1 query/din.
- Purane roll kabhi renumber nahi hote (card chhap chuke hote hain); hataya hua roll dobara use nahi hota.
- Exam Settings me Roll digits badle to panel "Roll dobara banayein" dikhata hai, phir Publish dobara karein.
- OCR naam check sirf tab chalta hai jab Scan settings me name-OCR ON ho; Devanagari naam par kabhi alarm nahi.
- Admit card sirf us student ko padhne yogya jiska mobile match kare (rules studentScanReports jaisa trust model).
- Test: `npm test` 43/43 passed. Asli phone/Firebase/camera par nahi chala — pehle ek demo exam se try karein.
