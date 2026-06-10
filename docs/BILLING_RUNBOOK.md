# Billing Runbook (MIA ekibi içi)

## 1. Manuel ücretli pilot açma
1. pilot.html → Yeni Pilot (bedel ₺25.000) → checklist tamamla.
2. e-Fatura/proforma kes (muhasebe süreci, platform dışı) → pilot detayında
   "Pilot Ödemesi" → durum: **Fatura kesildi / bekleniyor** → Kaydet (payment_records'a pending düşer).

## 2. Havale alınınca
1. Banka hesabını kontrol et (platform doğrulayamaz — insan onayı şart).
2. Pilot detayında durum: **Havale alındı (manuel onay)** → Kaydet (payment_record manual_confirmed olur).
3. Müşteriye pilot süresince kota gerekiyorsa aboneliği aktive et (aşağıda §4, status: `pilot_active`).

## 3. Pilot → abonelik dönüşümü
1. Pilot durumu: **Aboneliğe Dönüştü**; ödeme durumu: **Aboneliğe sayıldı**.
2. §4 ile org aboneliğini `manual_active` + plan (genelde `kamera_ai`) yap; pilot bedelini
   ilk yıl faturasından düş (muhasebe notu).

## 4. Abonelik aktivasyonu (kota açma) — yalnız MIA ekibi
Webhook ile (önerilen; idempotent):
```bash
curl -X POST https://miaissagligi.com/api/billing-webhook \
  -H "x-billing-secret: $MIA_BILLING_SECRET" -H "Content-Type: application/json" \
  -d '{"event_id":"manual-2026-06-10-mostar-1","type":"subscription",
       "org_id":"<ORG_UUID>","plan":"kamera_ai","status":"manual_active",
       "provider":"manual","current_period_end":"2027-06-10T00:00:00Z"}'
```
Kişisel abonelik için `org_id` yerine `user_id`. Alternatif: Supabase Table Editor →
subscriptions satırını elle düzenle (service_role).

## 5. Kullanım inceleme
- Müşteri tarafı: hesap.html (org başlığıyla org kullanımı).
- Ekip tarafı: Supabase → `api_usage` (org_id/subject + created_at son 30 gün, endpoint in detect,analyze).

## 6. Ödeme gecikmesi / başarısızlık
1. Aboneliği `past_due` yap (webhook, §4 formatı) — kota free'ye düşmez ama uyarı için;
   tahsilat hâlâ yoksa `canceled` → kota free'ye iner. Veri SİLİNMEZ; panel/raporlar açık kalır.
2. Müşteriyle iletişim → ödeme gelince tekrar `manual_active`.

## 7. Plan değişikliği
Webhook ile aynı org/user'a yeni `plan` gönder (status koru). `quota_overrides`:
`{"monthly_ai": 30000}` ile kurumsal özel kota.

## 8. İade
payment_records satırını `refunded` yap (Supabase), aboneliği değerlendir (`canceled`).
Banka iadesi platform dışı.

## 9. Rollback
`git revert <commit>` — UI/fonksiyonlar geri döner. Tablolar zararsız kalır; tam temizlik:
`drop table billing_events, invoices, payment_records, billing_customers;` + subscriptions'tan
Faz 6 kolonlarını düşür + `subs_*_key` indexlerini sil (DİKKAT: unique(user_id) kısıtını
geri eklemeden eski webhook sürümü çalışmaz — revert tam yapılmalı).
