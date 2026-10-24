# Brand name inventory (v239) — "SnapTest Pro" -> "SmarTest Pro"

Sirf **display labels** badle gaye (title, manifest name, splash/header, "Powered by", privacy/terms/pitch pages, notification titles, Android launcher label default).

## Jaan-boojh kar NAHI badla (technical identifiers)
| Kya | Kahan | Kyun |
|---|---|---|
| `com.snaptestpro.*` package/application IDs | capacitor.config.js, workflows, fetch-institute.js | Play/APK identity; badalne par app update nahi hota |
| Google Drive folder `"SnapTest Pro"` | drive-upload.js | Isi naam se purana folder dhoondha jata hai; badalne par institutes ki files "gayab" dikhengi |
| `SnapTestProApp` (User-Agent marker) | inline/index-inline-02.js | App-vs-web detection |
| `SnapTestPro.apk` release asset / `app-b<N>` tags | build-android.yml, app-version.json | Purane install links + auto-update |
| `snaptestpro.github.io`, `SnaptestPro/...` GitHub repo/URLs | everywhere | Production URLs |
| Firebase project ID `the-vishnu-sharma-test` | firebase-config.js | Project identity |
| localStorage keys `snap_*`, Worker service name `snaptestpro-push`, Firestore collections | various | Data compatibility |
| Purane docs/notes/changelog, tests ke history comments | docs/, notes/ | Itihaas |

Naya package ID / URL chahiye ho to alag migration plan banega — display rename ke saath mat milao.
