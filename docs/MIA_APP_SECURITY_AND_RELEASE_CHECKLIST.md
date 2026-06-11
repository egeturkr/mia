# MIA Uygulama Güvenlik ve Sürüm Kontrol Listesi (Faz 15)

**Dürüst dil:** Kaynak kod ve yapılandırma güvenli olacak şekilde tasarlandı,
ancak HER sürüm artefaktı dağıtımdan önce imzalanmalı ve taranmalıdır.
Taranmamış hiçbir build için "virüssüz" İDDİA EDİLMEZ.

## Masaüstü (Electron) — kod tarafı (doğrulandı ✓)
- [x] nodeIntegration: false
- [x] contextIsolation: true
- [x] sandbox: true
- [x] Gezinme yalnız miaissagligi.com (ALLOWED_HOSTS)
- [x] Dış linkler sistem tarayıcısında (shell.openExternal)
- [x] preload yok (tehlikeli API açığa çıkmaz)
- [x] service_role / Roboflow / RTSP / kamera kimlik bilgisi YOK
- [x] eval / uzak kod çalıştırma yok
- [x] Gereksiz izin yok
## Masaüstü — sürüm tarafı (HER build'de tekrarla)
- [ ] `npm audit` temiz (veya bilinen istisnalar belgelendi)
- [ ] Bağımlılık gözden geçirme (electron/electron-builder sürümleri güncel)
- [ ] Windows: Authenticode code signing (sertifika gerekir)
- [ ] macOS: Developer ID imza + notarization (`xcrun notarytool`)
- [ ] Linux: AppImage/deb + checksum
- [ ] SHA256 manifest üret (`scripts/verify-release-artifacts.sh`)
- [ ] Antivirüs/malware taraması (VirusTotal vb.) — sonucu sürüm notuna yaz
- [ ] Sürüm notları + sürüm numarası (package.json version)
- [ ] download.html durumu güncelle (yalnız imzalı+taranmış build yayınlanır)

## Mobil (Capacitor) — kod tarafı (doğrulandı ✓)
- [x] Gömülü secret yok
- [x] RTSP kimlik bilgisi yok
- [x] Cihazda ağır AI işleme yok
- [x] Yalnız izinli MIA URL'leri (allowNavigation)
- [x] Push bildirimleri yapılandırılmadı (v2 — açıkça belgelendi)
- [x] Gereksiz native izin yok (varsayılan Capacitor izin seti)
## Mobil — sürüm tarafı (HER build'de tekrarla)
- [ ] `npm audit` temiz
- [ ] Android: release keystore ile imzala, AAB üret, Play Console veri güvenliği formu
- [ ] iOS: Apple Developer profili, TestFlight, App Store inceleme (4.2 riski: push ekle)
- [ ] SHA256 + tarama + sürüm notları (masaüstüyle aynı süreç)

## Sürüm yayınlama sırası
1. Sürüm numarası artır → 2. build → 3. imzala → 4. `scripts/verify-release-artifacts.sh`
ile manifest → 5. malware taraması → 6. `releases/` klasörüne koy → 7. download.html'e
checksum'la birlikte bağla → 8. sürüm notu yayınla. Bu adımlar atlanırsa build YAYINLANMAZ.
