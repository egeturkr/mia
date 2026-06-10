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


def count_files(d, exts):
    if not os.path.isdir(d):
        return 0
    return sum(1 for f in os.listdir(d) if f.lower().endswith(exts))


def count_annotations(labels_dir):
    n = 0
    if not os.path.isdir(labels_dir):
        return 0
    for f in os.listdir(labels_dir):
        if f.endswith(".txt") and f != "classes.txt":
            try:
                with open(os.path.join(labels_dir, f), encoding="utf-8") as fh:
                    n += sum(1 for ln in fh if len(ln.split()) >= 5)
            except OSError:
                pass
    return n


def write_pending(cfg, num_videos, message):
    """Veri yokken dürüst 'pending' durumu — sahte sayı asla yazılmaz."""
    pending = {
        "status": "pending",
        "message": message,
        "model_version": cfg.get("model_version"),
        "model": cfg.get("model"),
        "dataset_name": None,
        "validated_at": None, "measured_at": None,
        "num_images": 0, "num_videos": num_videos, "num_annotations": 0,
        "images": 0,
        "metrics": {"precision": None, "recall": None, "f1": None, "mAP50": None},
        "mAP50": None, "violation_detection": None, "per_class": {},
        "notes": "Gerçek saha doğrulama verisi henüz çalıştırılmadı. Metrik iddia edilemez.",
    }
    path = os.path.join(HERE, "validation_latest.json")
    json.dump(pending, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=os.path.join(HERE, "validation_config.json"))
    args = ap.parse_args()

    cfg = load_json(args.config)
    ts = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    results_dir = os.path.join(HERE, "results")
    os.makedirs(results_dir, exist_ok=True)
    raw_out = os.path.join(results_dir, "_raw_%s.json" % ts)

    def absp(p):
        return p if os.path.isabs(p) else os.path.join(ROOT, p)

    images_dir = absp(cfg["images"])
    labels_dir = absp(cfg["labels"])
    videos_dir = absp(cfg.get("videos", "eval/dataset/videos"))
    num_videos = count_files(videos_dir, (".mp4", ".mov", ".avi", ".mkv", ".webm"))

    # --- Zarif çıkış: veri yoksa pending yaz, hata VERME (sahte sayı da yazma) ---
    num_images = count_files(images_dir, (".jpg", ".jpeg", ".png"))
    if num_images == 0:
        msg = ("Doğrulama verisi bulunamadı (eval/dataset/images boş). "
               "Bağımsız saha doğrulaması henüz tamamlanmadı; metrikler, sahadan toplanan "
               "etiketli veriyle ölçülüp burada yayınlanacaktır.")
        path = write_pending(cfg, num_videos, msg)
        print("ℹ Doğrulama verisi yok — durum 'pending' olarak yazıldı: %s" % path)
        if num_videos:
            print("  %d video bulundu ama kare çıkarılmamış. Önce: python eval/extract_frames.py" % num_videos)
        else:
            print("  Veri hazırlama rehberi: docs/PHASE2_AI_VALIDATION.md")
        return

    # Model registry tutarlılık kontrolü (uyarı — engellemez)
    reg_path = os.path.join(HERE, "model_registry.json")
    if os.path.exists(reg_path):
        reg = load_json(reg_path)
        if reg.get("current") and cfg.get("model_version") and reg["current"] != cfg["model_version"]:
            print("⚠ Uyarı: validation_config model_version=%s ama model_registry current=%s"
                  % (cfg["model_version"], reg["current"]))

    details_dir = os.path.join(results_dir, "details_%s" % ts)
    cmd = [
        sys.executable, os.path.join(HERE, "baseline_eval.py"),
        "--images", images_dir,
        "--labels", labels_dir,
        "--classes", absp(cfg["classes"]),
        "--model", cfg["model"],
        "--conf", str(cfg.get("confidence", 0.35)),
        "--iou", str(cfg.get("iou", 0.5)),
        "--overlap", str(cfg.get("overlap", 30)),
        "--out", raw_out,
        "--details-dir", details_dir,
        "--model-version", str(cfg.get("model_version") or "unknown"),
    ]
    # Offline tahmin klasörü (Modal/Roboflow çıktıları önceden kaydedildiyse)
    preds_dir = absp(cfg["predictions"]) if cfg.get("predictions") else None
    if preds_dir and os.path.isdir(preds_dir) and any(f.endswith(".json") for f in os.listdir(preds_dir)):
        cmd += ["--preds", preds_dir]
    print("Doğrulama çalıştırılıyor:", " ".join(cmd))
    r = subprocess.run(cmd)
    if r.returncode != 0 or not os.path.exists(raw_out):
        sys.exit("Doğrulama başarısız (inference hatası). validation_latest.json DEĞİŞTİRİLMEDİ.")

    rep = load_json(raw_out)
    enriched = {
        "status": "measured",
        "model_version": cfg.get("model_version"),
        "model": cfg.get("model"),
        "dataset_name": cfg.get("dataset_name"),
        "images": rep.get("images"),
        "num_images": rep.get("images"),
        "num_videos": num_videos,
        "num_annotations": rep.get("num_annotations"),
        "num_predictions": rep.get("num_predictions"),
        "prediction_source": rep.get("prediction_source"),
        "conf_threshold": rep.get("conf_threshold"),
        "iou_threshold": rep.get("iou_threshold"),
        "measured_at": ts, "validated_at": ts,
        "mAP50": rep.get("mAP50"),
        "metrics": {
            "precision": (rep.get("violation_detection") or {}).get("precision"),
            "recall": (rep.get("violation_detection") or {}).get("recall"),
            "f1": (rep.get("violation_detection") or {}).get("f1"),
            "mAP50": rep.get("mAP50"),
        },
        "violation_detection": rep.get("violation_detection"),
        "per_class": rep.get("per_class"),
        "details_dir": os.path.relpath(details_dir, ROOT),
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
