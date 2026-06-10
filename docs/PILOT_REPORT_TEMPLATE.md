# MIA — Haftalık Pilot Güvenlik Raporu (Şablon)

> Bu şablon pilot.html'deki "Raporu Kopyala" düğmesinin ürettiği metnin kaynağıdır.
> Müşteriye e-posta/WhatsApp ile gönderilir. Alanlar gerçek pilot verisinden doldurulur — sayı uydurulmaz.

```
MIA — Haftalık Pilot Güvenlik Raporu
=====================================
Firma: {company_name}
Saha: {site_name}
Pilot haftası: {week_number} / 4   ({report_date})

ÖZET
- Analiz edilen video: {uploaded_video_count}
- Tespit edilen toplam ihlal: {total_violations}
- Yüksek riskli ihlal: {high_risk_violations}
- Ortalama güvenlik skoru: {average_safety_score}%
- En çok tekrarlanan ihlal: {top_violation — İhlal Raporu sayfasından elle eklenir}
- AI doğrulama durumu: {pending | sahada ölçüldü: mAP/precision değerleri}

MANUEL İNCELEME NOTLARI
{manual_review_notes}

MÜŞTERİ GERİ BİLDİRİMİ
{customer_feedback}

ÖNERİLEN AKSİYONLAR
{next_actions}

—
Bu rapor MIA AI destekli güvenlik analizi ile hazırlanmıştır; sertifikalı İSG denetiminin,
yasal uygunluk kontrollerinin veya profesyonel insan değerlendirmesinin yerine geçmez.
MIA — miaissagligi.com
```

## Hafta 4 — Kapanış ROI Özeti (ek bölüm)

```
4 HAFTALIK ROI ÖZETİ
- Toplam analiz edilen video: {sum}
- İhlal trendi: Hafta 1: {w1} → Hafta 4: {w4}  ({değişim %})
- Yüksek risk trendi: {w1_high} → {w4_high}
- Ortalama skor trendi: {w1_score}% → {w4_score}%
- Raporlama süresi: ~2-3 saat/hafta → <15 dk/hafta
- Sahanızda ölçülen AI doğruluğu: {ölçüldüyse gerçek değer; ölçülmediyse "doğrulama sürüyor"}

SONRAKİ ADIM
12 aylık Kamera AI aboneliği (₺12.000/ay) — pilot bedeli (₺25.000) ilk yıl faturasından düşülür.
```
