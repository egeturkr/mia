# MIA Pilot Başarı Kriterleri ve Go/No-Go Çerçevesi

Tüm rakamlar pilot sırasında ÖLÇÜLÜR — önceden taahhüt edilmez.
Ölçüm yöntemi: docs/MIA_PPE_MODEL_EVALUATION_PLAN.md + worker perf metadata'sı.

## Teknik kriterler
| Metrik | Hedef | Ölçüm kaynağı |
|---|---|---|
| Worker uptime (pilot penceresi, mesai saatleri) | ≥ %95 | camera_worker_sessions heartbeat |
| Uçtan uca olay gecikmesi (kare → panel) | ≤ 30 sn | perf_ms + olay zaman damgaları |
| Baret precision (kalibrasyon sonrası) | ≥ 0.85 | etiketli saha verisi |
| Baret recall | ≥ 0.70 | etiketli saha verisi |
| Yelek precision | ≥ 0.80 | etiketli saha verisi |
| Yelek recall | ≥ 0.65 | etiketli saha verisi |
| Yanlış alarm | ≤ 2/saat/kamera | dismissed olay oranı |

## Kullanım kriterleri
- İSG ekibi haftada ≥3 gün panele girdi ve olayları inceledi
- Rapor/CSV en az 2 kez gerçek İSG sürecinde kullanıldı
- İSG ekibi geri bildirimi: "süreçlerimize değer kattı" (anket ≥3.5/5)
- Müşteri en az 1 gerçek sahada düzeltici aksiyonu MIA olayına dayandırdı

## Go / No-Go
**GO:** teknik kriterlerin ≥%70'i + kullanım kriterlerinin tamamı → ticari teklif.
**KOŞULLU GO:** precision hedefte ama recall düşük → ek kalibrasyon sprinti ile devam.
**NO-GO:** yanlış alarm hedefi 2× aşılıyor VEYA İSG ekibi değer görmüyor →
dürüst kapanış raporu + model eğitim yol haritası sunulur; veri (onayla) eval setine katılır.

## Pilot kapanış raporu içeriği
Ölçülen tüm metrikler (hedef vs gerçek) · olay istatistikleri · yanlış alarm
analizi ve kök nedenler · ekip geri bildirimi · öneri (go/koşullu/no-go) ·
ticari teklif veya iyileştirme planı.
