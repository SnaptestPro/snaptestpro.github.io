/* ============================================================================
   BOOKLET PRINT MODULE  (v2 — 2-column logical pages, full spec)
   ----------------------------------------------------------------------------
   Structure enforced everywhere in this file:

     Landscape A4 Sheet
        └── Left Half  = one Logical Page  → 2 Question Columns
        └── Right Half = one Logical Page  → 2 Question Columns

   Pipeline (matches the booklet spec step by step):
     1. Collect questions + options.
     2. Measure each question's real rendered height.
     3. Distribute questions into Logical Pages (Page 1, 2, 3 ...).
     4. Split every logical page into exactly 2 columns (Sequential or
        Balanced — user configurable, default Balanced).
     5. Never split a question across columns/pages — the whole question
        (text + options + table/diagram/etc.) always moves together.
     6. Stamp every logical page with its real page number (1..N) —
        independent of which physical Left/Right half it ends up on.
     7. Pad logical pages to the next multiple of 4 with blank pages
        (blank pages carry no content and no page number).
     8. Run booklet imposition (front/back, Left/Right) — works for ANY
        page count that is a multiple of 4 (4, 8, 12, 16, 20 ...), not
        hard-coded to 8.
     9. Render two preview modes: Logical Page Preview and Print /
        Imposition Preview (landscape sheets — shown first / by default).
    10. Print always prints the Imposition view, which is what's
        physically correct for duplex + fold + staple.
   ========================================================================= */
(function () {
  "use strict";

  /* -------------------------------------------------------------------- *
   *  Geometry (mm) — A4 landscape sheet, split into two halves            *
   * -------------------------------------------------------------------- */
  var MM2PX      = 3.7795275590551185; // px per mm @ 96dpi, for measuring
  var HALF_W     = 148;   // usable half-sheet width reference (mm)
  var HALF_H     = 210;   // half-sheet height (mm)
  var MARGIN     = 7;     // outer margin (mm)
  var GUTTER     = 5;     // extra margin on the inner (spine) edge (mm)
  var PAGE_NUM_H = 6;     // reserved strip at the bottom for the page number (mm)
  var COL_GAP    = 4;     // gap between the 2 columns (mm)
  var COLS       = 2;     // ALWAYS 2 columns per logical page (per spec)

  var CONTENT_W    = HALF_W - MARGIN * 2 - GUTTER;      // usable width inside a half
  var CONTENT_H    = HALF_H - MARGIN * 2 - PAGE_NUM_H;  // usable height, minus page-number strip
  var CONTENT_W_PX = Math.floor(CONTENT_W * MM2PX);
  var CONTENT_H_PX = Math.floor(CONTENT_H * MM2PX);
  var COL_W        = (CONTENT_W - COL_GAP * (COLS - 1)) / COLS;
  var COL_W_PX     = Math.floor(COL_W * MM2PX);

  /* -------------------------------------------------------------------- *
   *  Settings (Column Mode + Page Number Position) — remembered per      *
   *  browser via localStorage, editable any time via the ⚙ Settings      *
   *  button next to the Booklet Print buttons.                           *
   * -------------------------------------------------------------------- */
  var SETTINGS_KEY = "bookletSettings";

  function getBookletSettings() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"); } catch (e) {}
    var columnMode = s.columnMode === "sequential" ? "sequential" : "balanced"; // default: Balanced
    var pos = ["bottom-left", "bottom-right", "bottom-center"].indexOf(s.pageNumberPos) !== -1
      ? s.pageNumberPos
      : "bottom-center"; // default: Bottom Center
    return { columnMode: columnMode, pageNumberPos: pos };
  }

  function saveBookletSettings(s) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
  }

  window.openBookletSettings = function () {
    var existing = document.getElementById("bp-settings-overlay");
    if (existing) existing.remove();

    var cur = getBookletSettings();
    var overlay = document.createElement("div");
    overlay.id = "bp-settings-overlay";
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(17,24,39,.55);z-index:99999;" +
      "display:flex;align-items:center;justify-content:center;";
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:12px;padding:22px 24px;width:340px;max-width:92vw;' +
      'font-family:Inter,\'Noto Sans Devanagari\',sans-serif;box-shadow:0 12px 44px rgba(0,0,0,.4);">' +
        '<h3 style="margin:0 0 16px;font-size:15px;color:#1a0533;">📖 Booklet Print Settings</h3>' +

        '<label style="display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:5px;">Column Fill Mode</label>' +
        '<select id="bp-set-colmode" style="width:100%;padding:8px 9px;border:1px solid #d1d5db;border-radius:7px;margin-bottom:6px;font-size:13px;">' +
          '<option value="balanced">Balanced — dono columns barabar bharenge</option>' +
          '<option value="sequential">Sequential — pehle Column 1 poora bharega</option>' +
        '</select>' +
        '<p style="margin:0 0 14px;font-size:11px;color:#6b7280;">Default: Balanced</p>' +

        '<label style="display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:5px;">Page Number Position</label>' +
        '<select id="bp-set-pnpos" style="width:100%;padding:8px 9px;border:1px solid #d1d5db;border-radius:7px;margin-bottom:6px;font-size:13px;">' +
          '<option value="bottom-center">Bottom Center</option>' +
          '<option value="bottom-left">Bottom Left</option>' +
          '<option value="bottom-right">Bottom Right</option>' +
        '</select>' +
        '<p style="margin:0 0 18px;font-size:11px;color:#6b7280;">Default: Bottom Center</p>' +

        '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
          '<button id="bp-set-cancel" style="padding:9px 16px;border:0;border-radius:7px;background:#e5e7eb;color:#111;font-weight:700;cursor:pointer;">Cancel</button>' +
          '<button id="bp-set-save" style="padding:9px 16px;border:0;border-radius:7px;background:#4a0e8f;color:#fff;font-weight:700;cursor:pointer;">Save</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    overlay.querySelector("#bp-set-colmode").value = cur.columnMode;
    overlay.querySelector("#bp-set-pnpos").value = cur.pageNumberPos;

    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector("#bp-set-cancel").onclick = function () { overlay.remove(); };
    overlay.querySelector("#bp-set-save").onclick = function () {
      saveBookletSettings({
        columnMode: overlay.querySelector("#bp-set-colmode").value,
        pageNumberPos: overlay.querySelector("#bp-set-pnpos").value
      });
      overlay.remove();
      if (typeof toast === "function") toast("✅ Booklet settings saved");
    };
  };

  /* -------------------------------------------------------------------- *
   *  STEP 1 — Collect questions + header                                  *
   * -------------------------------------------------------------------- */
  function collectQuestions() {
    try {
      if (typeof isSectionMode === "function" && isSectionMode() && typeof getAllQuestionsFlat === "function") {
        return getAllQuestionsFlat();
      }
    } catch (e) {}
    try { if (typeof paperQuestions !== "undefined") return paperQuestions || []; } catch (e) {}
    return [];
  }

  function optionsHtml(q) {
    if (q.qType === "subjective") {
      var marks = (q.marks !== undefined && q.marks !== null && q.marks !== "") ? (q.marks + " marks") : "";
      return '<div class="bp-sub-badge">📝' + (marks ? " · " + marks : "") + '</div>';
    }
    var labels = typeof LABELS !== "undefined" ? LABELS : ["A", "B", "C", "D"];
    return (q.opts || []).map(function (opt, i) {
      return '<div class="bp-opt"><span class="bp-opt-tag">[' + labels[i] + ']</span><span class="math-text">' + opt + '</span></div>';
    }).join("");
  }

  function headerHtml() {
    var header = document.querySelector("#paper .paper-header");
    var instr = document.getElementById("paper-instr");
    var wrap = '<div class="bp-header-wrap">';
    if (header) wrap += header.outerHTML;
    if (instr) wrap += instr.outerHTML;
    wrap += "</div>";
    return wrap;
  }

  function questionItemsHtml(questions) {
    return questions.map(function (q, i) {
      return '<div class="bp-item"><div class="bp-qhead"><span class="bp-num">' + (i + 1) + '.</span>' +
        '<span class="math-text">' + q.text + '</span></div>' +
        '<div class="bp-opts">' + optionsHtml(q) + '</div></div>';
    });
  }

  /* -------------------------------------------------------------------- *
   *  STEP 2 & 3 — Measure heights, distribute into Logical Pages          *
   *  STEP 4 & 5 — Split each page into 2 columns without splitting a      *
   *               question; Sequential or Balanced per user setting       *
   * -------------------------------------------------------------------- */
  function buildLogicalPages(headerHtmlStr, itemsHtml, settings) {
    // Measure the header once (only occupies space on the very first page)
    var headerBox = document.createElement("div");
    headerBox.style.cssText = "position:fixed;left:-9999px;top:0;width:" + CONTENT_W_PX + "px;visibility:hidden;pointer-events:none;";
    document.body.appendChild(headerBox);
    headerBox.innerHTML = headerHtmlStr || "";
    var headerH = headerHtmlStr ? headerBox.getBoundingClientRect().height : 0;
    headerBox.remove();

    // Measure every question at the real column width
    var measureBox = document.createElement("div");
    measureBox.className = "bp-col";
    measureBox.style.cssText = "position:fixed;left:-9999px;top:0;width:" + COL_W_PX + "px;visibility:hidden;pointer-events:none;";
    document.body.appendChild(measureBox);
    var heights = itemsHtml.map(function (html) {
      measureBox.innerHTML = html;
      return measureBox.getBoundingClientRect().height;
    });
    measureBox.remove();

    var pages = [];
    var idx = 0;
    var n = itemsHtml.length;
    var pageNum = 0;

    while (idx < n) {
      pageNum++;
      var isFirstPage = pages.length === 0;
      var avail = CONTENT_H_PX - (isFirstPage ? headerH : 0);
      var budget = avail * 2; // total space across both columns of this page

      // Work out which run of (whole) questions lands on this page
      var runEnd = idx, sum = 0;
      while (runEnd < n) {
        var h = heights[runEnd];
        if (sum > 0 && sum + h > budget) break;
        sum += h;
        runEnd++;
      }
      if (runEnd === idx) runEnd = idx + 1; // safety: always make progress

      var runItems = itemsHtml.slice(idx, runEnd);
      var runHeights = heights.slice(idx, runEnd);
      var left, right, splitAt, colH, i;

      if (settings.columnMode === "sequential") {
        // Fill Column 1 completely first, then continue in Column 2
        colH = 0; splitAt = runItems.length;
        for (i = 0; i < runItems.length; i++) {
          if (colH > 0 && colH + runHeights[i] > avail) { splitAt = i; break; }
          colH += runHeights[i];
        }
      } else {
        // Balanced — distribute so both columns end up close to equal height
        var total = runHeights.reduce(function (a, b) { return a + b; }, 0);
        var half = total / 2;
        colH = 0; splitAt = runItems.length;
        for (i = 0; i < runItems.length; i++) {
          if (colH + runHeights[i] > avail) { splitAt = i; break; }             // column-1 hard limit
          if (colH > 0 && colH + runHeights[i] > half) { splitAt = i; break; }  // balance point
          colH += runHeights[i];
        }
      }
      left = runItems.slice(0, splitAt);
      right = runItems.slice(splitAt);

      pages.push({ num: pageNum, left: left, right: right, hasHeader: isFirstPage });
      idx = runEnd;
    }

    if (!pages.length) pages.push({ num: 1, left: [], right: [], hasHeader: true });
    return pages;
  }

  /* -------------------------------------------------------------------- *
   *  STEP 6 — render a logical page's inner HTML (2 columns + page #)     *
   * -------------------------------------------------------------------- */
  function renderPageInner(page, headerHtmlStr, settings) {
    var cols = '<div class="bp-cols">' +
      '<div class="bp-col">' + page.left.join("") + '</div>' +
      '<div class="bp-col">' + page.right.join("") + '</div>' +
      '</div>';
    var header = page.hasHeader ? headerHtmlStr : "";
    var pageNum = '<div class="bp-pagenum bp-pn-' + settings.pageNumberPos + '">' + page.num + '</div>';
    return header + cols + pageNum;
  }

  /* -------------------------------------------------------------------- *
   *  STEP 7 & 8 — pad to a multiple of 4, run booklet imposition          *
   *  (works for ANY multiple of 4: 4, 8, 12, 16, 20, 24, 28, 32 ...)      *
   * -------------------------------------------------------------------- */
  function imposeBooklet(pages) {
    var t = pages.slice();
    while (t.length % 4 !== 0) t.push(null); // blank filler — no content, no number
    var a = t.length;
    var sheets = [];
    for (var n = 0; n < a / 4; n++) {
      var s = a - 2 * n - 1, d = 2 * n, i = 2 * n + 1, o = a - 2 * n - 2;
      sheets.push({ front: [t[s] || null, t[d] || null], back: [t[i] || null, t[o] || null] });
    }
    return sheets;
  }

  function renderHalf(page, headerHtmlStr, settings, side) {
    var blank = !page;
    var inner = blank ? "" : renderPageInner(page, headerHtmlStr, settings);
    return '<div class="bp-half bp-half-' + side + (blank ? " bp-half-blank" : "") + '">' +
      '<div class="bp-half-inner">' + inner + '</div></div>';
  }

  function renderSheet(sheetSide, headerHtmlStr, settings) {
    return '<div class="bp-sheet">' +
      renderHalf(sheetSide[0], headerHtmlStr, settings, "left") +
      '<div class="bp-fold"></div>' +
      renderHalf(sheetSide[1], headerHtmlStr, settings, "right") +
      '</div>';
  }

  /* -------------------------------------------------------------------- *
   *  STEP 9 — Logical Page Preview (Page 1, Page 2, Page 3 ... stacked)   *
   * -------------------------------------------------------------------- */
  function renderLogicalView(pages, headerHtmlStr, settings) {
    return pages.map(function (page) {
      return '<div class="bp-logical-page">' +
        '<div class="bp-logical-label">Page ' + page.num + '</div>' +
        '<div class="bp-half-inner">' + renderPageInner(page, headerHtmlStr, settings) + '</div>' +
        '</div>';
    }).join("");
  }

  /* -------------------------------------------------------------------- *
   *  Full HTML document assembly                                          *
   * -------------------------------------------------------------------- */
  function buildDocument(pages, headerHtmlStr, settings) {
    var sheets = imposeBooklet(pages);
    var impositionHtml = sheets.map(function (sheet) {
      return renderSheet(sheet.front, headerHtmlStr, settings) + renderSheet(sheet.back, headerHtmlStr, settings);
    }).join("");
    var logicalHtml = renderLogicalView(pages, headerHtmlStr, settings);

    var modeLabel = settings.columnMode === "sequential" ? "Sequential" : "Balanced";
    var posLabel = { "bottom-center": "Bottom Center", "bottom-left": "Bottom Left", "bottom-right": "Bottom Right" }[settings.pageNumberPos];

    var head =
      '<meta charset="UTF-8"/><title>Booklet Print</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap" rel="stylesheet"/>' +
      '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css"/>' +
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js"><\/script>' +
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/contrib/auto-render.min.js"><\/script>' +
      '<style>' + stylesheet() + '</style>';

    var toolbar =
      '<div class="bp-toolbar no-print">' +
        '<div><b>📖 Booklet Print Ready</b> — ' + pages.length + ' page' + (pages.length > 1 ? "s" : "") +
          ' · ' + sheets.length + ' sheet' + (sheets.length > 1 ? "s" : "") +
          ' · 2 columns/page · ' + modeLabel + ' · Page #: ' + posLabel + '</div>' +
        '<div class="bp-toolbar-hint">Print dialog mein: <b>Two-sided → Flip on Short Edge</b> · Paper <b>A4</b> · Layout <b>Landscape</b> · Margins <b>None</b></div>' +
        '<div class="bp-view-toggle">' +
          '<button id="bp-view-logical-btn" onclick="bpShowView(\'logical\')">🗂 Logical Pages</button>' +
          '<button id="bp-view-imposition-btn" class="active" onclick="bpShowView(\'imposition\')">🖨 Landscape / Print View</button>' +
        '</div>' +
        '<button onclick="bpPrintNow()">🖨️ Print Now</button>' +
      '</div>';

    var body =
      '<div id="bp-logical-view" class="bp-logical-view" style="display:none">' + logicalHtml + '</div>' +
      '<div id="bp-imposition-view" class="bp-imposition-view">' + impositionHtml + '</div>';

    var script =
      '<script>' +
      'function bpShowView(v){' +
        'document.getElementById("bp-logical-view").style.display = v==="logical" ? "flex" : "none";' +
        'document.getElementById("bp-imposition-view").style.display = v==="imposition" ? "flex" : "none";' +
        'document.getElementById("bp-view-logical-btn").classList.toggle("active", v==="logical");' +
        'document.getElementById("bp-view-imposition-btn").classList.toggle("active", v==="imposition");' +
      '}' +
      'function bpPrintNow(){ bpShowView("imposition"); setTimeout(function(){ window.print(); }, 60); }' +
      'window.addEventListener("load",function(){' +
        'if(window.renderMathInElement){renderMathInElement(document.body,{delimiters:[{left:"$$",right:"$$",display:true},{left:"$",right:"$",display:false}],throwOnError:false});}' +
      '});' +
      '<\/script>';

    return "<!DOCTYPE html><html><head>" + head + "</head><body>" + toolbar + body + script + "</body></html>";
  }

  function stylesheet() {
    return [
      "@page{size:A4 landscape;margin:0}",
      "*{box-sizing:border-box}",
      'body{margin:0;font-family:"Inter","Noto Sans Devanagari",sans-serif;background:#525659}',

      ".bp-toolbar{position:sticky;top:0;z-index:9;background:#111827;color:#fff;display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:10px 18px;font-size:12.5px}",
      ".bp-toolbar b{color:#facc15}",
      ".bp-toolbar-hint{opacity:.85;font-size:11.5px}",
      ".bp-toolbar button{background:#4a0e8f;color:#fff;border:0;border-radius:6px;padding:8px 14px;font-weight:700;cursor:pointer;font-size:12px}",
      ".bp-toolbar > button{margin-left:auto}",
      ".bp-view-toggle{display:flex;gap:6px;margin-left:auto}",
      ".bp-view-toggle button{background:#374151;opacity:.8}",
      ".bp-view-toggle button.active{background:#4a0e8f;opacity:1}",

      ".bp-logical-view,.bp-imposition-view{display:flex;flex-direction:column;align-items:center;gap:14px;padding:14px 0 40px}",

      // ---- Imposition / print view: physical landscape sheets ----
      ".bp-sheet{width:297mm;height:210mm;background:#fff;display:flex;box-shadow:0 2px 10px rgba(0,0,0,.35);page-break-after:always;break-after:page}",
      ".bp-half{width:148.5mm;height:210mm;padding:" + MARGIN + "mm;overflow:hidden;position:relative}",
      ".bp-half-left{padding-right:" + (MARGIN + GUTTER) + "mm}",
      ".bp-half-right{padding-left:" + (MARGIN + GUTTER) + "mm}",
      ".bp-half-blank{background:repeating-linear-gradient(45deg,#fafafa,#fafafa 10px,#fff 10px,#fff 20px)}",
      ".bp-fold{width:0;border-left:1px dashed #cbd5e1}",
      ".bp-half-inner{width:" + CONTENT_W + "mm;height:" + CONTENT_H + "mm;overflow:hidden;position:relative}",

      // ---- Logical page preview: standalone cards, same proportions ----
      ".bp-logical-page{width:" + (CONTENT_W + MARGIN * 2 + GUTTER) + "mm;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.35);padding:" + MARGIN + "mm}",
      ".bp-logical-label{font-size:10px;font-weight:800;color:#4a0e8f;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px}",

      ".bp-header-wrap{margin:-2px -2px 6px;border-radius:4px;overflow:hidden}",
      ".paper-header{background:linear-gradient(135deg,#1a0533,#2d0a5e 50%,#1a0533);padding:0}",
      ".paper-header-top{display:flex;align-items:center;justify-content:space-between;padding:6px 8px 4px;gap:6px}",
      ".hbadge{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.28);color:#fff;font-size:7px;font-weight:700;padding:2px 6px;border-radius:3px;white-space:nowrap}",
      ".htopic{color:#ffd700;font-size:8.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;text-align:center;flex:1}",
      ".paper-header-meta{display:flex;align-items:center;justify-content:center;gap:8px;padding:3px 8px 5px;color:rgba(255,255,255,.88);font-size:7px;font-weight:500;border-top:1px solid rgba(255,255,255,.1)}",
      ".sep{color:rgba(255,255,255,.3)}",
      ".paper-instructions{background:#fffbeb;border-left:2px solid #f59e0b;padding:4px 6px;font-size:6.5px;color:#78350f;line-height:1.4}",

      ".bp-cols{display:flex;gap:" + COL_GAP + "mm;align-items:flex-start;height:100%}",
      ".bp-col{width:" + COL_W + "mm;flex:0 0 " + COL_W + "mm;overflow:hidden}",
      ".bp-col:not(:first-child){border-left:1px dashed #d1d5db;padding-left:" + (COL_GAP / 2) + "mm;margin-left:-" + (COL_GAP / 2) + "mm}",
      ".bp-item{padding:3px 0;border-bottom:1px dashed #e2e8f0;break-inside:avoid;page-break-inside:avoid}",
      ".bp-item:last-child{border-bottom:none}",
      ".bp-qhead{display:flex;gap:3px;font-size:7px;line-height:1.35;color:#111827}",
      ".bp-num{font-weight:800;color:#4a0e8f;flex-shrink:0}",
      ".bp-opts{display:flex;flex-direction:column;gap:1px;padding-left:9px;margin-top:1px}",
      ".bp-opt{display:flex;gap:2px;font-size:6.5px;color:#1f2937;line-height:1.3}",
      ".bp-opt-tag{font-weight:700;color:#4a0e8f;flex-shrink:0}",
      ".bp-sub-badge{margin-left:9px;margin-top:1px;font-size:6.5px;color:#92400e;font-weight:600}",

      ".bp-pagenum{position:absolute;left:0;right:0;bottom:1.5mm;font-size:7px;font-weight:800;color:#4a0e8f}",
      ".bp-pn-bottom-center{text-align:center}",
      ".bp-pn-bottom-left{text-align:left;padding-left:2mm}",
      ".bp-pn-bottom-right{text-align:right;padding-right:2mm}",

      "@media print{",
      "body{background:#fff}",
      ".no-print{display:none!important}",
      ".bp-imposition-view{padding:0;gap:0}",
      ".bp-sheet{box-shadow:none}",
      "}"
    ].join("\n");
  }

  /* -------------------------------------------------------------------- *
   *  Entry point                                                          *
   * -------------------------------------------------------------------- */
  window.printPaperBooklet = function () {
    var questions = collectQuestions();
    if (!questions.length) {
      alert("Pehle paper mein kam se kam ek question add karein.");
      return;
    }
    var settings = getBookletSettings();
    var header = headerHtml();
    var items = questionItemsHtml(questions);
    var pages = buildLogicalPages(header, items, settings);
    var doc = buildDocument(pages, header, settings);

    var win = window.open("", "_blank");
    if (!win) {
      alert("Popup blocked ho gaya — browser mein is site ke liye popups allow karein aur dobara try karein.");
      return;
    }
    win.document.open();
    win.document.write(doc);
    win.document.close();
  };
})();
