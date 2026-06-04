# Faz 2 — Legal & Compliance (Production Hardening)

Durum: tamamlandı (kod + mantık testleri). Geriye uyumlu; hiçbir sayfa/branding/route
değişmedi. Statik metin değil — **gerçek rıza akışları + kabul audit trail + sürüm takibi**.

## 1. Kapsanan uyum maddeleri

| Madde | Nasıl uygulandı | Kanıt/akış |
|-------|------------------|-----------|
| KVKK açık rıza | Kayıt formunda **zorunlu** onay kutusu | `consents`'e terms+privacy+kvkk satırı |
| Gizlilik onayı | Kayıt onayı + gizlilik sayfası | sürümlü kayıt |
| Görüntü işleme onayı | Analiz öncesi **modal** (detector + demo) | `image_processing` consent |
| Sınır ötesi aktarım | Modal + KVKK/gizlilik metni | `cross_border` consent + metin |
| AI-destekli analiz disclaimer | Sonuç ekranı + PDF + e-posta | her çıktı |
| Sorumluluk reddi | PDF + sonuç + rapor | her çıktı |
| Rapor disclaimer | PDF footer + public rapor sayfası | her rapor |

## 2. Audit trail + sürüm takibi

- `consents` tablosu (RLS açık, append-only): `document_key`, `version`, `user_id`/`email`,
  `user_agent`, `page`, `accepted_at`. Her kabul ayrı satır → denetimde kanıt.
- Sürümler `js/legal.js` → `MIALegal.VERSIONS`. Bir doküman metni değişince sürüm yükseltilir;
  `hasConsent` eski sürümü geçersiz sayar → kullanıcıdan **yeniden rıza** istenir.

## 3. Değişen / eklenen dosyalar

Eklenen:
- `js/legal.js` — sürüm defteri, `recordConsent`, `hasConsent`, görüntü işleme rıza modalı, disclaimer metinleri.
- `supabase/schema.sql` → `consents` tablosu.
- `docs/PHASE2_LEGAL_COMPLIANCE.md`.

Değiştirilen (geriye uyumlu):
- `kaydol.html` — zorunlu KVKK/şartlar/gizlilik onay kutusu (linkler düzeltildi) + `legal.js`.
- `js/app.js` — signup rıza kontrolü + kabul kaydı; demo analizi rıza kapısı; PDF + sonuç disclaimer.
- `js/detector.js` — canlı analiz rıza kapısı; PDF + sonuç disclaimer.
- `detector.html`, `demo.html` — `legal.js` dahil edildi.
- `netlify/functions/notify.js` — uyarı e-postasına disclaimer.
- `rapor.html` — public rapora disclaimer.
- `kvkk.html`, `gizlilik.html` — yurt dışı aktarım + görüntü işleme bölümleri.

## 4. Migration

1. Supabase SQL Editor'da güncel `supabase/schema.sql`'i çalıştır (idempotent) → `consents` oluşur.
2. Ek env gerekmez (mevcut Supabase anahtarları yeterli).
3. Deploy (git push) → Netlify otomatik yayınlar.

## 5. Test

Otomatik (doğrulandı): legal.js — sürümler, disclaimer metinleri, `recordConsent` satır şekli
(2 satır, doğru key/version), localStorage işareti, `hasConsent`. Syntax: app.js, detector.js,
legal.js, notify.js.

Manuel (deploy sonrası):
1. Kayıt: onay kutusu işaretlenmeden "Hesap Oluştur" → **hata** ("Lütfen ... kabul edin").
   İşaretleyip kayıt → başarılı; Supabase `consents`'te terms/privacy/kvkk satırları.
2. detector.html (giriş yapılmış) analiz → ilk seferde **görüntü işleme modalı** çıkar; onaylamadan analiz başlamaz. Onayınca `image_processing`+`cross_border` kaydı; ikinci analizde modal çıkmaz.
3. demo.html video upload → aynı modal.
4. PDF indir → son sayfada sorumluluk/AI disclaimer bloğu; footer güncel.
5. Yüksek riskli analiz e-postası → disclaimer satırı.
6. kvkk.html / gizlilik.html → yurt dışı aktarım bölümleri görünür.

## 6. Rollback

- Tümü `git revert <hash>` ile geri alınır; `consents` ek tablo, mevcut veriyi etkilemez.
- `legal.js` yoksa tüm rıza/disclaimer kancaları **no-op**'tur (kod `window.MIALegal` kontrolü yapar) → eski davranış güvenle döner.
- `consents` tablosu kalabilir (zararsız) veya `drop table public.consents;`.

## 7. Bilinen sınırlar / sonraki adımlar (hukuk danışmanı ile)

- Veri sorumlusu unvanı, VERBİS kaydı, saklama süreleri resmî olarak netleştirilmeli (kvkk.html'de not var).
- "Hesabımı/verimi sil" self-serve akışı Faz 4 (altyapı) kapsamında önerilir.
- Rıza geri çekme (withdraw) UI'si eklenebilir (şu an e-posta ile başvuru).
