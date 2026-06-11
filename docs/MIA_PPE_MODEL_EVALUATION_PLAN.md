# MIA KKD Model Değerlendirme Planı (Faz 15)

**Durum: SAHA DOĞRULAMASI BEKLİYOR.** Bu doküman ölçüm ÇERÇEVESİDİR — hiçbir
doğruluk rakamı henüz ölçülmedi ve ölçülmeden müşteriye RAKAM VERİLMEZ.

## Hedef sınıflar
| Sınıf | Durum | Pilot hedefi |
|---|---|---|
| Baret (no_helmet) | Destekleniyor (rf-27) | Birincil ölçüm |
| Yelek (no_safety_vest) | Destekleniyor (rf-27) | Birincil ölçüm |
| Maske (no_mask) | Deneysel | Yalnız gözlem, taahhüt yok |
| Eldiven/gözlük/kemer/bot/kulaklık | Model eğitimi gerekir | ÖLÇÜLMEZ (sınıf yok) |

## Test veri seti gereksinimleri
- **Asgari örnek:** sınıf başına ≥500 etiketli kare (≥200 pozitif ihlal içeren);
  pilot başına ≥2 farklı şantiyeden.
- **Türkiye şantiye koşulları:** beyaz/sarı/kırmızı/mavi baret renkleri, turuncu/sarı
  yelek, tozlu/çamurlu ekipman, yoğun iskele/demir donatı arka planı.
- **Çeşitlilik matrisi (her hücreden örnek):** gündüz/akşam/gece(projektör) ×
  iç/dış mekân × yakın(3-8m)/orta(8-20m)/uzak(20m+) × kamera açısı (göz hizası,
  yüksek direk, tepeden) × hava (güneş/yağmur/sis).
- **Zor durumlar:** kısmi kapanma (occlusion — iskele arkası, yarı görünen işçi),
  baret elde/belde (takılı değil), kapüşon/şapka karışıklığı, yelek bel hizasında,
  sırt dönük işçi, grup halinde işçiler.

## Metrikler (sınıf başına)
Precision · Recall · F1 · FP oranı (yanlış alarm/saat) · FN oranı ·
kare başına gecikme (capture/infer/total ms — worker zaten ölçüyor) · olay/saat.

## Pilot kabul kriterleri (hedef — ölçülünce rapora yazılır)
- Baret precision ≥ 0.85, recall ≥ 0.70 (kalibrasyon sonrası)
- Yelek precision ≥ 0.80, recall ≥ 0.65
- Yanlış alarm ≤ 2/saat/kamera (dedup sonrası)
- Uçtan uca gecikme ≤ 30 sn (kare → panelde olay)
Hedefler tutturulamazsa: eşik/açı kalibrasyonu → yeniden ölçüm → hâlâ altındaysa
müşteriye dürüst raporlanır ve sınıf "deneysel"e düşürülür.

## Ölçüm süreci
1. Pilot sahasından onaylı kayıt/canlı örnekler topla (hukuk onayı ZORUNLU).
2. Etiketle (CVAT/Label Studio) → `tools/evaluate_detections.py` girdi biçimine çevir.
3. Worker tespitlerini aynı kareler üzerinde topla (detections_json).
4. Script ile metrikleri hesapla; sonuçları bu dosyanın "Ölçülen Sonuçlar" ekine işle.
5. Eşik ayarla (DEFAULT_CONFIDENCE_THRESHOLD) → tekrar ölç → pilot raporuna koy.

## Ölçülen Sonuçlar
*(boş — saha doğrulaması yapılınca doldurulacak; uydurma rakam YAZILMAZ)*
