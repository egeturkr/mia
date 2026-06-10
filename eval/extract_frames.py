#!/usr/bin/env python3
"""
MIA — Video → Kare Çıkarma (Faz 2: AI Doğrulama)
=================================================
Doğrulama setindeki videolardan deterministik kare çıkarır, her kareyi kaynak
videoya + zaman damgasına bağlayan izlenebilir metadata üretir. Çıkan kareler
normal görsel-bazlı değerlendirme akışına girer (etiketle → baseline_eval).

Kullanım:
    python eval/extract_frames.py                          # varsayılan yollar
    python eval/extract_frames.py --fps 2 --videos eval/dataset/videos

Özellikler:
  * Sabit FPS örnekleme (--fps, varsayılan 1.0) → her koşuda aynı kareler.
  * Dosya adı izlenebilir: <video>_f00001_t2000ms.jpg
  * frames_metadata.json: kare → kaynak video + saniye + çıkarım parametreleri.
  * Video yoksa ZARAR VERMEDEN çıkar (exit 0, net mesaj) — sahte veri üretmez.

Bağımlılık: ffmpeg + ffprobe (sistemde kurulu olmalı).
"""
import argparse, json, os, re, shutil, subprocess, sys, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO_EXTS = (".mp4", ".mov", ".avi", ".mkv", ".webm")


def have(cmd):
    return shutil.which(cmd) is not None


def probe_duration(path):
    """ffprobe ile video süresi (saniye) — bilinemiyorsa None."""
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", path],
            capture_output=True, text=True, timeout=60)
        return round(float(out.stdout.strip()), 3)
    except Exception:
        return None


def slugify(name):
    s = re.sub(r"[^A-Za-z0-9_-]+", "-", os.path.splitext(os.path.basename(name))[0])
    return s.strip("-") or "video"


def extract(video, out_dir, fps):
    """Tek videodan sabit-FPS kare çıkarır → [(dosya, timestamp_sec)] döner."""
    slug = slugify(video)
    tmp_pattern = os.path.join(out_dir, "__tmp_%s_%%05d.jpg" % slug)
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
           "-i", video, "-vf", "fps=%s" % fps, "-q:v", "2", tmp_pattern]
    r = subprocess.run(cmd)
    if r.returncode != 0:
        print("  ! ffmpeg hata verdi: %s" % os.path.basename(video))
        return []
    frames = []
    i = 1
    while True:
        tmp = os.path.join(out_dir, "__tmp_%s_%05d.jpg" % (slug, i))
        if not os.path.exists(tmp):
            break
        # fps=N filtresi: i. kare ≈ (i-1)/fps saniyesinden örneklenir (deterministik)
        ts = round((i - 1) / float(fps), 3)
        final = os.path.join(out_dir, "%s_f%05d_t%dms.jpg" % (slug, i, int(ts * 1000)))
        os.replace(tmp, final)
        frames.append((os.path.basename(final), ts))
        i += 1
    return frames


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--videos", default=os.path.join(HERE, "dataset", "videos"))
    ap.add_argument("--out", default=os.path.join(HERE, "dataset", "images"))
    ap.add_argument("--meta", default=os.path.join(HERE, "dataset", "frames_metadata.json"))
    ap.add_argument("--fps", type=float, default=1.0,
                    help="saniyede çıkarılacak kare sayısı (varsayılan 1.0)")
    ap.add_argument("--force", action="store_true",
                    help="daha önce çıkarılmış videoları yeniden işle")
    args = ap.parse_args()

    if not (have("ffmpeg") and have("ffprobe")):
        sys.exit("ffmpeg/ffprobe gerekli. Kurulum: https://ffmpeg.org/download.html")

    if not os.path.isdir(args.videos):
        print("Video klasörü yok: %s — çıkarılacak veri bulunamadı (bu bir hata değil)." % args.videos)
        return
    videos = sorted(f for f in os.listdir(args.videos)
                    if f.lower().endswith(VIDEO_EXTS))
    if not videos:
        print("Doğrulama videosu bulunamadı (%s boş). Önce saha videosu ekleyin." % args.videos)
        return

    os.makedirs(args.out, exist_ok=True)
    meta = {"frames": {}, "videos": {}}
    if os.path.exists(args.meta):
        try:
            with open(args.meta, encoding="utf-8") as f:
                meta = json.load(f)
            meta.setdefault("frames", {}); meta.setdefault("videos", {})
        except Exception:
            print("  ! mevcut metadata okunamadı, yeniden oluşturulacak")

    now = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    total = 0
    for v in videos:
        vpath = os.path.join(args.videos, v)
        if v in meta["videos"] and not args.force:
            print("  = atlandı (zaten çıkarılmış): %s  (--force ile yenile)" % v)
            continue
        dur = probe_duration(vpath)
        print("  → %s (süre: %s sn, fps=%s)" % (v, dur if dur is not None else "?", args.fps))
        frames = extract(vpath, args.out, args.fps)
        for fname, ts in frames:
            meta["frames"][fname] = {
                "source_video": v, "timestamp_sec": ts,
                "extracted_fps": args.fps, "extracted_at": now,
            }
        meta["videos"][v] = {
            "duration_sec": dur, "frames_extracted": len(frames),
            "extracted_fps": args.fps, "extracted_at": now,
        }
        total += len(frames)

    with open(args.meta, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print("\n✓ %d kare çıkarıldı → %s" % (total, args.out))
    print("  Metadata: %s (kare → kaynak video + zaman)" % args.meta)
    print("  Sonraki adım: kareleri etiketle (labels/) ve run_validation.py çalıştır.")


if __name__ == "__main__":
    main()
