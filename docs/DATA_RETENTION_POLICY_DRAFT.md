# Veri Saklama Politikası (TASLAK)

> **Bu doküman hukuki tavsiye değildir.** MIA ekibi tarafından operasyonel hazırlık amacıyla
> hazırlanmıştır. Pilot kullanımdan önce yetkili hukuk danışmanı tarafından incelenmeli ve
> onaylanmalıdır.

## Saklama tablosu

| Veri kategorisi | Varsayılan saklama | Silme yöntemi | Müşteri silme talebi | Yasal tutma (legal hold) | Anonimleştirme |
|---|---|---|---|---|---|
| Yüklenen videolar | Sunucuda **saklanmaz** — analiz tarayıcıda karelenir; Modal hattında geçici işleme, kalıcı depolama yok | — | — | — | — |
| Çıkarılan kareler (eval doğrulama seti) | Doğrulama amacı süresince; repo dışında tutulur | Manuel dosya silme | Evet (pilot sözleşmesine göre) | Olabilir | Mümkün (yüz bulanıklaştırma — yol haritasında) |
| Analiz sonuçları (`analyses.detections_json`) | Hesap aktif olduğu sürece | Kullanıcı kendi analizini silebilir (mevcut özellik); toplu silme manuel | Evet | Olabilir | Kısmen (video adı/kimliksizleştirme) |
| PDF raporlar (`analyses.pdf_base64`) | Analiz kaydıyla birlikte | Analiz silinince silinir | Evet | Olabilir | Hayır |
| Paylaşım linkleri (`share_token`) | İptal edilene kadar | Analiz silinince geçersizleşir | Evet | — | — |
| Rıza kayıtları (`consents`) | **Süresiz (append-only)** — uyuşmazlıkta kanıt niteliği | Silinmez (hukuki değerlendirme gerekli) | Hukukçu görüşüne tabi | Evet | Mümkün değil (bütünlük) |
| Pilot kayıtları (pilot_* tabloları) | Pilot bitişi + **90 gün** (öneri; sözleşmeyle değişir) | Pilot silme (cascade) veya manuel | Evet | Olabilir | Kısmen |
| Veri talepleri (`data_subject_requests`) | Talep kapanışı + 1 yıl (öneri) | Manuel | Hukukçu görüşüne tabi | Evet | Kısmen |
| API kullanım logları (`api_usage`) | **60 gün — otomatik temizlik CANLI** (günlük cron) | Otomatik | — | — | Zaten hash'li |
| Hesap verisi (auth) | Hesap silinene kadar | Hesap silme talebi → manuel inceleme | Evet | Olabilir | — |

## Mevcut durumun dürüst özeti

- **Otomatik silme yalnızca api_usage'da canlı.** Diğer kategoriler için silme, `data_subject_requests`
  akışıyla **manuel** incelenir (Faz 4 kararı: üretim verisini otomatik silmek bu aşamada riskli).
- Kullanıcı kendi analizlerini panelden zaten silebilir (PDF + paylaşım linki birlikte gider).
- Saklama süreleri sözleşmeye yazılmadan ve hukukçu onayı alınmadan müşteriye taahhüt edilmemelidir.

## Silme talebi akışı

1. Kullanıcı: Hesap sayfası → Veri Talepleri → tür seç + detay → gönder.
2. Kayıt `data_subject_requests`'e düşer (status: submitted).
3. Ekip Supabase üzerinden inceler (service_role) → under_review → completed/rejected + admin_notes.
4. Hedef yanıt süresi: 30 gün (KVKK m.13 ile uyumlu hedef — hukukçu teyidi gerekli).

## Yapılacaklar (politika resmileşmeden önce)

- [ ] Sürelerin hukukçu ile teyidi  - [ ] Pilot sözleşmesine saklama maddesi
- [ ] consents için saklama/sildirme hukuki görüşü  - [ ] Otomatik silme job'ları (Faz sonrası)
