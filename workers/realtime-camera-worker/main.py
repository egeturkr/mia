#!/usr/bin/env python3
"""
MIA — Gerçek Zamanlı Kamera AI Worker (Faz 12)
================================================
RTSP/test akışlarından kare örnekler, Roboflow ile KKD tespiti yapar,
camera_events + heartbeat + sağlık kayıtlarını Supabase'e (service_role) yazar.

NEDEN AYRI SERVİS: Netlify Functions uzun süreli akış tutamaz (10 sn limit).
Bu worker bir VM / Fly.io / Render / yerel makinede sürekli çalışır.

GÜVENLİK:
  * RTSP kimlik bilgileri YALNIZ buradaki cameras.json'da yaşar — DB/frontend'e gitmez.
  * Loglarda URL kimlik bilgileri maskelenir.
  * Kareler kalıcı saklanmaz (snapshot depolama bilinçli olarak v2'ye bırakıldı).

KULLANIM:
  pip install -r requirements.txt
  cp cameras.example.json cameras.json   # camera_id → stream eşlemesi
  export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ROBOFLOW_API_KEY=...
  python main.py

Test akışı: cameras.json'da "stream": "test:./ornek.mp4" (dosya döngüsü) veya
"webcam:0". Gerçek RTSP: "rtsp://kullanici:sifre@ip:554/yol".
"""
import argparse
import json
import os
import re
import signal
import socket
import sys
import threading
import time
import urllib.request

try:
    import cv2  # opencv-python-headless
except ImportError:
    sys.exit("opencv gerekli: pip install -r requirements.txt")

# ---- Konfig (Faz 15: config.example.env alanları + eski adlarla geri uyumlu) --
def _env(*names, default=""):
    for n in names:
        v = os.environ.get(n)
        if v:
            return v
    return default

SB_URL = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
SB_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
RF_KEY = os.environ.get("ROBOFLOW_API_KEY") or ""
RF_MODEL = _env("ROBOFLOW_MODEL_ID", "RF_MODEL", default="construction-site-safety/27")
MODEL_VERSION = _env("ROBOFLOW_MODEL_VERSION", "RF_MODEL_VERSION", default="rf-27")
# Güven eşiği: 0..1 (DEFAULT_CONFIDENCE_THRESHOLD) veya eski yüzde (RF_CONFIDENCE)
if os.environ.get("DEFAULT_CONFIDENCE_THRESHOLD"):
    CONFIDENCE = float(os.environ["DEFAULT_CONFIDENCE_THRESHOLD"])
else:
    CONFIDENCE = int(os.environ.get("RF_CONFIDENCE", "45")) / 100.0
DEFAULT_SAMPLING_SECONDS = float(_env("DEFAULT_SAMPLING_SECONDS", default="5"))
DEDUP_WINDOW_SEC = int(_env("EVENT_DEDUP_SECONDS", "DEDUP_WINDOW_SEC", default="60"))
ALERT_WINDOW_SEC = int(_env("ALERT_THROTTLE_SECONDS", "ALERT_WINDOW_SEC", default="300"))
ALERT_EMAIL = os.environ.get("ALERT_EMAIL", "")                       # boşsa e-posta alarmı kapalı
RESEND_KEY = os.environ.get("RESEND_API_KEY", "")
WORKER_ID = os.environ.get("WORKER_ID", "worker-" + socket.gethostname())
HEARTBEAT_SEC = 30
CAMERAS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cameras.json")
# Snapshot: VARSAYILAN KAPALI. true istense bile v1'de uygulanmadı — sessizce
# görüntü YÜKLENMEZ; hukuk onayı + saklama politikası + güvenli bucket şart.
SNAPSHOT_ENABLED = os.environ.get("SNAPSHOT_STORAGE_ENABLED", "false").lower() == "true"
if SNAPSHOT_ENABLED:
    print("UYARI: SNAPSHOT_STORAGE_ENABLED=true istendi ama snapshot saklama v1'de"
          " UYGULANMADI (hukuk onayı + saklama politikası gerekir). Görüntü saklanmayacak.")
    SNAPSHOT_ENABLED = False

if not (SB_URL and SB_KEY):
    sys.exit("SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY zorunlu.")

# Faz 14 — DÜRÜSTLÜK: ROBOFLOW_API_KEY yoksa worker yine çalışır (heartbeat/sağlık),
# ama ÇIKARIM YAPILAMAZ ve HİÇBİR OLAY ÜRETİLMEZ — sahte tespit yoktur.
# Panel bunu session metadata'sından okuyup "çıkarım kullanılamıyor" uyarısı gösterir.
INFERENCE_AVAILABLE = bool(RF_KEY)
if not INFERENCE_AVAILABLE:
    print("=" * 70)
    print("UYARI: ROBOFLOW_API_KEY tanımlı değil — ÇIKARIM KAPALI.")
    print("Worker heartbeat/sağlık gönderir ama KKD tespiti YAPMAZ, olay ÜRETMEZ.")
    print("Tespit için: export ROBOFLOW_API_KEY=... ve worker'ı yeniden başlatın.")
    print("=" * 70)

# Faz 13: olay eşlemesi org'un KKD profili'nden üretilir (ppe_registry).
# Faz 15: çıkarım model adaptör katmanından geçer (normalize tespit şeması).
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "src"))
from ppe_registry import build_violation_map, equipment_summary, DEFAULT_REQUIRED  # noqa: E402
from model_adapter import get_adapter, associate_frame  # noqa: E402

ADAPTER = get_adapter("roboflow", api_key=RF_KEY, model_id=RF_MODEL,
                      confidence_threshold=CONFIDENCE) if INFERENCE_AVAILABLE else None

def mask(url):
    """Loglar için kimlik bilgisi maskeleme."""
    return re.sub(r"//[^@/]+@", "//***:***@", str(url))

def log(msg):
    print(time.strftime("[%H:%M:%S]"), msg, flush=True)

# ---- Supabase REST (service_role) -------------------------------------------
def sb_req(method, path, body=None, params=""):
    url = f"{SB_URL}/rest/v1/{path}{params}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}",
        "Content-Type": "application/json", "Prefer": "return=minimal",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            raw = r.read()
            return json.loads(raw) if raw else None
    except Exception as e:
        log(f"  ! supabase {method} {path}: {e}")
        return None

def sb_get(path, params):
    url = f"{SB_URL}/rest/v1/{path}{params}"
    req = urllib.request.Request(url, headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except Exception as e:
        log(f"  ! supabase GET {path}: {e}")
        return None

def now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

# ---- Çıkarım (Faz 15: adaptör katmanı — model şekline sıkı bağ yok) ----------
def infer(frame):
    """BGR kare → normalize tespit listesi (detection_schema biçimi)."""
    ok, jpg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
    if not ok:
        return []
    return ADAPTER.infer_jpeg(jpg.tobytes())

# ---- Kamera döngüsü -----------------------------------------------------------
class CameraLoop(threading.Thread):
    def __init__(self, cam, stream, profile=None):
        super().__init__(daemon=True)
        self.cam = cam                  # Supabase cameras satırı
        self.stream = stream            # cameras.json'daki kaynak
        self.stop_flag = False
        self.last_event = {}            # event_type → ts (dedup)
        self.last_alert = {}            # event_type → ts (e-posta)
        self.session_id = None
        # Faz 13: org KKD profili → yalnız ETKİN ekipman ihlali üretilir.
        self.required = (profile or {}).get("required_equipment") or DEFAULT_REQUIRED
        self.vmap = build_violation_map(self.required, (profile or {}).get("risk_rules"))
        # Faz 15: performans ölçümü + mod etiketi
        self.perf = None  # {"capture_ms","infer_ms","total_ms"} — son döngü
        self.mode = "demo" if (stream.startswith("test:") or stream.startswith("webcam:")) else "rtsp"
        # Faz 21: ihlalsiz-durum geri bildirimi — "hiçbir şey olmuyor" sanılmasın
        self.last_result = None        # no_violation | violation_created | no_person_detected | inference_error
        self.last_inference_at = None
        self.det_count = 0

    def open_capture(self):
        s = self.stream
        if s.startswith("webcam:"):
            return cv2.VideoCapture(int(s.split(":", 1)[1]))
        if s.startswith("test:"):
            return cv2.VideoCapture(s.split(":", 1)[1])   # dosya — biter, yeniden açılır (döngü)
        return cv2.VideoCapture(s)                         # rtsp/onvif/http

    def set_cam(self, fields):
        fields["updated_at"] = now_iso()
        sb_req("PATCH", "cameras", fields, f"?id=eq.{self.cam['id']}")

    def health(self, status, msg=None, latency=None):
        sb_req("POST", "camera_health_logs", {
            "org_id": self.cam["org_id"], "camera_id": self.cam["id"],
            "status": status, "message": msg, "latency_ms": latency})

    def heartbeat(self, status="running", err=None):
        body = {"status": status, "last_heartbeat_at": now_iso(), "error_message": err,
                "metadata": {"inference": INFERENCE_AVAILABLE, "mode": self.mode,
                             "model": MODEL_VERSION if INFERENCE_AVAILABLE else None,
                             "model_id": RF_MODEL if INFERENCE_AVAILABLE else None,
                             "adapter": "roboflow" if INFERENCE_AVAILABLE else None,
                             "confidence_threshold": CONFIDENCE if INFERENCE_AVAILABLE else None,
                             "perf_ms": self.perf or None,
                             "last_result": self.last_result,
                             "last_inference_at": self.last_inference_at,
                             "detections_count": self.det_count}}
        if self.session_id:
            sb_req("PATCH", "camera_worker_sessions", body, f"?id=eq.{self.session_id}")

    def emit_event(self, etype, risk, det):
        """Dedup: aynı kamera+tip DEDUP_WINDOW_SEC içinde tek olay (kare başına spam yok)."""
        now = time.time()
        if now - self.last_event.get(etype, 0) < DEDUP_WINDOW_SEC:
            return
        self.last_event[etype] = now
        eq = equipment_summary(self.required, det.get("all"))  # Faz 13: ekipman özeti
        sb_req("POST", "camera_events", {
            "org_id": self.cam["org_id"], "site_id": self.cam.get("site_id"),
            "camera_id": self.cam["id"], "event_type": etype, "risk_level": risk,
            "confidence": det.get("confidence"), "frame_timestamp": now_iso(),
            # Faz 15: normalize tespitler + kare bağlamı + performans (görüntü YOK — metadata-only)
            "detections_json": {"detections": det.get("all"), "context": det.get("context"),
                                "perf_ms": self.perf, "evidence": "metadata-only"},
            "model_name": RF_MODEL,
            "model_version": MODEL_VERSION, "validation_status": "pending",
            "required_equipment": eq["required"], "detected_equipment": eq["detected"],
            "missing_equipment": eq["missing"]})
        self.set_cam({"last_detection_at": now_iso()})
        log(f"  ⚠ {self.cam['name']}: {etype} ({risk}, %{det.get('confidence')})")
        if risk in ("high", "critical"):
            self.maybe_alert(etype, det)

    def maybe_alert(self, etype, det):
        """Yüksek riskte e-posta — kamera+tip başına 5 dk'da en çok 1 (spam yok)."""
        if not (ALERT_EMAIL and RESEND_KEY):
            return
        now = time.time()
        if now - self.last_alert.get(etype, 0) < ALERT_WINDOW_SEC:
            return
        self.last_alert[etype] = now
        try:
            body = json.dumps({
                "from": "MIA Kamera AI <bildirim@miaissagligi.com>", "to": ALERT_EMAIL,
                "subject": f"⚠️ Canlı kamera ihlali: {self.cam['name']} — {etype}",
                "html": f"<p>Kamera: <b>{self.cam['name']}</b> ({self.cam.get('location_label') or '-'})<br>"
                        f"Olay: <b>{etype}</b> · Güven: %{det.get('confidence')}<br>"
                        f"Zaman: {now_iso()}<br><br>Detay: miaissagligi.com/cameras.html</p>"
                        f"<p style='color:#888;font-size:11px'>AI destekli ön değerlendirmedir; sertifikalı İSG denetiminin yerine geçmez.</p>"
            }).encode()
            req = urllib.request.Request("https://api.resend.com/emails", data=body, method="POST",
                headers={"Authorization": f"Bearer {RESEND_KEY}", "Content-Type": "application/json"})
            urllib.request.urlopen(req, timeout=15)
            log(f"  ✉ alarm gönderildi: {etype}")
        except Exception as e:
            log(f"  ! alarm hatası: {e}")

    def run(self):
        cam_label = f"{self.cam['name']} [{mask(self.stream)}]"
        # Worker oturumu aç
        res = None
        # Demo/test akışları DÜRÜSTÇE etiketlenir — gerçek RTSP kamerası gibi gösterilmez.
        mode = self.mode
        try:
            req = urllib.request.Request(f"{SB_URL}/rest/v1/camera_worker_sessions", method="POST",
                data=json.dumps({"org_id": self.cam["org_id"], "camera_id": self.cam["id"],
                                 "worker_id": WORKER_ID, "status": "running",
                                 "metadata": {"inference": INFERENCE_AVAILABLE, "mode": mode,
                                              "model": MODEL_VERSION if INFERENCE_AVAILABLE else None}}).encode(),
                headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}",
                         "Content-Type": "application/json", "Prefer": "return=representation"})
            with urllib.request.urlopen(req, timeout=15) as r:
                res = json.loads(r.read())
        except Exception as e:
            log(f"  ! oturum açılamadı: {e}")
        self.session_id = res[0]["id"] if isinstance(res, list) and res else None

        fps = float(self.cam.get("sampling_fps") or 0)
        interval = max(1.0, 1.0 / fps) if fps > 0 else DEFAULT_SAMPLING_SECONDS
        backoff, last_hb = 5, 0
        log(f"▶ başladı: {cam_label} (her {interval:.0f} sn'de 1 kare)")
        self.set_cam({"status": "active", "health_status": "online"})

        while not self.stop_flag:
            cap = self.open_capture()
            if not cap.isOpened():
                log(f"  ✖ akış açılamadı: {cam_label} — {backoff} sn sonra tekrar")
                self.set_cam({"status": "error", "health_status": "offline"})
                self.health("offline", "stream open failed")
                self.heartbeat("error", "stream open failed")
                time.sleep(backoff)
                backoff = min(backoff * 2, 120)            # üstel geri çekilme + yeniden bağlanma
                continue
            backoff = 5
            self.set_cam({"status": "active", "health_status": "online"})
            self.health("online")
            while not self.stop_flag:
                t0 = time.time()
                ok, frame = cap.read()
                t_cap = time.time()
                if not ok:
                    if self.stream.startswith("test:"):
                        cap.release(); break               # dosya bitti → döngüye al
                    log(f"  ✖ kare okunamadı: {cam_label}")
                    self.set_cam({"health_status": "degraded"})
                    cap.release(); break                   # yeniden bağlan
                self.set_cam({"last_frame_at": now_iso()})
                if INFERENCE_AVAILABLE:
                    try:
                        preds = infer(frame)               # normalize tespitler (adaptör)
                        t_inf = time.time()
                        ctx = associate_frame(preds)       # kare bağlamı (dürüst, tracking yok)
                        emitted = False
                        for p in preds:
                            m = self.vmap.get(p["raw_class_name"])  # profil-farkında: kapalı ekipman olay üretmez
                            if m:
                                emitted = True
                                self.emit_event(m[0], m[1], {
                                    "confidence": round(p["confidence"] * 100),
                                    "all": preds, "context": ctx})
                        # Faz 21: dürüst durum — ihlal yoksa da "çıkarım çalışıyor" bilgisi akar
                        self.last_inference_at = now_iso()
                        self.det_count = len(preds)
                        self.last_result = ("violation_created" if emitted
                                            else "no_violation" if preds
                                            else "no_person_detected")
                        # Faz 15: performans ölçümü (heartbeat metadata'sına gider)
                        self.perf = {"capture_ms": round((t_cap - t0) * 1000),
                                     "infer_ms": round((t_inf - t_cap) * 1000),
                                     "total_ms": round((time.time() - t0) * 1000)}
                    except Exception as e:
                        log(f"  ! inference hatası: {e}")
                        self.last_result = "inference_error"
                        self.health("degraded", f"inference: {type(e).__name__}")
                # ÇIKARIM YOKSA: kare okunur, sağlık/heartbeat akar, olay ÜRETİLMEZ (sahte tespit yok)
                if time.time() - last_hb > HEARTBEAT_SEC:
                    self.heartbeat(); last_hb = time.time()
                # örnekleme aralığı kadar bekle (akıştaki ara kareleri tüket)
                wait_until = t0 + interval
                while time.time() < wait_until and not self.stop_flag:
                    cap.grab()
                    time.sleep(0.05)
            cap.release()
        self.heartbeat("stopped")
        self.set_cam({"status": "paused", "health_status": "unknown"})
        log(f"■ durdu: {cam_label}")

# ---- Ana ----------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="MIA Gerçek Zamanlı Kamera Worker")
    ap.add_argument("--config", default=CAMERAS_FILE,
                    help="kamera id → akış eşleme dosyası (vars. cameras.json)")
    args = ap.parse_args()
    cfg = args.config
    if not os.path.exists(cfg):
        sys.exit(f"{cfg} yok — cameras.example.json'u kopyalayıp doldurun.")
    with open(cfg) as f:
        raw = json.load(f)
    # İki biçim desteklenir (Faz 21):
    #   sözlük: { "<camera_uuid>": "rtsp://..." }
    #   liste:  [ { "id": "<uuid>", "name": "...", "stream_url": "..." }, ... ]
    if isinstance(raw, list):
        stream_map = {r["id"]: r["stream_url"] for r in raw
                      if r.get("id") and r.get("stream_url") and not str(r["id"]).startswith("PASTE")}
    else:
        stream_map = {k: v for k, v in raw.items() if not k.startswith("_")}

    cams = sb_get("cameras", "?status=in.(active,testing,inactive)&select=*") or []

    # Faz 13: KKD profilleri (saha profili > org varsayılanı > yerleşik varsayılan)
    profiles = sb_get("ppe_detection_profiles", "?select=*") or []
    by_site = {p["site_id"]: p for p in profiles if p.get("site_id")}
    by_org = {p["org_id"]: p for p in profiles if p.get("is_default") and not p.get("site_id")}

    loops = []
    for cam in cams:
        stream = stream_map.get(cam["id"])
        if not stream:
            log(f"– atlandı (cameras.json'da eşleme yok): {cam['name']} [{cam['id']}]")
            continue
        profile = by_site.get(cam.get("site_id")) or by_org.get(cam["org_id"])
        loop = CameraLoop(cam, stream, profile)
        enabled = sorted(k for k, v in loop.required.items() if v)
        log(f"  profil [{cam['name']}]: {', '.join(enabled) or 'yok'}"
            + ("" if profile else " (varsayılan — uygulamadan profil kaydedilmemiş)"))
        loops.append(loop)
    if not loops:
        sys.exit("Eşlenmiş aktif kamera yok. Önce uygulamadan kamera ekleyin ve cameras.json'a id→stream yazın.")

    for lp in loops:
        lp.start()
    log(f"Worker {WORKER_ID}: {len(loops)} kamera izleniyor. Ctrl+C ile durdur.")

    def stop(*_):
        log("durduruluyor…")
        for lp in loops:
            lp.stop_flag = True
        for lp in loops:
            lp.join(timeout=10)
        sys.exit(0)
    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)
    while True:
        time.sleep(60)

if __name__ == "__main__":
    main()
