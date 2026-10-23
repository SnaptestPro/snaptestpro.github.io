# v236 — Admin dashboard se 📊 Read-Meter hata diya (build 232)

## Kya hata
- `read-meter.js` poori delete (dev-only reads counter, dashboard par 📊 button + dark panel).
- index.html se script tag, sw.js precache se entry hata di. Firestore get/onSnapshot par wrapper bhi band => thoda halka.

## Panel ki cheezein kahan gayi
- Bank refresh  -> Admin Settings -> Data (pehle se tha)
- Bank publish  -> Admin Settings -> Data (pehle se tha) + AUTO: question change ke ~45 sec baad apne-aap
- Bank export   -> Admin Settings -> Data me NAYA row "Bank backup (export)"
- Reads table / Reset -> hata (admin ke kaam ka nahi)

## Files
index.html, sw.js, admin-settings-pro.js, version.json, app-config.js (+ read-meter.js delete)

## Check
node --check OK, check-precache OK (99 entries), unit tests 44/46 (2 purane fail same: test_apk_brand_v222, test_branding2_v221).

## v237 (sirf packaging)
- Zip me ab `.github/workflows/` ki 6 files hain (build-institute-apk, build-owner-apk, build-android, announce-update, ci, auto-extract).
- auto-extract.yml naya: repo secret `WORKFLOW_PAT` ho to zip ke saath workflows bhi extract+push hote hain; na ho to pehle jaisa (.github skip).
- DELETE_THESE.txt me read-meter.js joda (zip se file delete nahi hoti, GitHub par haath se delete karo).
