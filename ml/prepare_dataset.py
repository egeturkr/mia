#!/usr/bin/env python3
"""MIA — veri seti hazırlığı (ml/README.md adım 1).

Temel CSS veri setini (YOLOv8 format) MIA saha verisiyle (masaüstü uygulamanın
Veri Toplama Modu çıktısı) birleştirir, train/val böler, data.yaml üretir.

Kullanım:
    python ml/prepare_dataset.py --out ml/data --css-dir <yol> [--mia-dir <yol>] [--val-ratio 0.15]

Sınıf sırası SABİTTİR (model + tracker + masaüstü CLS_INDEX ile senkron):
    0 Hardhat, 1 Mask, 2 NO-Hardhat, 3 NO-Mask, 4 NO-Safety Vest,
    5 Person, 6 Safety Cone, 7 Safety Vest, 8 machinery, 9 vehicle
"""
import argparse
import random
import shutil
from pathlib import Path

CLASSES = ["Hardhat", "Mask", "NO-Hardhat", "NO-Mask", "NO-Safety Vest",
           "Person", "Safety Cone", "Safety Vest", "machinery", "vehicle"]


def collect_pairs(root: Path):
    """images/*.jpg + labels/*.txt eşlerini bul (alt klasörler dahil: train/valid/test)."""
    pairs = []
    for img in root.rglob("*.jpg"):
        if "images" not in img.parts:
            continue
        lbl = Path(str(img).replace("/images/", "/labels/")).with_suffix(".txt")
        if lbl.exists():
            pairs.append((img, lbl))
    return pairs


def valid_label(lbl: Path) -> bool:
    """Bozuk/boş etiket dosyalarını ele (satır: cls cx cy w h, hepsi [0,1])."""
    try:
        lines = lbl.read_text().strip().splitlines()
    except OSError:
        return False
    if not lines:
        return False
    for ln in lines:
        p = ln.split()
        if len(p) != 5:
            return False
        try:
            c = int(p[0]); vals = [float(x) for x in p[1:]]
        except ValueError:
            return False
        if not (0 <= c < len(CLASSES)) or any(v < 0 or v > 1.5 for v in vals):
            return False
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--css-dir", required=True, help="Construction Site Safety veri seti kökü (YOLOv8)")
    ap.add_argument("--mia-dir", default=None, help="MIA saha verisi (mia-dataset klasörü) — opsiyonel")
    ap.add_argument("--val-ratio", type=float, default=0.15)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    out = Path(args.out)
    pairs = collect_pairs(Path(args.css_dir))
    n_css = len(pairs)
    if args.mia_dir:
        mia = collect_pairs(Path(args.mia_dir))
        # mia-dataset düz yapı: images/ + labels/ — rglob bunu da yakalar
        pairs += mia
        print(f"MIA saha verisi: {len(mia)} görüntü (etiketleri CVAT'ta DOĞRULADIĞINIZDAN emin olun)")
    pairs = [(i, l) for i, l in pairs if valid_label(l)]
    print(f"Toplam geçerli örnek: {len(pairs)} (CSS: {n_css})")
    if len(pairs) < 100:
        raise SystemExit("HATA: 100'den az örnek — veri yolu yanlış olabilir.")

    random.Random(args.seed).shuffle(pairs)
    n_val = int(len(pairs) * args.val_ratio)
    splits = {"val": pairs[:n_val], "train": pairs[n_val:]}

    for split, items in splits.items():
        (out / split / "images").mkdir(parents=True, exist_ok=True)
        (out / split / "labels").mkdir(parents=True, exist_ok=True)
        for idx, (img, lbl) in enumerate(items):
            stem = f"{split}_{idx:06d}"
            shutil.copyfile(img, out / split / "images" / (stem + ".jpg"))
            shutil.copyfile(lbl, out / split / "labels" / (stem + ".txt"))
        print(f"{split}: {len(items)}")

    yaml = out / "data.yaml"
    yaml.write_text(
        f"path: {out.resolve()}\ntrain: train/images\nval: val/images\n"
        f"nc: {len(CLASSES)}\nnames: {CLASSES}\n", encoding="utf-8")
    print(f"✔ {yaml} hazır — sıradaki adım: python ml/train.py --data {yaml}")


if __name__ == "__main__":
    main()
