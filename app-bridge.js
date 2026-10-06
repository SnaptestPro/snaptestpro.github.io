/* v145 — Android app (Capacitor WebView) bridge. Website (browser) par ye kuch nahi karta.
   1) File download: blob:/data: download links (Word, OMR, PDF, Excel...) -> phone me save + Share sheet
   2) Back button: andar peeche jao, home par 2 baar Back = app band
   3) window.print(): WebView me chalta nahi — saaf message dikhata hai
   Native plugins (Filesystem/Share/App) ko Capacitor.nativePromise / nativeCallback se bulata hai
   (remote site par Capacitor.Plugins.* nahi hota). */
(function () {
  "use strict";
  var ua = navigator.userAgent || "";
  function getCap() {
    var w = [window]; try { if (window.parent && window.parent !== window) w.push(window.parent); } catch (e) {}
    try { if (window.top) w.push(window.top); } catch (e) {}
    for (var i = 0; i < w.length; i++) { try { var c = w[i].Capacitor; if (c && typeof c.nativePromise === "function") return c; } catch (e) {} }
    return null;
  }
  var isApp = !!(getCap() || /SnapTestProApp/.test(ua) || /; wv\)/.test(ua));
  window.__IS_APP = window.__IS_APP || isApp;
  if (!isApp) return;
  try { document.documentElement.classList.add("is-app"); } catch (e) {}

  function toast(msg) {
    try {
      var b = document.createElement("div"); b.textContent = msg;
      b.style.cssText = "position:fixed;left:50%;bottom:30px;transform:translateX(-50%);background:#1e1b4b;color:#fff;padding:11px 20px;border-radius:24px;font-size:.85rem;z-index:2147483647;box-shadow:0 6px 18px rgba(0,0,0,.35);max-width:88vw;text-align:center;pointer-events:none;";
      (document.body || document.documentElement).appendChild(b); setTimeout(function () { b.remove(); }, 2200);
    } catch (e) {}
  }

  /* ---------- 1) FILE DOWNLOADS ---------- */
  function toBase64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(",")[1] || ""); };
      r.onerror = function () { rej(r.error || new Error("File padh nahi payi")); };
      r.readAsDataURL(blob);
    });
  }
  async function saveNative(href, name) {
    var C = getCap();
    if (!C) { toast("❌ File save nahi ho payi (app plugin nahi mila). App ka naya version install karein."); return; }
    var safe = String(name || "file").replace(/[\\\/:*?"<>|]+/g, "_").trim() || "file";
    try {
      toast("⏳ File taiyaar ho rahi hai...");
      var blob = await (await fetch(href)).blob();
      var data = await toBase64(blob);
      var w = await C.nativePromise("Filesystem", "writeFile", { path: "exports/" + safe, data: data, directory: "CACHE", recursive: true });
      await C.nativePromise("Share", "share", { title: safe, text: safe, url: w.uri, dialogTitle: "File save / share karein" });
    } catch (e) {
      var m = (e && (e.message || e.errorMessage)) || String(e);
      if (/cancel/i.test(m)) return;           // user ne share sheet band kar di
      console.error("native save failed", e);
      toast("❌ File save nahi hui: " + m);
    }
  }
  function isDl(a) {
    return a && a.tagName === "A" && a.hasAttribute("download") && /^(blob:|data:)/i.test(a.href || "");
  }
  var origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (isDl(this)) { saveNative(this.href, this.getAttribute("download")); return; }
    return origClick.apply(this, arguments);
  };
  var origDispatch = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function (ev) {
    if (ev && ev.type === "click" && isDl(this)) { saveNative(this.href, this.getAttribute("download")); return true; }
    return origDispatch.apply(this, arguments);
  };
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[download]") : null;
    if (a && isDl(a)) { e.preventDefault(); e.stopPropagation(); saveNative(a.href, a.getAttribute("download")); }
  }, true);

  /* ---------- 3) PRINT ---------- */
  window.print = function () {
    try { if (window.AndroidPrint && typeof window.AndroidPrint.print === "function") { window.AndroidPrint.print(); return; } } catch (e) {}
    toast("🖨️ Print app me abhi nahi chalta — Word (.docx) file download karke print karein");
  };

  /* ---------- 2) BACK BUTTON (sirf main window) ---------- */
  if (window.top !== window) return;
  var last = 0, tries = 0;
  function attachBack() {
    var C = getCap();
    if (!C || typeof C.nativeCallback !== "function") { if (++tries < 40) setTimeout(attachBack, 250); return; }
    C.nativeCallback("App", "addListener", { eventName: "backButton" }, function (ev) {
      if (ev && ev.canGoBack) { history.back(); return; }
      var now = Date.now();
      if (now - last < 2000) { try { C.nativeCallback("App", "exitApp", {}); } catch (e) {} return; }
      last = now; toast("⬅️ App band karne ke liye dobara Back dabayein");
    });
  }
  attachBack();
})();
