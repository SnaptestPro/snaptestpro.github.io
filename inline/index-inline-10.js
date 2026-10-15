
// ══════════════════════════════════════════════════════════════
//  MATH EQUATION CONVERTER — Batch (Firebase) + Auto (on save)
// ══════════════════════════════════════════════════════════════

function needsMathConversion(q) {
  if (!q) return false;
  const subject = (q.subject || '').toLowerCase();
  const isMath = /math|गणित|maths/.test(subject);
  if (!isMath) return false;
  const fields = [q.textHI, q.textEN, q.text, ...(q.optionsHI||[]), ...(q.optionsEN||[]), ...(q.options||[])];
  const hasLatex = fields.some(f => f && /\\\(|\\\[|\$\$|\\frac|\\sqrt|\\cdot|\\times/.test(f));
  if (hasLatex) return false;
  return fields.some(f => f && /[=+\-*\/^√π≤≥≠×÷]|\b\d+\s*\/\s*\d+\b|\bsqrt\b|\b(sin|cos|tan|log)\b/i.test(f));
}

async function batchConvertMathEquations() {
  const db = window.getDB ? window.getDB() : null;
  if (!db) { alert('Firebase connected nahi hai.'); return; }

  const btn = document.getElementById('batch-convert-btn');
  let logEl = document.getElementById('batch-convert-log');
  if (!logEl) {
    logEl = document.createElement('div');
    logEl.id = 'batch-convert-log';
    logEl.style.cssText = 'margin-top:6px;padding:8px 12px;background:#f5f3ff;border-left:3px solid #7c3aed;border-radius:8px;font-size:.78rem;color:#5b21b6;max-height:150px;overflow-y:auto;';
    btn.parentNode.insertBefore(logEl, btn.nextSibling);
  }
  logEl.style.display = 'block';
  logEl.innerHTML = '';
  const log = msg => { logEl.innerHTML += '<div>' + msg + '</div>'; logEl.scrollTop = logEl.scrollHeight; };

  const toConvert = (window.questionBank || []).filter(needsMathConversion);
  if (!toConvert.length) {
    log('✅ Sab Math questions already equation format mein hain!');
    return;
  }
  if (!confirm(toConvert.length + ' Math questions mein plain text equations hain. Inhe LaTeX format mein convert karein?\n\nYe undo nahi hoga.')) return;

  btn.disabled = true;
  btn.textContent = '⏳ Converting...';
  log('🔍 ' + toConvert.length + ' questions convert ho rahe hain...');

  let success = 0, failed = 0;
  for (let i = 0; i < toConvert.length; i++) {
    const q = Object.assign({}, toConvert[i]);
    try {
      if (window.autoFormatMathFields) window.autoFormatMathFields(q);
      const id = q.id;
      const data = Object.assign({}, q);
      delete data.id;
      await db.collection('questionBank').doc(id).set(data, { merge: true });
      success++;
      if ((i + 1) % 10 === 0 || i === toConvert.length - 1)
        log('✔️ ' + (i+1) + '/' + toConvert.length + ' done...');
    } catch(e) {
      failed++;
      log('❌ Q' + (i+1) + ' fail: ' + (e.message||e));
    }
  }
  log('<br/><strong>🎉 Complete! ' + success + ' converted, ' + failed + ' failed.</strong>');
  btn.disabled = false;
  btn.textContent = '🧮 Convert to Equations';
  if (window.syncBank) window.syncBank();
}

window.batchConvertMathEquations = batchConvertMathEquations;
window.needsMathConversion = needsMathConversion;
