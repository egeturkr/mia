# Güvenlik Runbook (MIA ekibi içi)

## MIA_SCAN_TOKEN rotasyonu
1. Yeni token üret: `openssl rand -hex 32`
2. Netlify → Environment variables → MIA_SCAN_TOKEN güncelle → redeploy.
3. Sahadaki tüm okuyucu/istemcilerde token'ı değiştir (eski token anında geçersiz).
4. Sızıntı şüphesinde HEMEN rotasyon + api_usage'da `endpoint=scan` son istekleri incele.

## İzinli origin güncelleme
Netlify env → `MIA_ALLOWED_ORIGINS` (virgüllü) → redeploy. Varsayılan: canlı domain + www + *.netlify.app.

## Rate limit / kota ayarı
- Dakika limitleri: ilgili fonksiyonda `guard.enforce` çağrısındaki `perMin` (detect 30, analyze 5, scan 120) + notify.js'te 3/dk.
- Aylık plan kotaları: `guard.js PLAN_QUOTAS` + `js/plans.js` (İKİSİ birlikte!). Müşteri özel: `subscriptions.quota_overrides = {"monthly_ai": N}`.

## API abuse müdahalesi
1. Supabase → `api_usage`: subject/org_id bazında son 1 saat sayımı (`status` 4xx yoğunluğu = deneme).
2. Kötüye kullanan kullanıcı: subscriptions'ı `canceled` yap (kota free'ye iner) veya Supabase Auth'tan kullanıcıyı banla.
3. IP bazlı anon abuse: analyze anon limiti zaten 3/gün; gerekirse `anonPerDay` düşür.

## Paylaşım linki iptali
Kullanıcı: panelden analizi siler (token'lı satır gider). Ekip: Supabase → analyses → ilgili satırda `share_token = null` (analizi silmeden paylaşımı keser).

## Şüpheli kullanım incelemesi
`api_usage` (kim/ne zaman/hangi uç/status) → `consents` (rıza var mı) → `analyses.created_at` desenleri. Billing abuse: `payment_records` + `subscriptions` durum/tarih tutarlılığı (aktivasyonlar yalnız ekip yapmış olmalı — beklenmedik `manual_active` varsa service key sızıntısından şüphelen → Supabase service_role anahtarını ROTASYONLA).

## CSP deploy-sonrası testi
1. Deploy → siteyi aç → F12 Console: "Refused to ..." CSP hatası ara.
2. Kontrol listesi: tema/dil değişimi, dashboard grafikleri (chart.js), PDF indirme (jsPDF), QR üretimi, video önizleme, Supabase girişi, Google fontlar.
3. Kırılan meşru kaynak varsa netlify.toml CSP'ye domain ekle (gerekçesiyle) → redeploy. CSP'yi tümden KALDIRMA.

## Secret rotasyonları
Supabase service_role / Roboflow / Resend / MIA_BILLING_SECRET: ilgili panelden yeni anahtar → Netlify env → redeploy → eski anahtarı iptal et. Frontend'e hiçbir secret girmez (tarama: `grep -r "SERVICE_ROLE\\|IYZICO_SECRET" js/ *.html` boş dönmeli).
