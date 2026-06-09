# Faz 5 — Billing System (Production Hardening)

Durum: tamamlandı (sağlayıcıdan **bağımsız** mimari + plana bağlı kota; testler geçti).
Gerçek para akışı YOK — ödeme sağlayıcısı (iyzico/Stripe) sonradan adaptörle takılır.
Mevcut fiyat sayfası (cozumler.html) UI'ı **değişmedi**.

## 1. Mimari (sağlayıcı-bağımsız)

```
Kullanıcı ── hesap.html ──(yükselt)──> startCheckout()  ── (bugün) ──> satış akışı (demo-talep)
                                              └──────────── (yarın) ──> iyzico/Stripe checkout
Ödeme sağlayıcısı ──(webhook)──> /api/billing-webhook ──> subscriptions (upsert)
guard.js ──(her AI çağrısında)──> resolvePlan(user) ──> PLAN_QUOTAS ──> aylık kota zorlama
```

Tek değişim noktası: `startCheckout()` (istemci) + `billing-webhook` içindeki imza/olay map'i (sunucu).
Geri kalan her şey (plan, kota, abonelik tablosu) sağlayıcıdan bağımsız çalışır.

## 2. Planlar & kota (tek kaynak)

`js/plans.js` (istemci) ve `guard.PLAN_QUOTAS` (sunucu) — ikisi senkron tutulur.

| Plan | Aylık AI analizi | Kamera | Fiyat (₺/ay) |
|------|------------------|--------|--------------|
| free (abonesiz) | 10 | 1 | 0 |
| giris | 30 | QR/RFID | 4.000 |
| kamera_ai | 300 | 10 | 12.000 |
| pro | 1.000 | 30 | 25.000 |
| kurumsal | 100.000 | sınırsız | Özel |

**Kota zorlaması aktif**: `/api/detect` + `/api/analyze` birleşik aylık sayım kullanıcının planını
aşarsa **402** döner. Abonesi olmayan kullanıcı `free` (10/ay). Anonim demo: IP başına 3/gün (Faz 1).

## 3. Değişen / eklenen dosyalar

Eklenen: `subscriptions` tablosu (schema.sql), `js/plans.js`, `netlify/functions/usage.js`
(`/api/usage`), `netlify/functions/billing-webhook.js`, `hesap.html`, `js/hesap.js`,
`docs/PHASE5_BILLING.md`.
Değiştirilen: `netlify/functions/lib/guard.js` (resolvePlan + plan kotası + AI grup sayımı),
`netlify.toml` (/api/usage + /api/billing-webhook redirect), `dashboard.html` (Hesap nav linki),
`.env.example` (MIA_BILLING_SECRET).

## 4. Migration

1. Supabase SQL Editor → güncel `supabase/schema.sql` (idempotent) → `subscriptions` tablosu.
2. Env: `MIA_BILLING_SECRET` (webhook için; sağlayıcı bağlanınca gerekli — şimdilik opsiyonel,
   yoksa webhook 500 verir ama akış bozulmaz). Diğer env'ler mevcut.
3. Deploy (git push).

## 5. Ödeme sağlayıcısı bağlama (sonraki adım — sen sağlayıcı seçince)

1. iyzico/Stripe hesabı + (önce) **sandbox** anahtarları.
2. `startCheckout(plan)` → sağlayıcı checkout oturumu açacak şekilde güncellenir.
3. `billing-webhook` içine sağlayıcıya özel **imza doğrulaması** + olay→plan map'i eklenir
   (TODO yorumu kodda işaretli).
4. Test modunda uçtan uca doğrulanır → sonra canlı anahtara geçilir.

## 6. Test

Otomatik (doğrulandı): plans.js kotaları; guard plan-kota paritesi; abonelik→plan çözümleme;
pro kullanıcı kota altında ok, kota üstünde 402 (plan/limit gövdede); abonesiz kullanıcı free(10)
zorlanıyor. Syntax: tüm yeni JS.

Manuel (deploy sonrası):
1. Giriş yap → `hesap.html` → mevcut plan "Ücretsiz / Deneme", kullanım çubuğu görünür.
2. `/api/usage` (Bearer token ile) → plan + used + quota JSON döner.
3. (İsteğe bağlı) `subscriptions`'a elle bir satır ekle (plan='pro') → hesap sayfası Pro gösterir, kota 1000'e çıkar.
4. webhook testi: `MIA_BILLING_SECRET` ayarlıyken `/api/billing-webhook`'a doğru secret + {user_id,plan} POST → subscriptions upsert.

## 7. Rollback

`git revert` ile tümü geri alınır. `subscriptions` ek tablo; yoksa guard `free` plana düşer
(resolvePlan hata→free). Kota zorlaması eski sabit davranışa döndürmek istenirse guard'da
`resolvePlan` yerine sabit limit yazılabilir. Mevcut akışları bozmaz.
