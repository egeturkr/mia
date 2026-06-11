# MIA Uygulama Yapılandırması (ortak)

Tüm kabuklar (masaüstü/mobil) TEK web uygulamasını yükler: **https://miaissagligi.com**
Ayrı kod tabanı yok — web'e atılan her deploy anında tüm platformlara yansır.

| Platform | Teknoloji | Hedef | Durum |
|---|---|---|---|
| Web | Statik HTML/JS (Netlify) | tarayıcı | CANLI |
| Windows/macOS/Linux | Electron kabuk | apps/desktop | iskelet hazır, build manuel |
| Android/iOS | Capacitor kabuk | apps/mobile | iskelet hazır, build manuel |
| RTSP işleme | Python worker | workers/realtime-camera-worker | ayrı sunucu gerektirir |

Kurallar:
- Kabuklarda secret/API anahtarı/RTSP kimlik bilgisi SAKLANMAZ.
- Kimlik doğrulama her platformda aynı Supabase oturumudur (WebView/Window içinde).
- URL değişirse: desktop `main.js` ALLOWED_HOSTS + `MIA_APP_URL`, mobile `capacitor.config.json`.
