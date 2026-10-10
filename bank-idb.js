/* v168 — Question bank ka IndexedDB cache.
   Kyun: bank ~7.5MB hai; localStorage ki limit (~5M chars) se bada, isliye pehle cache save hota hi nahi tha aur har app-open par
   poora bank dobara download + parse hota tha (student ko "load ho raha hai" dikhta tha). IndexedDB me ye aaram se save hota hai.
   Ye file sirf helper deti hai: window.__bankIdb.get() / .put(arr). Kabhi throw nahi karti. */
(function () {
  "use strict";
  var DB = "snap_bank_db_v1", ST = "kv", KEY = "bank";
  function open() {
    return new Promise(function (res) {
      try {
        var r = indexedDB.open(DB, 1);
        r.onupgradeneeded = function () { try { r.result.createObjectStore(ST); } catch (e) {} };
        r.onsuccess = function () { res(r.result); };
        r.onerror = r.onblocked = function () { res(null); };
      } catch (e) { res(null); }
    });
  }
  window.__bankIdb = {
    get: function () {
      return open().then(function (db) {
        if (!db) return null;
        return new Promise(function (res) {
          try {
            var q = db.transaction(ST, "readonly").objectStore(ST).get(KEY);
            q.onsuccess = function () { var v = q.result; res(v && Array.isArray(v.arr) ? v.arr : null); };
            q.onerror = function () { res(null); };
          } catch (e) { res(null); }
        });
      }).catch(function () { return null; });
    },
    put: function (arr) {
      return open().then(function (db) {
        if (!db) return false;
        return new Promise(function (res) {
          try {
            var tx = db.transaction(ST, "readwrite"); tx.objectStore(ST).put({ arr: arr, ts: Date.now() }, KEY);
            tx.oncomplete = function () { res(true); }; tx.onerror = tx.onabort = function () { res(false); };
          } catch (e) { res(false); }
        });
      }).catch(function () { return false; });
    }
  };
})();
