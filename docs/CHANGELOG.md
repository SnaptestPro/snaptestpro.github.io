# Changelog

## 2026-10-17 — v217 Phase 1: YouTube Live (embed, attendance, recording, bulk paste)

- Go Live: `prompt()` ki jagah form; sirf 11-char `ytId` save (`youtube.com/live/ID`, `watch?v=ID`, `youtu.be/ID`).
- Student Join: `youtube-nocookie.com` embed app ke andar + "YouTube me kholein" fallback. Attendance purane `EXT.hooks.join` se (koi naya system nahi).
- End Class: `ytId` se recording item `ready` (unpublished) banta hai; admin dekhkar Publish kare.
- Naya admin view "Bulk YouTube Add" (`link | title | subject | chapter`, preview, 400 ke chunks me write, oEmbed se title best-effort).
- Institute Settings: `youtubeChannelUrl` (rules me sirf https youtube.com) + student dashboard par channel link (SnapBrand cache se, naya read nahi) + unlisted-link note.
- Kill-switch: `SNAP_CONFIG.youtubeLive=false` -> Phase 0 wala link-prompt. Version 1.4.12 / build 217.
- Deploy: `firestore.rules` dobara Publish karna hoga. Emulator test (`npm run test:rules`) chalaya nahi gaya.

## 2026-10-17 — v216 Phase 0: SnapLive hataya, live = sirf YouTube link

- Hataya: `own-live.js` (poori file), uska `<script>` (`index.html`), `sw.js` precache entry, `snapLive` flag (`app-config.js`), SnapLive CSS (`batch-system.css`), SnapLive ke `chat`/`hands` Firestore rules, Worker ka `handleLive` + `/live/*` route aur uske helper.
- `batch-system.js`: class form se SnapLive aur Jitsi (`inapp`) option hata; naya class hamesha link wali (`external`). Purani `inapp` live class dekhne ka raasta (`joinLive`) rakha; purani `own` class/recording par saaf message.
- `SnapFiles` (R2 `files/`) abhi **deprecated** mark: code rakha, `ownFiles:false`. R2 binding `LIVE_R2` Worker me SnapFiles ke liye rakhi hai.
- Version 1.4.11 / build 216. Details: `docs/notes/PHASE0_SNAPLIVE_REMOVAL_v216_NOTES.md`.
- Deploy nahi hua: web, Worker aur Firestore rules alag se deploy karne honge.

## 2026-10-15 — Phases 6–10 engineering pass

- Added required registration consent capture, Privacy/Terms pages, public deletion page, and authenticated student/institute-admin deletion in the canonical Worker.
- Moved historical `*_NOTES.md` and release notes to `docs/notes/`; moved setup guides to `docs/setup/`.
- Split the student question bank into class/subject chunks, added lazy loading and IndexedDB caching, standardized Worker sources and CI, and added secret scanning.
- Extracted inline CSS/JavaScript and introduced tested module facades and data-model/contributor documentation. The large legacy core is only partly formatted and modularized.
- Added labeled/zoom-friendly UI markup, static accessibility checks, axe/Lighthouse CI for seven screens, keyboard/mobile checks, and an accessibility score gate of 90. The local score is not measured because the local runner could not install the browser-audit packages or serve localhost.
- Added web/native App Check bootstrap, custom-role claims with email fallback, bounded result-page reads, error-report scrubbing, API-key guidance, Firestore limit documentation, and a dry-run-only-by-default export/restore drill.
- Bumped web app metadata to 1.4.5/build 195. Firebase Console provider setup/enforcement, API-key restrictions, custom-claim migration, native APK build, and an actual staging restore remain external operator steps; see [`AUDIT_RESULT.md`](../AUDIT_RESULT.md).
- All work remains local; no web, Android or Worker deployment was performed.

## Historical releases

Older release notes are preserved under [`docs/notes/`](notes/). They describe the code at the time they were written; check the current guides before using any deployment steps.
