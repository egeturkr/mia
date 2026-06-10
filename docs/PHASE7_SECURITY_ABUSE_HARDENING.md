# Faz 7 — Güvenlik, Abuse Koruması & Platform Sertleştirme

## Risk haritası (inceleme bulguları) ve düzeltmeler

| Risk | Önem | Durum |
|---|---|---|
| **/api/notify kimliksizdi, alıcı serbestti** — Resend hesabıyla rastgele adrese spam/maliyet saldırısı | KRİTİK | ✅ JWT zorunlu + alıcı YALNIZ oturum sahibinin e-postası (body'deki `to` yok sayılır) + origin allowlist + 3/dk limit + kullanım logu |
| Dashboard'da `video_name` innerHTML'e kaçışsız (kendi verisi ama stored-XSS hijyeni) | ORTA | ✅ global `window.miaEsc()` + kaçış |
| overview.js işçi adı kaçışsız | ORTA | ✅ miaEsc |
| Upload yalnız 100MB kontrolü; tür/süre yok | ORTA | ✅ uzantı+MIME beyaz listesi (mp4/mov/avi/webm), 10 dk süre limiti (metadata yüklenince), net TR/EN hatalar |
| Demo formu korumasız (anon insert, bot spam) | ORTA | ✅ honeypot alanı (bota sahte başarı) + 3 sn zaman kontrolü. NOT: istemci taraflı — kararlı saldırgan Supabase'e doğrudan insert atabilir (kalan risk, aşağıda) |
| CSP yok | ORTA | ✅ netlify.toml'a CSP + COOP + Permissions-Policy (camera=self — QR tarama) |
| shareA fallback token `Math.random` (tahmin edilebilir) | DÜŞÜK | ✅ crypto.getRandomValues fallback'i |
| Paylaşılan rapor "linki bilen herkes" uyarısı yok | DÜŞÜK | ✅ rapor.html'e uyarı + iptal yönergesi (analizi sil) |
| MIA_SCAN_TOKEN tek paylaşılan token | DÜŞÜK-ORTA | 📋 Rotasyon prosedürü runbook'ta; per-checkpoint token gelecek işi |
| Hata mesajlarında sağlayıcı detayı | DÜŞÜK | ✅ notify artık jenerik hata döner; diğer uçlar zaten güvenliydi |

## Upload limitleri (js/detector.js UPLOAD_LIMITS)
100 MB · 10 dk · mp4/mov/avi/webm (uzantı + MIME). Süre, tarayıcı metadata'sından doğrulanır;
yüklemeden önce güvenilir okunamadığı durumda seçim anında reddedilir. Sunucu tarafında ek
koruma: kare bazlı kota (analiz ne kadar uzun olursa olsun ≤10 kare) + 30/dk rate limit.

## API koruma özeti
| Uç | Auth | Limit | Diğer |
|---|---|---|---|
| /api/detect | JWT | 30/dk + plan kotası | origin, fail-closed |
| /api/analyze | JWT veya IP (anon 3/gün) | 5/dk + kota | origin |
| /api/notify | **JWT (YENİ)** | **3/dk (YENİ)** | alıcı=kendi e-postası, origin |
| /api/scan | x-scan-token | 120/dk | abuse logu (api_usage) |
| /api/usage | JWT | — | salt okuma |
| /api/create-checkout | JWT + org rol | — | origin, sahte başarı yok |
| /api/billing-webhook | x-billing-secret | — | idempotency, fail-closed |
| /api/health | public | — | secret sızdırmaz (yalnız bool) |

## CSP / başlıklar (netlify.toml — gerekçeli)
script: self + cdn.jsdelivr.net (supabase-js, chart.js) + cdnjs.cloudflare.com (jsPDF) + inline
(sayfa içi tema/i18n — kaldırılması ayrı refactor); style: self+inline+fonts.googleapis;
font: gstatic; connect: self + *.supabase.co; img: self+data:+blob:+https; media: blob (önizleme);
object none; base-uri self; frame-ancestors self; form-action self. + COOP, Permissions-Policy
(camera=self), HSTS, nosniff, X-Frame-Options (mevcut).

## Kalan riskler (dürüst)
Penetrasyon testi YAPILMADI. CSP deploy sonrası konsoldan izlenmeli (runbook'ta test adımı) —
'unsafe-inline' script izni XSS korumasını zayıflatır; inline scriptlerin nonce'a taşınması
gelecek işi. Form koruması istemci taraflı — sunucu taraflı Turnstile/rate-limit gelecek işi
(anon insert RLS'i `check(true)`). Tek scan token (rotasyon manuel). MFA/SSO yok. Audit log yok.
Supabase anon key ile doğrudan REST erişimi RLS'e dayanır (tasarım gereği — RLS testleri kritik).
