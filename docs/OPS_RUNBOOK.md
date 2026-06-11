# Ops Runbook (MIA ekibi içi)

**Günlük rutin (2 dk):** ops.html aç → sağlık kartları yeşil mi → son hatalar boş mu → kota bloğu anormal mi.

## Arıza senaryoları

**Detector çalışmıyor / boş sonuç:**
1. /api/health → supabase + ai_config durumu. 2. ops.html → son hatalarda `roboflow_upstream`/`modal_upstream` var mı.
3. Konsolda (müşteri tarayıcısı) kırmızı mesaj — artık hatalar yüzeye çıkar (402=kota, 401=oturum, 5xx=upstream).
4. Kota: hesap sayfası kullanım / `api_usage` sayımı. 5. Roboflow/Modal panellerinde kredi/servis durumu.

**PDF inmiyor:** Konsolda jsPDF/CSP hatası ara ("Refused to load") → SECURITY_RUNBOOK CSP bölümü. report-meta hatası PDF'i engellemez (korumalı).

**Billing webhook başarısız:** ops.html → `billing_webhook_invalid_secret` uyarıları (yanlış secret = saldırı denemesi olabilir) → Netlify function logs → `billing_events`'te event_id var mı (idempotency). Webhook hatasında ödeme ASLA paid işaretlenmez (fail-closed) — tekrar gönder.

**Supabase down:** /api/health 503 + checks.supabase=down + system_errors'a critical düşer (DB dönünce görünür). status.supabase.com kontrol → bekle; site statik kısımları çalışır, veri akışları döner.

**Hata inceleme:** ops.html → Son Hatalar → kaynak/fonksiyon/mesaj → çözünce "Çözüldü" işaretle. Derin bakış: Supabase → system_errors (stack_hash ile aynı hatanın tekrarını grupla).

**Olay (incident) süreci:** 1) ops+health ile kapsamı belirle 2) müşteri etkileniyorsa pilot iletişim kişisine kısa not ("farkındayız, çalışıyoruz") 3) düzelt → system_errors resolved 4) kök neden + önlem notunu CRM/dokümana yaz.

**Bozuk özelliği geçici kapatma:** İlgili Netlify env'ini boşalt (ör. ROBOFLOW_API_KEY → detect 500/fail-closed döner, site ayakta kalır) veya netlify.toml'da ilgili redirect'i yorum satırı yap → deploy. Tam site geri alma: Netlify → Deploys → önceki deploy → "Publish deploy".

**Harici uptime (önerilen, 5 dk kurulum):** UptimeRobot/BetterStack → `https://miaissagligi.com/api/health` → 503'te e-posta. MIA tarafında ek iş gerekmez.
