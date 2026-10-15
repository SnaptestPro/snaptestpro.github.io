/* ============================================================
   SnapTest Pro — APP CONFIG (Owner/Developer ek hi jagah se badle)
   Yahan jo likhoge wahi Student app aur Admin app dono ke
   Help & Support / About me dikhega. Khaali ("") chhodne par wo
   option apne-aap chhup jata hai.
   ============================================================ */
window.SNAP_CONFIG = {
  appName: "SnapTestPro",
  serverAuth: false,   // Phase 4: true karne par login/register/PIN Worker se (salted hash + rate limit). Pehle docs/PHASE4_AUTH.md padhein.
  appCheck: {
    enabled: true,
    webSiteKey: "",           // Firebase Console > App Check > Web app reCAPTCHA v3 site key; public site key only
    nativeEnabled: true,
    tokenAutoRefresh: true
  },
  tagline: "Smart Practice • Better Result",
  version: "1.4.8",
  workerUrl: "https://cool-thunder-a280.vishnu1234stm.workers.dev",   // Cloudflare Worker (bank + push + owner alerts)
  ownFiles: false,                                                    // Cloudflare R2 (card chahiye) band — file upload ab Google Drive se
  googleClientId: "",                                                 // <-- yahan Google OAuth Web Client ID daalein (DRIVE_SETUP_HINDI.md dekhein). Khaali = Drive upload band
  driveUpload: true,
  githubRepo: "SnaptestPro/snaptestpro.github.io",                   // Owner Panel ke "📱 APK" button ke liye
  webUrl: "https://snaptestpro.github.io/",
  graceDays: 3,                                                       // plan expire ke baad itne din app chalta rehta hai (rules me bhi 3 din)
  plans: {                                                            // Owner Panel ke "Branding & Plan" ke preset — number aap badal sakte ho
    Free:    { studentLimit: 30,   storageLimitMB: 500 },
    Basic:   { studentLimit: 150,  storageLimitMB: 3000 },
    Pro:     { studentLimit: 500,  storageLimitMB: 10000 },
    Premium: { studentLimit: 2000, storageLimitMB: 30000 },
    Custom:  {}
  },
  appLock: true,                                                      // institute-APK / ?inst= link lock + "app band hai" screen (kill-switch)
  snapLive: false,                                                    // true tab karein jab Cloudflare R2 (LIVE_R2) set ho jaye — tab "SnapLive" option dikhega
  ownerAlertEmail: "vishnu1234stm@gmail.com",                         // is email se login par owner app me alerts ka push aata hai
  build: "202",
  ownerName: "Vishnu Sharma",
  supportPhone: "9525208263",
  supportWhatsapp: "9525208263",          // WhatsApp number (khaali = phone wala use hoga)
  supportEmail: "vishnu1234stm@gmail.com",
  supportHours: "Roz 10:00 AM – 7:00 PM",
  website: "https://snaptestpro.github.io",
  privacyUrl: "/privacy.html",            // Privacy Policy
  termsUrl: "/terms.html",                // Terms & Conditions
  privacyVersion: "2026-10-15-v1",
  termsVersion: "2026-10-15-v1",
  adminFaqs: [
    ["Naya test kaise banayein?", "Admin Dashboard → Tests → Naya Test. Questions Question Bank se chunein, time/marks set karein aur Publish karein."],
    ["Students ko notification kaise bhejein?", "Dashboard → 🔔 Notification. Title aur message likhkar 'Students ko bhejein' dabayein. App band hone par bhi students ko mil jata hai."],
    ["Student ka password bhool gaya?", "Records / Students list me us student ko chunkar Password Reset karein."],
    ["Nayi class ya subject kaise jodein?", "Owner se contact karein — class list institute ke hisaab se Owner Panel se set hoti hai."],
    ["Data ya result nahi dikh raha?", "Settings → App & Data → 'Cache saaf karke refresh' dabayein. Login bana rahega."]
  ]
};
