# MIA Gerçek Zamanlı Kamera Worker

RTSP/test akışlarından kare örnekler, org'un **KKD profiline göre** (cameras.html →
KKD Tarama Profili) Roboflow rf-27 ile tespit yapar, `camera_events` + heartbeat yazar.
Netlify'da ÇALIŞMAZ — ayrı sunucu/VM/Fly.io/Render gerektirir.

## Yerel çalıştırma
```bash
pip install -r requirements.txt
cp cameras.example.json cameras.json   # kamera ID → gerçek RTSP (ŞİFRELER YALNIZ BURADA)
export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ROBOFLOW_API_KEY=...
python main.py
```
Test (RTSP olmadan): cameras.json'da `"<id>": "test:./ornek.mp4"` veya `"webcam:0"`.

## Docker
```bash
docker build -t mia-camera-worker .
docker run --env-file .env -v $(pwd)/cameras.json:/app/cameras.json mia-camera-worker
```

## Davranış
- Profilde **kapalı** ekipman ihlal üretmez; "model eğitimi gerekir" ekipmanlar asla üretmez.
- Dedup: aynı kamera+tip 60 sn'de 1 olay. Alarm: kamera+tip 5 dk'da 1 e-posta.
- Profil değişikliği worker **yeniden başlatılınca** etkinleşir.
- Loglarda RTSP kimlik bilgileri maskelenir; kareler kalıcı saklanmaz (snapshot v2).

Detay: docs/REALTIME_CAMERA_RUNBOOK.md ve docs/REALTIME_CAMERA_ENTERPRISE_RUNBOOK.md
