#!/usr/bin/env python3
"""
MIA — Termal PoC Değerlendirme Prototipi (Sprint 5)
====================================================
Termal kareler üzerinde üç hipotezi ölçer:
  H1  İnsan/sıcak gövde tespiti  → precision/recall (ısı eşikleme + kontur)
  H2  Baret ayrımı                → baretli vs baretsiz kafa bölgesi sıcaklık ayrışması (AUC)
  H3  Yelek ayrımı                → yelekli vs yeleksiz gövde sıcaklık ayrışması (AUC)

Görsel: 8-bit gri ya da 16-bit radyometrik PNG. Piksel yoğunluğu sıcaklık-proxy.
Etiket: her görselle aynı isimde .json
  { "person": true, "helmet": false, "vest": true, "head_box": [x,y,w,h], "body_box": [x,y,w,h] }
  (kutular piksel; head_box/body_box yoksa H2/H3 o kare için atlanır.)

Bağımlılık: opencv-python-headless, numpy

NOT: Bu bir PoC iskeletidir — gerçek termal veri henüz yokken metodolojiyi ve karar
çerçevesini sabitler. Veri geldiğinde aynı script go/no-go sayısını üretir.
"""
import argparse, glob, json, os, sys
from statistics import mean

try:
    import numpy as np
    import cv2
except ImportError:
    sys.exit("Gerekli: pip install opencv-python-headless numpy --break-system-packages")


def load_thermal(path):
    """16-bit radyometrik ya da 8-bit gri oku → float32 normalize [0,1] + ham."""
    raw = cv2.imread(path, cv2.IMREAD_ANYDEPTH | cv2.IMREAD_GRAYSCALE)
    if raw is None:
        return None
    raw = raw.astype(np.float32)
    mn, mx = float(raw.min()), float(raw.max())
    norm = (raw - mn) / (mx - mn) if mx > mn else raw * 0
    return norm


def detect_person(norm, thr=0.55, min_area_frac=0.01):
    """Isı eşikleme + kontur → en büyük sıcak bölge var mı (H1 proxy)."""
    h, w = norm.shape
    mask = (norm >= thr).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    min_area = min_area_frac * h * w
    big = [c for c in cnts if cv2.contourArea(c) >= min_area]
    return len(big) > 0


def region_stat(norm, box):
    """Kutu içi ortalama yoğunluk (sıcaklık-proxy)."""
    if not box:
        return None
    x, y, w, h = [int(v) for v in box]
    H, W = norm.shape
    x2, y2 = min(W, x + w), min(H, y + h)
    x, y = max(0, x), max(0, y)
    if x2 <= x or y2 <= y:
        return None
    roi = norm[y:y2, x:x2]
    return float(roi.mean()) if roi.size else None


def auc(pos, neg):
    """Mann-Whitney U üzerinden AUC: pozitif (özellik var) skorları negatiflerden
    ne kadar ayrışıyor. İki grubun da örneği yoksa None."""
    if not pos or not neg:
        return None
    wins = 0.0
    for a in pos:
        for b in neg:
            wins += 1.0 if a > b else (0.5 if a == b else 0.0)
    return wins / (len(pos) * len(neg))


def prf(tp, fp, fn):
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    f = 2 * p * r / (p + r) if p + r else 0.0
    return round(p, 4), round(r, 4), round(f, 4)


def decide(h2_auc):
    if h2_auc is None:
        return "VERİ YOK — baret kararı için etiketli baretli/baretsiz kare gerekli"
    if h2_auc >= 0.80:
        return "GO — baret tespiti termalle değerli, ürünleştir"
    if h2_auc >= 0.65:
        return "KOŞULLU — RGB füzyonu dene, tek başına termal yetersiz"
    return "NO-GO (baret) — termali sadece insan/gece varlık tespiti için kullan"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--images", required=True)
    ap.add_argument("--labels", required=True)
    ap.add_argument("--person-thr", type=float, default=0.55)
    ap.add_argument("--out", default="thermal_poc/thermal_poc_report.json")
    args = ap.parse_args()

    imgs = sorted(sum([glob.glob(os.path.join(args.images, e))
                       for e in ("*.png", "*.jpg", "*.tiff", "*.tif")], []))
    if not imgs:
        sys.exit(f"{args.images} içinde termal görsel yok. (PoC: önce veri topla — bkz. README)")

    # H1 sayaçları
    tp = fp = fn = tn = 0
    # H2 / H3 dağılımları
    helmet_on, helmet_off = [], []   # kafa bölgesi sıcaklık-proxy
    vest_on, vest_off = [], []       # gövde bölgesi sıcaklık-proxy
    n_eval = 0

    for img in imgs:
        base = os.path.splitext(os.path.basename(img))[0]
        lpath = os.path.join(args.labels, base + ".json")
        if not os.path.exists(lpath):
            continue
        norm = load_thermal(img)
        if norm is None:
            print(f"  ! okunamadı: {base}")
            continue
        lbl = json.load(open(lpath, encoding="utf-8"))
        n_eval += 1

        # H1
        pred_person = detect_person(norm, thr=args.person_thr)
        gt_person = bool(lbl.get("person"))
        if pred_person and gt_person: tp += 1
        elif pred_person and not gt_person: fp += 1
        elif not pred_person and gt_person: fn += 1
        else: tn += 1

        # H2 — baret proxy (kafa bölgesi sıcaklığı)
        hs = region_stat(norm, lbl.get("head_box"))
        if hs is not None and "helmet" in lbl:
            (helmet_on if lbl["helmet"] else helmet_off).append(hs)
        # H3 — yelek proxy (gövde bölgesi sıcaklığı)
        bs = region_stat(norm, lbl.get("body_box"))
        if bs is not None and "vest" in lbl:
            (vest_on if lbl["vest"] else vest_off).append(bs)

    p, r, f = prf(tp, fp, fn)
    h2 = auc(helmet_off, helmet_on)  # baretsiz kafa daha sıcak beklenir → baretsiz=pozitif sinyal
    h3 = auc(vest_off, vest_on)

    report = {
        "frames_evaluated": n_eval,
        "H1_person_detection": {"precision": p, "recall": r, "f1": f,
                                "tp": tp, "fp": fp, "fn": fn, "tn": tn},
        "H2_helmet_separation_auc": round(h2, 4) if h2 is not None else None,
        "H2_samples": {"helmet_on": len(helmet_on), "helmet_off": len(helmet_off)},
        "H3_vest_separation_auc": round(h3, 4) if h3 is not None else None,
        "H3_samples": {"vest_on": len(vest_on), "vest_off": len(vest_off)},
        "decision": decide(h2),
    }
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    json.dump(report, open(args.out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    print("\n=== TERMAL PoC ÖZET ===")
    print(f"Değerlendirilen kare: {n_eval}")
    print(f"H1 insan tespiti: P {p*100:.1f}%  R {r*100:.1f}%  F1 {f*100:.1f}%")
    print(f"H2 baret ayrışması AUC: {report['H2_helmet_separation_auc']}  (örnek: {len(helmet_on)} baretli / {len(helmet_off)} baretsiz)")
    print(f"H3 yelek ayrışması AUC: {report['H3_vest_separation_auc']}  (örnek: {len(vest_on)} yelekli / {len(vest_off)} yeleksiz)")
    print(f"KARAR: {report['decision']}")
    print(f"\nRapor: {args.out}")


if __name__ == "__main__":
    main()
