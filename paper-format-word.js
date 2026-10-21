/* ============================================================================
   PAPER FORMAT WORD  (Savyasachi "Test_4" format)  — v1
   ----------------------------------------------------------------------------
   Naya, ALAG module. Koi purana function (exportToWord / exportBookletToWord /
   printPaperBooklet) nahi chheda gaya.

   Button: "📄 Paper Format Word"  ->  window.exportPaperFormatWord()

   Output = A4 landscape, Word "Narrow" margins (0.5"). Booklet pages ki ginti
   questions ke hisaab se khud banti hai: 4, 8, 12 ... 40 pages (= N/2 Word pages).
   Har Word page = 2 half-pages, har half-page me 2 columns. Imposition (N pages):
        sheet s : front [N-2s | 1+2s] , back [2+2s | N-1-2s]
   N = 8 par:  [8|1] [2|7] [6|3] [4|5]   (page 1 = header box + instruction)

   - MCQ        : page 1 se aage, column 1 pehle poora bharta hai, phir column 2.
                  Ek question kabhi beech me nahi kategta.
   - Subjective : aakhri page(s) par (N-1 / N), single column list.
   - Page numbers print NAHI hote.

   Pagination kaise: har question ki height Word ke hisaab se estimate hoti hai
   (fixed line-height + text-width estimate + fraction/root ka extra). Paragraphs
   me line-height EXACT rakhi hai (jahan math nahi) taaki Word ki font-metrics
   se height na badle. Estimate me ~8% safety margin hai (SAFETY).
   Math (fraction / root) wahi helpers use karte hain jo normal "Download Word"
   karta hai: htmlToDocxRuns + mathToWordHtml (qgen-app.js).
   ========================================================================== */
(function () {
  "use strict";

  /* ---- geometry (twips; 1pt = 20) ------------------------------------- */
  var PAGE_M = 720;                       // Word "Narrow" margins = 0.5" (720 twips) on all sides
  var HF_DIST = 432;                      // Narrow preset: header/footer distance 0.3"
  var HALF_W = 7699;                      // (16838 - 2*720) / 2
  var ROW_H = 10340;                      // exact row height (page content 10466 minus section-break paragraph + slack)
  var PAD_X = 160, PAD_Y = 60;            // half-page inner padding
  var INNER_W = HALF_W - PAD_X * 2;       // 7619
  var COL_W = Math.floor(INNER_W / 2);    // 3809
  var COL_PAD = 60;                       // column cell side margin
  var COL_H = ROW_H - PAD_Y * 2;          // usable height of a column
  var TXT_W = COL_W - COL_PAD * 2 - 40;   // text width in a column (conservative)
  var OPT_TBL_W = COL_W - COL_PAD * 2;    // 2x2 option table width
  var OPT_W = Math.floor(OPT_TBL_W / 2) - 60 - 40; // text width inside one option cell
  var PT = 9.5;                          // body font size (pt) — yahin se badlo (9 / 9.5 / 10)
  var SZ = Math.round(PT * 2);            // docx half-points
  var LH_RATIO = 1.625;                   // line height = font x ye ratio (1.5 = aur tight, par Hindi matra kat sakti hai)
  var LH = Math.round(PT * LH_RATIO * 20);   // exact line height (twips)
  var SPACER = 60;                        // base gap between questions
  var BOTTOM_GUARD = 100;                 // columns ke neeche itni jagah chhodte hain (twips)
  var MAX_EXTRA = 0;                      // 0 = questions ke beech koi extra gap NAHI (sab gap barabar). >0 rakhoge to column neeche tak stretch hoga
  var SAFETY = 1.0;                       // estimate safety margin (1.0 = sabse zyada questions fit; 1.03-1.05 = zyada safe)
  var FIT_GUARD = 80;                     // column ke neeche itni jagah (twips) hamesha khali rakhte hain, kategne se bachne ke liye
  var MAX_PAGES = 40;                     // booklet max: 4, 8, 12 ... 40 pages
  var CLASS_KEY = "pfwClass";

  /* ---- collect questions (same source as Booklet Print) --------------- */
  function collectQuestions() {
    try { if (window.QGSets && typeof window.QGSets.flat === "function") return window.QGSets.flat(); } catch (e) {}
    try { if (typeof isSectionMode === "function" && isSectionMode() && typeof getAllQuestionsFlat === "function") return getAllQuestionsFlat(); } catch (e) {}
    try { if (typeof paperQuestions !== "undefined") return paperQuestions || []; } catch (e) {}
    return [];
  }

  /* ---- width / height estimation -------------------------------------- */
  function cw(c) {                         // approx advance width in em
    if (c === 32) return 0.28;
    if (c >= 0x900 && c <= 0x97F) {
      if (c <= 0x902 || c === 0x93C || (c >= 0x941 && c <= 0x948) || c === 0x94D || (c >= 0x951 && c <= 0x957)) return 0;
      if ((c >= 0x93E && c <= 0x940) || (c >= 0x949 && c <= 0x94C)) return 0.3;
      return 0.5;
    }
    if (c >= 48 && c <= 57) return 0.5;
    if (c >= 65 && c <= 90) return 0.66;
    if (c < 128) return 0.5;
    return 0.7;
  }
  function textW(s, pt) { var w = 0; for (var i = 0; i < s.length; i++) w += cw(s.charCodeAt(i)); return w * pt; }

  function est(html, prefix, widthTw, pt) {
    var d = document.createElement("div");
    d.innerHTML = html;
    var frac = d.querySelectorAll("table").length, rad = d.querySelectorAll("radical").length;
    var w = (textW(prefix, pt) + textW(d.textContent || "", pt)) * 1.03;
    var n = Math.max(1, Math.ceil(w / (widthTw / 20)));
    var extra = Math.min(frac, n) * 30 + Math.min(rad, n) * 30;
    return { lines: n, math: frac + rad > 0, h: n * LH + extra };
  }
  function sp(math, after) {               // math wali line: AT_LEAST (clip na ho), baaki EXACT
    return { line: LH, lineRule: math ? docx.LineRuleType.AT_LEAST : docx.LineRuleType.EXACT, before: 0, after: after || 0 };
  }

  /* ---- docx building blocks ------------------------------------------- */
  function noBorders() {
    var n = { style: docx.BorderStyle.NONE, size: 0, color: "FFFFFF" };
    return { top: n, bottom: n, left: n, right: n, insideHorizontal: n, insideVertical: n };
  }
  function spacer(h) {
    return new docx.Paragraph({
      spacing: { line: h || SPACER, lineRule: docx.LineRuleType.EXACT, before: 0, after: 0 },
      children: [new docx.TextRun({ text: "", size: 2 })]
    });
  }
  function optCell(label, raw, w) {
    var html = mathToWordHtml(raw || ""), e = est(html, "[A] ", OPT_W, PT);
    return {
      h: e.h,
      cell: new docx.TableCell({
        width: { size: w, type: docx.WidthType.DXA },
        margins: { top: 0, bottom: 0, left: 30, right: 30 },
        children: [new docx.Paragraph({
          spacing: sp(e.math, 0),
          children: [new docx.TextRun({ text: "[" + label + "] ", size: SZ })].concat(htmlToDocxRuns(html, { size: SZ }))
        })]
      })
    };
  }
  function mcqBlock(n, q) {
    var sh = mathToWordHtml(q.text || ""), s = est(sh, n + ". ", TXT_W, PT);
    var out = [new docx.Paragraph({
      spacing: sp(s.math, 20),
      children: [new docx.TextRun({ text: n + ". ", bold: true, size: SZ })].concat(htmlToDocxRuns(sh, { size: SZ }))
    })];
    var h = s.h + 20, L = ["A", "B", "C", "D"], o = q.opts || [];
    var w1 = Math.floor(OPT_TBL_W / 2), w2 = OPT_TBL_W - w1, rows = [];
    for (var r = 0; r < 2; r++) {
      var a = optCell(L[r * 2], o[r * 2], w1), b = optCell(L[r * 2 + 1], o[r * 2 + 1], w2);
      rows.push(new docx.TableRow({ cantSplit: true, children: [a.cell, b.cell] }));
      h += Math.max(a.h, b.h);
    }
    out.push(new docx.Table({
      width: { size: OPT_TBL_W, type: docx.WidthType.DXA },
      columnWidths: [w1, w2], layout: docx.TableLayoutType.FIXED,
      borders: noBorders(), rows: rows
    }));
    return { children: out, h: (h + SPACER) * SAFETY };
  }
  function subBlock(n, q) {
    var html = mathToWordHtml(q.text || ""), e = est(html, n + ". ", INNER_W - 40, PT + 0.5);
    return {
      h: (e.h + e.lines * 20 + 100) * SAFETY,
      children: [new docx.Paragraph({
        spacing: Object.assign(sp(e.math, 100), { line: LH + 20 }),
        children: [new docx.TextRun({ text: n + ". ", bold: true, size: SZ + 1 })].concat(htmlToDocxRuns(html, { size: SZ + 1 }))
      })]
    };
  }
  function colCell(blocks, w, isRight, extra) {
    var kids = [];
    blocks.forEach(function (b, i) {
      kids = kids.concat(b.children);
      kids.push(spacer(SPACER + (i < blocks.length - 1 ? (extra || 0) : 0)));   // gap (stretch se column neeche tak bharta hai)
    });
    if (!kids.length) kids.push(spacer());
    var cfg = {
      width: { size: w, type: docx.WidthType.DXA },
      verticalAlign: docx.VerticalAlign.TOP,
      margins: { top: 0, bottom: 0, left: isRight ? 100 : COL_PAD, right: COL_PAD },
      children: kids
    };
    return new docx.TableCell(cfg);
  }
  function colsTable(left, right, exL, exR) {
    return new docx.Table({
      width: { size: INNER_W, type: docx.WidthType.DXA },
      columnWidths: [COL_W, INNER_W - COL_W], layout: docx.TableLayoutType.FIXED,
      borders: noBorders(),
      rows: [new docx.TableRow({ children: [colCell(left, COL_W, false, exL), colCell(right, INNER_W - COL_W, true, exR)] })]
    });
  }

  /* ---- header box (page 1) -------------------------------------------- */
  function buildHeader(h) {
    var tsz = h.title.length <= 22 ? 40 : h.title.length <= 34 ? 30 : 22;
    var instr = "Instructions: " + h.instr;
    var il = est(instr.replace(/&/g, "&amp;").replace(/</g, "&lt;"), "", INNER_W - 40, 8.5).lines;
    var row = function (l, r) {
      return new docx.Paragraph({
        tabStops: [{ type: docx.TabStopType.RIGHT, position: INNER_W - 260 }],
        spacing: { line: 260, lineRule: docx.LineRuleType.EXACT, before: 0, after: 0 },
        children: [new docx.TextRun({ children: [l, new docx.Tab(), r], size: 18 })]
      });
    };
    var edge = { style: docx.BorderStyle.SINGLE, size: 12, color: "000000" };
    var box = new docx.Table({
      width: { size: INNER_W, type: docx.WidthType.DXA },
      columnWidths: [INNER_W], layout: docx.TableLayoutType.FIXED,
      rows: [new docx.TableRow({
        cantSplit: true,
        children: [new docx.TableCell({
          width: { size: INNER_W, type: docx.WidthType.DXA },
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          borders: { top: edge, bottom: edge, left: edge, right: edge },
          children: [
            new docx.Paragraph({
              alignment: docx.AlignmentType.CENTER,
              spacing: { line: tsz * 12, lineRule: docx.LineRuleType.EXACT, before: 0, after: 0 },
              children: [new docx.TextRun({ text: h.title.toUpperCase(), bold: true, size: tsz, characterSpacing: 20 })]
            }),
            row("Test:- " + h.test, "M.M;- " + h.mm),
            row("DATE ;- " + h.date, "CLASS;- " + h.cls)
          ]
        })]
      })]
    });
    var ip = new docx.Paragraph({
      alignment: docx.AlignmentType.CENTER,
      spacing: { line: 240, lineRule: docx.LineRuleType.EXACT, before: 60, after: 60 },
      children: [new docx.TextRun({ text: instr, bold: true, italics: true, size: 17 })]
    });
    return { children: [box, ip], h: (tsz * 12 + 520 + 120 + 24 + il * 240 + 120) };
  }

  /* ---- distribute MCQ blocks into columns (as many as needed, up to maxCols) --- */
  function distribute(blocks, headerH, maxCols) {
    var cols = [[]], usedArr = [0], ci = 0, dropped = 0;
    blocks.forEach(function (b) {
      var avail = COL_H - (ci < 2 ? headerH : 0);
      // question tab tak isi column me jaata hai jab tak jagah ho (serial order); aakhri question ka trailing gap count nahi hota
      if (usedArr[ci] > 0 && usedArr[ci] + b.h - SPACER * SAFETY > avail - FIT_GUARD) {
        if (ci + 1 >= maxCols) { dropped++; return; }
        ci++; cols.push([]); usedArr.push(0);
      }
      cols[ci].push(b);
      usedArr[ci] += b.h;
    });
    // bhare hue (aakhri ke alawa) columns ko neeche tak stretch karo: bacha hua space questions ke beech baant do
    var extras = cols.map(function (c, i) {
      if (i >= cols.length - 1 || c.length < 2) return 0;
      var left = (COL_H - (i < 2 ? headerH : 0)) - usedArr[i] - BOTTOM_GUARD;
      return left > 0 ? Math.min(MAX_EXTRA, Math.floor(left / (c.length - 1))) : 0;
    });
    return { cols: cols, extras: extras, dropped: dropped };
  }

  function halfCell(children) {
    return new docx.TableCell({
      width: { size: HALF_W, type: docx.WidthType.DXA },
      verticalAlign: docx.VerticalAlign.TOP,
      margins: { top: PAD_Y, bottom: PAD_Y, left: PAD_X, right: PAD_X },
      children: children
    });
  }

  function fmtDate(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || "");
    return m ? m[3] + "/" + m[2] + "/" + m[1] : "__/__/____";
  }
  function val(id) { var el = document.getElementById(id); return el ? el.value || "" : ""; }

  /* ---- main ------------------------------------------------------------ */
  window.exportPaperFormatWord = async function () {
    var all = collectQuestions();
    if (!all.length) { alert("Pehle paper mein kam se kam ek question add karein."); return; }
    if (!window.docx && window.__ensureLib) { try { await window.__ensureLib("docx"); } catch (e) {} }
    if (!window.docx || typeof htmlToDocxRuns !== "function" || typeof mathToWordHtml !== "function") {
      alert("Word export library load nahi hui — internet check karke page reload karein.");
      return;
    }

    var savedCls = ""; try { savedCls = localStorage.getItem(CLASS_KEY) || ""; } catch (e) {}
    var cls = prompt("Header me Class kya likhna hai? (e.g. 9TH)", savedCls);
    if (cls === null) return;
    cls = cls.trim();
    try { localStorage.setItem(CLASS_KEY, cls); } catch (e) {}

    var mcq = all.filter(function (q) { return q.qType !== "subjective"; });
    var sub = all.filter(function (q) { return q.qType === "subjective"; });

    var brand = (window.SnapBrand && SnapBrand.plain) ? SnapBrand.plain("SAVYASACHI COACHING") : "SAVYASACHI COACHING";
    var header = buildHeader({
      title: brand,
      test: val("subject"),
      mm: val("maxMarks"),
      date: fmtDate(val("testDate")),
      cls: cls,
      instr: val("instructions") || "सभी प्रश्न अनिवार्य हैं। प्रत्येक प्रश्न के लिए एक ही सही उत्तर है।"
    });

    var mcqBlocks = mcq.map(function (q, i) { return mcqBlock(i + 1, q); });

    // subjective pages (single column per page); instruction sirf pehle subjective page par
    var SUB_INSTR_H = 400;
    var subPages = [], cur = [], used = 0;
    sub.map(function (q, i) { return subBlock(i + 1, q); }).forEach(function (b) {
      var avail = COL_H - (subPages.length === 0 ? SUB_INSTR_H : 0);
      if (cur.length && used + b.h > avail) { subPages.push(cur); cur = []; used = 0; }
      cur.push(b); used += b.h;
    });
    if (cur.length) subPages.push(cur);
    var subDropped = 0;
    while (subPages.length > MAX_PAGES - 1) subDropped += subPages.pop().length;
    var sp = subPages.length;

    var dist = distribute(mcqBlocks, header.h, (MAX_PAGES - sp) * 2);
    var mp = Math.max(1, Math.ceil(dist.cols.length / 2));
    var N = Math.max(4, Math.ceil((mp + sp) / 4) * 4);          // total booklet pages: 4, 8, 12 ... 40

    var dropped = dist.dropped + subDropped;
    if (dropped > 0) {
      if (!confirm("⚠️ " + dropped + " question 40 page ki limit me nahi aa rahe.\nBaaki questions ke saath file bana dein?")) return;
    }

    // half-page content by booklet page number
    var pageKids = {};
    for (var p = 1; p <= N; p++) {
      var kids = [];
      if (p <= mp) {
        if (p === 1) kids = kids.concat(header.children);
        kids.push(colsTable(dist.cols[(p - 1) * 2] || [], dist.cols[(p - 1) * 2 + 1] || [], dist.extras[(p - 1) * 2], dist.extras[(p - 1) * 2 + 1]));
        kids.push(spacer());
      } else if (p > N - sp) {
        var si = p - (N - sp) - 1, blocks = subPages[si];
        if (si === 0) kids.push(new docx.Paragraph({
          alignment: docx.AlignmentType.RIGHT,
          spacing: { line: 240, lineRule: docx.LineRuleType.EXACT, before: 0, after: 120 },
          children: [new docx.TextRun({ text: "Instructions: सभी प्रश्न अनिवार्य हैं।", bold: true, italics: true, size: 17 })]
        }));
        blocks.forEach(function (b) { kids = kids.concat(b.children); });
      } else kids.push(spacer());
      pageKids[p] = kids;
    }

    // booklet imposition for ANY multiple of 4:  front [N-2s, 1+2s], back [2+2s, N-1-2s]
    var pairs = [];
    for (var s2 = 0; s2 < N / 4; s2++) { pairs.push([N - 2 * s2, 1 + 2 * s2]); pairs.push([2 + 2 * s2, N - 1 - 2 * s2]); }

    var sections = pairs.map(function (pair, si2) {
      var isLast = si2 === pairs.length - 1;
      return {
        properties: { page: {
          size: { width: 11906, height: 16838, orientation: docx.PageOrientation.LANDSCAPE },
          margin: { top: PAGE_M, bottom: PAGE_M, left: PAGE_M, right: PAGE_M, header: HF_DIST, footer: HF_DIST }
        } },
        children: [
          new docx.Table({
            width: { size: HALF_W * 2, type: docx.WidthType.DXA },
            columnWidths: [HALF_W, HALF_W], layout: docx.TableLayoutType.FIXED,
            borders: noBorders(),
            rows: [new docx.TableRow({
              cantSplit: true,
              height: { value: ROW_H, rule: docx.HeightRule.EXACT },
              children: [halfCell(pageKids[pair[0]]), halfCell(pageKids[pair[1]])]
            })]
          })
        ].concat(isLast ? [new docx.Paragraph({
          spacing: { line: 20, lineRule: docx.LineRuleType.EXACT, before: 0, after: 0 },
          children: [new docx.TextRun({ text: "", size: 2 })]
        })] : [])
      };
    });

    var doc = new docx.Document({
      // math bhi body size me aaye; default paragraph 1pt exact => docx.js ka section-break paragraph page ke neeche
      // extra jagah nahi leta (yehi "blank page" ka reason tha)
      styles: { default: { document: {
        run: { size: SZ },
        paragraph: { spacing: { line: 20, lineRule: docx.LineRuleType.EXACT, before: 0, after: 0 } }
      } } },
      sections: sections
    });

    var filename = "Paper_" + (val("testNo") || "Test") + ".docx";
    try {
      var blob = await docx.Packer.toBlob(doc);
      try {
        var file = new File([blob], filename, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: filename, text: "Test paper (Word file)" });
          if (typeof toast === "function") toast("📄 Paper Format Word share ho gayi!");
          return;
        }
      } catch (shareErr) { console.warn("Share failed, downloading instead:", shareErr); }
      var url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      if (typeof toast === "function") toast("📄 Paper Format Word: " + N + " page (" + (N / 2) + " Word page) — download shuru!");
    } catch (err) {
      console.error(err);
      alert("Paper Format Word banane mein error: " + (err.message || err));
    }
  };

})();
