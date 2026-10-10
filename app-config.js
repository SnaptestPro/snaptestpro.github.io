/* ============================================================
   SnapTest Pro — APP CONFIG (Owner/Developer ek hi jagah se badle)
   Yahan jo likhoge wahi Student app aur Admin app dono ke
   Help & Support / About me dikhega. Khaali ("") chhodne par wo
   option apne-aap chhup jata hai.
   ============================================================ */
window.SNAP_CONFIG = {
  appName: "SnapTestPro",
  tagline: "Smart Practice • Better Result",
  version: "1.1",
  workerUrl: "https://cool-thunder-a280.vishnu1234stm.workers.dev",   // Cloudflare Worker (bank + push + owner alerts)
  ownerAlertEmail: "vishnu1234stm@gmail.com",                         // is email se login par owner app me alerts ka push aata hai
  build: "168",
  ownerName: "Vishnu Sharma",
  supportPhone: "9525208263",
  supportWhatsapp: "9525208263",          // WhatsApp number (khaali = phone wala use hoga)
  supportEmail: "vishnu1234stm@gmail.com",
  supportHours: "Roz 10:00 AM – 7:00 PM",
  website: "https://snaptestpro.github.io",
  privacyUrl: "",                         // Privacy Policy ka link (khaali = chhup jayega)
  termsUrl: "",                           // Terms & Conditions ka link
  adminFaqs: [
    ["Naya test kaise banayein?", "Admin Dashboard → Tests → Naya Test. Questions Question Bank se chunein, time/marks set karein aur Publish karein."],
    ["Students ko notification kaise bhejein?", "Dashboard → 🔔 Notification. Title aur message likhkar 'Students ko bhejein' dabayein. App band hone par bhi students ko mil jata hai."],
    ["Student ka password bhool gaya?", "Records / Students list me us student ko chunkar Password Reset karein."],
    ["Nayi class ya subject kaise jodein?", "Owner se contact karein — class list institute ke hisaab se Owner Panel se set hoti hai."],
    ["Data ya result nahi dikh raha?", "Settings → App & Data → 'Cache saaf karke refresh' dabayein. Login bana rahega."]
  ]
};
