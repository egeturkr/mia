# Faz 6 — Faturalandırma, Abonelik, Plan & Kota

## Mimari

```
İstemci (hesap.html / pilot.html)            Sunucu
  plan seç → /api/create-checkout  ──────►  niyet kaydı (payment_records: pending)
  durum görüntüle (RLS select)               AKTİVASYON YOK — sahte başarı yok
                                             │
Ödeme gerçekleşince (havale / sağlayıcı)     ▼
  /api/billing-webhook (x-billing-secret) → billing_events (idempotency)
                                          → subscriptions (status: manual_active/active)
                                          → payment_records (paid)
Kota: guard.enforce → org aboneliği → kişisel abonelik → free
```

**Çekirdek kural:** Aboneliği aktif yapmak (kota açmak) YALNIZCA service_role/webhook'tadır.
Müşteri (owner/admin dahil) kendi aboneliğini aktive edemez — RLS insert politikası yalnız
`unpaid/trialing` niyetine izin verir, update politikası yoktur. `payment_records.manual_confirmed`
bir beyandır; kota vermez.

## Plan kayıt defteri (js/plans.js + guard.js PLAN_QUOTAS — senkron)

| Plan | Fiyat | Aylık AI çağrısı (≈analiz) | Not |
|---|---|---|---|
| free | ₺0 | 150 (≈15) | Deneme; ticari kullanım değil |
| giris (QR Pasif) | ₺4.000 | 450 (≈45) | QR/RFID odaklı |
| kamera_ai | ₺12.000 | 4.500 (≈450) | Video AI + panel + raporlar |
| pro (Füzyon) | ₺25.000 | 15.000 (≈1.500) | AI + QR + öncelikli destek |
| kurumsal | Özel | 100.000 veya `quota_overrides.monthly_ai` | Özel sözleşme |

## Kota çözüm sırası (guard.js)

1. `x-mia-org` başlığı + **service-role ile üyelik doğrulaması** (başlığa güvenilmez)
2. Org aboneliği (status: active/trialing/manual_active/pilot_active) → org limiti; kullanım
   **org bazında** sayılır (api_usage.org_id — tüm üyelerin toplamı)
3. Yoksa kişisel abonelik (org_id is null) → kullanıcı bazlı sayım
4. Yoksa free. `quota_overrides.monthly_ai` her seviyede limiti ezer.
Kota aşımı → 402 yalnız YENİ analizleri engeller; panel/rapor erişimi etkilenmez.
Sayaç servisi erişilemezse fail-closed (503). Viewer rolü kotadan bağımsız analiz başlatamaz (RLS).

## Sağlayıcı durumu

| Sağlayıcı | Durum |
|---|---|
| **manual** | CANLI — niyet kaydı + havale + MIA aktivasyonu (runbook) |
| **iyzico** | İskelet hazır: env anahtarları yoksa 503 fail-safe; anahtar girilse bile adaptör imzası (IYZWSv2 + checkout-form) yazılana dek 501 döner — SAHTE BAŞARI YOK. Canlı: BILLING_MODE=live + merchant onayı + adaptör tamamlanması |
| **stripe** | Arayüz rezerve (provider alanlarında); entegrasyon yok |

## Webhook güvenliği

`x-billing-secret` zorunlu (eksik env → 500 fail-closed, yanlış → 401); `event_id`
billing_events'e unique yazılır → tekrar olay no-op (`duplicate:true`); billing_events
tablosu yoksa istek REDDEDİLİR (idempotency'siz yazma yok); ödeme durumu asla istemciden
kabul edilmez; plan/status beyaz listeyle doğrulanır; `on_conflict` bağımlılığı kaldırıldı
(select→patch/insert).

## Test sonuçları

Lokal mock: env eksik→500 ✓, yanlış secret→401 ✓, GET→405 ✓, geçersiz plan/status→400 ✓,
checkout yabancı origin→403 ✓, token'sız→401 ✓. Frontend'de secret taraması temiz.
Deploy sonrası: free kota, org owner billing görünümü, viewer/safety_manager kısıtları,
manuel ödeme kaydı, kota aşımında 402 + panel erişimi — ORG_RBAC_TEST_PLAN'a ek olarak koşulmalı.

## Kalan riskler (dürüst)

iyzico canlı tahsilat için gerçek merchant hesabı + adaptör imza implementasyonu gerekir.
e-Fatura/vergi entegrasyonu yok — fatura kesimi muhasebeci/mali müşavir süreciyle manuel.
Stripe entegre değil. Başarısız ödeme otomasyonu (dunning) yok. İadeler manuel.
Aktivasyon MIA ekibinin Supabase/webhook erişimine bağlı (runbook). Kota dönem penceresi
takvim ayı değil son-30-gün kayan penceredir (bilinçli, mevcut davranış korunarak).
