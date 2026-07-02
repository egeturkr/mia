# MIA Model Eğitim Hattı — Kendi Modelimize Giden Yol

Amaç: hazır Roboflow modeline bağımlılığı bitirip **MIA'ya ait ağırlıklar**
(`mia-ppe-vX`) üretmek. Yol haritası dokümanıyla uyumlu:
`docs/MIA_CUSTOM_PPE_MODEL_TRAINING_ROADMAP.md` (Faz 21).

## Mimari (bugün canlı olan)
Masaüstü uygulamada tespit İKİ katmandır:
1. **Model** (değiştirilebilir): `apps/desktop/models/mia-ppe-yolov8s.onnx` —
   bu hat onu MIA eğitimli sürümle DEĞİŞTİRİR.
2. **MIA Vision Engine** (bizim yazılımımız, model'den bağımsız):
   `apps/desktop/renderer/js/tracker.js` — kişi takibi, KKD-kişi eşleme,
   kare oylamalı doğrulama, track ID'li raporlama. Model hangisi olursa olsun
   doğruluk katmanı bizde.

## Süreç (sınıf başına, KISAYOL YOK — roadmap ile aynı)
veri → eğitim → ölçüm (eval gate) → deneysel → saha → destekli

## Adımlar

### 1) Veri hazırlığı
```bash
python ml/prepare_dataset.py --out ml/data \
    --css-dir <Construction-Site-Safety dataset klasörü> \
    --mia-dir <masaüstü uygulamanın topladığı mia-dataset klasörü>
```
- **Temel veri:** Roboflow "Construction Site Safety" (CC BY 4.0, ~2800 görüntü,
  10 sınıf) — https://universe.roboflow.com/roboflow-universe-projects/construction-site-safety
  (YOLOv8 formatında indirin) veya VoxDroid repo klonundaki `Model-Training/Dataset`.
- **MIA saha verisi:** masaüstü uygulama → Ayarlar → *Saha Veri Toplama Modu*.
  Konum: `~/Library/Application Support/mia-desktop/mia-dataset/` (macOS).
  Etiketler model ÖN-etiketidir → eğitime girmeden CVAT/Label Studio'da düzeltin
  (%10 örneklem ikinci kontrol). TR şantiye verisi asıl farkı yaratır:
  beyaz/sarı/kırmızı baret kültürü, turuncu yelek, iskele/demir donatı arka planı.

### 2) Eğitim (GPU gerekir)
```bash
pip install ultralytics
python ml/train.py --data ml/data/data.yaml --epochs 150 --model yolov8s.pt
```
GPU yoksa: Google Colab (T4, ücretsiz katman ~1,5-3 saat) — bu repo'yu klonla,
aynı komutu çalıştır. Kiralık alternatif: Lambda/RunPod A10 ≈ $1-2 toplam.

### 3) Ölçüm kapısı (eval gate) — GEÇMEDEN YAYINLANMAZ
```bash
python ml/eval_compare.py \
    --baseline apps/desktop/models/mia-ppe-yolov8s.onnx \
    --candidate ml/runs/detect/train/weights/best.onnx \
    --data ml/data
```
Kural (roadmap ile aynı): aday model, doğrulama setinde temel modeli baret+yelek
sınıflarında **geçmeden** üretime alınmaz (precision ≥ 0.80 şartı ayrıca geçerli).

### 4) Yayınlama
```bash
python ml/export.py --weights ml/runs/detect/train/weights/best.pt --version v1
```
- `apps/desktop/models/mia-ppe-yolov8s.onnx` üzerine yazar (uygulama dosya adı sabit)
- `ml/MODEL_VERSIONS.md`'ye sürüm + SHA256 + eval skorları eklenir
- Masaüstü release süreci normal akışla devam eder (`npm run release:mac`)

## Sürüm hedefleri
| Sürüm | İçerik | Durum |
|---|---|---|
| v0 (bugün) | Topluluk CSS ağırlıkları + MIA Vision Engine | canlı |
| v1 | CSS verisiyle MIA'nın KENDİ eğitimi (aynı 10 sınıf) | bu hat hazır — GPU'da koş |
| v2 | v1 + MIA saha verisi (TR şantiye) → doğruluk sıçraması | veri toplama modu canlı |
| v3+ | Yeni sınıflar (kemer, eldiven, gözlük…) — roadmap tablosuna göre | veri gerekli |

## Dürüstlük çizgisi
Sınıf durumları `js/ppe-registry.js` + `workers/.../ppe_registry.py`'de tek
gerçek kaynaktır; eval kapısından geçmeyen hiçbir model/sınıf "destekleniyor"
gösterilmez.
