(function () {
  "use strict";
  // v125: "3D Solids Lab" — poora React + Three.js widget hai (student ne
  // diya hua solids_lab.jsx). App khud React/build-tool use nahi karta,
  // isliye is widget ke liye hi (aur sirf tabhi jab koi ise kholta hai)
  // React, ReactDOM, Three.js aur Babel-standalone alag se load hoti hain
  // (__ensureLib se, index.html ke LIBS map mein "solidsLab" key dekhein).
  // Yeh chaaron files kabhi bhi eager load nahi hotin — normal
  // student/admin flow (test dena, bank, records...) par koi asar nahi
  // padta, bilkul waise hi jaise exam-manager.js/owner-panel.js ab lazy
  // hain.
  //
  // Babel-standalone yahan sirf is EK component ke liye JSX ko browser
  // mein hi (on-demand, ek hi baar) plain JS mein badalta hai — koi
  // pre-built bundle available nahi tha (is sandbox mein na npm chala na
  // internet), isliye yeh sabse safe tarika tha original code ko BINA
  // haath lagaye (copy-paste galtiyon ke risk ke bina) chalane ka.

  var CSS_ID = "solids-lab-mini-css";
  var bootPromise = null;
  var roots = new Map(); // container element -> ReactDOM root (taaki dobara khulne par purana root reuse/unmount ho sake)

  function injectCssOnce() {
    if (document.getElementById(CSS_ID)) return;
    var style = document.createElement("style");
    style.id = CSS_ID;
    // Component ke andar Tailwind-jaisi utility classNames use hui hain
    // (flex, gap-2, grid-cols-2, waghera) — poora Tailwind load karne ki
    // jagah, sirf yehi ~25 exact utilities jo is widget mein chahiye,
    // ".solids-lab-root" ke andar scoped — baaki site par koi asar nahi.
    style.textContent =
      ".solids-lab-root{box-sizing:border-box}" +
      ".solids-lab-root *{box-sizing:border-box}" +
      ".solids-lab-root .flex{display:flex}" +
      ".solids-lab-root .flex-1{flex:1 1 0%}" +
      ".solids-lab-root .flex-col{flex-direction:column}" +
      ".solids-lab-root .flex-shrink-0{flex-shrink:0}" +
      ".solids-lab-root .items-center{align-items:center}" +
      ".solids-lab-root .justify-between{justify-content:space-between}" +
      ".solids-lab-root .gap-1{gap:.25rem}" +
      ".solids-lab-root .gap-1\\.5{gap:.375rem}" +
      ".solids-lab-root .gap-2{gap:.5rem}" +
      ".solids-lab-root .gap-3{gap:.75rem}" +
      ".solids-lab-root .grid{display:grid}" +
      ".solids-lab-root .grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}" +
      ".solids-lab-root .h-full{height:100%}" +
      ".solids-lab-root .w-full{width:100%}" +
      ".solids-lab-root .max-h-64{max-height:16rem}" +
      ".solids-lab-root .min-h-0{min-height:0px}" +
      ".solids-lab-root .mt-1\\.5{margin-top:.375rem}" +
      ".solids-lab-root .mt-2{margin-top:.5rem}" +
      ".solids-lab-root .overflow-hidden{overflow:hidden}" +
      ".solids-lab-root .overflow-y-auto{overflow-y:auto}" +
      ".solids-lab-root .p-3{padding:.75rem}" +
      ".solids-lab-root .px-4{padding-left:1rem;padding-right:1rem}" +
      ".solids-lab-root .py-3{padding-top:.75rem;padding-bottom:.75rem}" +
      ".solids-lab-root .rounded-lg{border-radius:.5rem}" +
      ".solids-lab-root .border{border-width:1px;border-style:solid}" +
      ".solids-lab-root .border-slate-700{border-color:#334155}" +
      ".solids-lab-root .block{display:block}" +
      "@media (min-width:768px){" +
      ".solids-lab-root .md\\:w-72{width:18rem}" +
      ".solids-lab-root .md\\:flex-row{flex-direction:row}" +
      ".solids-lab-root .md\\:max-h-none{max-height:none}" +
      "}";
    document.head.appendChild(style);
  }

  function loadComponentOnce() {
    if (bootPromise) return bootPromise;
    bootPromise = fetch("solids-lab-source.jsx")
      .then(function (res) {
        if (!res.ok) throw new Error("solids-lab-source.jsx fetch failed: " + res.status);
        return res.text();
      })
      .then(function (jsxSource) {
        var compiled = window.Babel.transform(jsxSource, { presets: ["react"] }).code;
        // eslint-disable-next-line no-new-func
        new Function(compiled)(); // sets window.SolidsLab
        if (typeof window.SolidsLab !== "function") throw new Error("SolidsLab component load nahi hua");
      });
    return bootPromise;
  }

  // container: woh DOM element jiske andar widget dikhana hai.
  window.mountSolidsLab = function (container) {
    if (!container) return Promise.resolve();
    injectCssOnce();
    return loadComponentOnce().then(function () {
      if (roots.has(container)) return; // pehle se mounted hai, dobara na karo
      var root = window.ReactDOM.createRoot(container);
      root.render(window.React.createElement(window.SolidsLab));
      roots.set(container, root);
    }).catch(function (err) {
      console.error("[SolidsLab] mount failed", err);
      container.innerHTML =
        '<p class="muted-text">3D Solids Lab load nahi ho paya. Internet connection check karke page reload karein.</p>';
    });
  };

  // Section band karte waqt (dusre tab/section par jaate waqt) call karo —
  // WebGL context aur animation-loop ko saaf tarike se rok deta hai,
  // warna baar-baar khulne par purane contexts memory mein jama hote
  // rehte (browser "too many WebGL contexts" warning de sakta hai).
  window.unmountSolidsLab = function (container) {
    if (!container || !roots.has(container)) return;
    var root = roots.get(container);
    try { root.unmount(); } catch (e) { /* ignore */ }
    roots.delete(container);
  };
})();
