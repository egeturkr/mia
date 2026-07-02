#!/usr/bin/env python3
"""MIA — eval kapısı (ml/README.md adım 3): aday model temeli GEÇMEDEN yayınlanmaz.

    python ml/eval_compare.py --baseline apps/desktop/models/mia-ppe-yolov8s.onnx \
        --candidate ml/runs/detect/mia-ppe/weights/best.pt --data ml/data

Ölçüm: doğrulama seti üzerinde sınıf bazlı precision/recall (IoU 0.5).
Kapı kuralları (roadmap ile aynı):
  1) Kritik sınıflarda (NO-Hardhat, NO-Safety Vest) aday F1 >= temel F1
  2) Kritik sınıflarda precision >= 0.80
İkisi de sağlanmazsa çıkış kodu 1 → CI/insan bunu yayın engeli sayar.
"""
import argparse
import sys
from pathlib import Path

import numpy as np

CLASSES = ["Hardhat", "Mask", "NO-Hardhat", "NO-Mask", "NO-Safety Vest",
           "Person", "Safety Cone", "Safety Vest", "machinery", "vehicle"]
CRITICAL = ["NO-Hardhat", "NO-Safety Vest"]
CONF, IOU_THR = 0.40, 0.50


def load_model(path):
    """.pt → ultralytics; .onnx → onnxruntime. Her ikisi de aynı predict arayüzüne sarılır."""
    p = str(path)
    if p.endswith(".pt"):
        from ultralytics import YOLO
        m = YOLO(p)

        def predict(img_path):
            r = m.predict(img_path, conf=CONF, verbose=False)[0]
            out = []
            for b in r.boxes:
                x1, y1, x2, y2 = map(float, b.xyxy[0])
                out.append((int(b.cls[0]), float(b.conf[0]), x1, y1, x2 - x1, y2 - y1))
            return out
        return predict

    import onnxruntime as ort
    from PIL import Image
    sess = ort.InferenceSession(p)

    def predict(img_path):
        im = Image.open(img_path).convert("RGB")
        w, h = im.size
        size = 640
        r = min(size / w, size / h)
        nw, nh = int(round(w * r)), int(round(h * r))
        canvas = Image.new("RGB", (size, size), (114, 114, 114))
        canvas.paste(im.resize((nw, nh)), (0, 0))
        x = np.asarray(canvas, np.float32).transpose(2, 0, 1)[None] / 255.0
        out = sess.run(None, {"images": x})[0][0]          # 14x8400
        boxes, scores = out[:4].T, out[4:].T
        cls, conf = scores.argmax(1), scores.max(1)
        keep = conf > CONF
        dets = []
        for (cx, cy, bw, bh), c, cf in zip(boxes[keep], cls[keep], conf[keep]):
            dets.append((int(c), float(cf), (cx - bw / 2) / r, (cy - bh / 2) / r, bw / r, bh / r))
        # sınıf bazlı NMS
        dets.sort(key=lambda d: -d[1])
        final = []
        for d in dets:
            if all(d[0] != k[0] or _iou(d, k) <= 0.45 for k in final):
                final.append(d)
        return final
    return predict


def _iou(a, b):
    ax, ay, aw, ah = a[2], a[3], a[4], a[5]
    bx, by, bw, bh = b[2], b[3], b[4], b[5]
    x1, y1 = max(ax, bx), max(ay, by)
    x2, y2 = min(ax + aw, bx + bw), min(ay + ah, by + bh)
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    uni = aw * ah + bw * bh - inter
    return inter / uni if uni > 0 else 0


def evaluate(predict, data_dir):
    """val seti üzerinde sınıf bazlı TP/FP/FN → precision/recall/F1."""
    from PIL import Image
    tp = np.zeros(len(CLASSES)); fp = np.zeros(len(CLASSES)); fn = np.zeros(len(CLASSES))
    val_imgs = sorted((Path(data_dir) / "val" / "images").glob("*.jpg"))
    for img in val_imgs:
        lbl = Path(str(img).replace("/images/", "/labels/")).with_suffix(".txt")
        w, h = Image.open(img).size
        gts = []
        if lbl.exists():
            for ln in lbl.read_text().strip().splitlines():
                p = ln.split()
                c, cx, cy, bw, bh = int(p[0]), *[float(x) for x in p[1:]]
                gts.append([c, (cx - bw / 2) * w, (cy - bh / 2) * h, bw * w, bh * h, False])
        dets = predict(str(img))
        for c, cf, x, y, bw, bh in dets:
            best, bi = 0, -1
            for i, g in enumerate(gts):
                if g[0] != c or g[5]:
                    continue
                v = _iou((0, 0, x, y, bw, bh), (0, 0, g[1], g[2], g[3], g[4]))
                if v > best:
                    best, bi = v, i
            if best >= IOU_THR:
                gts[bi][5] = True; tp[c] += 1
            else:
                fp[c] += 1
        for g in gts:
            if not g[5]:
                fn[g[0]] += 1
    prec = tp / np.maximum(1, tp + fp)
    rec = tp / np.maximum(1, tp + fn)
    f1 = 2 * prec * rec / np.maximum(1e-9, prec + rec)
    return prec, rec, f1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--baseline", required=True)
    ap.add_argument("--candidate", required=True)
    ap.add_argument("--data", required=True)
    args = ap.parse_args()

    print("Temel model değerlendiriliyor…")
    bp, br, bf = evaluate(load_model(args.baseline), args.data)
    print("Aday model değerlendiriliyor…")
    cp, cr, cf = evaluate(load_model(args.candidate), args.data)

    print(f"\n{'Sınıf':<18}{'Temel P/R/F1':<22}{'Aday P/R/F1':<22}")
    for i, name in enumerate(CLASSES):
        print(f"{name:<18}{bp[i]:.2f}/{br[i]:.2f}/{bf[i]:.2f}      "
              f"{cp[i]:.2f}/{cr[i]:.2f}/{cf[i]:.2f}")

    ok = True
    for name in CRITICAL:
        i = CLASSES.index(name)
        if cf[i] < bf[i]:
            print(f"✘ KAPI: {name} F1 geriledi ({cf[i]:.2f} < {bf[i]:.2f})"); ok = False
        if cp[i] < 0.80:
            print(f"✘ KAPI: {name} precision < 0.80 ({cp[i]:.2f})"); ok = False
    if ok:
        print("\n✔ EVAL KAPISI GEÇİLDİ — yayınlanabilir: python ml/export.py --weights <best.pt> --version vX")
    else:
        print("\n✘ EVAL KAPISI GEÇİLEMEDİ — veri ekle / tekrar eğit. KISAYOL YOK.")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
