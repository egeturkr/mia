# Kurumsal Canlı Kamera Runbook — Müşteri Devreye Alma (MIA ekibi içi)

## 1. Firma onboard'u (sırayla)
1. Sözleşme + **hukuk hazırlığı**: kamera kaydı onayı, saha bildirim panoları,
   çalışan aydınlatma metni (KVKK) — bunlar bitmeden izleme BAŞLATILMAZ.
2. Org hesabı aç (organization.html) → owner daveti → plan aktivasyonu (manuel billing runbook).
3. Sahaları tanımla (organization_sites).

## 2. Kameralar
cameras.html → "+ Kamera Ekle" (owner/admin) → ad/konum/tip/saha + MASKELİ adres.
Çıkan kamera ID'lerini topla. Gerçek RTSP adresleri yalnız worker'ın cameras.json'una.
Plan limiti otomatik uygulanır (kamera_ai 10 / pro 30 / kurumsal sınırsız).

## 3. KKD profili
cameras.html → "KKD Tarama Profili": firma ile birlikte ekipmanları seç
(vars. baret+yelek). Kilitli ekipmanları DÜRÜSTÇE anlat: "model henüz tespit
edemiyor, yol haritamızda". Riskleri firma İSG uzmanıyla ayarla → Kaydet.

## 4. Worker başlatma
workers/realtime-camera-worker/README.md. Müşteri ağına erişim seçenekleri:
(a) sahada mini PC (önerilen — RTSP dışarı açılmaz), (b) VPN'li bulut VM,
(c) firma port yönlendirmesi (en az güvenli). Önce `ffplay` ile RTSP testi.
Profil değişince worker restart.

## 5. Canlı ihlal incelemesi
cameras.html olay tablosu 15 sn'de yenilenir. safety_manager "İncelendi/Yok say"
işaretler. Yok sayılanlar ihlal raporuna girmez. Yüksek risk → ALERT_EMAIL'e
e-posta (5 dk/kamera+tip sınırı).

## 6. Raporlar
events.html: canlı olaylar "· Canlı Kamera" etiketiyle, CSV "Kaynak" kolonuyla.
PDF aynı sayfadan. Olaylar validation_status=pending taşır — müşteriye "AI ön
değerlendirmesi, saha doğrulamasıyla raporlanır" denir.

## 7. Yanlış pozitif yönetimi
"Yok say" → kayıt kalır, rapordan düşer. Tekrarlıyorsa: RF_CONFIDENCE yükselt,
kamera açısı/ışık düzelt, örnekleri eval setine ekle. İlk 2 hafta = kalibrasyon
dönemi olarak satışta açıkça söylenir.

## 8. Duraklatma / erişim iptali
Panelden "Duraklat" + worker restart (v1: worker listeyi başlangıçta okur).
Kalıcı iptal: kamera şifresini KAMERADAN değiştir → cameras.json'dan sil →
worker restart → panelden "Arşivle". Sözleşme bitişinde tüm kameralar için uygula.

## 9. Müşteriye anlatım (zorunlu dil)
"Yakın gerçek zamanlı: birkaç saniyede bir kare analiz edilir; ihlal dakikalar
içinde panelde + e-postada. 7/24 kesintisiz izleme ve SLA pilotta taahhüt
edilmez. Şu an baret ve yelek tespiti destekleniyor (maske deneysel); diğer
ekipmanlar model eğitimi gerektirir. Doğruluk sahanızda ölçülerek raporlanır."
