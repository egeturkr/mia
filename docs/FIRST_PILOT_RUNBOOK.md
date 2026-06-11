# İlk Pilot Runbook (MIA ekibi içi — adım adım)

## 1. Müşteri onboarding (W0)
1. customers.html → firma kaydı zaten var olmalı (durum: pilot_proposed) → pilot.html → Yeni Pilot (₺25.000, tarihler) → CRM'den pilota bağla.
2. Hukuki Hazırlık panelini doldur → hukukçu onayı gelmeden **"Hukukçu Onayladı" işaretleme**.
3. Checklist'i sözleşme/KVKK/afiş/onay maddeleriyle ilerlet.

## 2. Org + kullanıcılar
organization.html → org adını müşteri firması yap (veya yeni org) → İSG müdürünü **safety_manager**, GM'i **viewer** (yalnız izleme) veya **admin** (ekip yönetecekse) davet et → davet linkini e-posta/WhatsApp ile ilet → kabulü üye listesinde doğrula. Müşteriye 10 dk panel turu: Analiz yükleme, Dashboard, İhlal Raporu, PDF.

## 3. Video toplama (W1+, yalnız hukuk onayından sonra)
PILOT_VIDEO_COLLECTION_PROTOCOL.md müşteri saha sorumlusuna PDF olarak verilir. Günlük: 2-3 geçiş noktası × 5-10 dk, adlandırma standardı, Analiz sayfasından yükleme. İlk hafta her analizi MIA elden doğrular (yanlış tespitler not edilir).

## 4. Analiz → haftalık rapor
Müşteri (veya Gökberk) yükler → analizler pilot detayında "Bağlı Analizler"e eklenir → Cuma: "Bağlı analizlerden doldur" → manuel inceleme notu + müşteri geri bildirimi + aksiyonlar → Kaydet → "Raporu Kopyala" → e-posta/WhatsApp ile İSG müdürüne + GM'e CC.

## 5. AI hataları
FP (yanlış alarm): raporda şeffaf belirt ("X tespitinin Y'si doğrulandı"), kareyi eval/dataset düzeltme setine ekle. FN (kaçan ihlal): müşteriden öğrenildiyse not al, eval setine ekle, "örnekleme sınırı" açıklamasını kullan (rapor zaten içeriyor). ASLA hatayı gizleme — ilk pilotta şeffaflık güven inşa eder; "modeli sizin sahanızla eğitiyoruz" anlatısı satıştır.

## 6. Doğrulama koşusu (W3)
Pilot videolarından 300+ kare etiketle (PHASE2_AI_VALIDATION §8) → `run_validation.py` → ai-performans.html ölçülen değeri gösterir → kapanış sunumunda "SİZİN sahanızda ölçülen doğruluk" slaytı.

## 7. Kapanış ROI raporu (W4)
PILOT_REPORT_TEMPLATE.md'nin "4 Haftalık ROI Özeti" bölümü: trendler (W1→W4), zaman tasarrufu, ölçülen doğruluk, en riskli nokta/saat. Sunum GM'e (SALES_PLAYBOOK kapanış gündemi).

## 8. Aboneliğe dönüşüm
Teklif: Kamera AI ₺12.000/ay, pilot bedeli ilk yıldan mahsup → kabul: pilot durumu **converted** + ödeme **Aboneliğe sayıldı** → BILLING_RUNBOOK §4 ile org aboneliğini `manual_active` yap → CRM: customer + vaka izni iste + 3 tanıştırma → ret: **lost** + neden notu → 3 ay sonra takip görevi.
