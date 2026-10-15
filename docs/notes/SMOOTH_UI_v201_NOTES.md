# v1.4.7 / build 201 — Smooth UI (lag + overlay fix)

## Bugs fixed
1. **Batch / Analysis / More page ke peeche home page move hota tha**
   - Overlay `bottom:var(--snh)` (84px) par ruk jaata tha, neeche ki patti me home page dikhta + scroll hota tha.
   - Ab `#bm-student` aur `#sn-page` `bottom:0` tak jaate hain, nav ke liye `padding-bottom` hai.
   - `overscroll-behavior:contain` -> overlay ka scroll peeche leak nahi hota.
   - `html{scroll-behavior:smooth}` hata diya (scrollTo(0,0) animate hoke home ko ghumata tha).
   - `smooth-ui.js`: overlay khulte hi `html.sn-ovl` -> peeche ka page lock + paint band.
2. **Lag**
   - `.card` etc. par `backdrop-filter:blur(20px/8px)` (styles.css) hata diya — sabse bada scroll-lag.
   - `transition:all` + bouncy easing -> sirf transform/opacity/color/shadow.
   - Lambi lists par `content-visibility:auto`.
   - Wallpaper layer GPU par.
   - Background polling kam: batch hook 1.5s->2.5s, prefetch 5s->15s, rank 2.5s->8s, native-push 5s->15s, read-meter 2.5s->5s; sab sirf jab app visible ho.
3. Page khulne par halka (opacity+transform) animation.

## Files
New: `smooth-ui.css`, `smooth-ui.js`. Edited: `index.html`, `owner-app.html`, `batch-system.css/js`, `app-ui.css/js`, `native-push.js`, `read-meter.js`, `sw.js`, `scripts/build-www.js`, version files.

## Rollback
index.html se `smooth-ui.css` / `smooth-ui.js` ki line hata do -> purana look/behaviour (baaki edits chhote hain).
