/* SnapLive (v168) — apna live class + recording system. Jitsi/Zoom/Meet ki zaroorat nahi.
   Kaise: teacher ka device camera/screen+mic ko MediaRecorder se record karta hai, har ~3 sec ka segment Worker (/live/seg) ke through
   R2 me upload hota hai. Students live.json (manifest) poll karke segments MSE se chalate hain (~8-12 sec delay). Class khatam hone par
   wahi segments recording ban jate hain (seek ke saath) — alag se kuch upload/convert nahi karna.
   Limits (jaan-boojh kar): one-to-many (teacher bolta hai, students dekhte hain); student ka mic/camera nahi — sawal chat / raise-hand se.
   Chrome/Android (APK) par chalta hai; iPhone Safari par MSE-WebM nahi hota. Recording tabhi "ready" jab saare segments upload ho chuke hon. */
(function () {
  "use strict";
  if (window.SnapLive) return;
  var SEG_MS = 3000;

  /* ---------- small helpers ---------- */
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (x) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[x]; }); }
  function mk(html) { var d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstChild; }
  function WK() { var c = window.SNAP_CONFIG || {}; return String(c.workerUrl || "https://cool-thunder-a280.vishnu1234stm.workers.dev").replace(/\/+$/, ""); }
  function token() { var u = window.firebase && firebase.auth && firebase.auth().currentUser; return u && u.getIdToken ? u.getIdToken() : Promise.reject(new Error("Admin login chahiye")); }
  function api(path, body) {
    path += body && body.key ? (path.indexOf("?") < 0 ? "?" : "&") + "key=" + body.key : "";
    return token().then(function (t) { return fetch(WK() + path, { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify(body || {}) }); })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || j.ok === false) throw new Error(j.error || "HTTP " + r.status); return j; }); });
  }
  function fmt(ms) { var s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); s = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0"); }
  function pickMime() {
    if (!window.MediaRecorder) return "";
    var c = ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm"];
    for (var i = 0; i < c.length; i++) if (MediaRecorder.isTypeSupported(c[i])) return c[i];
    return "";
  }
  function mseMime(m) { var x = /codecs=([^;]+)/i.exec(m || ""); return 'video/webm; codecs="' + (x ? x[1].replace(/"/g, "") : "vp8,opus") + '"'; }
  function supported(m) { return !!(window.MediaSource && MediaSource.isTypeSupported && MediaSource.isTypeSupported(mseMime(m))); }
  function findCluster(u8) { for (var i = 0; i + 3 < u8.length; i++) if (u8[i] === 0x1F && u8[i + 1] === 0x43 && u8[i + 2] === 0xB6 && u8[i + 3] === 0x75) return i; return -1; }
  function trimToCluster(buf) { var u = new Uint8Array(buf), i = findCluster(u); return i < 0 ? null : (i === 0 ? buf : buf.slice(i)); }
  function getBuf(u) { return fetch(u, { cache: "force-cache" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.arrayBuffer(); }); }
  function getJson(u) { return fetch(u + (u.indexOf("?") < 0 ? "?" : "&") + "cb=" + Date.now(), { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }); }
  function toast(c, m) { try { c && c.toast ? c.toast(m) : console.log(m); } catch (e) {} }

  /* ---------- MSE engine ---------- */
  function Engine(video, mime) {
    var me = this; me.v = video; me.q = []; me.ms = new MediaSource(); me.started = false;
    video.src = URL.createObjectURL(me.ms);
    me.ms.addEventListener("sourceopen", function () {
      if (me.sb) return;
      me.sb = me.ms.addSourceBuffer(mime); me.sb.mode = "segments";
      me.sb.addEventListener("updateend", function () { me.afterUpdate(); me.pump(); me.onupd && me.onupd(); });
      me.ready = true; me.pump(); me.onready && me.onready();
    });
  }
  Engine.prototype.push = function (buf, offset) { this.q.push({ b: buf, o: offset }); this.pump(); };
  Engine.prototype.pump = function () {
    var sb = this.sb; if (!sb || sb.updating || !this.q.length || this.ms.readyState === "closed") return;   // "ended" me append/remove MSE khud wapas "open" kar deta hai (seek ke liye zaroori)
    var it = this.q.shift();
    try { if (it.rm) { sb.remove(it.rm[0], it.rm[1]); return; } if (it.o != null) {            // nayi part / seek: pichla live-cluster kabhi "band" nahi hota => parser reset (abort) ke bina timestampOffset set nahi hota
        try { if (this.ms.readyState === "open") sb.abort(); } catch (e) {}
        sb.timestampOffset = it.o;
      }
      sb.appendBuffer(it.b); }
    catch (e) { if (e && e.name === "QuotaExceededError") { this.q.unshift(it); this.trim(true); } else this.onerror && this.onerror(e); }
  };
  Engine.prototype.trim = function (force) {
    var v = this.v, sb = this.sb; if (!sb || sb.updating || !sb.buffered.length) return;
    var s = sb.buffered.start(0), cut = v.currentTime - (force ? 8 : 60); if (cut > s + 1) { this.q.unshift({ rm: [s, cut] }); this.pump(); }
  };
  Engine.prototype.afterUpdate = function () {
    var v = this.v, sb = this.sb;
    if (!this.started && sb.buffered.length) { this.started = true; try { v.currentTime = Math.max(v.currentTime, sb.buffered.start(0)); } catch (e) {} var p = v.play(); p && p.catch && p.catch(function () {}); }
  };
  Engine.prototype.reset = function () {
    this.q.length = 0; var sb = this.sb; if (!sb) return; try { if (sb.updating) sb.abort(); if (sb.buffered.length) this.q.push({ rm: [0, 1e9] }); } catch (e) {} this.started = false; this.pump();
  };
  Engine.prototype.bufEnd = function () { var sb = this.sb; return sb && sb.buffered.length ? sb.buffered.end(sb.buffered.length - 1) : 0; };
  Engine.prototype.destroy = function () { try { this.v.removeAttribute("src"); this.v.load(); } catch (e) {} };

  /* ---------- Player (live + recording) ---------- */
  function Player(video, base, key, o) {
    o = o || {}; this.v = video; this.base = String(base).replace(/\/+$/, "") + "/" + key; this.live = !!o.live; this.m = null; this.pos = null; this.busy = false; this.dead = false;
    this.mime = mseMime(o.mime); this.e = new Engine(video, this.mime); var me = this;
    this.e.onready = function () { me.refresh(true); };
    this.e.onupd = function () { me.step(); };
    this.e.onerror = function (err) { me.onstate && me.onstate("error", err); };
    this.timer = setInterval(function () { me.tick(); }, this.live ? 2500 : 1500);
  }
  Player.prototype.url = function (p, f) { return this.base + "/p" + p + "/" + f + ".webm"; };
  Player.prototype.refresh = function (first) {
    var me = this; return getJson(this.base + "/live.json").then(function (m) {
      me.m = m; if (first || !me.pos) me.startDefault(); me.onstate && me.onstate("manifest", m); me.step();
    }).catch(function (e) { me.onstate && me.onstate(first ? "notfound" : "neterr", e); });
  };
  Player.prototype.total = function () { var m = this.m; return m ? Math.max(m.totalMs || 0, 0) : 0; };
  Player.prototype.startDefault = function () {
    var m = this.m; if (!m || !m.parts.length) { this.pos = null; return; }
    if (this.live && m.status === "live") { var p = m.parts.length - 1; this.startAt(p, Math.max(0, m.parts[p].segs.length - 4), true); } else this.startAt(0, 0, false);
  };
  Player.prototype.startAt = function (p, i, mid) { this.finished = false; this.e.reset(); this.pos = { p: p, i: i, needInit: true, first: !!(mid || i > 0) }; };
  Player.prototype.seek = function (ms) {
    var m = this.m; if (!m) return; var v = this.v, sec = ms / 1000, sb = this.e.sb;
    if (sb) for (var k = 0; k < sb.buffered.length; k++) if (sec >= sb.buffered.start(k) && sec < sb.buffered.end(k) - 0.5) { v.currentTime = sec; return; }
    var p = 0; for (var j = 0; j < m.parts.length; j++) if (m.parts[j].startMs <= ms) p = j;
    var P = m.parts[p], rel = ms - P.startMs, i = 0; for (var s = 0; s < P.segs.length; s++) if (P.segs[s].t <= rel) i = s;
    this.startAt(p, Math.max(0, i - 1), true); this.want = sec; this.step();
  };
  Player.prototype.step = function () {
    var me = this, m = this.m, pos = this.pos; if (this.dead || this.busy || !m || !pos || !this.e.ready) return;
    var P = m.parts[pos.p]; if (!P) return;
    if (!this.live && this.e.bufEnd() - this.v.currentTime > 30) return;           // recording: zyada aage buffer nahi
    if (pos.needInit) { if (!P.init) return; this.busy = true;
      getBuf(this.url(pos.p, "init")).then(function (b) { me.e.push(b, (P.startMs || 0) / 1000); pos.needInit = false; me.busy = false; me.step(); }).catch(function () { me.busy = false; });
      return; }
    var s = P.segs[pos.i];
    if (!s) { if (m.parts[pos.p + 1]) { pos.p++; pos.i = 0; pos.needInit = true; pos.first = false; this.step(); }
      else if (m.status !== "live" && !this.finished && !this.e.q.length && this.e.sb && !this.e.sb.updating) { this.finished = true; try { this.e.ms.endOfStream(); } catch (e) {} this.onstate && this.onstate("ended"); }
      return; }
    this.busy = true;
    getBuf(this.url(pos.p, s.n)).then(function (b) {
      if (pos.first) { var t = trimToCluster(b); if (!t) { pos.i++; me.busy = false; me.step(); return; } b = t; pos.first = false; }
      me.e.push(b); pos.i++; me.busy = false; me.step();
    }).catch(function () { me.busy = false; });
  };
  Player.prototype.tick = function () {
    if (this.dead) return; var v = this.v, e = this.e;
    if (this.live || !this.m || this.m.status === "live") this.refresh(false);
    if (this.want != null && e.sb && e.sb.buffered.length) { var st = e.sb.buffered.start(0); try { v.currentTime = Math.max(this.want, st); } catch (x) {} this.want = null; }
    if (this.live && e.sb && e.sb.buffered.length) { var end = e.bufEnd(), lag = end - v.currentTime; this.lag = lag; if (lag > 10) v.currentTime = Math.max(e.sb.buffered.start(0), end - 3); }
    if (e.sb && e.sb.buffered.length > 1 && !v.paused) {         // parts ke beech chhota gap (<0.6s) => agli range par jump
      for (var g = 0; g < e.sb.buffered.length; g++) { var gs = e.sb.buffered.start(g); if (gs > v.currentTime && gs - v.currentTime < 0.6 && v.readyState < 3) { try { v.currentTime = gs + 0.01; } catch (x) {} break; } }
    }
    if (!e.q.length) e.trim(false);
    this.step();
  };
  Player.prototype.destroy = function () { this.dead = true; clearInterval(this.timer); this.e.destroy(); };

  /* ---------- chat + raise hand (Firestore) ---------- */
  function itemRef(c, inst, it) { return c.bref(inst, it.batchId).collection("items").doc(it.id); }
  function chatPanel(c, inst, it, box, who, isTeacher) {
    var col = itemRef(c, inst, it).collection("chat"), unsub = null, hands = null;
    box.innerHTML = '<div class="sl-chat" data-list></div><div class="sl-send"><input data-in maxlength="300" placeholder="Sawal / message likhein…"><button data-go>Bhejein</button></div>';
    var list = box.querySelector("[data-list]"), inp = box.querySelector("[data-in]");
    function paint(snap) {
      var rows = snap.docs.map(function (d) { return d.data(); }).sort(function (a, b) { return c.ms(a.at) - c.ms(b.at); });
      list.innerHTML = rows.length ? rows.map(function (r) { return '<div class="' + (r.role === "teacher" ? "t" : "") + '"><b>' + esc(r.name || "") + "</b> " + esc(r.text) + "</div>"; }).join("") : '<div class="sl-dim">Abhi koi message nahi.</div>';
      list.scrollTop = list.scrollHeight;
    }
    try { var q = col.orderBy ? col.orderBy("at", "desc").limit(40) : col; if (q.onSnapshot) unsub = q.onSnapshot(paint, function () {}); else q.get().then(paint); } catch (e) {}
    function send() {
      var t = inp.value.trim(); if (!t) return; inp.value = "";
      col.add({ name: who.name, mobile: who.mobile || "", role: isTeacher ? "teacher" : "student", text: t, at: c.FV().serverTimestamp() }).catch(function () { toast(c, "Message nahi gaya"); });
    }
    box.querySelector("[data-go]").onclick = send; inp.onkeydown = function (e) { if (e.key === "Enter") send(); };
    return { stop: function () { try { unsub && unsub(); } catch (e) {} } };
  }

  /* ---------- STUDENT: live watch ---------- */
  function watch(it, c) {
    var inst = c.S.inst, s = c.sess() || {}, who = { name: s.name || "Student", mobile: String(s.mobile || "") };
    if (!it.liveKey || !it.liveBase) return toast(c, "Class abhi live nahi hai");
    if (!supported(it.liveMime)) return alert("Is device/browser par SnapLive nahi chalta (iPhone Safari). Android app ya Chrome use karein.");
    var ov = mk('<div class="sl-ov"><div class="sl-top"><b>🔴 ' + esc(it.title) + '</b><span class="sl-lag" data-lag></span><button data-x>Leave</button></div><div class="sl-main"><div class="sl-vid"><video playsinline autoplay muted></video><div class="sl-badge" data-st>Connecting…</div><button class="sl-unmute" data-um>🔊 Awaaz chalu karein</button></div><div class="sl-side"><div data-chat></div><button class="sl-hand" data-hand>✋ Haath uthayein</button></div></div></div>');
    document.body.appendChild(ov);
    var v = ov.querySelector("video"), st = ov.querySelector("[data-st]"), lagEl = ov.querySelector("[data-lag]"), p = new Player(v, it.liveBase, it.liveKey, { live: true, mime: it.liveMime }), up = false;
    var chat = chatPanel(c, inst, it, ov.querySelector("[data-chat]"), who, false);
    p.onstate = function (k, x) {
      if (k === "notfound") st.textContent = "Teacher ka stream shuru hone ka intezaar…";
      else if (k === "neterr") st.textContent = "Network slow hai — dobara koshish…";
      else if (k === "error") st.textContent = "Playback error — Leave karke dobara join karein";
      else if (k === "manifest") { if (x.status !== "live") st.textContent = "Class khatam ho gayi. Recording thodi der me Recorded Lectures me aayegi."; else if (!x.parts.length) st.textContent = "Teacher ka stream shuru hone ka intezaar…"; }
      else if (k === "ended") st.textContent = "Class khatam ho gayi.";
    };
    v.addEventListener("playing", function () { st.style.display = "none"; });
    v.addEventListener("waiting", function () { if (p.m && p.m.status === "live") { st.style.display = ""; st.textContent = "Buffering…"; } });
    var lt = setInterval(function () { lagEl.textContent = p.lag != null ? "~" + Math.max(0, Math.round(p.lag)) + "s delay" : ""; }, 2000);
    ov.querySelector("[data-um]").onclick = function () { v.muted = false; this.remove(); v.play().catch(function () {}); };
    var hand = ov.querySelector("[data-hand]"), hr = itemRef(c, inst, it).collection("hands").doc(who.mobile || "x");
    hand.onclick = function () { up = !up; hand.classList.toggle("on", up); hand.textContent = up ? "✋ Haath neeche karein" : "✋ Haath uthayein"; (up ? hr.set({ name: who.name, mobile: who.mobile, up: true, at: c.FV().serverTimestamp() }) : hr.delete()).catch(function () { toast(c, "Nahi hua"); }); };
    ov.querySelector("[data-x]").onclick = function () { clearInterval(lt); p.destroy(); chat.stop(); if (up) hr.delete().catch(function () {}); ov.remove(); };
  }

  /* ---------- recording player ---------- */
  function play(rec, c) {
    if (!rec.ownKey || !rec.ownBase) return toast(c, "Recording abhi ready nahi hai");
    if (!supported(rec.ownMime)) return alert("Is device/browser par recording nahi chalegi (iPhone Safari). Android app ya Chrome use karein.");
    var ov = mk('<div class="sl-ov"><div class="sl-top"><b>🎬 ' + esc(rec.title) + '</b><span></span><button data-x>Close</button></div><div class="sl-vod"><video playsinline></video><div class="sl-badge" data-st>Loading…</div></div><div class="sl-ctl"><button data-pp>▶</button><span data-t>0:00</span><input type="range" min="0" max="1000" value="0" data-sk><span data-d>0:00</span><select data-sp><option value="1">1x</option><option value="1.25">1.25x</option><option value="1.5">1.5x</option><option value="2">2x</option></select></div></div>');
    document.body.appendChild(ov);
    var v = ov.querySelector("video"), st = ov.querySelector("[data-st]"), sk = ov.querySelector("[data-sk]"), pp = ov.querySelector("[data-pp]"), dragging = false;
    var p = new Player(v, rec.ownBase, rec.ownKey, { live: false, mime: rec.ownMime }), tot = rec.durationMs || 0; window.SnapLive._last = p;
    p.onstate = function (k, x) { if (k === "manifest") { tot = Math.max(x.totalMs || 0, tot); ov.querySelector("[data-d]").textContent = fmt(tot); } else if (k === "notfound") st.textContent = "Recording nahi mili"; else if (k === "error") st.textContent = "Playback error"; };
    v.addEventListener("playing", function () { st.style.display = "none"; pp.textContent = "⏸"; }); v.addEventListener("pause", function () { pp.textContent = "▶"; });
    v.addEventListener("waiting", function () { st.style.display = ""; st.textContent = "Buffering…"; });
    var ut = setInterval(function () { if (dragging || !tot) return; ov.querySelector("[data-t]").textContent = fmt(v.currentTime * 1000); sk.value = Math.min(1000, Math.round(1000 * v.currentTime * 1000 / tot)); }, 500);
    pp.onclick = function () { v.paused ? v.play().catch(function () {}) : v.pause(); };
    sk.oninput = function () { dragging = true; ov.querySelector("[data-t]").textContent = fmt(tot * sk.value / 1000); };
    sk.onchange = function () { dragging = false; p.seek(tot * sk.value / 1000); v.play().catch(function () {}); };
    ov.querySelector("[data-sp]").onchange = function () { v.playbackRate = +this.value; };
    ov.querySelector("[data-x]").onclick = function () { clearInterval(ut); p.destroy(); ov.remove(); };
  }

  /* ---------- finalize (class khatam) ---------- */
  function finalize(it, c, key, base, mime, ok, manifest) {
    var items = c.bref(c.A.inst, it.batchId).collection("items"), has = (c.A.items[it.batchId] || []).some(function (x) { return x.kind === "recording" && x.classId === it.id; });
    return items.doc(it.id).update({ status: "completed", liveKey: c.FV().delete(), liveBase: c.FV().delete(), liveMime: c.FV().delete(), endedAt: c.FV().serverTimestamp() }).then(function () {
      if (has) return;
      return items.add({ batchId: it.batchId, instituteId: c.A.inst, kind: "recording", classId: it.id, title: it.title, desc: it.desc || "", subject: it.subject || "", chapter: it.chapter || "", subjectId: it.subjectId || "", chapterId: it.chapterId || "", teacher: it.teacher || "",
        mode: "own", ownKey: key, ownBase: base, ownMime: mime || "", durationMs: (manifest && manifest.totalMs) || 0, status: ok ? "published" : "ready", incomplete: !ok, published: !!ok, createdAt: c.FV().serverTimestamp(), createdBy: c.adminEmail(), updatedAt: c.FV().serverTimestamp() });
    });
  }

  /* ---------- TEACHER studio ---------- */
  function studio(it, c, done) {
    if (!window.MediaRecorder || !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) return alert("Is device me recording support nahi hai. Chrome / Android app use karein.");
    var canScreen = !!(navigator.mediaDevices.getDisplayMedia);
    var mime = pickMime(), inst = c.A.inst, S = { key: it.liveKey || "", base: it.liveBase || "", part: 0, tot: 0, seg: 0, q: [], sending: false, retry: 0, sent: 0, on: false, stream: null, rec: null, chain: Promise.resolve(), last: 0, partStart: 0 };
    var ov = mk('<div class="sl-ov"><div class="sl-top"><b>🎙 ' + esc(it.title) + '</b><span class="sl-lag" data-time></span><button data-x>Close</button></div><div class="sl-main"><div class="sl-vid"><video playsinline muted></video><div class="sl-badge" data-st>Source chunein</div></div><div class="sl-side"><div class="sl-ctrl"><select data-src><option value="camera">📷 Camera + Mic</option>' + (canScreen ? '<option value="screen">🖥 Screen + Mic</option>' : "") + '</select><label><input type="checkbox" data-mic checked> Mic</label><button data-go class="go">▶ Live shuru karein</button><button data-end class="red" style="display:none">⏹ Class khatam</button></div><div class="sl-stat" data-stat></div><div data-chat></div><div class="sl-hands" data-hands></div></div></div></div>');
    document.body.appendChild(ov);
    var $ = function (s) { return ov.querySelector(s); }, vid = $("video"), chat = null, hunsub = null, timer = null;
    if (!canScreen) $("[data-stat]").textContent = "Note: Is device par screen-share nahi — sirf camera.";
    function ui() { var qn = S.q.length; $("[data-stat]").innerHTML = (S.on ? "🔴 LIVE • " : "") + "Segments bhej diye: <b>" + S.sent + "</b>" + (qn ? " • baaki: <b>" + qn + "</b>" : "") + (S.retry ? ' • <span style="color:#b91c1c">upload retry #' + S.retry + "</span>" : ""); }
    function status(t) { $("[data-st]").textContent = t; $("[data-st]").style.display = t ? "" : "none"; }

    function upload(q) {
      return token().then(function (t) { return fetch(WK() + "/live/seg?key=" + S.key + "&part=" + q.part + "&n=" + q.n + "&d=" + q.d + "&t=" + q.t + "&ps=" + q.ps, { method: "PUT", headers: { Authorization: "Bearer " + t, "Content-Type": "video/webm" }, body: new Blob([q.buf]) }); })
        .then(function (r) { if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.error || "HTTP " + r.status); }); });
    }
    function pump() {
      if (S.sending || !S.q.length) return; S.sending = true; var q = S.q[0];
      upload(q).then(function () { S.q.shift(); S.sent++; S.retry = 0; S.sending = false; ui(); pump(); })
        .catch(function (e) { S.sending = false; S.retry++; S.lastErr = e && e.message; ui(); if (S.stopping && S.retry > 6) return; setTimeout(pump, Math.min(12000, 800 * Math.pow(2, S.retry))); });
    }
    function onBlob(buf, d) {
      var t = S.tot; S.tot += d;
      if (S.first) {
        S.first = false; var i = findCluster(new Uint8Array(buf)), init = i < 0 ? buf : buf.slice(0, i);
        S.q.push({ part: S.part, n: "init", d: 0, t: 0, ps: S.partStart, buf: init });
        if (i >= 0) S.q.push({ part: S.part, n: S.seg++, d: d, t: t, ps: S.partStart, buf: buf.slice(i) });
      } else S.q.push({ part: S.part, n: S.seg++, d: d, t: t, ps: S.partStart, buf: buf });
      ui(); pump();
    }
    function startRec() {
      S.first = true; S.seg = 0; S.tot = 0; S.last = performance.now();
      var r = new MediaRecorder(S.stream, mime ? { mimeType: mime, videoBitsPerSecond: 800000, audioBitsPerSecond: 64000 } : {}); S.rec = r;
      r.ondataavailable = function (e) { if (!e.data || !e.data.size) return; var now = performance.now(), d = Math.round(now - S.last); S.last = now; S.chain = S.chain.then(function () { return e.data.arrayBuffer(); }).then(function (b) { onBlob(b, d); }); };
      r.start(SEG_MS);
    }
    function liveFields(extra) { return Object.assign({ status: "live", mode: "own", liveKey: S.key, liveBase: S.base, liveMime: mime || "", published: true, startedAt: c.FV().serverTimestamp() }, extra || {}); }
    function begin() {
      var src = $("[data-src]").value, mic = $("[data-mic]").checked, md = navigator.mediaDevices; $("[data-go]").disabled = true; status("Camera/mic khul raha hai…");
      var gs = src === "screen" ? md.getDisplayMedia({ video: { frameRate: { ideal: 15 } }, audio: false }).then(function (s) { return mic ? md.getUserMedia({ audio: true }).then(function (a) { return new MediaStream(s.getVideoTracks().concat(a.getAudioTracks())); }) : s; })
        : md.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 } }, audio: mic ? { echoCancellation: true, noiseSuppression: true } : false });
      gs.then(function (stream) { S.stream = stream; vid.srcObject = stream; vid.play().catch(function () {}); status("Server se jud rahe hain…"); return api("/live/start", { instituteId: inst, batchId: it.batchId, classId: it.id, key: S.key || undefined }); })
        .then(function (j) {
          S.key = j.key; S.base = j.base; var m = j.manifest; if (m && m.parts && m.parts.length) { S.part = m.parts.length; S.partStart = m.totalMs || 0; }   // resume => nayi part
          return itemRef(c, inst, it).update(liveFields());
        }).then(function () {
          S.on = true; startRec(); status(""); $("[data-go]").style.display = "none"; $("[data-end]").style.display = ""; $("[data-src]").disabled = true; ui();
          var t0 = Date.now() - S.partStart; timer = setInterval(function () { $("[data-time]").textContent = fmt(Date.now() - t0); }, 1000);
          var who = { name: "Teacher" }; chat = chatPanel(c, inst, it, $("[data-chat]"), who, true);
          try { var hq = itemRef(c, inst, it).collection("hands"); if (hq.onSnapshot) hunsub = hq.onSnapshot(function (sn) { var l = sn.docs.map(function (d) { return d.data(); }); $("[data-hands]").innerHTML = l.length ? "✋ " + l.map(function (h) { return esc(h.name); }).join(", ") : ""; }, function () {}); } catch (e) {}
          window.addEventListener("beforeunload", warn);
        }).catch(function (e) { $("[data-go]").disabled = false; status(""); stopTracks(); var m = (e && e.message) || String(e); alert("Live shuru nahi hui: " + (/LIVE_R2/.test(m) ? "Worker me R2 bucket (LIVE_R2) set nahi hai — OWNER notes dekhein." : m)); });
    }
    function warn(e) { e.preventDefault(); e.returnValue = ""; }
    function stopTracks() { try { S.stream && S.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} }
    function cleanup() { clearInterval(timer); window.removeEventListener("beforeunload", warn); try { chat && chat.stop(); hunsub && hunsub(); } catch (e) {} stopTracks(); ov.remove(); }
    function end() {
      if (!confirm("Class khatam karein? Recording apne-aap ban jayegi.")) return;
      $("[data-end]").disabled = true; status("Aakhri segments upload ho rahe hain… (device band na karein)"); S.stopping = true;
      var stopped = new Promise(function (res) { S.rec.onstop = function () { res(); }; try { S.rec.stop(); } catch (e) { res(); } });
      stopped.then(function () { return S.chain; }).then(function () {
        return new Promise(function (res) { var t0 = Date.now(); (function w() { if (!S.q.length || Date.now() - t0 > 90000) return res(); ui(); S.retry && pump(); setTimeout(w, 500); })(); });
      }).then(function () {
        var ok = !S.q.length;
        if (!ok && !confirm("Kuch segments upload nahi hue (" + S.q.length + ").\nOK = jo upload hua usse hi class khatam karein (recording adhuri)\nCancel = dobara koshish")) { S.stopping = false; S.retry = 0; pump(); $("[data-end]").disabled = false; status("Dobara upload ho raha hai — phir 'Class khatam' dabayein"); try { S.rec = new MediaRecorder(S.stream); } catch (e) {} return; }
        return api("/live/end", { key: S.key, status: ok ? "ended" : "failed" }).then(function (j) { return finalize(it, c, S.key, S.base, mime, ok, j.manifest); }).then(function () { cleanup(); toast(c, ok ? "✅ Class khatam. Recording ready!" : "Class khatam — recording adhuri (incomplete)"); done && done(); });
      }).catch(function (e) { alert("Class khatam karne me dikkat: " + (e && e.message)); $("[data-end]").disabled = false; });
    }
    $("[data-go]").onclick = begin; $("[data-end]").onclick = end;
    $("[data-x]").onclick = function () {
      if (!S.on) { cleanup(); done && done(); return; }
      if (!confirm("Studio band karne se aapka stream ruk jayega (class live rahegi, 'Rejoin' se wapas aa sakte hain). Band karein?")) return;
      var b = this; b.disabled = true; status("Aakhri segments upload ho rahe hain…"); S.stopping = true;
      new Promise(function (res) { S.rec.onstop = function () { res(); }; try { S.rec.stop(); } catch (e) { res(); } }).then(function () { return S.chain; }).then(function () {
        return new Promise(function (res) { var t0 = Date.now(); (function w() { if (!S.q.length || Date.now() - t0 > 30000) return res(); S.retry && pump(); setTimeout(w, 400); })(); });
      }).then(function () { cleanup(); done && done(); });
    };
  }

  /* admin: studio band hai/teacher gayab — class ko list se khatam karna */
  function endClass(it, c, done) {
    if (!it.liveKey) return Promise.resolve(false);
    return api("/live/end", { key: it.liveKey, status: "ended" }).then(function (j) { return finalize(it, c, it.liveKey, it.liveBase, it.liveMime, true, j.manifest); }).then(function () { done && done(); return true; });
  }
  function purge(it) { var k = it && (it.ownKey || it.liveKey); return k ? api("/live/delete", { key: k }).catch(function () {}) : Promise.resolve(); }

  window.SnapLive = { studio: studio, watch: watch, play: play, endClass: endClass, purge: purge, supported: supported, _Player: Player, _trimToCluster: trimToCluster, _findCluster: findCluster };
})();
