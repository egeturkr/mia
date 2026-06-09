# Faz 0 — Yürütme Temeli (Execution Baseline)

Tarih: 9 Haziran 2026 · Kaynaklar: kod tabanı, `MIA_Ticarilesme_Master_Plani.docx`, Production Readiness Audit (42→74), docs/PHASE1–5.

Bu doküman değişiklik içermez; sonraki tüm fazların referans haritasıdır.

---

## 1. Sistem Haritası

### 1.1 Frontend (statik HTML/CSS/JS — framework yok, build yok)

| Grup | Sayfalar |
|---|---|
| Pazarlama | index, sirket, cozumler, iletisim, demo-talep, ai-performans |
| Auth | giris-yap, kaydol, dogrulama, sifre-sifirla (login.html → redirect) |
| Ürün | dashboard, events (İhlal Raporu), detector (analiz), tarama, qr-uret, hesap, rapor (paylaşılan rapor) |
| Yasal | kvkk, gizlilik, kullanim-sartlari |
| Diğer | 404, demo→detector redirect |

### 1.2 JS modülleri

| Dosya | Sorumluluk |
|---|---|
| js/app.js | i18n (TR/EN/ES), tema, Supabase client, auth akışları, dashboard render + chart'lar, PDF üretimi (miaBuildAnalysisPdf), paylaşım (shareA), silme (delA) |
| js/detector.js | Analiz UI. Anonim → Demo simülasyon (etiketli), girişli → canlı çıkarım |
| js/events.js / events-ui.js | İhlal raporu: filtre + CSV/PDF / salt görsel katman (grafikler, sekmeler, arama) |
| js/overview.js | Dashboard'da geçiş taramaları paneli |
| js/tarama.js, js/qr-uret.js | QR/RFID tarama + QR üretimi |
| js/plans.js | Plan kayıt defteri (tek doğru kaynak — guard.js'te kopyası var, İKİSİ birlikte güncellenir) |
| js/hesap.js | Mevcut plan + aylık kullanım/kota gösterimi |
| js/legal.js | Sürümlü rıza sistemi (consents tablosuna yazar), DISCLAIMERS(lang), görüntü işleme rıza modalı |
| js/postprocess.js | Tespit son-işleme |

### 1.3 API uç noktaları (Netlify Functions)

| Uç nokta | İşlev | Koruma |
|---|---|---|
| /api/detect | Roboflow çıkarım proxy'si | guard.js: origin + JWT + rate-limit + kota |
| /api/analyze | Modal tam-video analiz proxy'si | guard.js (aynı) |
| /api/scan | RFID/QR ingestion | x-scan-token (paylaşılan gizli) |
| /api/notify | Resend e-posta | sunucu anahtarı |
| /api/health | Env/sağlık kontrolü | — |
| /api/usage | Plan + aylık kullanım özeti | JWT |
| /api/billing-webhook | Ödeme sağlayıcı stub'ı | MIA_BILLING_SECRET |
| weekly-digest (cron Pzt 07:00) | Haftalık güvenlik özeti e-postası | — |
| cleanup (cron günlük 03:00) | api_usage 60 gün temizliği | — |

guard.js: origin allowlist + Supabase JWT + rate-limit + aylık plan kotası + api_usage log, **fail-closed**. Doğrulanmış (403/401 testleri).

### 1.4 Supabase tabloları (RLS)

| Tablo | RLS | Not |
|---|---|---|
| analyses | sahibine kilitli | detections_json, share_token, pdf_base64 (⚠ base64 DB'de) |
| demo_requests, chat_messages | anon insert | captcha yok (spam riski) |
| workers, equipment, checkpoints, scans | sahibine kilitli | QR/RFID modülü |
| api_usage | servis | rate-limit + kota penceresi |
| consents | insert self/anon, select own | **sürümlü rıza audit trail — canlı** |
| subscriptions | select own | plan ataması; tahsilat bağlı değil |

Hepsi `user_id` bazlı — **org_id yok** (Faz 5'in işi).

### 1.5 AI iş akışı

- Model: `rf-27` = Roboflow `construction-site-safety/27`, 10 sınıf, yayınlanan ~%70 mAP. model_registry.json'da sürümlü.
- İki hat: (1) /api/detect — ≤10 kare örnekleme (hızlı), (2) /api/analyze — Modal GPU tam video. Tutarsızlık riski biliniyor.
- Eval framework HAZIR: eval/baseline_eval.py, run_validation.py, YOLO etiket formatı, validation_config.json. `validation_latest.json = "pending"` — **hiç saha verisiyle koşulmadı**. ai-performans.html bu dosyadan okuyor (dürüst: "henüz ölçülmedi" gösteriyor).
- Demo modu sentetik ve etiketli.

### 1.6 Billing durumu

- plans.js: free(10 analiz) / giris ₺4K(30) / kamera_ai ₺12K(300) / pro ₺25K(1000) / kurumsal.
- subscriptions tablosu + guard.js kota zorlaması + hesap.html gösterimi + sağlayıcı-bağımsız webhook stub: **mimari tamam, tahsilat (iyzico/Stripe) bağlı DEĞİL.** Manuel pilot faturası mümkün.

### 1.7 Ortam değişkenleri (Netlify)

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL`, `ROBOFLOW_API_KEY`, `MODAL_URL`, `MIA_SCAN_TOKEN`, `MIA_BILLING_SECRET`, `MIA_ALLOWED_ORIGINS`, SMTP_* (Supabase panelinde), EMAIL_* (bilgi amaçlı).

---

## 2. "Bozulmayacaklar" Listesi (her fazda regresyon kontrolü)

1. Kayıt → e-posta doğrulama → giriş → çıkış
2. Video yükleme → AI analizi (demo + canlı) → analiz geçmişi
3. Dashboard istatistik + grafikler + dönem filtreleri
4. İhlal raporu: filtreler, sekmeler, arama, CSV, PDF
5. PDF raporu üretimi + paylaşım linki (rapor.html?t=) + silme
6. QR üretme / tarama / geçiş paneli
7. Hesap sayfası: plan + kullanım gösterimi
8. Dil seçici (TR/EN/ES) + tema
9. Demo talep + iletişim formları
10. Rıza modalı (görüntü işleme) + consents kaydı
11. API korumaları (403/401 fail-closed) + kota zorlaması
12. Cron işleri (weekly-digest, cleanup)
13. Tüm rotalar + netlify.toml redirect'leri
14. RLS politikaları (org migration'a kadar dokunulmaz)

---

## 3. Risk Listesi

### P0 — İlk ödeme yapan müşteriden önce
| Risk | Durum | Çözüm fazı |
|---|---|---|
| Ölçülmüş AI metriği yok (validation "pending") | Framework hazır, veri yok | Faz 2 (esas iş VERİ, kod değil) |
| Tahsilat bağlı değil | Mimari hazır | Faz 6 (pilot için manuel fatura yeterli) |
| Free tier altyapı (Supabase/Roboflow free, kişisel Modal) | Pilot yükünde tükenir | Operasyonel — kod dışı, HEMEN |
| Hukuk imzası yok (VERBİS, DPA, saklama) | Rıza altyapısı canlı, hukukçu onayı yok | Faz 4 (kalan kısım hukuki) |
| Site metni "gerçek zamanlı" imaları | Kısmen düzeltilmiş, tam denetim yok | Faz 1 |

### P1 — İlk 10 müşteri için
| Risk | Çözüm fazı |
|---|---|
| Org/RBAC yok (tek kullanıcı) — B2B blocker | Faz 5 |
| Sentry / ürün analitiği / uptime yok | Faz 10 |
| pdf_base64 + detections_json Postgres'te (şişme) | Faz 9/10 sırasında Storage'a migration |
| İki AI hattı tutarsızlığı (Modal vs ≤10 kare) | Faz 2 ölçümünden sonra tek hat kararı |
| plans.js ↔ guard.js çift kota haritası (senkron riski) | Faz 6'da tekleştir |
| CSP yok, captcha yok (demo_requests/chat spam açık) | Faz 7 |
| innerHTML render (XSS yüzeyi) | Faz 7 |

### P2
Bus factor=1 · MFA/SRI yok · share_token süresiz · a11y denetimi yok.

### Faz–mevcut durum eşlemesi (önemli: bazı fazlar büyük ölçüde hazır)
| İstenen faz | Mevcut hazırlık |
|---|---|
| F1 Dil | ~%60 (disclaimer'lar var; pazarlama metni denetlenmedi) |
| F2 AI doğrulama | ~%80 kod, %0 veri |
| F3 Pilot modu | %10 (sözleşme/protokol/şablon yok) |
| F4 KVKK/rıza | ~%70 (sürümlü consent + audit canlı; hukuk + saklama eksik) |
| F5 Org hesapları | %0 |
| F6 Billing | ~%60 (tahsilat eksik) |
| F7 Kota/abuse | ~%75 (CSP/captcha/boyut limitleri eksik) |
| F8 Müşteri ops | %0 |
| F9 Rapor kalitesi | ~%50 (PDF + disclaimer var; rapor ID/hash/model sürümü raporda yok) |
| F10 İzleme | ~%30 (health + log var; Sentry/analytics yok) |

---

## 4. İlk Sprint Önerisi (Sprint A — 2 hafta)

Mantık: en düşük riskli + en yüksek satış etkili işler önce; master planın H1–4 bloğuyla hizalı.

**Kod işleri (Faz 1 + Faz 2 tamamlama):**
1. **Faz 1 — Dil denetimi** (1–2 gün, düşük risk): index/cozumler/sirket/detector metinlerinde "gerçek zamanlı izleme/7-24" taraması → "yüklenen video analizi, AI destekli, pilot doğrulamasından ölçülmüş performans" diline. 3 dilde (TR/EN/ES). Tasarım ve işlev korunur.
2. **Faz 2 — Doğrulama koşumu hazırlığı** (2–3 gün): eval framework'e video-bazlı değerlendirme desteği + FP/FN ayrıştırması + validation raporu üretim adımının dokümante koşum talimatı. Sayı UYDURULMAZ; veri gelene kadar "pending" kalır.

**Operasyonel işler (kod dışı — paralel, Deniz/Ege/Gökberk):**
- Supabase Pro + Roboflow ücretli + Modal kurumsal hesap (P0 altyapı).
- Mostar pilot sözleşmesi + saha aydınlatma metni (Faz 4'ün hukuk kısmı başlasın).
- 20 hedef firma listesi (master plan H1).

**Sprint A çıkışında:** site dürüst konuşuyor, doğrulama koşmaya hazır, altyapı ücretli planda, Mostar pilotu sözleşme aşamasında → Faz 3 (Pilot Modu) implementasyonuna geç.
