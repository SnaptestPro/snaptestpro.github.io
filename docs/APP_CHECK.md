# Firebase App Check rollout

`app-config.js` has an App Check feature switch and an intentionally blank public reCAPTCHA v3 site key. `firebase-config.js` starts the web compat provider when that key is configured and starts the Capacitor Firebase App Check plugin on native platforms. Android uses the native Firebase provider, Play Integrity. Automatic token refresh is enabled. The current code reports provider startup state through `window.vishnuFirebase.appCheckState` and continues to allow the app to start when the provider has not yet been configured.

## Required Firebase Console setup

1. In Firebase Console, register the deployed website under App Check with reCAPTCHA v3 and copy the **site key** (never the secret key) to `app-config.js > appCheck.webSiteKey`.
2. Register the Android app in Firebase App Check, link the Google Play Integrity API, and register the release app signing SHA-256 fingerprint. The app must use the same Firebase Android app/project as its `google-services.json`.
3. Install the Capacitor 6 compatible plugin by running the normal dependency install and `npx cap sync android`; build and inspect a signed internal-test APK.
4. Enable App Check metrics/monitoring for Firestore, Storage and Authentication in Firebase Console. Observe real web, PWA and Play-distributed APK traffic through a full release cycle.
5. Enforce one Firebase product at a time only after verified traffic is healthy and unsupported clients are understood. Rollback by disabling enforcement in Firebase Console.

Do not enable enforcement from this repository: it cannot verify Console provider registrations or live traffic. The Worker API is a separate custom backend. Firebase product enforcement does not validate Worker requests; before protecting those endpoints, send an App Check token and verify it with Firebase Admin in the Worker/server. Do not claim those routes are App Check protected until server verification exists.

The project currently uses Capacitor 6 and the matching `@capacitor-firebase/app-check` 6.x plugin. Its maintainers mark the 6.x line deprecated; keep this compatibility dependency only for the current Capacitor major and plan a coordinated Capacitor/plugin major upgrade. See the [plugin usage guide](https://github.com/capawesome-team/capacitor-firebase/blob/main/packages/app-check/README.md).

References: [Firebase App Check for Web](https://firebase.google.com/docs/app-check/web/recaptcha-provider), [Firebase App Check for Android with Play Integrity](https://firebase.google.com/docs/app-check/android/play-integrity-provider).
