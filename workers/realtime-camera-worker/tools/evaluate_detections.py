#!/usr/bin/env python3
"""MIA — KKD Tespit Değerlendirme İskeleti (Faz 15)

Etiketli gerçek veri ile model tespitlerini karşılaştırır; precision/recall/F1
hesaplar. SONUÇ UYDURMAZ: girdi dosyaları yoksa açıkça söyler ve çıkar.

Girdi biçimi (her ikisi de JSON listesi):
  labels.json      [{"frame_id": "f001", "classes": ["no_helmet", "person"]}, ...]
  detections.json  [{"frame_id": "f001", "classes": ["no_helmet"]}, ...]
(kare-seviyesi değerlendirme; kutu-seviyesi IoU değerlendirmesi v2)

Kullanım:
  python tools/evaluate_detections.py labels.json detections.json
"""
import json
import sys

TARGET_CLASSES = ["no_helmet", "no_safety_vest", "no_mask"]


def load(path):
    with open(path) as f:
        data = json.load(f)
    return {row["frame_id"]: set(row.get("classes", [])) for row in data}


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    try:
        labels = load(sys.argv[1])
        dets = load(sys.argv[2])
    except FileNotFoundError as e:
        sys.exit(f"Girdi dosyası yok: {e.filename}\n"
                 "Önce saha verisi toplayıp etiketleyin (docs/MIA_PPE_MODEL_EVALUATION_PLAN.md).\n"
                 "Bu araç sonuç UYDURMAZ — gerçek etiketli veri gerekir.")

    common = set(labels) & set(dets)
    if not common:
        sys.exit("Ortak frame_id yok — iki dosya aynı kareleri içermeli.")
    print(f"Değerlendirilen kare: {len(common)} "
          f"(etiketli: {len(labels)}, tespitli: {len(dets)})\n")
    print(f"{'Sınıf':<18}{'TP':>5}{'FP':>5}{'FN':>5}{'Precision':>11}{'Recall':>9}{'F1':>7}")
    for cls in TARGET_CLASSES:
        tp = sum(1 for f in common if cls in labels[f] and cls in dets[f])
        fp = sum(1 for f in common if cls not in labels[f] and cls in dets[f])
        fn = sum(1 for f in common if cls in labels[f] and cls not in dets[f])
        prec = tp / (tp + fp) if tp + fp else 0.0
        rec = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
        note = "" if (tp + fp + fn) else "  (örnek yok)"
        print(f"{cls:<18}{tp:>5}{fp:>5}{fn:>5}{prec:>11.3f}{rec:>9.3f}{f1:>7.3f}{note}")
    print("\nNot: kare-seviyesi metriklerdir; sonuçları MIA_PPE_MODEL_EVALUATION_PLAN.md")
    print("'Ölçülen Sonuçlar' bölümüne tarih ve veri seti bilgisiyle işleyin.")


if __name__ == "__main__":
    main()
