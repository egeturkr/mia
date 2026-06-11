# Faz 11 — İlk Müşteri Hazırlık Denetimi & Go-Live (11 Haziran 2026)

## Hazırlık skorları (acımasız)

| Alan | Skor | Gerekçe |
|---|---|---|
| Teknik | **85/100** | Tüm akışlar kod denetiminden geçti; canlı health "healthy"; otomatik tarama temiz. Eksi: RLS elle test edilmedi (ORG_RBAC_TEST_PLAN koşulmadı), MIA_BILLING_SECRET canlıda tanımsız |
| Ticari | **70/100** | Ücretli pilot sistemi + CRM + manuel ödeme hazır; otomatik tahsilat yok (bilinçli); pipeline boş — satış işi şimdi başlıyor |
| Hukuki | **35/100** | Altyapı (rıza, audit, disclaimers, taslaklar) tam ama **hukukçu onayı SIFIR**: KVKK metinleri, pilot sözleşmesi, DPA'lar, VERBİS — hepsi açık |
| AI | **45/100** | Pipeline çalışıyor + doğrulama çerçevesi hazır; **sahada ölçülmüş tek metrik yok** (pending). İlk pilot verisi bunu çözer |
| Operasyonel | **75/100** | İzleme/ops/runbook'lar hazır; harici uptime takibi kurulmadı; tek teknik kişi (bus factor 1) |
| **GENEL (ilk ücretli pilot)** | **65/100** | **"P0'lar çözülünce hazır"** — kod değil, hukuk+env+test işleri |

## P0 — Pilot başlamadan ÖNCE (engelleyiciler)
1. **Hukukçu onayı:** pilot sözleşmesi + KVKK aydınlatma + işveren onayı + saha afişi + sınır ötesi değerlendirme. *Onaysız tek kare saha videosu çekilmez (pilot sayfası da uyarır).*
2. **MIA_BILLING_SECRET + BILLING_PROVIDER=manual** Netlify env'ine eklenmeli (canlı health: billing not_configured — abonelik aktivasyon webhook'u şu an çalışmaz; fail-closed, güvenli).
3. **RLS elle testi:** ORG_RBAC_TEST_PLAN §1-4 ikinci hesapla koşulmalı (özellikle izolasyon + viewer kısıtları). Kod doğru görünüyor; üretim kanıtı yok.
4. **GO_LIVE_TEST_PLAN'ın tamamı** canlıda bir kez koşulmalı (iç kuru çalışma).
5. **Supabase schema.sql son sürümle koşulmuş olmalı** (Faz 10 tabloları dahil) — /ops dolmuyorsa migration eksiktir.

## P1 — Ücretli aboneliğe dönüşümden önce
Ölçülmüş AI doğruluğu (pilot verisiyle run_validation) · iyzico canlı tahsilat (veya kalıcı manuel fatura süreci + e-fatura/mali müşavir) · DPA imzaları (Roboflow/Modal) · VERBİS · harici uptime monitörü · pdf_base64 → Storage migration'ı.

## P2 — Kurumsal satıştan önce
SSO/SAML · MFA · tam audit log · canlı RTSP kamera · per-checkpoint scan token · CSP nonce refactor (unsafe-inline) · ISO 27001 yol haritası · pentest.

## Go-Live kontrol listesi (müşteri girişi gönderilmeden)
**Teknik:** schema güncel ✓ · env'ler (ROBOFLOW/MODAL/RESEND ✓; **MIA_BILLING_SECRET ekle**) · /api/health healthy ✓ · /ops erişilebilir · UptimeRobot kur · GO_LIVE_TEST_PLAN koşuldu.
**Müşteri:** org oluştur → kullanıcıları davet et (İSG=safety_manager, GM=viewer/admin) → pilot kaydı + checklist → ödeme durumu → CRM'e bağla.
**Hukuk:** hukukçu onayı VEYA açıkça "pending + video toplama kapalı" · saha afişi basılı · işveren onay formu imzalı · saklama süresi sözleşmede · pilot hukuki durumu sistemde "Hukukçu Onayladı".
**AI:** ai-performans sayfası "pending" göstermeye DEVAM eder — ilk gerçek koşuya kadar müşteriye sayı verilmez; pilot verisi doğrulama setine girer.
**Operasyon:** iç sahip (Deniz=teknik, Ege=müşteri, Gökberk=saha) · haftalık rapor sorumlusu · eskalasyon: saha sorumlusu → Ege → Deniz · kapanış toplantısı W4 başında takvime.

## 4 Haftalık Pilot Operasyon Planı (özet — detay FIRST_PILOT_RUNBOOK)
**W0 Hazırlık:** hukuk onayı + sözleşme + onboarding + çekim protokolü eğitimi + iç kuru çalışma (test videosuyla uçtan uca).
**W1 Baseline:** ilk videolar → analiz → %100 insan doğrulaması (FP/FN kaydı eval setine) → ilk haftalık rapor.
**W2 Stabilizasyon:** çekim kalitesi düzeltmeleri, kullanım takibi (ops), müşteri geri bildirim görüşmesi.
**W3 ROI kanıtı:** ihlal trendi W1↔W3, raporlama süresi ölçümü, yönetici özeti taslağı, run_validation ilk koşusu.
**W4 Kapanış:** final rapor + GM'e ROI sunumu + abonelik teklifi (pilot bedeli mahsuplu) + vaka çalışması izni + 3 tanıştırma.

## Yapılmayanlar (dürüst)
Canlı tarayıcıda elle regresyon BEN koşamadım (kod+statik+canlı-health denetimi yapıldı; tarayıcı testleri GO_LIVE_TEST_PLAN'da sana bırakıldı) · RLS sızma testleri koşulmadı · pentest yok · yük testi yok.

## Nihai tavsiye
**"P0'lar çözülünce ilk ücretli pilota HAZIR."** Yazılım engel değil; kalan işler hukuk imzası,
2 env değişkeni, bir test turu ve satış. Hukukçu onayı gelmeden saha videosu toplayan pilot BAŞLATMA;
onay sürecinde sözleşme/keşif/demo (kendi videolarınla) ilerleyebilir.
