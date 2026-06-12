# MIA Gerçek AI Tespit Runbook'u (Faz 20 — operasyon)

Amaç: gerçek çıkarımla uçtan uca canlı tespit. Mock/sahte olay YOK — bu zincirin
her halkası gerçek veridir. (Sunum dili: MIA_REALTIME_CAMERA_DEMO_SCRIPT.md)

## Kurulum (worker host: Mac/Linux/mini PC)
1. **.env:** `cd workers/realtime-camera-worker && cp config.example.env .env` →
   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ROBOFLOW_API_KEY doldur →
   `set -a; source .env; set +a`
2. **cameras.json:** `cp cameras.example.json cameras.json` → uygulamadan eklenen
   kameranın ID'sini gerçek kaynağa eşle:
   - test: `"<id>": "webcam:0"` veya `"test:./ornek-santiye.mp4"`
   - saha: `"<id>": "rtsp://kullanici:sifre@ip:554/stream1"` (önce `ffplay` ile doğrula)
3. **Başlat:** `pip install -r requirements.txt && python main.py --config cameras.json`

## Doğrulama zinciri (sırayla)
4. **Heartbeat:** /app/cameras → Uçtan Uca Hazırlık → "Worker bağlantısı ✓" (≤2 dk).
5. **Model/çıkarım:** aynı panelde "AI çıkarımı ✓ — model rf-27 · son çıkarım N ms";
   /app/detections'ta model ID + adaptör + güven eşiği görünür.
6. **Gerçek tespit tetikle:** webcam önünde baretsiz dur / test videosunda baretsiz
   sahne → ≤60 sn içinde olay düşer (dedup penceresi).
7. **/app/cameras:** Canlı İhlal Olayları tablosunda olay (güven + model + pending).
8. **/app/events:** "· Canlı Kamera" etiketiyle ihlal raporunda; kaynak filtresiyle ayrıştır.
9. **Rapor:** /app/events CSV/PDF · /app/cameras 17 kolonlu CSV.

## Sorun giderme
| Belirti | Neden / Çözüm |
|---|---|
| Hazırlıkta worker ✗ | .env SUPABASE_* yanlış → worker logundaki Supabase hatasına bak; 2 dk bekle |
| "AI çıkarımı kapalı" | ROBOFLOW_API_KEY tanımsız → .env doldur, worker restart (olay üretilmez — tasarım gereği) |
| Olay düşmüyor | profil kayıtlı mı (baret/yelek etkin) · güven eşiği çok yüksek mi (DEFAULT_CONFIDENCE_THRESHOLD) · dedup: aynı tip 60 sn'de 1 |
| Webcam açılmıyor | macOS Sistem Ayarları → Gizlilik → Kamera → terminal'e izin |
| RTSP açılmıyor | `ffplay "rtsp://..."` worker host'unda çalışmalı; port 554/ağ/VPN kontrol |
| Olaylar geç | sampling aralığı (vars. 5 sn) + Roboflow gecikmesi; /app/detections'ta infer_ms'e bak |

## Sınırlar (dürüst)
Doğruluk saha doğrulaması bekler (tüm olaylar pending) · baret/yelek destekli,
maske deneysel, diğerleri kilitli · görüntü saklanmaz (metadata-only) · 7/24
çalışırlık worker host'unun sorumluluğudur (systemd + izleme önerilir).
