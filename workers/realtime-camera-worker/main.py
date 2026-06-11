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
import base64
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

# ---- Konfig -----------------------------------------------------------------
SB_URL = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
SB_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
RF_KEY = os.environ.get("ROBOFLOW_API_KEY") or ""
RF_MODEL = os.environ.get("RF_MODEL", "construction-site-safety/27")
MODEL_VERSION = os.environ.get("RF_MODEL_VERSION", "rf-27")
CONFIDENCE = int(os.environ.get("RF_CONFIDENCE", "40"))
DEDUP_WINDOW_SEC = int(os.environ.get("DEDUP_WINDOW_SEC", "60"))      # aynı kamera+tip tek olay/pencere
ALERT_WINDOW_SEC = int(os.environ.get("ALERT_WINDOW_SEC", "300"))     # e-posta: 5 dk/kamera+tip
ALERT_EMAIL = os.environ.get("ALERT_EMAIL", "")                       # boşsa e-posta alarmı kapalı
RESEND_KEY = os.environ.get("RESEND_API_KEY", "")
WORKER_ID = os.environ.get("WORKER_ID", "worker-" + socket.gethostname())
HEARTBEAT_SEC = 30
CAMERAS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cameras.json")

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

# Faz 13: olay eşlemesi artık org'un KKD profili'nden üretilir (ppe_registry).
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "src"))
from ppe_registry import build_violation_map, equipment_summary, DEFAULT_REQUIRED  # noqa: E402

MIN_BOX_AREA = 0.0008  # js/postprocess.js ile aynı gürültü eşiği

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

# ---- Roboflow çıkarımı --------------------------------------------------------
def infer(frame):
    """BGR kare → Roboflow tahminleri (normalize kutularla)."""
    ok, jpg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
    if not ok:
        return []
    b64 = base64.b64encode(jpg.tobytes())
    url = f"https://serverless.roboflow.com/{RF_MODEL}?api_key={RF_KEY}&confidence={CONFIDENCE}&overlap=30"
    req = urllib.request.Request(url, data=b64, method="POST",
                                 headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=30) as r:
        j = json.loads(r.read())
    W = (j.get("image") or {}).get("width") or 1
    H = (j.get("image") or {}).get("height") or 1
    out = []
    for p in j.get("predictions", []):
        w, h = p["width"] / W, p["height"] / H
        if w * h < MIN_BOX_AREA:
            continue
        out.append({"class": p["class"], "confidence": round(p.get("confidence", 0) * 100),
                    "box": [round((p["x"] - p["width"] / 2) / W, 3), round((p["y"] - p["height"] / 2) / H, 3),
                            round(w, 3), round(h, 3)]})
    return out

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
        body = {"status": status, "last_heartbeat_at": now_iso(), "error_message": err}
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
            "detections_json": det.get("all"), "model_name": RF_MODEL,
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
        mode = "demo" if (self.stream.startswith("test:") or self.stream.startswith("webcam:")) else "rtsp"
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

        interval = max(1.0, 1.0 / float(self.cam.get("sampling_fps") or 0.2))
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
                if not ok:
                    if self.stream.startswith("test:"):
                        cap.release(); break               # dosya bitti → döngüye al
                    log(f"  ✖ kare okunamadı: {cam_label}")
                    self.set_cam({"health_status": "degraded"})
                    cap.release(); break                   # yeniden bağlan
                self.set_cam({"last_frame_at": now_iso()})
                if INFERENCE_AVAILABLE:
                    try:
                        preds = infer(frame)
                        for p in preds:
                            m = self.vmap.get(p["class"])   # profil-farkında: kapalı ekipman olay üretmez
                            if m:
                                self.emit_event(m[0], m[1], {"confidence": p["confidence"], "all": preds})
                    except Exception as e:
                        log(f"  ! inference hatası: {e}")
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
        stream_map = json.load(f)   # { "<camera_uuid>": "rtsp://..." }

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
