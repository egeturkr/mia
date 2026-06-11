# MIA Masaüstü Uygulaması (Electron kabuk)

Canlı web uygulamasını (miaissagligi.com) güvenli pencerede açar — giriş, panel,
canlı kamera paneli, analiz aynen çalışır. Web deploy'undan tamamen bağımsızdır.

## Geliştirme
```bash
cd apps/desktop
npm install
npm start
```

## Dağıtım paketleri
```bash
npm run dist:win     # Windows .exe (NSIS) — Windows'ta veya wine ile
npm run dist:mac     # macOS .dmg — yalnız macOS'ta; imza için Apple Developer hesabı
npm run dist:linux   # AppImage + .deb
```
`icon.png` (512×512, images/logo'dan üretin) ekleyin; yoksa varsayılan ikon kullanılır.

## Güvenlik notları
- nodeIntegration kapalı, contextIsolation+sandbox açık.
- Yalnız miaissagligi.com içinde gezinilir; dış linkler sistem tarayıcısında açılır.
- RTSP kimlik bilgisi/secret bu uygulamada saklanmaz.
- Otomatik güncelleme v1'de YOK — yeni sürüm dağıtımı manuel (build guide'a bakın).
