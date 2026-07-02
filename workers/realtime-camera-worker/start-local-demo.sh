#!/usr/bin/env bash
# MIA — Yerel KKD Demo Başlatıcı (Faz 21, macOS Bash 3.2 uyumlu)
# webcam:0 / test:video / RTSP ile İLK GERÇEK tespit için tek komut.
# GÜVENLİK: hiçbir secret EKRANA BASILMAZ — yalnız var/yok kontrol edilir.
set -eu
cd "$(dirname "$0")"

fail() { echo ""; echo "❌ $1"; echo "→ $2"; exit 1; }

echo "== MIA Yerel KKD Demo — ön kontroller =="

# 1) Python sürümü
command -v python3 >/dev/null || fail "python3 bulunamadı" "https://python.org veya 'brew install python' ile kurun."
PYV=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3,9) else 1)' \
  || fail "Python $PYV çok eski" "Python 3.9+ gerekli."
echo "✓ Python $PYV"

# 2) venv + bağımlılıklar
if [ ! -d ".venv" ]; then
  echo "  venv oluşturuluyor…"; python3 -m venv .venv
fi
# shellcheck disable=SC1091
. .venv/bin/activate
python -c "import cv2" 2>/dev/null || { echo "  bağımlılıklar kuruluyor…"; pip install -q -r requirements.txt; }
echo "✓ Bağımlılıklar hazır (venv)"

# 3) .env (varsa yükle) + zorunlu değişkenler — DEĞERLER ASLA YAZDIRILMAZ
if [ -f ".env" ]; then set -a; . ./.env; set +a; fi
[ -n "${SUPABASE_URL:-}" ]              || fail "SUPABASE_URL tanımsız" "cp config.example.env .env → doldurun (Supabase Dashboard → Settings → API)."
[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ] || fail "SUPABASE_SERVICE_ROLE_KEY tanımsız" ".env dosyasına ekleyin (Supabase → API → service_role). Bu anahtar YALNIZ bu makinede kalır."
echo "✓ Supabase yapılandırması mevcut"
if [ -n "${ROBOFLOW_API_KEY:-}" ]; then
  echo "✓ Roboflow anahtarı mevcut — gerçek çıkarım AÇIK"
else
  echo "⚠ ROBOFLOW_API_KEY tanımsız — worker bağlanır ama TESPİT YAPMAZ (olay üretilmez)."
  echo "  Gerçek tespit için .env'e ekleyin: https://app.roboflow.com → Settings → API"
fi

# 4) cameras.json + kamera ID kontrolü
[ -f "cameras.json" ] || fail "cameras.json yok" "cp cameras.example.json cameras.json → MIA uygulamasında kamera oluşturun (/app/cameras) → 'ID Kopyala' ile ID'yi yapıştırın → stream: \"webcam:0\""
python3 - <<'PYEOF' || exit 1
import json, re, sys
try:
    data = json.load(open("cameras.json"))
except Exception as e:
    sys.exit(f"❌ cameras.json geçersiz JSON: {e}")
# iki biçim: {"id": "stream"} sözlüğü VEYA [{"id":..., "stream_url":...}] listesi
if isinstance(data, list):
    pairs = [(r.get("id",""), r.get("stream_url","")) for r in data]
else:
    pairs = [(k, v) for k, v in data.items() if not k.startswith("_")]
uuid_re = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
valid = [(i, s) for i, s in pairs if uuid_re.match(str(i))]
if not valid:
    sys.exit("❌ cameras.json'da geçerli kamera ID'si yok.\n"
             "→ MIA uygulaması /app/cameras → '+ Kamera Ekle' → 'ID Kopyala' → cameras.json'a yapıştırın.\n"
             "  (PASTE_CAMERA_ID... örnek satırları gerçek UUID ile değiştirilmeli.)")
print(f"✓ {len(valid)} kamera eşlemesi hazır")
for i, s in valid:
    masked = __import__("re").sub(r"//[^@/]+@", "//***:***@", str(s))
    print(f"    {i[:8]}… → {masked}")
PYEOF

echo ""
echo "== Worker başlatılıyor (Ctrl+C ile durdurun) =="
echo "Sonraki adımlar: MIA uygulaması → /app/cameras → 'Uçtan Uca Hazırlık' panelinde ✓'leri izleyin."
echo "Baretsiz kameraya görünün → ≤60 sn içinde olay düşer → /app/events'te raporlanır."
echo ""
exec python main.py --config cameras.json
