# MIA QR Saha Doğrulama Katmanı (Faz 19)

## Mostar Projects geri bildirimi (3 Haz 2026 görüşmesi)
Saha gerçeği: tek başına kamera AI yeterli değil — **katmanlı/modüler tespit**
istendi: QR/RFID geçiş katmanı + kamera AI + (ileride) termal. MIA'nın QR
altyapısı zaten canlıydı (Giriş paketi); Faz 19 bunu müşteri uygulamasına
birinci sınıf modül olarak taşıdı: **/app/qr**.

## Konumlandırma (dürüst dil — satışta bu cümle kullanılır)
"QR saha doğrulama katmanı, kamera AI'ının YERİNE geçmez; onu tamamlar.
AI görüntüden KKD ihlalini tespit eder; QR katmanı kişi, ekipman ve süreç
kayıtlarını saha operasyonuna bağlar."

## Bugün UYGULANMIŞ olan (gerçek tablolar: workers/equipment/checkpoints/scans)
- **Çalışan QR rozeti:** rozet üretimi (qr-uret), geçiş noktasında tarama (tarama.html),
  saha varlık + KKD beyan kaydı (scans.ppe_present/missing/compliant).
- **Saha giriş/çıkış:** geçiş noktası bazlı tarama denetim izi; uyumsuz geçiş sayacı.
- **KKD ekipman QR etiketi:** ekipman kaydı + zimmet/denetim izi temeli.
- **AI olay takibi (pilot süreç):** AI olayı → İSG incelemesi → QR geçiş kayıtlarına
  bakarak süreç yönetimi. EŞLEŞTİRME İNSAN KARARIDIR.

## Henüz UYGULANMAYAN (sahte gösterilmez)
- Eğitim/oryantasyon QR onayı (PLANLANDI — pilot geri bildirimiyle; gerekirse
  `training_confirmations` tablosu RLS'li eklenecek).
- Otomatik kamera↔QR kimlik eşleştirme — **bilinçli olarak yapılmıyor**.

## İddia ETMEYECEKLERİMİZ
Yüz tanıma · kameradan otomatik kişi kimliklendirme · yasal personel takibi
(hukuki dayanak kurulmadan) · QR'ın AI'ı ikame ettiği.

## KVKK
QR kayıtları kişisel veri içerir (ad, geçiş zamanı): işveren aydınlatması +
saha bildirimi zorunlu; veriler org-RLS'li, kamuya kapalı; veri sahibi talepleri
mevcut DSR akışından. Hassas veri (sağlık vb.) TUTULMAZ.

## Pilot yaygınlaştırma adımları
1. Rozet üret (qr-uret) → çalışan listesi içe aktar. 2. Geçiş noktası tanımla +
tablet/telefonda tarama ekranı. 3. 1 hafta yalnız giriş kaydı (alışma).
4. KKD beyan kontrolü aç. 5. AI olay takibi süreciyle birleştir (İSG rutini).
6. Aylık: uyumsuz geçiş raporu + AI olay raporu birlikte sunulur.
