# Scan Sheet — stable-hold capture, auto-retry, lighter camera (v204)

Report: 10 scans mein se sirf 1-2 sahi; 4 corners mil jaane ke baad 1-2 sec se zyada nahi lagna chahiye; camera lag nahi.

## Root cause
v21 ne capture trigger 1 frame kar diya tha: jis tick par 4 corners pehli baar green hue, usi frame (hilta haath, focus hunting, blur)
par photo le li jaati thi, aur corner positions ek hi frame ki raw read thi.

## Changes (exam-manager.js, Ct / Fn / Fn2)
- **Stable-hold gate:** capture tab hota hai jab 4 corners *fresh* detect hon aur ~0.9s (`_HOLD`) tak steady rahein
  (tick-to-tick movement <= 0.45% of frame width, window spread <= 0.9%). Hilne par hold wahin se restart.
  Sharp frame (`_shOk`) chahiye; nahi mile to +0.6s baad bhi capture (kabhi atakta nahi).
- **Shaky hand fallback:** 1.2s se zyada 4 corners dikhte rahein to tolerance 1% tak relax -> worst case ~2.5s.
- **Averaging:** corner position ab last 6 stable ticks ka average (`kn` 4 -> 6); grace ticks average mein nahi jaate.
- **Corner refine:** video-frame fallback mein bhi corners capture-resolution par `aa()` se re-detect hote hain (`_refinePts`).
- **Auto-retry:** agar warp ke baad registration squares < 30/45 (`sa`) to result dikhane ki jagah scanner khud dobara chalta hai
  (max 2 baar), warning message ke saath.
- **Camera lag:** full-size frame snapshot ab sirf stable window mein (har tick nahi) aur GPU canvas par; preview stream 1440x1920
  (final image HQ photo se aati hai, fallback ke liye 1440 wide kaafi hai).
- Test: `tests/unit/test_scan_stable_hold.js`. Tuning knobs: `_HOLD`, `.0045` / `.01` tolerances in `Ct()`.

---
## v205 — 3 corners enough + 45-square refit
- **3 corner trigger:** ab min 3 corners fresh detect hon to 4th corner sheet ke parallelogram se nikal liya jata hai (`vn()`), UI mein 4th box bhi green.
  Hold `_HOLD` 900 -> 500ms (3 ya 4 corners dono par). Hilne par restart / sharpness gate / auto-retry waise hi.
- **45-square refit (`_warp2`):** pehli warp ke baad jitne bhi registration squares (corner bhi grid ka hissa hain) mile, unse sheet->photo
  homography least-squares se dobara fit hoti hai (outlier trim ke saath) aur photo dobara warp hoti hai. Sirf tab apply jab squares >= pehle jitne
  aur mean offset kam ho — warna purani warp. Synthetic test: 4th corner 90px galat hone par bhi 45/45 squares align.
- Inferred corner ke liye `_refinePts` / HQ-photo re-detect ka tolerance wide (4%).
- Tests: `test_scan_stable_hold.js` (3-corner cases), `test_scan_refit_45.js` (refit maths + perspective photo).
