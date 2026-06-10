# Faz 2 — AI Doğrulama Sistemi

Amaç: "Modeliniz gerçek şantiye görüntüsünde ne kadar doğru?" sorusuna **ölçülmüş** cevap verebilmek.
Sayı uydurulmaz; gerçek etiketli veriyle koşulmamış hiçbir metrik yayınlanmaz (durum: `pending`).

> Not: `docs/PHASE3_AI_VALIDATION.md` önceki hardening turunun kaydıdır; bu doküman onun üzerine
> video desteği, FP/FN analizi ve offline tahmin karşılaştırmasını ekler.

---

## 1. Klasör yapısı

```
eval/
  baseline_eval.py          # metrik motoru (P/R/F1/AP@0.5, mAP@0.5, FP/FN detayları)
  run_validation.py         # orkestratör → validation_latest.json + arşiv + tarihçe
  extract_frames.py         # video → deterministik kare çıkarma (YENİ)
  validation_config.json    # model, eşikler, veri yolları
  validation_latest.json    # ai-performans.html'in okuduğu kamu kaynağı
  validation_history.json   # zaman serisi (her koşu eklenir)
  model_registry.json       # model sürüm kaydı (current: rf-27)
  results/                  # arşiv: <sürüm>_<zaman>.json + details_<zaman>/
  dataset/
    images/                 # test görselleri (.jpg/.png) — video kareleri de buraya
    labels/                 # YOLO etiketleri (görselle aynı isim .txt)
    videos/                 # doğrulama videoları (MP4/MOV/AVI)
    predictions/            # OPSİYONEL: önceden hesaplanmış tahminler (offline mod)
    classes.txt             # 10 sınıf, model sırasıyla — DEĞİŞTİRME
    frames_metadata.json    # kare → kaynak video + saniye (extract_frames üretir)
```

Saha verisi (görüntü = kişisel veri) `.gitignore` ile repo dışında tutulur.

## 2. Ground truth formatı

**YOLO** (mevcut format korunur). Her görsel için aynı isimde `.txt`:

```
<class_id> <cx> <cy> <w> <h>      # 0..1 normalize; class_id classes.txt sırasından
```

Video karelerinde izlenebilirlik `frames_metadata.json`'dan gelir; her kare için:
`source_video`, `timestamp_sec`, `extracted_fps`, `extracted_at`. Etiketçi/saha bilgisi
isteğe bağlı olarak `validation_config.json → dataset_name` ve nota yazılır.

Etiketleme araçları: Roboflow Annotate, CVAT, Label Studio (üçü de YOLO export verir).
Etiketleme kuralları için `eval/README.md` bölüm 4 geçerli.

## 3. Video → kare akışı

```bash
# 1) Videoları koy:  eval/dataset/videos/santiye-giris-01.mp4
# 2) Kare çıkar (deterministik, varsayılan 1 kare/sn):
python eval/extract_frames.py --fps 1
# Çıktı: eval/dataset/images/santiye-giris-01_f00001_t0ms.jpg ... + frames_metadata.json
# 3) Kareleri etiketle → labels/ altına aynı isimli .txt
```

Aynı video tekrar işlenmez (`--force` ile yenilenir). Video yoksa script zarifçe çıkar.

## 4. Doğrulamayı çalıştırma

```bash
# Canlı mod (Roboflow API ile):
export ROBOFLOW_API_KEY=xxxx
python eval/run_validation.py

# Offline mod: tahminler önceden kaydedildiyse (Modal çıktısı vb.) API çağrılmaz.
# eval/dataset/predictions/<görsel-adı>.json doluysa otomatik offline'a geçer.
```

Offline tahmin formatları (`predictions/<görsel>.json`):
- A: `[{"class": "NO-Hardhat", "confidence": 0.87, "box": [x1,y1,x2,y2]}]` (0..1 normalize)
- B: Roboflow ham çıktısı (`{"predictions": [...], "image": {"width": W, "height": H}}`)

**Veri yoksa:** koşu hata vermez; `validation_latest.json` dürüst `pending` durumuyla yazılır.

## 5. Çıktılar

| Dosya | İçerik |
|---|---|
| `eval/validation_latest.json` | Kamu kaynağı — status, model sürümü, sayımlar, metrics{precision,recall,f1,mAP50}, per_class |
| `eval/results/<sürüm>_<ts>.json` | Arşiv (her koşu, yeniden üretilebilirlik) |
| `eval/validation_history.json` | Zaman serisi (trend) |
| `eval/results/details_<ts>/false_positives.json` | Her FP: görsel, sınıf, güven, kutu, kaynak video+saniye, model sürümü |
| `.../false_negatives.json` | Kaçan her gerçek ihlal (görsel, sınıf, kutu, kaynak) |
| `.../low_confidence_predictions.json` | Güven < 0.5 tahminler (eşik kalibrasyonu girdisi) |
| `.../per_class_summary.json` | Sınıf bazında TP/FP/FN, P/R/F1/AP@0.5 |
| `.../validation_summary.json` | Koşu özeti + sayımlar |

Metrikler: TP/FP/FN, precision, recall, F1, sınıf bazında P/R, AP@0.5, **mAP@0.5**
(VOC-tarzı interpolated), güven dağılımı (mean_confidence + low_confidence listesi),
IoU eşiği yapılandırılabilir (`validation_config.json → iou`).

## 6. ai-performans.html davranışı

- `status: "pending"` → "Henüz saha verisiyle ölçülmedi" + model/sürüm + açık uyarı. Sayı YOK.
- `status: "measured"` → yalnızca script'in ürettiği gerçek sayılar: mAP@0.5, ihlal P/R,
  görsel/etiket/video sayıları, sınıf tablosu, model sürümü, veri seti adı.
- Sayfa `eval/validation_latest.json`'ı fetch eder; elle düzenleme YAPILMAZ.

## 7. Neyin "ölçülmüş" sayılacağı

Bir sonuç ancak şu şartlarda pazarlamada kullanılabilir:
1. Gerçek saha görüntüsü (≥300 görsel hedef; ilk rapor için ≥100 kabul edilebilir, raporda boyut açıkça yazılır).
2. Etiketler insan tarafından, kılavuza göre yapılmış (eval/README.md §4).
3. `run_validation.py` ile üretilmiş ve `results/` altında arşivlenmiş.
4. Üretim eşikleriyle koşulmuş (conf 0.35 / IoU 0.5).

**Asla iddia edilmeyecekler:** veri olmadan herhangi bir doğruluk yüzdesi; `_vtest/`
(geliştirme fixture'ı) veya demo verisinden türetilen sayılar; tek-görsel testler;
Roboflow'un genel %70 mAP'ının "bizim doğruluğumuz" gibi sunulması.

## 8. Mostar pilot verisi geldiğinde

1. Saha videolarını `eval/dataset/videos/` altına koy (KVKK: aydınlatma asılmış olmalı).
2. `python eval/extract_frames.py --fps 1` → kareler + metadata.
3. Kareleri etiketle (Roboflow Annotate önerilir) → YOLO export → `labels/`.
4. `validation_config.json → dataset_name`'i güncelle (örn. "Mostar pilot seti v1").
5. `export ROBOFLOW_API_KEY=... && python eval/run_validation.py`.
6. Çıktıyı kontrol et, commit + push → ai-performans.html otomatik "measured" gösterir.
7. `details_<ts>/false_*.json` dosyalarını model iyileştirme döngüsüne besle.

## 9. Manuel test adımları

1. **Boş veriyle:** `python eval/run_validation.py` → çökmez, "pending" yazar, net mesaj. ✓
2. **Mini örnek setiyle (offline):** images+labels+predictions doldur → metrikler ve
   5 detay JSON üretilir. ✓
3. **ai-performans.html:** pending'de dürüst metin; measured'da yalnız script çıktısı. ✓
4. **Regresyon:** giriş, video yükleme, analiz, panel, ihlal raporu, PDF/CSV, dil, tema —
   bu faz ürün koduna dokunmaz (yalnız eval/ + ai-performans görüntüleme).

## 10. Rollback

`git revert <commit>` — eval/ scriptleri ve ai-performans.html görüntüleme katmanı bağımsızdır;
ürün akışlarına bağımlılığı yoktur. `validation_latest.json` eski pending içeriğe döner.
