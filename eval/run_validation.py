#!/usr/bin/env python3
"""
MIA — Yeniden Üretilebilir AI Doğrulama Çalıştırıcısı (Faz 3)
=============================================================
validation_config.json'u okur, baseline_eval.py'yi üretim eşikleriyle çalıştırır,
sonucu model sürümü + dataset meta + zaman damgası ile zenginleştirir ve:
  * eval/results/<version>_<timestamp>.json    (arşiv — her çalıştırma)
  * eval/validation_latest.json                (kamu performans sayfasının kaynağı)
  * eval/validation_history.json               (zaman serisi — dashboard trendi)
yazar. Böylece pazarlama "ölçülen metrik" kullanır; her sayı yeniden üretilebilir.

Kullanım:
    export ROBOFLOW_API_KEY=xxxx
    python eval/run_validation.py                      # config'ten okur
    python eval/run_validation.py --config eval/validation_config.json

Veri yoksa baseline_eval hata verir; bu normaldir (önce saha verisi toplanmalı).
"""
import argparse, json, os, subprocess, sys, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=os.path.join(HERE, "validation_config.json"))
    args = ap.parse_args()

    cfg = load_json(args.config)
    ts = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    results_dir = os.path.join(HERE, "results")
    os.makedirs(results_dir, exist_ok=True)
    raw_out = os.path.join(results_dir, "_raw_%s.json" % ts)

    cmd = [
        sys.executable, os.path.join(HERE, "baseline_eval.py"),
        "--images", os.path.join(ROOT, cfg["images"]) if not os.path.isabs(cfg["images"]) else cfg["images"],
        "--labels", os.path.join(ROOT, cfg["labels"]) if not os.path.isabs(cfg["labels"]) else cfg["labels"],
        "--classes", os.path.join(ROOT, cfg["classes"]) if not os.path.isabs(cfg["classes"]) else cfg["classes"],
        "--model", cfg["model"],
        "--conf", str(cfg.get("confidence", 0.35)),
        "--iou", str(cfg.get("iou", 0.5)),
        "--overlap", str(cfg.get("overlap", 30)),
        "--out", raw_out,
    ]
    print("Doğrulama çalıştırılıyor:", " ".join(cmd))
    r = subprocess.run(cmd)
    if r.returncode != 0 or not os.path.exists(raw_out):
        sys.exit("Doğrulama başarısız (veri yok ya da inference hatası). Önce eval/dataset'i doldurun.")

    rep = load_json(raw_out)
    enriched = {
        "status": "measured",
        "model_version": cfg.get("model_version"),
        "model": cfg.get("model"),
        "dataset_name": cfg.get("dataset_name"),
        "images": rep.get("images"),
        "conf_threshold": rep.get("conf_threshold"),
        "iou_threshold": rep.get("iou_threshold"),
        "measured_at": ts,
        "mAP50": rep.get("mAP50"),
        "violation_detection": rep.get("violation_detection"),
        "per_class": rep.get("per_class"),
        "notes": cfg.get("notes"),
    }

    # Arşiv
    archive = os.path.join(results_dir, "%s_%s.json" % (cfg.get("model_version", "model"), ts))
    json.dump(enriched, open(archive, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    # Kamu kaynağı (latest)
    json.dump(enriched, open(os.path.join(HERE, "validation_latest.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    # Tarihçe (trend)
    hist_path = os.path.join(HERE, "validation_history.json")
    hist = load_json(hist_path) if os.path.exists(hist_path) else []
    hist.append({"measured_at": ts, "model_version": enriched["model_version"],
                 "mAP50": enriched["mAP50"], "images": enriched["images"],
                 "violation_precision": (enriched["violation_detection"] or {}).get("precision"),
                 "violation_recall": (enriched["violation_detection"] or {}).get("recall")})
    json.dump(hist, open(hist_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    try: os.remove(raw_out)
    except OSError: pass

    print("\n✓ Doğrulama yayınlandı:")
    print("  mAP@0.5:", enriched["mAP50"])
    print("  İhlal tespiti:", enriched["violation_detection"])
    print("  → eval/validation_latest.json güncellendi (kamu performans sayfası buradan okur).")


if __name__ == "__main__":
    main()
