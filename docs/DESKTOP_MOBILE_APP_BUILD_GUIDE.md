# MIA Masaüstü + Mobil Build Rehberi

Her iki kabuk da canlı siteyi yükler — web deploy'u tek gerçek kaynak.
Bu ortamda build ÜRETİLMEDİ (platform araçları gerekir); adımlar aşağıda.

## Masaüstü (Electron — apps/desktop)
Gerekenler: Node 18+, npm.
```bash
cd apps/desktop && npm install
npm start                 # geliştirme: pencere açılır, giriş/panel test edilir
npm run dist:win          # Windows NSIS .exe  (Windows'ta çalıştırın)
npm run dist:mac          # macOS .dmg         (yalnız macOS; imza: Apple Dev hesabı)
npm run dist:linux        # AppImage + .deb
```
- `icon.png` (512×512) ekleyin — images/logo-horizontal-trim.png'den kare ikon üretin.
- macOS imzasız .dmg Gatekeeper uyarısı verir; dağıtım için Developer ID imzası gerekir.
- Otomatik güncelleme v1'de yok; yeni sürümde dosyayı yeniden dağıtın.

## Mobil (Capacitor — apps/mobile)
Gerekenler: Node 18+; Android için Android Studio + SDK; iOS için macOS + Xcode.
```bash
cd apps/mobile && npm install
npm run add:android && npm run sync && npm run open:android   # Android Studio'da Run
npm run add:ios && npm run sync && npm run open:ios           # Xcode'da Run (yalnız macOS)
```
### Yayın kontrol listesi
- [ ] Android: keystore üret (`keytool`), `android/` içinde signing config, AAB üret,
      Play Console ($25) — veri güvenliği formunda kamera/KVKK beyanları.
- [ ] iOS: Apple Developer ($99/yıl), bundle id `com.miaissagligi.app`, TestFlight →
      App Store incelemesi. **Risk:** salt web-sarmalayıcı reddi (Guideline 4.2) —
      yayın öncesi push bildirimi eklenmesi önerilir (v2).
- [ ] Her ikisi: gizlilik politikası URL'si = miaissagligi.com/gizlilik.html
- [ ] Uygulama ikonları + splash (Capacitor assets aracı: `npx capacitor-assets generate`).

## Ortam değişkenleri
Kabuklar secret TAŞIMAZ. Tek yapılandırma uygulama URL'sidir:
masaüstü `MIA_APP_URL` env (vars. miaissagligi.com), mobil capacitor.config.json.

## Sürüm stratejisi
Web her push'ta güncellenir → kabuk içeriği otomatik günceldir. Kabuk binary'si
yalnız kabuk kodu değişince yeniden dağıtılır (nadir).
