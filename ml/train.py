#!/usr/bin/env python3
"""MIA — model eğitimi (ml/README.md adım 2). GPU önerilir (Colab T4 yeterli).

    pip install ultralytics
    python ml/train.py --data ml/data/data.yaml --epochs 150 --model yolov8s.pt

Notlar:
- yolov8s.pt (COCO ön-eğitimli) tabanından fine-tune — CSS + MIA verisiyle
  ağırlıklar MIA'NIN OLUR (Ultralytics AGPL-3.0 lisans şartlarını ticari
  dağıtımda gözden geçirin; alternatif: Ultralytics Enterprise lisansı).
- Augmentasyon TR şantiye koşullarına göre: toz/pus (hsv), açı (degrees),
  ölçek (uzak kamera) — roadmap'teki çeşitlilik matrisiyle uyumlu.
"""
import argparse


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--model", default="yolov8s.pt")
    ap.add_argument("--epochs", type=int, default=150)
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--name", default="mia-ppe")
    args = ap.parse_args()

    from ultralytics import YOLO
    model = YOLO(args.model)
    model.train(
        data=args.data, epochs=args.epochs, imgsz=args.imgsz, batch=args.batch,
        name=args.name, project="ml/runs/detect",
        patience=30,               # erken durdurma — aşırı öğrenmeye karşı
        hsv_h=0.015, hsv_s=0.6, hsv_v=0.5,   # toz/ışık varyasyonu
        degrees=8, scale=0.5, fliplr=0.5,    # açı + uzak kamera + ayna
        mosaic=1.0, close_mosaic=15,
    )
    print("\n✔ Eğitim bitti. Sıradaki adım (eval kapısı):")
    print(f"  python ml/eval_compare.py --baseline apps/desktop/models/mia-ppe-yolov8s.onnx "
          f"--candidate ml/runs/detect/{args.name}/weights/best.pt --data ml/data")


if __name__ == "__main__":
    main()
