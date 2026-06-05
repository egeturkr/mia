# Faz 3 — AI Validation System (Production Hardening)

Durum: tamamlandı (framework + dashboard + iddia scrub; mantık testleri geçti).
Geriye uyumlu; tasarım/route değişmedi. **Ölçülen metrik prensibi**: kanıtsız sayı yok,
ya gerçek ölçüm ya "doğrulama sürüyor" durumu gösterilir.

## 1. Bileşenler

- **Yeniden üretilebilir doğrulama framework'ü** (`eval/`):
  - `validation_config.json` — model, sürüm, eşikler (conf 0.35 / IoU 0.5 / overlap 30), veri yolları.
  - `model_registry.json` — model sürüm kayıt defteri (sağlayıcı, sınıflar, tarih, yayınlanan mAP).
  - `run_validation.py` — config'i okur, `baseline_eval.py`'yi üretim eşikleriyle çalıştırır, sonucu
    sürüm + veri seti + zaman ile zenginleştirir; `results/` arşivi, `validation_latest.json` (kamu kaynağı)
    ve `validation_history.json` (trend) üretir.
  - `baseline_eval.py` — artık sınıf başına **mean_confidence** de raporluyor (güven takibi).
- **Kamu performans dashboard'u** (`ai-performans.html`): `eval/validation_latest.json`'u okur; ölçüm varsa
  mAP, ihlal precision/recall, sınıf tablosu, model sürümü, veri seti, tarih gösterir; yoksa **"doğrulama sürüyor"**
  durumunu dürüstçe gösterir. Metodoloji + disclaimer içerir. index footer'dan ve nav'dan erişilir.
- **İddia scrub**: pazarlamadaki kanıtsız "Yüksek Doğruluk / High Accuracy / Alta Precisión" ifadesi
  → "Doğrulanan Performans / Validated Performance / Rendimiento Validado" (3 dil, app.js + sirket.html).
  Sektör istatistikleri (kaynak belirtilmiş) ve "Gerçek Zamanlı" korundu.
- **Model sürüm takibi**: detector.js JSON raporuna `model` + `model_version` eklendi → her çıktı hangi modelle
  üretildiğini taşır.

## 2. Ölçülen metrikler

Precision, Recall, F1, AP@0.5 (sınıf bazında), genel mAP@0.5, iş-kritik ihlal (NO-*) birleşik
precision/recall, sınıf başına ortalama güven. Tümü üretim eşikleriyle, etiketli sete karşı.

## 3. Değişen / eklenen dosyalar

Eklenen: `eval/run_validation.py`, `eval/validation_config.json`, `eval/model_registry.json`,
`eval/validation_latest.json`, `eval/.gitignore`, `ai-performans.html`, `docs/PHASE3_AI_VALIDATION.md`.
Değiştirilen: `eval/baseline_eval.py` (mean_confidence), `js/app.js` (sk_b3 ×3 dil),
`sirket.html` (sk_b3 metni), `js/detector.js` (rapora model sürümü), `index.html` (footer linki).

## 4. Doğrulamanın çalıştırılması (veri geldiğinde)

```bash
# 1) Etiketli saha verisini eval/dataset/images + labels'a koy (bkz. eval/README.md)
# 2) Çalıştır:
export ROBOFLOW_API_KEY=xxxx
python eval/run_validation.py
# 3) eval/validation_latest.json güncellenir → ai-performans.html otomatik gösterir
# 4) git add eval/validation_latest.json eval/validation_history.json && commit && push
```

## 5. Test

Otomatik (doğrulandı): JSON dosyaları geçerli; baseline_eval sentetik veriyle uçtan uca çalışıyor ve
`mean_confidence` üretiyor; app.js/detector.js syntax. IoU/AP/PRF mantığı S1'de test edilmişti.

Manuel (deploy sonrası): `ai-performans.html` açılır → "Doğrulama sürüyor" durumu + model/sürüm görünür.
Veri ölçülünce metrik kartları + sınıf tablosu dolar.

## 6. Rollback

`git revert <hash>` ile tümü geri alınır. Yeni dosyalar bağımsız (eval/ + yeni sayfa); mevcut akışları
etkilemez. İddia metinleri eski haline döner. Veri/şema değişikliği yok.

## 7. Sonraki (veri bağımlı)

- Mostar pilotundan etiketli veri → ilk gerçek ölçüm → `validation_latest.json` yayını.
- Ölçülen mAP/precision sayıları satış materyaline (ai-performans linkiyle) işlenebilir.
- İleride: drift izleme (periyodik run_validation + history trend grafiği), insan-onaylı inceleme.
