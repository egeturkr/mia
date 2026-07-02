# MIA Özel KKD Model Eğitim Yol Haritası — "Tüm KKD"ye Giden Yol (Faz 21)

**Durum:** Bugün CANLI olan yalnız baret+yelek (rf-27); maske deneysel.
Aşağıdakiler PLAN'dır — hiçbiri canlı değildir ve canlıymış gibi satılmaz.

## Temel (bugün)
rf-27 doğrudan negatif sınıflar verir (NO-Hardhat, NO-Safety Vest) — bu güçlü
temel korunur. Yeni sınıflar bu temelin ÜZERİNE eklenir, yerine geçmez.

## Sınıf-sınıf eğitim planı (öncelik sırası — saha riskine göre)
| Sınıf | Asgari görüntü | Zorluk | Not |
|---|---|---|---|
| Emniyet kemeri (harness) | 2500+ | Yüksek | Yüksekte çalışma = en ölümcül risk; kemer gövdeye yakın, açı kritik |
| Eldiven | 1500+ | Orta | Küçük nesne; el görünürlüğü değişken |
| Koruyucu gözlük | 2000+ | Yüksek | Çok küçük; yüz açısı şart; FP riski yüksek |
| İş ayakkabısı | 1500+ | Orta | Alt kadraj gerekir; kamera açısı planlaması |
| Kulak koruyucu | 1500+ | Orta | Baretle karışma riski |

## Veri seti gereksinimleri (her sınıf için)
- **TR şantiye örnekleri:** beyaz/sarı/kırmızı baret kültürü, turuncu yelek,
  iskele/demir donatı arka planı, tozlu ekipman — Batı veri setleri yetmez.
- Pozitif (takılı) + **negatif (takılı DEĞİL)** örnekler dengeli (≥%30 negatif).
- Çeşitlilik matrisi: MIA_PPE_MODEL_EVALUATION_PLAN.md'deki gün/gece × iç/dış ×
  mesafe × açı × hava kombinasyonları.
- Etiket şeması: kanonik adlarla (detection_schema.py CANONICAL_MAP'e uyumlu):
  `gloves / no_gloves / safety_glasses / no_glasses / safety_harness / no_harness /
  safety_boots / no_boots / ear_protection / no_ear_protection` + person her karede.
- Kaynak: pilot müşteri sahaları (yazılı veri onayı + KVKK) + kamu veri setleri (lisans kontrolü).

## Eğitim → yayına alma süreci (sınıf başına)
1. Veri topla → CVAT/Label Studio'da etiketle (çift kontrol: %10 örneklem ikinci etiketleyici).
2. Roboflow'da yeni sürüm eğit (veya kendi YOLO'muz — aşağıda).
3. `tools/evaluate_detections.py` + eval planı hedefleriyle ölç (precision ≥0.80 şartı).
4. Geçerse: `ppe_registry` (py+js SENKRON) → sınıf `requires_training` → `experimental`.
5. 1 pilot sahada ≥2 hafta gözlem → FP/saat hedefi tutarsa → `supported` + UI kilidi açılır.
6. Geçmezse: hata analizi → veri ekle → tekrar. KISAYOL YOK.

## Roboflow'dan özel modele geçiş
Adaptör mimarisi hazır: `src/` altına `yolo_adapter.py` (Ultralytics/ONNX) →
normalize şemaya çevir → `get_adapter()`'a ekle → env `MODEL_PROVIDER`.
Geçiş şartı: kendi modelimiz eval'de rf-27'yi GEÇMEDEN üretime alınmaz.
Kazanım: kare başına API maliyeti sıfırlanır, gecikme düşer (yerel GPU),
görüntü makineden çıkmaz (KVKK güçlenir).

## Müşteri/saha kalibrasyonu
`DEFAULT_CONFIDENCE_THRESHOLD` saha başına (MIA_MODEL_IMPROVEMENT_PLAN.md §2);
gelecek: kamera başına eşik (cameras tablosuna kolon — v2).

## Dürüstlük çizgisi
Her sınıf için sıra DAİMA: veri → eğitim → ölçüm → deneysel → saha → destekli.
UI kilidi yalnız bu süreç tamamlanınca açılır; pazarlama hiçbir sınıfı süreç
bitmeden "destekleniyor" gösteremez (registry tek gerçek kaynak).
