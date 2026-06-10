# Alt-İşleyen / Üçüncü Taraf İşleyen Kaydı (TASLAK)

> **Bu doküman hukuki tavsiye değildir.** MIA ekibi tarafından operasyonel hazırlık amacıyla
> hazırlanmıştır. Pilot kullanımdan önce yetkili hukuk danışmanı tarafından incelenmeli ve
> onaylanmalıdır. **Hiçbir DPA henüz imzalanmamıştır** — aşağıdaki durumlar gerçeği yansıtır.

| Sağlayıcı | Amaç | Veri kategorisi | Bölge | Durum | DPA durumu | Not |
|---|---|---|---|---|---|---|
| **Supabase** | Veritabanı, kimlik doğrulama, RLS | Hesap bilgileri, analiz sonuçları, rıza kayıtları, pilot kayıtları | Proje bölgesine göre (AB/ABD) — teyit edilmeli | Aktif | **Başlanmadı** | Standart DPA'sı mevcut (supabase.com/legal/dpa) — incelenip kabul edilmeli |
| **Roboflow** | AI çıkarım — kare bazlı KKD tespiti | Yüklenen görüntü kareleri (çalışan görüntüsü içerebilir) | ABD | Aktif | **Başlanmadı** | Sınır ötesi aktarım — KVKK değerlendirmesi kritik |
| **Modal** | AI çıkarım — tam video analizi (GPU) | Yüklenen videolar (geçici işleme) | ABD | Aktif | **Başlanmadı** | Kişisel hesaptan kurumsal hesaba geçilmeli; veri kalıcılığı teyit edilmeli |
| **Netlify** | Barındırma, sunucusuz fonksiyonlar, loglar | Trafik meta verisi, fonksiyon logları (IP hash) | ABD/küresel CDN | Aktif | **Başlanmadı** | Standart DPA'sı mevcut — incelenmeli |
| **Resend** | İşlemsel e-posta (doğrulama, uyarı, haftalık özet) | E-posta adresi, bildirim içeriği (ihlal özetleri) | ABD | Aktif | **Başlanmadı** | İhlal e-postalarında kişisel veri minimizasyonu gözden geçirilmeli |
| Sentry (veya eşdeğeri) | Hata izleme | Hata bağlamı (PII scrub yapılandırılacak) | ABD/AB | **Planlandı (Faz 10)** | Başlanmadı | Kurulumda PII scrubbing zorunlu |
| Ürün analitiği (PostHog/Plausible) | Kullanım analitiği | Sayfa/etkinlik verisi | Seçime göre AB mümkün | **Planlandı (Faz 10)** | Başlanmadı | AB barındırmalı seçenek tercih edilmeli |

## Süreç

- Yeni alt-işleyen eklenmeden önce bu kayda işlenir ve hukuki değerlendirme yapılır.
- DPA imzalandığında durum yalnızca o zaman "İmzalandı" yapılır — **imzasız "imzalandı" yazılmaz.**
- Müşteri sözleşmelerinde bu liste "alt-işleyen listesi" eki olarak referans verilecek (hukukçu onayıyla).
- Kamuya açık sürüm: hukukçu onayından sonra gizlilik sayfasından linklenebilir.
