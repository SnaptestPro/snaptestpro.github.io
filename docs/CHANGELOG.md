# Changelog

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
