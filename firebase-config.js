/* Firebase client bootstrap. Firebase API configuration is public client
   metadata; access control belongs in Security Rules and App Check. */
var firebaseConfig = {
  apiKey: "AIzaSyBTrkAoQ2T9KNB2vcacv4EPehaDboXmUxk",
  authDomain: "the-vishnu-sharma-test.firebaseapp.com",
  projectId: "the-vishnu-sharma-test",
  storageBucket: "the-vishnu-sharma-test.firebasestorage.app",
  messagingSenderId: "57228202591",
  appId: "1:57228202591:web:6011f163e5ed22c1ba8dea",
  measurementId: "G-FYQB0PX72R"
};

window.vishnuFirebase = {
  db: null,
  storage: null,
  auth: null,
  enabled: false,
  authReady: null,
  appCheckReady: null,
  appCheckState: "off"
};

function startFirebaseAppCheck() {
  var config = (window.SNAP_CONFIG || {}).appCheck || {};
  if (!config.enabled) return Promise.resolve("disabled");

  var C = window.Capacitor;
  var native = false;
  try { native = !!(C && (C.isNativePlatform ? C.isNativePlatform() : C.platform && C.platform !== "web")); } catch (e) {}
  if (native && config.nativeEnabled && C && typeof C.nativePromise === "function") {
    return C.nativePromise("FirebaseAppCheck", "initialize", {
      isTokenAutoRefreshEnabled: config.tokenAutoRefresh !== false
    }).then(function () {
      window.vishnuFirebase.appCheckState = "initialized:android-play-integrity";
      return window.vishnuFirebase.appCheckState;
    }).catch(function (error) {
      window.vishnuFirebase.appCheckState = "native-init-failed";
      console.warn("Firebase App Check native initialization failed", error && error.message || error);
      return window.vishnuFirebase.appCheckState;
    });
  }

  var siteKey = String(config.webSiteKey || "").trim();
  if (siteKey && typeof firebase.appCheck === "function") {
    try {
      var activation = firebase.appCheck().activate(siteKey, config.tokenAutoRefresh !== false);
      return Promise.resolve(activation).then(function () {
        window.vishnuFirebase.appCheckState = "initialized:web-recaptcha-v3";
        return window.vishnuFirebase.appCheckState;
      }).catch(function (error) {
        window.vishnuFirebase.appCheckState = "web-init-failed";
        console.warn("Firebase App Check web initialization failed", error && error.message || error);
        return window.vishnuFirebase.appCheckState;
      });
    } catch (error) {
      window.vishnuFirebase.appCheckState = "web-init-failed";
      console.warn("Firebase App Check web initialization failed", error && error.message || error);
      return Promise.resolve(window.vishnuFirebase.appCheckState);
    }
  }

  window.vishnuFirebase.appCheckState = native ? "native-plugin-unavailable" : "web-site-key-missing";
  console.warn("Firebase App Check is not activated:", window.vishnuFirebase.appCheckState);
  return Promise.resolve(window.vishnuFirebase.appCheckState);
}

try {
  if (typeof firebase !== "undefined") {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    window.vishnuFirebase.appCheckReady = startFirebaseAppCheck();
    window.vishnuFirebase.db = firebase.firestore();
    /* v200: kuch mobile network/WebView me Firestore ka normal connection atak jaata hai ("Backend didn't respond within 10 seconds").
       Auto-detect ON: atakne par SDK khud long-polling par chala jaata hai. Fail ho to app pehle jaisa chalta hai. */
    try { window.vishnuFirebase.db.settings({ experimentalAutoDetectLongPolling: true, merge: true }); } catch (error) { console.warn("Firestore long-polling setting skip", error && error.message); }
    try { window.vishnuFirebase.storage = firebase.storage(); }
    catch (error) { console.warn("Firebase Storage unavailable", error); }

    try {
      window.vishnuFirebase.db.enablePersistence({ synchronizeTabs: true }).catch(function (error) {
        console.warn("Firestore offline persistence enable nahi ho payi:", error && error.code);
      });
    } catch (error) { console.warn("Firestore offline persistence setup error", error); }

    try {
      window.vishnuFirebase.auth = firebase.auth();
      window.vishnuFirebase.authReady = new Promise(function (resolve) {
        var signInStarted = false, unsubscribe = function () {};
        unsubscribe = window.vishnuFirebase.auth.onAuthStateChanged(function (user) {
          if (user) { unsubscribe(); resolve(user); return; }
          if (signInStarted) return;
          signInStarted = true;
          Promise.resolve(window.vishnuFirebase.appCheckReady).then(function () {
            return window.vishnuFirebase.auth.signInAnonymously();
          }).catch(function (error) {
            console.warn("Anonymous sign-in failed (enable it in Firebase Console > Authentication)", error);
            unsubscribe(); resolve(null);
          });
        }, function (error) {
          console.warn("Firebase Auth state listener failed", error);
          unsubscribe(); resolve(null);
        });
      });
    } catch (error) { console.warn("Firebase Auth unavailable", error); }

    window.vishnuFirebase.enabled = true;
  }
} catch (error) { console.warn("Firebase unavailable", error); }
