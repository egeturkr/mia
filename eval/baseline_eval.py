#!/usr/bin/env python3
"""
MIA — Baseline PPE Tespit Değerlendirme Harness'ı (Sprint 1)
=============================================================
Mevcut Roboflow modelini (construction-site-safety/27) etiketli bir test setine
karşı çalıştırır ve sınıf bazında precision / recall / F1 ile mAP@0.5 hesaplar.
Özellikle iş-kritik ihlal sınıfları (NO-Hardhat, NO-Safety Vest) ayrı raporlanır.

Kullanım:
    export ROBOFLOW_API_KEY=xxxx
    python eval/baseline_eval.py --images eval/dataset/images \
                                 --labels eval/dataset/labels \
                                 --classes eval/dataset/classes.txt \
                                 --conf 0.35 --iou 0.5 --out eval/baseline_report.json

Etiket formatı: YOLO (her görsel için aynı isimde .txt):
    <class_id> <cx> <cy> <w> <h>     # hepsi 0..1 normalize, sınıf id classes.txt sırasından

Bağımlılık: requests  (pip install requests --break-system-packages)
"""
import argparse, json, os, sys, glob, time
from collections import defaultdict

try:
    import requests
except ImportError:
    sys.exit("requests gerekli: pip install requests --break-system-packages")

RF_URL = "https://serverless.roboflow.com/{model}"

# İş-kritik ihlal sınıfları — ayrı KPI olarak izlenecek.
VIOLATION_CLASSES = {"NO-Hardhat", "NO-Safety Vest", "NO-Mask"}


def load_classes(path):
    with open(path, encoding="utf-8") as f:
        return [ln.strip() for ln in f if ln.strip()]


def load_gt(label_path, classes, img_w=1.0, img_h=1.0):
    """YOLO txt → [{class, box=(x1,y1,x2,y2) normalized}]"""
    boxes = []
    if not os.path.exists(label_path):
        return boxes
    with open(label_path, encoding="utf-8") as f:
        for ln in f:
            parts = ln.split()
            if len(parts) < 5:
                continue
            cid, cx, cy, w, h = int(parts[0]), *map(float, parts[1:5])
            boxes.append({
                "class": classes[cid] if cid < len(classes) else str(cid),
                "box": (cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2),
            })
    return boxes


def infer(model, api_key, img_path, conf, overlap):
    """Roboflow serverless inference → normalized predictions."""
    import base64
    with open(img_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()
    url = RF_URL.format(model=model)
    params = {"api_key": api_key, "confidence": int(conf * 100), "overlap": overlap}
    r = requests.post(url, params=params, data=img_b64,
                      headers={"Content-Type": "application/x-www-form-urlencoded"}, timeout=60)
    r.raise_for_status()
    j = r.json()
    W = j.get("image", {}).get("width") or 1
    H = j.get("image", {}).get("height") or 1
    out = []
    for p in j.get("predictions", []):
        x, y, w, h = p["x"], p["y"], p["width"], p["height"]
        out.append({
            "class": p["class"],
            "conf": p.get("confidence", 0),
            "box": ((x - w / 2) / W, (y - h / 2) / H, (x + w / 2) / W, (y + h / 2) / H),
        })
    return out


def load_offline_preds(preds_dir, base):
    """Önceden hesaplanmış tahminleri oku (Roboflow çağrısı yapmadan — offline mod).
    Desteklenen formatlar (preds/<görsel-adı>.json):
      A) [{"class": str, "confidence": float, "box": [x1,y1,x2,y2] (0..1 normalize)}]
      B) Roboflow ham çıktısı: {"predictions":[{x,y,width,height,class,confidence}],
                                "image":{"width":W,"height":H}}
    Dosya yoksa None döner (görsel atlanmaz; tahminsiz = tüm GT'ler FN sayılır).
    """
    path = os.path.join(preds_dir, base + ".json")
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        j = json.load(f)
    out = []
    if isinstance(j, dict) and "predictions" in j:  # format B (Roboflow ham)
        W = (j.get("image") or {}).get("width") or 1
        H = (j.get("image") or {}).get("height") or 1
        for p in j["predictions"]:
            x, y, w, h = p["x"], p["y"], p["width"], p["height"]
            out.append({"class": p["class"], "conf": p.get("confidence", 0),
                        "box": ((x - w / 2) / W, (y - h / 2) / H, (x + w / 2) / W, (y + h / 2) / H)})
    elif isinstance(j, list):  # format A (normalize liste)
        for p in j:
            b = p["box"]
            out.append({"class": p["class"], "conf": p.get("confidence", p.get("conf", 0)),
                        "box": (b[0], b[1], b[2], b[3])})
    return out


def iou(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0:
        return 0.0
    ua = (ax2 - ax1) * (ay2 - ay1) + (bx2 - bx1) * (by2 - by1) - inter
    return inter / ua if ua > 0 else 0.0


def match(preds, gts, iou_thr, image=None):
    """Greedy IoU matching per class.
    Returns (stats, records): stats = TP/FP/FN sayıları + AP skorları (sınıf bazında);
    records = örnek-seviyesi kayıtlar (FP/FN analizi için) — {type, image, class, conf, iou, box}.
    """
    stats = defaultdict(lambda: {"tp": 0, "fp": 0, "fn": 0, "scores": []})
    records = []
    by_cls_pred = defaultdict(list)
    by_cls_gt = defaultdict(list)
    for p in preds:
        by_cls_pred[p["class"]].append(p)
    for g in gts:
        by_cls_gt[g["class"]].append(g)
    classes = set(by_cls_pred) | set(by_cls_gt)
    for c in classes:
        ps = sorted(by_cls_pred[c], key=lambda x: -x["conf"])
        gs = by_cls_gt[c]
        used = [False] * len(gs)
        for p in ps:
            best, bi = iou_thr, -1
            for i, g in enumerate(gs):
                if used[i]:
                    continue
                v = iou(p["box"], g["box"])
                if v >= best:
                    best, bi = v, i
            if bi >= 0:
                used[bi] = True
                stats[c]["tp"] += 1
                stats[c]["scores"].append((p["conf"], 1))
                records.append({"type": "tp", "image": image, "class": c,
                                "conf": round(p["conf"], 4), "iou": round(best, 4),
                                "box": [round(x, 4) for x in p["box"]]})
            else:
                stats[c]["fp"] += 1
                stats[c]["scores"].append((p["conf"], 0))
                records.append({"type": "fp", "image": image, "class": c,
                                "conf": round(p["conf"], 4), "iou": None,
                                "box": [round(x, 4) for x in p["box"]]})
        for i, g in enumerate(gs):
            if not used[i]:
                records.append({"type": "fn", "image": image, "class": c,
                                "conf": None, "iou": None,
                                "box": [round(x, 4) for x in g["box"]]})
        stats[c]["fn"] += used.count(False)
    return stats, records


def prf(tp, fp, fn):
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    f = 2 * p * r / (p + r) if p + r else 0.0
    return p, r, f


def average_precision(scores, n_gt):
    """11-point benzeri: PR eğrisi üzerinden AP."""
    if n_gt == 0:
        return 0.0
    scores = sorted(scores, key=lambda x: -x[0])
    tp = fp = 0
    points = []
    for _, is_tp in scores:
        if is_tp:
            tp += 1
        else:
            fp += 1
        prec = tp / (tp + fp)
        rec = tp / n_gt
        points.append((rec, prec))
    # VOC tarzı interpolated AP (PR eğrisi altındaki alan)
    ap = 0.0
    recs = [0.0] + [r for r, _ in points] + [1.0]
    precs = [0.0] + [p for _, p in points] + [0.0]
    for i in range(len(precs) - 2, -1, -1):
        precs[i] = max(precs[i], precs[i + 1])
    for i in range(1, len(recs)):
        ap += (recs[i] - recs[i - 1]) * precs[i]
    return ap


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--images", required=True)
    ap.add_argument("--labels", required=True)
    ap.add_argument("--classes", required=True)
    ap.add_argument("--model", default="construction-site-safety/27")
    ap.add_argument("--conf", type=float, default=0.35)
    ap.add_argument("--iou", type=float, default=0.5)
    ap.add_argument("--overlap", type=int, default=30)
    ap.add_argument("--out", default="eval/baseline_report.json")
    # --- Faz 2 eklemeleri (opsiyonel; verilmezse davranış öncekiyle aynı) ---
    ap.add_argument("--preds", default=None,
                    help="önceden hesaplanmış tahmin klasörü (offline mod — Roboflow çağrılmaz)")
    ap.add_argument("--details-dir", default=None,
                    help="FP/FN/düşük-güven detay JSON'larının yazılacağı klasör")
    ap.add_argument("--model-version", default=None, help="model_registry sürümü (örn. rf-27)")
    ap.add_argument("--frames-meta", default=None,
                    help="frames_metadata.json yolu (kare → kaynak video + zaman izlenebilirliği)")
    ap.add_argument("--low-conf", type=float, default=0.5,
                    help="düşük-güven eşiği (detay raporu için, varsayılan 0.5)")
    args = ap.parse_args()

    api_key = os.environ.get("ROBOFLOW_API_KEY")
    if not args.preds and not api_key:
        sys.exit("ROBOFLOW_API_KEY ortam değişkeni gerekli (ya da --preds ile offline tahmin verin).")

    classes = load_classes(args.classes)
    imgs = sorted(sum([glob.glob(os.path.join(args.images, e))
                       for e in ("*.jpg", "*.jpeg", "*.png")], []))
    if not imgs:
        sys.exit(f"{args.images} içinde görsel bulunamadı.")

    # Kare → kaynak video izlenebilirliği (varsa)
    frames_meta = {}
    fm_path = args.frames_meta or os.path.join(os.path.dirname(args.images.rstrip("/")), "frames_metadata.json")
    if os.path.exists(fm_path):
        try:
            with open(fm_path, encoding="utf-8") as f:
                frames_meta = json.load(f).get("frames", {})
        except Exception:
            frames_meta = {}

    def trace(image_name):
        """Detay kaydına kaynak video + zaman ekle (video karesi ise)."""
        m = frames_meta.get(image_name)
        if not m:
            return {}
        return {"source_video": m.get("source_video"), "timestamp_sec": m.get("timestamp_sec")}

    agg = defaultdict(lambda: {"tp": 0, "fp": 0, "fn": 0, "scores": []})
    gt_counts = defaultdict(int)
    all_records = []
    n_preds_total = 0
    mode = "offline (--preds)" if args.preds else "Roboflow API"
    print(f"{len(imgs)} görsel değerlendiriliyor (model={args.model}, conf={args.conf}, IoU={args.iou}, mod={mode})...")
    for i, img in enumerate(imgs, 1):
        base = os.path.splitext(os.path.basename(img))[0]
        img_name = os.path.basename(img)
        gts = load_gt(os.path.join(args.labels, base + ".txt"), classes)
        for g in gts:
            gt_counts[g["class"]] += 1
        if args.preds:
            preds = load_offline_preds(args.preds, base)
            if preds is None:
                print(f"  ! {base}: offline tahmin dosyası yok — tahminsiz değerlendirildi (GT'ler FN)")
                preds = []
        else:
            try:
                preds = infer(args.model, api_key, img, args.conf, args.overlap)
            except Exception as e:
                print(f"  ! {base}: inference hata: {e}")
                continue
        n_preds_total += len(preds)
        s, recs = match(preds, gts, args.iou, image=img_name)
        for rec in recs:
            rec.update(trace(img_name))
            rec["model_version"] = args.model_version
        all_records.extend(recs)
        for c, v in s.items():
            agg[c]["tp"] += v["tp"]; agg[c]["fp"] += v["fp"]; agg[c]["fn"] += v["fn"]
            agg[c]["scores"].extend(v["scores"])
        print(f"  [{i}/{len(imgs)}] {base}: {len(preds)} tespit / {len(gts)} gerçek")
        if not args.preds:
            time.sleep(0.05)

    per_class, aps = {}, []
    for c in sorted(set(agg) | set(gt_counts)):
        tp, fp, fn = agg[c]["tp"], agg[c]["fp"], agg[c]["fn"]
        p, r, f = prf(tp, fp, fn)
        ap_c = average_precision(agg[c]["scores"], gt_counts[c])
        aps.append(ap_c)
        confs = [s[0] for s in agg[c]["scores"]]
        mean_conf = round(sum(confs) / len(confs), 4) if confs else 0.0
        per_class[c] = {"tp": tp, "fp": fp, "fn": fn, "precision": round(p, 4),
                        "recall": round(r, 4), "f1": round(f, 4), "ap50": round(ap_c, 4),
                        "mean_confidence": mean_conf, "gt_count": gt_counts[c]}

    # İş-kritik ihlal aggregate
    vt = vfp = vfn = 0
    for c in VIOLATION_CLASSES:
        if c in agg:
            vt += agg[c]["tp"]; vfp += agg[c]["fp"]; vfn += agg[c]["fn"]
    vp, vr, vf = prf(vt, vfp, vfn)

    report = {
        "model": args.model, "images": len(imgs),
        "model_version": args.model_version,
        "num_annotations": sum(gt_counts.values()),
        "num_predictions": n_preds_total,
        "prediction_source": "offline" if args.preds else "roboflow_api",
        "conf_threshold": args.conf, "iou_threshold": args.iou,
        "mAP50": round(sum(aps) / len(aps), 4) if aps else 0.0,
        "violation_detection": {"precision": round(vp, 4), "recall": round(vr, 4),
                                "f1": round(vf, 4), "tp": vt, "fp": vfp, "fn": vfn},
        "per_class": per_class,
    }
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    # --- Faz 2: FP/FN analiz detayları (model iyileştirme döngüsünün girdisi) ---
    if args.details_dir:
        os.makedirs(args.details_dir, exist_ok=True)
        def dump(name, data):
            with open(os.path.join(args.details_dir, name), "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        fps_ = [r for r in all_records if r["type"] == "fp"]
        fns_ = [r for r in all_records if r["type"] == "fn"]
        low_ = [r for r in all_records if r["type"] in ("tp", "fp")
                and r["conf"] is not None and r["conf"] < args.low_conf]
        dump("false_positives.json", fps_)
        dump("false_negatives.json", fns_)
        dump("low_confidence_predictions.json", low_)
        dump("per_class_summary.json", per_class)
        dump("validation_summary.json", {
            "model": args.model, "model_version": args.model_version,
            "images": len(imgs), "num_annotations": report["num_annotations"],
            "num_predictions": n_preds_total,
            "conf_threshold": args.conf, "iou_threshold": args.iou,
            "low_conf_threshold": args.low_conf,
            "mAP50": report["mAP50"], "violation_detection": report["violation_detection"],
            "counts": {"tp": sum(1 for r in all_records if r["type"] == "tp"),
                        "fp": len(fps_), "fn": len(fns_), "low_confidence": len(low_)},
        })
        print(f"  Detaylar: {args.details_dir}/ (false_positives, false_negatives, "
              f"low_confidence_predictions, per_class_summary, validation_summary)")

    print("\n=== BASELINE ÖZET ===")
    print(f"mAP@0.5: {report['mAP50']*100:.1f}%")
    v = report["violation_detection"]
    print(f"İhlal tespiti (NO-*): precision {v['precision']*100:.1f}%  recall {v['recall']*100:.1f}%  F1 {v['f1']*100:.1f}%")
    print(f"{'Sınıf':<18}{'P':>7}{'R':>7}{'F1':>7}{'AP50':>8}{'GT':>6}")
    for c, m in per_class.items():
        print(f"{c:<18}{m['precision']*100:>6.1f}{m['recall']*100:>7.1f}{m['f1']*100:>7.1f}{m['ap50']*100:>8.1f}{m['gt_count']:>6}")
    print(f"\nRapor: {args.out}")


if __name__ == "__main__":
    main()
