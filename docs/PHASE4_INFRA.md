# Faz 4 — Production Infrastructure (Production Hardening)

Durum: kod tarafı tamamlandı (health + retention + temizlik komutları). Geriye uyumlu.
Host: **Netlify** (tek kaynak). Bazı adımlar hesap tarafında aksiyon gerektirir (aşağıda).

## 1. Ortam değişkeni zorlaması (env enforcement)

- Sunucusuz fonksiyonlar eksik env'de **fail-closed** (guard.js: 503; notify/scan/analyze: 500).
- Yeni **/api/health** endpoint'i zorunlu env'lerin tanımlı olup olmadığını (değer sızdırmadan,
  yalnızca boolean) ve endpoint envanterini raporlar. Deploy sonrası tek bakışta doğrulama.

Zorunlu env matrisi (Netlify → Site settings → Environment variables):

| Değişken | Kullanım | Kritik |
|----------|----------|--------|
| SUPABASE_URL | tüm fonksiyonlar | evet |
| SUPABASE_ANON_KEY | JWT doğrulama (guard) | evet |
| SUPABASE_SERVICE_ROLE_KEY | rate-limit/kota/scan/cleanup | evet |
| ROBOFLOW_API_KEY | /api/detect | evet |
| MODAL_URL | /api/analyze | evet |
| RESEND_API_KEY | /api/notify, weekly-digest | evet |
| MIA_SCAN_TOKEN | /api/scan (headless RFID) | opsiyonel |
| MIA_ALLOWED_ORIGINS | ek origin'ler | opsiyonel |

## 2. Secret yönetimi

- Tüm sırlar Netlify env'de; kodda/clientte sır yok. `SUPABASE_SERVICE_ROLE_KEY` "Scoped to
  Builds, Functions, Runtime" olarak tutulmalı (panelde kilit ikonu).
- `.env.example` yalnızca **public** anon key + placeholder içerir; gerçek sır YOK.
- **Rotasyon**: Roboflow/Resend/Supabase anahtarları periyodik (örn. 6 ayda bir) ve sızıntı
  şüphesinde yenilenmeli. `MIA_SCAN_TOKEN` uzun rastgele değer; saha okuyucu değişiminde döndürülmeli.
- Git geçmişinde sır taraması önerilir (`gitleaks` veya GitHub secret scanning).

## 3. Endpoint envanteri (tek host: Netlify)

| Endpoint | Kimlik | Rate | Kota |
|----------|--------|------|------|
| /api/detect | Supabase JWT | 30/dk | 300/ay |
| /api/analyze | JWT veya anonim IP | 5/dk | kullanıcı 300/ay · anon 3/gün |
| /api/scan | scan token | 120/dk | — |
| /api/notify | sunucu (Resend) | — | — |
| /api/health | public (boolean) | — | — |

Zamanlanmış işler: `weekly-digest` (Pzt 07:00 UTC), `cleanup` (her gün 03:00 UTC — api_usage 60 gün retention).

## 4. Geliştirme kısayollarının temizliği (terminal — tek host'a indir)

Canlı host Netlify; Vercel kopyaları kullanılmıyor ve `api/detect.js` **korumasız** (Vercel'e
deploy edilirse açık olurdu). Tek host'a inmek için sil:

```bash
git rm -r api .vercel vercel.json
git commit -m "Faz4: tek host (Netlify) — kullanilmayan Vercel kopyalarini kaldir"
git push origin main
```

> Güvenli: frontend `/api/*`'i netlify.toml redirect'leriyle (netlify/functions) çağırır;
> `api/` klasörü bu akışta KULLANILMAZ. Silmek hiçbir işlevi bozmaz, geri alınabilir (git).

## 5. Üretim hazırlığı — hesap tarafı checklist (senin yapacakların)

**Supabase**
- [ ] Ücretsiz → **Pro plan** (üretim yükü + günlük yedek + 7 gün PITR). Free tier üretim için yetersiz.
- [ ] Database → Backups açık olduğunu doğrula.
- [ ] Auth → Rate limits ve e-posta SMTP (Resend) ayarlı.
- [ ] RLS: tüm tablolarda açık (analyses, workers, equipment, checkpoints, scans, consents, api_usage) — teyit.

**Modal**
- [ ] Kişisel hesap → **ekip/üretim** hesabı; kullanım limiti + faturalandırma uyarısı.
- [ ] MODAL_URL'in stabil (versiyonlanmış) endpoint olduğunu doğrula.

**Roboflow**
- [ ] Free (15 kredi) → ücretli plan; kullanım uyarısı.
- [ ] API anahtarını domain/kullanım kısıtıyla yapılandır.

**Netlify**
- [ ] Deploy sonrası `https://miaissagligi.com/api/health` → `status: ok` dönmeli.
- [ ] Scheduled functions (weekly-digest, cleanup) Functions sekmesinde görünür olmalı.
- [ ] Production branch + deploy bildirimleri (Slack/e-posta) açık.

## 6. Test (deploy sonrası)

1. `curl -s https://miaissagligi.com/api/health` → `status:"ok"`, `critical_missing: []`.
2. Bir env'i geçici kaldır → health `503 misconfigured` döner (enforcement çalışıyor).
3. Functions sekmesinde `cleanup` zamanlanmış görünür.

## 7. Rollback

- health/cleanup yeni dosyalar — `git revert` ile kalkar; mevcut akışı etkilemez.
- Vercel temizliği geri alınabilir (`git revert` veya dosyaları geri ekleme).
- Schedule kaldırmak için netlify.toml'daki `[functions."cleanup"]` bloğunu sil.
