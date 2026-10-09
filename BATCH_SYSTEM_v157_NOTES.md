# Batch Management System (v157) — Phase 1

## Nayi files
batch-system.js, batch-system.css (+ index.html me 2 lines, sw.js cache, firestore.rules me batches block)

## Owner ko karna hai
1. Firebase Console -> Firestore -> Rules -> firestore.rules paste -> Publish (zaroori, warna "permission-denied").
2. GitHub par saari files upload (batch-system.js/.css, index.html, sw.js, firestore.rules).
3. Admin -> Dashboard -> "Batch Management" card.

## Kya kaam karta hai
Admin: Dashboard (real counts), Batch CRUD (activate/deactivate, safe delete), Live Class schedule + Go Live / End,
Recorded Lectures (Processing -> Ready -> Published/Unpublished/Failed/Retry), Notes & Study Material, PPT,
Announcements, Students enrollment (limit check), audit logs.
Student: bottom nav "Batch" + Home card: My Batches, Live Now/Join, tabs (Overview, Live, Recorded, Notes,
Study Material, PPT, Tests link, Announcements), in-app viewer.

## Jaan-boojh kar alag (free tier / architecture)
- Files Firebase Storage me nahi: Drive/YouTube/https link (Storage = paid plan).
- Live = Jitsi (meet.jit.si, config liveDomain se badal sakte hain). Automatic recording NAHI hoti: class end par recording
  "Processing" banti hai, admin link jodta hai tab "Ready". Auto-recording ke liye paid provider + Cloud Functions (Blaze) chahiye.
- Student security: students anonymous-auth hain, isliye rules "student kis batch ka member hai" verify nahi kar sakte. Admin-side
  isolation (write + draft read) server-side enforced hai; student-side client-trusted (app ka purana design).
- Pending (Phase 2): Assignments/Doubts, batch-wise test assign, Reports page, teacher accounts, batch-wise push, 2-institute rules test.
