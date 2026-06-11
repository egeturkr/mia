# MIA Mobil Uygulaması (Capacitor kabuk)

Canlı web uygulamasını native WebView'da açar: giriş, panel, ihlal incelemesi,
raporlar, kamera olayları görüntüleme. Ağır AI işleme cihazda YAPILMAZ
(RTSP işleme worker'dadır). Push bildirimleri v2 (şimdilik e-posta bildirimleri).

## Kurulum
```bash
cd apps/mobile
npm install
npm run add:android   # android/ projesi üretir (Android Studio gerekir)
npm run add:ios       # ios/ projesi üretir (yalnız macOS + Xcode)
npm run sync
npm run open:android  # veya open:ios
```

## Yayın gereksinimleri (dürüst)
- **Android:** keystore ile imzalama + Google Play Console hesabı ($25 tek seferlik).
- **iOS:** Apple Developer hesabı ($99/yıl) + App Store incelemesi. Apple, salt
  web-sarmalayıcı uygulamaları reddedebilir (Guideline 4.2) — yayına çıkmadan
  push bildirimi gibi en az bir native özellik eklemek gerekir.
- `android/` ve `ios/` klasörleri üretilen dosyalardır, repo'ya eklemeyin.

Detay: docs/DESKTOP_MOBILE_APP_BUILD_GUIDE.md
