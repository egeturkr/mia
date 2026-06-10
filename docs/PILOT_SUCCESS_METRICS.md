# Pilot Başarı Metrikleri

Tüm sayılar pilot.html'deki bağlı analizlerden ve haftalık raporlardan gelir. **Sayı uydurulmaz**;
veri yoksa metrik "ölçülmedi" olarak raporlanır.

## Sözleşmeye yazılan hedefler

| Metrik | Ölçüm yöntemi | Hedef |
|---|---|---|
| İhlal tespit doğruluğu (precision) | MIA tespiti vs İSG uzmanı haftalık örneklem doğrulaması | ≥ %85 |
| False positive oranı | Hafta 1 insan incelemesi (her video) | < %10 |
| İhlal oranında düşüş | Hafta 1 baseline vs Hafta 4 (görünürlük etkisi) | ≥ %30 |
| Raporlama süresi | Haftalık İSG raporu hazırlama süresi önce/sonra | 2–3 saat → < 15 dk |
| Denetim kapsamı | Gözlemlenen çalışan-geçişi/hafta | manuel turun ≥ 5 katı |
| Kullanım | Video/hafta + aktif kullanıcı | ≥ 5 video/hafta, ≥ 2 kullanıcı |

## İzlenen seriler (haftalık rapor tablosu)

- Analiz edilen video sayısı (haftalık)
- Toplam ihlal + yüksek riskli ihlal (trend: H1→H4 düşüş beklenir)
- Ortalama güvenlik skoru (trend: yükseliş beklenir)
- En çok tekrarlanan ihlal türü (İhlal Raporu sayfasından)
- FP/FN notları (manuel inceleme alanı) → eval setine geri beslenir

## AI doğrulama bağlantısı

Pilot videoları aynı zamanda doğrulama verisidir: `docs/PHASE2_AI_VALIDATION.md` §8 akışıyla
etiketlenip `run_validation.py` koşulur → kapanış sunumunda "sizin sahanızda ölçülmüş doğruluk"
sayısı sunulur. Bu, pilotun en güçlü satış çıktısıdır.

## Önce/sonra karşılaştırması (kapanış sunumu)

| | Pilot öncesi | Pilot sonrası |
|---|---|---|
| KKD denetimi | Manuel saha turu, örneklem | Her geçiş noktası, günlük |
| İhlal kanıtı | Sözlü/fotoğraf | Zaman damgalı video + rapor |
| Haftalık rapor | 2–3 saat manuel | < 15 dk, otomatik veri |
| Yönetim görünürlüğü | Aylık özet | Canlı panel + haftalık PDF |

## Dönüşüm hazırlık skoru (iç değerlendirme, H3 sonunda)

Her madde 0–2 puan (0 yok, 1 kısmi, 2 tam): kullanım ≥hedef · İSG müdürü raporları iletiyor mu ·
GM kapanışa katılıyor mu · ölçülen doğruluk ≥%85 · ihlal trendi düşüyor mu · bütçe sinyali var mı.
**≥9/12 → dönüşüm teklifi güçlü; <6 → kayıp riski, H4'te kurtarma planı.**
