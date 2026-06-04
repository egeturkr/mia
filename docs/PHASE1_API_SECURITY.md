# Faz 1 — API Güvenlik Sertleştirmesi (Production Hardening)

Durum: tamamlandı (kod + birim/akış testleri). Host: **Netlify**. Geriye uyumlu.
Hiçbir sayfa/branding/route değişmedi; mevcut işlevler korundu.

## 1. Bulunan açıklar (öncesi)

| # | Açık | Etki | Çözüm |
|---|------|------|-------|
| V1 | `/api/detect` kimlik/origin/rate-limit yok | Herkes POST atıp Roboflow kredisini tüketebilir (maliyet DoS) | JWT zorunlu + origin allowlist + rate-limit + kota |
| V2 | Modal URL istemcide **hardcoded** (`...modal.run`) ve korumasız | Endpoint herkese açık; pahalı video çıkarımı suistimali; URL sızıntısı | Sunucu proxy `/api/analyze`, URL `MODAL_URL` env'ine taşındı, koruma eklendi |
| V3 | `/api/scan` token var ama rate-limit/log yok | Token sızarsa sınırsız yazma | Token + hesap başına dakikalık rate-limit + loglama |
| V4 | Kullanım görünürlüğü yok | Suistimal/kota takibi imkânsız | `api_usage` tablosu + her istekte log |
| V5 | CORS açıkça yönetilmiyor | İstenmeyen origin'lerden çağrı | Origin allowlist + doğru CORS başlıkları + preflight |

## 2. Değişen / eklenen dosyalar

Eklenen:
- `netlify/functions/lib/guard.js` — origin allowlist, Supabase JWT doğrulama, rate-limit + kota, CORS, loglama (paylaşılan helper).
- `netlify/functions/analyze.js` — korumalı Modal proxy (`/api/analyze`).
- `supabase/schema.sql` → `api_usage` tablosu (RLS açık, yalnızca service_role).
- `docs/PHASE1_API_SECURITY.md` (bu dosya).

Değiştirilen (geriye uyumlu):
- `netlify/functions/detect.js` — guard ile sarıldı (login zorunlu).
- `netlify/functions/scan.js` — rate-limit + log eklendi (token davranışı korundu).
- `js/detector.js` — canlı çıkarım çağrılarına `Authorization: Bearer <jwt>` eklendi (`miaGetToken`).
- `js/app.js` — demo upload artık `/api/analyze` proxy'sini kullanıyor + JWT (varsa) ekliyor.
- `netlify.toml` — `/api/analyze` redirect.
- `.env.example` — `MODAL_URL`, `MIA_ALLOWED_ORIGINS`, hardening env'leri.

> Not: `api/*.js` (Vercel kopyaları) bilinçli olarak değiştirilmedi çünkü canlı host Netlify.
> Vercel'e geçilmeyecekse temizlenebilir; geçilecekse aynı guard mantığı oraya da uygulanmalı.

## 3. Koruma modeli (özet)

| Endpoint | Kimlik | Rate (dk) | Kota | Origin |
|----------|--------|-----------|------|--------|
| `/api/detect` (canlı kamera) | Supabase JWT **zorunlu** | 30 | 300 / ay (kullanıcı) | allowlist |
| `/api/analyze` (video) | JWT veya anonim demo | 5 | kullanıcı 300/ay · anonim 3/gün (IP) | allowlist |
| `/api/scan` (headless okuyucu) | `MIA_SCAN_TOKEN` | 120 (hesap) | — | N/A (server-to-server) |

Allowlist varsayılan: `miaissagligi.com`, `www.miaissagligi.com`, `*.netlify.app`
(+ `MIA_ALLOWED_ORIGINS` ile genişletilebilir). Rate limiter sayım yapamazsa
**fail-closed** (503) — kredi koruması güvenli tarafta kalır.

## 4. Gerekli ortam değişkenleri (Netlify → Environment variables)

`ROBOFLOW_API_KEY`, `MODAL_URL`, `MIA_SCAN_TOKEN`,
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
(ops.) `MIA_ALLOWED_ORIGINS`.

## 5. Migration adımları

1. Supabase SQL Editor'da güncel `supabase/schema.sql`'i çalıştır (idempotent) → `api_usage` tablosu oluşur.
2. Netlify env'lerine `MODAL_URL` (eski hardcoded URL), `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MIA_SCAN_TOKEN` ekle/teyit et.
3. Deploy (git push). Redirect'ler ve fonksiyonlar otomatik yayınlanır.

## 6. Test prosedürü

Otomatik (bu repoda doğrulandı):
- guard birim testleri: origin allowlist, bearer parse, IP hash, CORS.
- enforce akış testleri: OPTIONS→204, kötü origin→403, token yok→401, normal→ok, rate→429, kota→402, anonim IP→ok.

Manuel (deploy sonrası):
1. Giriş yapmadan `detector.html` canlı mod → `/api/detect` **401** dönmeli (demo modu etkilenmez).
2. Giriş yapıp canlı analiz → çalışmalı; `api_usage`'da `detect` kayıtları artmalı.
3. `curl -X POST https://miaissagligi.com/api/detect` (origin/yetki yok) → **401/403**.
4. Farklı origin'den `Origin: https://evil.com` ile çağrı → **403**.
5. Demo video upload (anonim) → çalışır; 4. denemede aynı IP **402** (günlük limit).
6. `/api/scan` token'sız → **401**; doğru token ile → kayıt + `api_usage`'da `scan`.

## 7. Rollback planı

Tümü Git revert ile geri alınabilir; veri kaybı yok (`api_usage` ek tablo, mevcut veriyi etkilemez).

- Hızlı geri alma: bu commit'i `git revert <hash>` → fonksiyonlar eski (korumasız) haline döner.
- Kısmi: yalnızca bir endpoint sorun çıkarırsa ilgili fonksiyon dosyasını önceki sürüme döndür.
- `MODAL_URL` ayarlanmadıysa `/api/analyze` 500 verir → geçici olarak `js/app.js`'te `API_URL`'i eski Modal URL'ine döndürmek mümkün (ama önerilmez).
- `api_usage` tablosu kalabilir (zararsız); istenirse `drop table public.api_usage;`.
- Acil "tamamen kapat": Netlify env'lerinden ilgili anahtarları kaldırmak fonksiyonları 500'e düşürür (fail-closed).
