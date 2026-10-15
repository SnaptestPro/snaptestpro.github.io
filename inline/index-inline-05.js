
  (function () {
    var SPLASH_DURATION_MS = 400; // PERF FIX v126: pehle 2200ms tha —
    // jabardasti har visit par 2.2s+ wait karwata tha chahe content
    // turant ready ho. LCP/Speed Index dono is fixed delay ki wajah se
    // seedha 2.2s+ se start hote the. Ab sirf ek chhota "brand flash"
    // (400ms) — content jitni jaldi ready ho utni jaldi dikhta hai.
    // PERF FIX v127: pehle "DOMContentLoaded" ka wait karta tha — jo
    // is script se BAAD wale saare `<script defer>` (4 Firebase SDK
    // files + script.js 232 KB + 10+ aur files) poori tarah
    // download+execute hone ke baad hi fire hota hai. Splash us poori
    // chain ke khatam hone tak screen ko block kiye rakhta tha (LCP
    // 9+ second tak chala jaata tha), jabki splash hatane ke liye in
    // mein se kisi bhi file ki zaroorat nahi hai — yeh apna khud ka
    // fixed-timer hai. Ab seedha turant (is inline script ke chalte
    // hi) apna 400ms ka timer shuru karta hai.
    (function () {
      // v143: splash tab hi hatao jab styles.css load ho chuki ho (max 8s). Pehle sirf 400ms ka
      // timer tha — slow load (app ya slow net) me splash hatne ke baad kuch second bina design ka
      // plain text dikhta tha.
      var t0 = Date.now();
      function hideSplash() {
        var el = document.getElementById("app-splash-screen");
        if (!el) return;
        el.style.opacity = "0";
        setTimeout(function () { el.remove(); }, 500);
      }
      function tick() {
        var waited = Date.now() - t0;
        if (waited >= SPLASH_DURATION_MS && (window.__stylesReady || waited >= 8000)) hideSplash();
        else setTimeout(tick, 50);
      }
      setTimeout(tick, SPLASH_DURATION_MS);
    })();
  })();
