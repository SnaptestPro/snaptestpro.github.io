/* v248  SnapTest Clipper panel (admin).
   - Clipper ke liye key banana / band karna
   - "Photo se test": gallery ki photo -> backend /api/clip -> AI -> PDF Drafts
   - PDF Draft ki original photo dekhna (SnapClip.showImage)
   Sab kuch apne backend (Render) se; Firebase ke reads nahi lagte. Popup kholna turant hota hai. */
(function (root) {
  "use strict";
  var ov = null;

  function base() { var c = root.SNAP_CONFIG && root.SNAP_CONFIG.ownBackend; return (c && c.enabled !== false && c.url) ? String(c.url).replace(/\/+$/, "") : ""; }
  function token() {
    try { var a = typeof getAuth === "function" ? getAuth() : null; return a && a.currentUser ? a.currentUser.getIdToken() : Promise.resolve(""); } catch (e) { return Promise.resolve(""); }
  }
  function headers(extra) {
    return token().then(function (t) {
      var h = Object.assign({}, extra || {});
      if (t) h.Authorization = "Bearer " + t;
      var b = root.SNAP_CONFIG && root.SNAP_CONFIG.build; if (b) h["X-App-Build"] = String(b);
      return h;
    });
  }
  function api(method, path, opts) {
    opts = opts || {};
    if (!base()) return Promise.reject(new Error("Apna backend chalu nahi hai (app-config me ownBackend)"));
    return headers(opts.headers).then(function (h) {
      return fetch(base() + path, { method: method, headers: h, body: opts.body }).then(function (r) {
        if (opts.blob && r.ok) return r.blob();
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) { var e = new Error((j && j.error) || ("HTTP " + r.status)); e.status = r.status; throw e; }
          return j;
        });
      });
    });
  }
  function el(tag, css, txt) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (txt != null) e.textContent = txt; return e; }
  function toast(msg, ms) {
    var t = el("div", "position:fixed;left:12px;right:12px;bottom:16px;z-index:100002;background:#0f172a;color:#fff;padding:12px 14px;border-radius:12px;font-size:.88rem;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.3)", msg);
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, ms || 5000);
  }
  function copy(txt, okMsg) {
    var done = function () { toast(okMsg || "Copy ho gaya ✅", 2500); };
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(txt).then(done, function () { fallback(); }); return; } } catch (e) {}
    fallback();
    function fallback() { var ta = el("textarea", "position:fixed;opacity:0"); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (e) { toast("Copy nahi hua — khud chuniye"); } ta.remove(); }
  }
  function close() { if (ov) { ov.remove(); ov = null; } document.body.style.overflow = ""; }
  function shell(title) {
    close(); document.body.style.overflow = "hidden";
    ov = el("div", "position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.55);display:flex;align-items:flex-end;justify-content:center");
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    var box = el("div", "background:#f8fafc;color:#0f172a;width:100%;max-width:640px;max-height:92vh;overflow:auto;border-radius:18px 18px 0 0;padding:14px 16px 20px;box-sizing:border-box");
    var head = el("div", "display:flex;align-items:center;justify-content:space-between");
    head.appendChild(el("div", "font-weight:800;font-size:1.05rem", title));
    var x = el("button", "border:0;background:#e2e8f0;border-radius:10px;padding:6px 12px;font-weight:700;cursor:pointer", "Band"); x.type = "button"; x.onclick = close; head.appendChild(x);
    box.appendChild(head); ov.appendChild(box); document.body.appendChild(ov);
    return box;
  }
  var BTN = "padding:10px 14px;border:0;border-radius:11px;font-weight:800;font-size:.9rem;cursor:pointer;";
  function when(d) { if (!d) return "kabhi nahi"; var t = new Date(d); return isNaN(t) ? "" : t.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }

  /* photo ko chhota karke (max 1600px, JPEG) bhejna: phone ka data aur AI ka kharch kam */
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error("Photo chhoti nahi hui")); }, "image/jpeg", 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("Photo khul nahi paayi")); };
      img.src = url;
    });
  }

  function open() {
    var box = shell("✂️ Clipper");
    var status = el("div", "margin-top:10px;padding:9px 11px;border-radius:10px;background:#e0e7ff;color:#3730a3;font-size:.85rem", "Check ho raha hai...");
    box.appendChild(status);

    /* 1) Photo se test */
    box.appendChild(el("div", "margin-top:16px;font-weight:800", "📷 Photo se sawal nikalo"));
    box.appendChild(el("div", "font-size:.8rem;color:#475569;margin-top:2px", "Kisi bhi sawal ki photo / screenshot chuniye. AI sawal banakar PDF Drafts me daal dega."));
    var file = el("input", "margin-top:8px;max-width:100%"); file.type = "file"; file.accept = "image/*";
    var go = el("button", BTN + "margin-top:8px;background:#4f46e5;color:#fff", "Bhejo"); go.type = "button";
    var res = el("div", "margin-top:8px;font-size:.85rem;white-space:pre-wrap");
    go.onclick = function () {
      var f = file.files && file.files[0]; if (!f) { toast("Pehle photo chuniye"); return; }
      go.disabled = true; res.style.color = "#334155"; res.textContent = "⏳ AI sawal padh raha hai (5-20 second)...";
      shrink(f).then(function (blob) { return api("POST", "/api/clip", { headers: { "Content-Type": "image/jpeg", "X-Clip-Source": "App photo" }, body: blob }); })
        .then(function (r) {
          res.style.color = r.count ? "#166534" : "#92400e";
          res.textContent = r.count ? ("✅ " + r.count + " sawal PDF Drafts me aa gaye.\nWahan se Edit / Bank / Test kar sakte hain.") : ("⚠️ " + (r.notes || "Photo me sawal nahi mila"));
          refresh();
        })
        .catch(function (e) { res.style.color = "#b91c1c"; res.textContent = "❌ " + (e.message || e); })
        .then(function () { go.disabled = false; });
    };
    box.append(file, go, res);

    /* 2) Clipper (phone app) ki key */
    box.appendChild(el("div", "margin-top:20px;font-weight:800", "📱 Clipper app ke liye key"));
    box.appendChild(el("div", "font-size:.8rem;color:#475569;margin-top:2px", "Phone me Clipper app me ye key aur Backend URL daalni hai. Key sirf ek baar dikhegi."));
    var row = el("div", "display:flex;gap:8px;margin-top:8px");
    var label = el("input", "flex:1;padding:9px 10px;border:1px solid #cbd5e1;border-radius:10px;font-size:.9rem"); label.type = "text"; label.placeholder = "Naam (jaise: Mera phone)"; label.maxLength = 60;
    var mk = el("button", BTN + "background:#0f766e;color:#fff", "Naya key"); mk.type = "button";
    row.append(label, mk); box.appendChild(row);
    var fresh = el("div", "margin-top:8px"); box.appendChild(fresh);
    mk.onclick = function () {
      mk.disabled = true;
      api("POST", "/api/clip/keys", { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: label.value.trim() }) })
        .then(function (k) {
          fresh.textContent = "";
          var card = el("div", "padding:10px;border:2px dashed #0f766e;border-radius:12px;background:#ecfdf5;font-size:.82rem");
          card.appendChild(el("div", "font-weight:800;color:#065f46", "✅ Key ban gayi — abhi copy kar lijiye (dobara nahi dikhegi)"));
          [["Backend URL", base()], ["Clip key", k.key]].forEach(function (p) {
            var r = el("div", "margin-top:8px"); r.appendChild(el("div", "font-weight:700", p[0]));
            var v = el("div", "word-break:break-all;font-family:monospace;background:#fff;border:1px solid #a7f3d0;border-radius:8px;padding:6px 8px;margin-top:2px", p[1]);
            var b = el("button", BTN + "margin-top:4px;padding:6px 12px;background:#065f46;color:#fff", "Copy"); b.type = "button"; b.onclick = function () { copy(p[1]); };
            r.append(v, b); card.appendChild(r);
          });
          fresh.appendChild(card); label.value = ""; refresh();
        })
        .catch(function (e) { toast("Key nahi bani: " + (e.message || e), 6000); })
        .then(function () { mk.disabled = false; });
    };
    var list = el("div", "margin-top:10px"); box.appendChild(list);

    function refresh() {
      api("GET", "/api/clip/keys").then(function (j) {
        status.textContent = (j.aiConfigured ? "✅ AI chalu" : "❌ AI abhi band: Render me ANTHROPIC_API_KEY daalni hai") + "  •  Aaj: " + j.usedToday + " / " + j.dailyLimit + " photo";
        status.style.background = j.aiConfigured ? "#dcfce7" : "#fee2e2"; status.style.color = j.aiConfigured ? "#166534" : "#991b1b";
        list.textContent = "";
        (j.keys || []).forEach(function (k) {
          var r = el("div", "display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-top:1px solid #e2e8f0;font-size:.82rem");
          var t = el("div", "min-width:0"); t.appendChild(el("div", "font-weight:700", (k.label || "Key") + (k.revoked ? "  (band)" : "")));
          t.appendChild(el("div", "color:#64748b", "Aakhri use: " + when(k.last_used_at) + " • " + (k.uses || 0) + " baar")); r.appendChild(t);
          if (!k.revoked) { var b = el("button", BTN + "padding:6px 10px;background:#fee2e2;color:#991b1b", "Band karein"); b.type = "button";
            b.onclick = function () { if (!confirm("Ye key band karein? Is key wala Clipper phone kaam nahi karega.")) return; api("DELETE", "/api/clip/keys/" + k.id).then(refresh).catch(function (e) { toast("Band nahi hua: " + e.message); }); };
            r.appendChild(b); }
          list.appendChild(r);
        });
      }).catch(function (e) { status.textContent = "❌ " + (e.message || e); status.style.background = "#fee2e2"; status.style.color = "#991b1b"; });
    }
    refresh();
  }

  function showImage(id) {
    if (!id) return;
    toast("⏳ Photo la raha hu...", 2000);
    api("GET", "/api/clip/image/" + encodeURIComponent(id), { blob: true }).then(function (blob) {
      var url = URL.createObjectURL(blob), box = shell("🖼️ Original photo");
      var im = el("img", "width:100%;margin-top:10px;border-radius:10px;border:1px solid #e2e8f0"); im.src = url; im.alt = "Clip ki original photo";
      box.appendChild(im);
      var cur = ov, obs = new MutationObserver(function () { if (!cur.isConnected) { URL.revokeObjectURL(url); obs.disconnect(); } });
      obs.observe(document.body, { childList: true });
    }).catch(function (e) { toast("Photo nahi mili: " + (e.message || e), 6000); });
  }

  root.SnapClip = { open: open, showImage: showImage };
})(window);
