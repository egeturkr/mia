# MIA Sürüm Klasörü

Gerçek build artefaktları buraya konur. **Sahte/boş yükleyici dosyası ASLA konmaz.**
Şu an hiçbir artefakt yok — `manifest.json` artifacts listesi boştur (dürüst durum).

## Yapı
```
releases/
  manifest.json        # gerçek artefakt listesi (script günceller)
  checksums.sha256     # yalnız gerçek dosyalar için (script üretir)
  desktop/windows|macos|linux/
  mobile/android|ios/
```

## Build üretimi (yerel Mac — sandbox'ta Electron binary'si indirilemiyor)
```bash
cd apps/desktop && npm install
npm run dist:mac     # → dist/*.dmg  → releases/desktop/macos/ kopyala
npm run dist:linux   # → AppImage/deb → releases/desktop/linux/
npm run dist:win     # Windows makinesinde → releases/desktop/windows/
```
Sonra: `bash scripts/verify-release-artifacts.sh` → checksum + manifest güncellenir.

## Yayın şartı (atlanamaz)
imza (Win Authenticode / mac notarization / Android keystore) → SHA256 → malware
taraması → sürüm notu → ancak o zaman download.html'e link eklenir.
**Büyük binary'ler git'e COMMIT EDİLMEZ** (.gitignore) — dağıtım ayrı kanaldan
(S3/Netlify Large Media/sürüm sunucusu) yapılır; repo yalnız manifest+checksum tutar.
