# Faz 10 — Üretim İzleme & Operasyonel Görünürlük

## Ne kuruldu
| Bileşen | Detay |
|---|---|
| 3 izleme tablosu | `system_events` (ürün+sistem olayları), `system_errors` (hata takibi, resolved akışı), `health_checks` (sağlık geçmişi). Okuma yalnız **crm_admins**; yazma service_role (+system_events'e kullanıcı yalnız KENDİ frontend info olayını yazabilir) |
| `lib/log.js` | logEvent/logError/logHealth + sanitizasyon (Bearer/JWT/key desenleri [REDACTED], 500 char limit) + stack hash. **Log hatası ürünü asla bozmaz** (yutulur + console.warn) |
| `/api/log-client-error` | İstemci hataları: JWT zorunlu + 10/dk limit + sanitize; ham stack saklanmaz (yalnız hash) |
| `js/monitor.js` | window.onerror + unhandledrejection (oturum başına maks 5, yalnız girişli kullanıcı) + `MIAMonitor.event()` ürün olayı yardımcısı |
| API kancaları | detect/analyze upstream hataları → system_errors; webhook received + invalid-secret uyarısı; checkout_created; quota_exceeded (guard) |
| Ürün olayları | analysis_started/completed/failed (detector); pdf/csv/shared_link zaten report_exports'ta (Faz 9) |
| `/api/health` genişletmesi | Env boolean'ları (mevcut) + **canlı Supabase ping (latency)** + ai_config/billing/email durumları + genel healthy/degraded/down + her çağrıda health_checks kaydı + Supabase düşükse critical hata logu |
| `ops.html` | İç panel: sağlık kartları, 24s/7g metrikler (analiz, export, kota bloğu, hata, billing), son 15 hata (Çözüldü işaretleme), son 20 olay. Giriş zorunlu; log okumaları RLS ile yalnız crm_admins — başkası "erişim yok" görür |

## Neler LOGLANMAZ
JWT/token'lar · API/service anahtarları · ham video içeriği · localStorage · form değerleri ·
ham stack trace (yalnız hash) · gereksiz kişisel veri (yalnız user_id/org_id ID'leri).
Sanitizasyon regex'leri lib/log.js'te; istemci tarafı ayrıca 300-1000 char keser.

## Alarm stratejisi (bilinçli minimal)
Otomatik e-posta alarmı YOK (spam riski + tek kişilik ekip). Mevcut sinyaller:
(1) /api/health harici uptime izleyiciye bağlanabilir (UptimeRobot vb. — 503'te bildirir; kurulum dışsal),
(2) ops.html günlük kontrol rutini (OPS_RUNBOOK), (3) Supabase düşüşü critical olarak loglanır.
Eşik bazlı e-posta alarmı gelecek işi — OPS_ALERT_EMAIL env'i rezerve edildi.

## Kalan riskler
Sentry entegre değil (DSN rezerve) · uptime için harici servis gerekir · alarm manuel ·
tam değiştirilemez audit log yok · olay kapsamı seçili olaylarla sınırlı (login/register izlenmiyor —
Supabase Auth logları oradan görülür) · ops sayfası crm_admins tablosuna bağlı.

## Rollback
`git revert <commit>` — tüm izleme çağrıları korumalı (yokluğunda ürün aynen çalışır);
tablolar zararsız kalır. Tam temizlik: `drop table system_events, system_errors, health_checks;`
