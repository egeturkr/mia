# MIA Müşteri Onboard Akışı

## Gün 0 — Keşif görüşmesi
Demo (docs/MIA_REALTIME_CAMERA_DEMO_SCRIPT.md) → ihtiyaç analizi: kaç saha,
kaç kamera, hangi KKD öncelikli, mevcut İSG süreci. Dürüst kapsam anlatımı
(baret/yelek destekli; diğerleri yol haritası). CRM'e kayıt (/customers).

## Gün 1-3 — Sözleşme + hukuk
Pilot protokolü + KVKK ekleri. Müşterinin hukuk/İK onay süreci başlar.
**Bu tamamlanmadan teknik kurulum başlamaz.**

## Gün 3-5 — Hesap kurulumu
Org hesabı → owner daveti → ekip üyeleri (admin / safety_manager / viewer
rolleri) → saha kayıtları → plan aktivasyonu → KKD profili müşteriyle birlikte.

## Gün 5-10 — Teknik kurulum
Kamera listesi + ağ kararı → worker host (mini PC sahaya / bulut VM) →
RTSP testleri → worker go-live → uçtan uca doğrulama (deployment checklist §5).

## Hafta 2-3 — Kalibrasyon
Yanlış alarm incelemesi, eşik ayarı, kamera açısı düzeltmeleri. Müşteri
beklentisi: "bu dönemde alarm kalitesi artar, rakamlar henüz rapor edilmez."

## Hafta 4 — Pilot raporu
Eval metrikleri (ölçülen!) + olay istatistikleri + İSG ekip geri bildirimi →
go/no-go toplantısı → ticari teklif.

## Sürekli
Aylık kullanım raporu · model güncellemelerinde bilgilendirme · destek kanalı
(info@miaissagligi.com) · yıllık KVKK gözden geçirme.
