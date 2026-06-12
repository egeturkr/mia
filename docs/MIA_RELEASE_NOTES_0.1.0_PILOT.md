# MIA 0.1.0-pilot — Sürüm Notları

**Kanal:** internal-pilot · **Tarih:** Haziran 2026 · **Hedef:** kurumsal pilot müşterileri

## İçerik
Özel MIA müşteri uygulaması (/app/*): giriş (web hesabıyla aynı), operasyon
dashboard'u, canlı kamera izleme + KKD profilleri, AI tespit durumu, olay
yönetimi (kaynak filtreli), rapor merkezi (CSV/PDF), QR saha doğrulama katmanı,
saha/takım/ayarlar. Masaüstü kabuk doğrudan uygulamaya açılır.

## Platformlar
- **macOS (Apple Silicon/arm64):** DMG — GitHub Releases'ta, /download'dan SHA256 ile
- **Windows/Linux:** build-ready, talep üzerine
- **Android/iOS:** iskelet hazır; mağaza süreci başlamadı
- **Web:** canlı (tüm uygulama tarayıcıda da çalışır)

## Çalışan
Yüklenen video AI analizi (canlı üründe) · yakın gerçek zamanlı kamera KKD
tespiti (worker kuruluyken): **baret + yelek** destekli, maske deneysel ·
60 sn dedup, 5 dk alarm sınırı · org/RBAC + sunucu tarafı kamera limiti ·
QR rozet/geçiş/ekipman katmanı · kaynak etiketli raporlar.

## Pilot kapsamı (henüz değil)
Eldiven/gözlük/kemer/bot/kulaklık tespiti (model eğitimi gerekir) · snapshot/
görüntü kanıtı (kapalı — hukuk+saklama politikası şartı) · eğitim QR onayı ·
7/24 SLA · ölçülmüş doğruluk (pilotta sahada ölçülür).

## Güvenlik durumu (dürüst)
- Kod imzalama: **BEKLEMEDE** — macOS Gatekeeper uyarısı verir (sağ tık → Aç)
- Apple notarization: **BEKLEMEDE**
- Malware taraması: **BEKLEMEDE** — "virüssüz" iddiası YOKTUR
- SHA256: yayında — indirme sonrası doğrulayın:
  `shasum -a 256 ~/Downloads/MIA*.dmg` → /download'daki değerle karşılaştırın
- Uygulama kabuğu hiçbir gizli anahtar/kamera şifresi içermez; izin istekleri
  varsayılan reddedilir; gezinme yalnız https://miaissagligi.com
- npm audit: 10 high — tamamı build-zinciri (tar/cacache/node-gyp, devDependencies);
  üretilen uygulamaya PAKETLENMEZ; bir sonraki electron-builder major'ında kapatılacak

## Bilinen sınırlar
Canlı video önizleme yok (bilinçli — gizlilik/maliyet) · worker ayrı sunucu
gerektirir · gerçek RTSP saha testi ilk pilotta yapılacak.
