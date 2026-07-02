#!/usr/bin/env python3
"""MIA — yayınlama (ml/README.md adım 4): eval kapısını GEÇEN modeli pakete al.

    python ml/export.py --weights ml/runs/detect/mia-ppe/weights/best.pt --version v1

- ONNX'e çevirir (640, opset uyumlu), sınıf adlarını doğrular
- apps/desktop/models/mia-ppe-yolov8s.onnx üzerine yazar (uygulama yolu sabit)
- SHA256 + sürümü ml/MODEL_VERSIONS.md'ye ekler
"""
import argparse
import hashlib
import shutil
from datetime import date
from pathlib import Path

CLASSES = ["Hardhat", "Mask", "NO-Hardhat", "NO-Mask", "NO-Safety Vest",
           "Person", "Safety Cone", "Safety Vest", "machinery", "vehicle"]
APP_MODEL = Path("apps/desktop/models/mia-ppe-yolov8s.onnx")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--weights", required=True, help=".pt (eval kapısını geçmiş olmalı)")
    ap.add_argument("--version", required=True, help="örn. v1")
    args = ap.parse_args()

    from ultralytics import YOLO
    m = YOLO(args.weights)
    names = [m.names[i] for i in sorted(m.names)]
    if names != CLASSES:
        raise SystemExit(f"HATA: sınıf sırası uyuşmuyor:\n  model: {names}\n  beklenen: {CLASSES}")

    onnx_path = Path(m.export(format="onnx", imgsz=640, simplify=True))
    APP_MODEL.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(onnx_path, APP_MODEL)
    sha = hashlib.sha256(APP_MODEL.read_bytes()).hexdigest()
    size_mb = APP_MODEL.stat().st_size / 1048576

    log = Path("ml/MODEL_VERSIONS.md")
    if not log.exists():
        log.write_text("# MIA Model Sürümleri\n\n| Tarih | Sürüm | Kaynak | SHA256 | Boyut |\n|---|---|---|---|---|\n",
                       encoding="utf-8")
    with log.open("a", encoding="utf-8") as f:
        f.write(f"| {date.today()} | mia-ppe-{args.version} | {args.weights} | `{sha[:16]}…` | {size_mb:.1f} MB |\n")

    print(f"✔ {APP_MODEL} güncellendi (mia-ppe-{args.version}, {size_mb:.1f} MB)")
    print(f"  SHA256: {sha}")
    print("  Sıradaki: apps/desktop içinde npm start ile duman testi → npm run release:mac")


if __name__ == "__main__":
    main()
