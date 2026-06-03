# MIA — Termal PoC (Sprint 5)

Mostar görüşmesinde termal kamera ile baret/yelek tespiti önerildi. Bu PoC, termal
katmanı ürünleştirmeden **önce** fizibilitesini sayısal olarak ölçer ve net bir
**go / no-go** kararı verir. Para ve mühendislik zamanı harcamadan önce hipotezi sınarız.

## 1. Hipotezler

- **H1 (güçlü beklenti):** Termal, sahada **insan varlığını** (ısı imzası) ışık koşulundan
  bağımsız, gece dahil yüksek doğrulukla tespit eder.
- **H2 (asıl belirsizlik):** Termal, bir kişinin **baret takıp takmadığını** ayırt edebilir.
  Baret (plastik) ile saç/kafa derisi arasındaki yüzey sıcaklığı farkı, baret varlığını
  güvenilir bir sinyale dönüştürür mü? → PoC'nin esas test ettiği soru.
- **H3:** Termal, **yelek** varlığını (kumaş ısı tutuşu / gövde sıcaklık dağılımı) ayırt eder.

Önsel beklenti: H1 büyük olasılıkla geçer; H2/H3 zayıf olabilir. PoC bunu kanıtlar — varsayımla
ilerlemeyiz.

## 2. Donanım seçenekleri (pilot için ucuz → pahalı)

- **Akıllı telefon termal eklentisi:** FLIR One / Seek Thermal (~9–25k₺). Pilot için en hızlı.
- **FLIR Lepton modülü** (Raspberry Pi ile): gömülü/sabit nokta için ~radyometrik veri.
- **Sabit termal IP kamera:** saha kurulumu, daha pahalı — sadece go kararından sonra.

Pilotu telefon eklentisiyle başlat: maliyet düşük, Mostar sahasında hemen veri toplanır.

## 3. Veri toplama planı

Hedef: **≥ 150 eşleştirilmiş kare** (mümkünse termal + aynı anda RGB referans).

| Senaryo | Adet | Not |
|---------|------|-----|
| Baretli kişi | ~40 | farklı mesafe/açı |
| Baretsiz kişi | ~40 | H2 için kritik karşılaştırma |
| Yelekli / yeleksiz | ~40 | H3 |
| Gece / düşük ışık | ~20 | H1'in termal avantajı |
| İnsansız sahne | ~10 | yanlış pozitif ölçümü |

Her termal kare için etiket (JSON): `{ "person": true/false, "helmet": true/false, "vest": true/false, "head_box": [x,y,w,h] }`.
Etiketleme `thermal_eval.py`'nin beklediği formatta — bkz. örnek `labels/ornek.json`.

## 4. Değerlendirme

`thermal_eval.py` üç şeyi ölçer:

1. **İnsan tespiti (H1):** ısı eşikleme + kontur ile sıcak gövde tespiti → precision/recall.
2. **Baret proxy'si (H2):** etiketli kafa bölgesinde sıcaklık dağılımı; baretli vs baretsiz
   kareler arasında ayırt edici bir eşik bulunup bulunmadığı (ROC/AUC benzeri ayrışma skoru).
3. **Yelek proxy'si (H3):** gövde bölgesi sıcaklık homojenliği — aynı ayrışma analizi.

Çıktı: `thermal_poc_report.json` + konsol özeti.

## 5. Go / No-Go kriterleri

| Bulgu | Karar |
|-------|-------|
| H2 ayrışma (baretli vs baretsiz) AUC ≥ 0.80 | **GO** — baret tespiti termalle değerli, ürünleştir |
| H2 AUC 0.65–0.80 | **KOŞULLU** — RGB kamera ile füzyon dene, tek başına termal yetersiz |
| H2 AUC < 0.65 | **NO-GO (baret)** — termali sadece H1 (insan/gece varlık) için kullan |
| H1 recall ≥ 0.90 | Termal en azından "gece insan varlığı + kalabalık" katmanı olarak değerli |

Karar ne olursa olsun PoC değerli: ya termali ürün ailesine ekleriz, ya da roadmap'ten
çıkarıp kaynakları kamera+RFID'e yoğunlaştırırız (S6 paketleme buna göre güncellenir).

## 6. Çalıştırma

```bash
pip install opencv-python-headless numpy --break-system-packages
python thermal_poc/thermal_eval.py --images thermal_poc/dataset/images \
                                    --labels thermal_poc/dataset/labels \
                                    --out thermal_poc/thermal_poc_report.json
```

Termal görseller gri tonlamalı (8-bit) ya da radyometrik (16-bit PNG) olabilir; script
ikisini de okur ve sıcaklık-proxy olarak piksel yoğunluğunu kullanır (radyometrik varsa
gerçek °C'ye yakındır).
