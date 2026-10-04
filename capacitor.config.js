// Android app config. Web version isko use nahi karta — sirf GitHub Actions / Android build.
// APP_ID  : Android package name (Play Store par jo pehle se hai wahi rakhein, warna update nahi hoga)
// APP_URL : (optional) agar set ho to app seedha live website khulti hai (web update = app update).
//           Khaali ho to app apni bundled copy (www/) se chalti hai.
const appUrl = (process.env.APP_URL || '').trim();
module.exports = {
  appId: process.env.APP_ID || 'com.snaptestpro.app',
  appName: process.env.APP_NAME || 'SnapTest Pro',
  webDir: 'www',
  backgroundColor: '#060513',
  android: { allowMixedContent: false },
  server: Object.assign(
    { androidScheme: 'https' },
    appUrl ? { url: appUrl, cleartext: false } : {}
  )
};
