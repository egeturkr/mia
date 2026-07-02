# MIA İlk Gerçek AI Tespiti — Kontrol Listesi (Faz 21)

Hedef: Mac'inde webcam ile İLK GERÇEK uçtan uca tespit. Süre: ~15 dk.
Kolay yol: **adım 3-7 yerine** `cd workers/realtime-camera-worker && ./start-local-demo.sh`
(script tüm kontrolleri yapar ve eksikte ne yapacağını söyler).

1. **Kamera oluştur:** MIA uygulaması → /app/cameras → "+ Kamera Ekle" →
   tip: "Webcam (demo)" → ad ver → Ekle.
2. **Camera ID kopyala:** kamera kartındaki **"ID Kopyala"** butonu.
3. **.env oluştur:** `cd workers/realtime-camera-worker && cp config.example.env .env`
   → SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY doldur (Supabase → Settings → API).
4. **Roboflow anahtarı:** .env'e ROBOFLOW_API_KEY=... (app.roboflow.com → Settings → API).
5. **Model:** vars. doğru: `ROBOFLOW_MODEL_ID=construction-site-safety/27`, `ROBOFLOW_MODEL_VERSION=rf-27`.
6. **cameras.json:** `cp cameras.example.json cameras.json` → ilk kaydın `id`'sine
   kopyaladığın ID'yi yapıştır, `stream_url: "webcam:0"` (veya kartta **"cameras.json Kopyala"** ile hazır snippet).
7. **Worker'ı başlat:** `./start-local-demo.sh` (venv+kontroller+başlatma otomatik).
8. **Worker bağlı mı:** /app/cameras → Uçtan Uca Hazırlık → "Worker bağlantısı ✓ (DEMO modu)" (≤2 dk).
9. **Çıkarım çalışıyor mu:** aynı panelde "AI çıkarımı ✓ — model rf-27 · N ms".
10. **Tespit durumu:** /app/detections → "Son çıkarım sonucu" satırı — baretliyken
    "ihlal yok ✓" görmen NORMALDİR ve sistemin çalıştığını kanıtlar.
11. **İhlali tetikle:** webcam karşısında **baretsiz** dur (veya test videosunda
    baretsiz sahne) → dedup gereği ≤60 sn bekle.
12. **Olayı doğrula:** /app/cameras olay tablosu + /app/events'te "· Canlı Kamera"
    etiketli "Baretsiz çalışan" (güven + rf-27 + pending).
13. **Rapor al:** /app/events → CSV/PDF; /app/cameras → 17 kolonlu CSV.
14. **Olay düşmüyorsa:**
    - /app/detections "son sonuç" ne diyor? "karede tespit yok" → ışık/mesafe
      (kamera 1-3 m, yüz/gövde görünür); "ihlal yok" → model bareti görüyor olabilir,
      gerçekten baretsiz olduğundan emin ol; "çıkarım hatası" → worker logu.
    - Profil: /app/cameras KKD profilinde baret etkin mi?
    - Eşik: .env'de DEFAULT_CONFIDENCE_THRESHOLD=0.35 dene + worker restart.
    - Dedup: aynı tip 60 sn'de 1 olay — bekle.
    - Hâlâ yoksa: docs/MIA_REAL_AI_DETECTION_RUNBOOK.md sorun giderme tablosu.
