# MIA Canlı Kamera Demo Runbook — Tek Oturumda Uçtan Uca (Faz 16)

Amaç: ~20 dk'da gerçek çıkarımla çalışan demo. Mock/sahte olay YOK — adımlar
gerçek zinciri kurar. Sunum dili için: docs/MIA_REALTIME_CAMERA_DEMO_SCRIPT.md

1. **Platform:** miaissagligi.com'u aç (veya masaüstü kabuk: `cd apps/desktop && npm start`).
2. **Şema:** Supabase SQL Editor'da `supabase/schema.sql` güncel mi? (Blok 17 dahil — bir kez yeterli, idempotent.)
3. **Org/saha/kamera:** Giriş yap → organizasyon seç → /cameras → "+ Kamera Ekle"
   (tip: Test akışı veya Webcam) → çıkan **kamera ID'sini kopyala**.
4. **KKD profili:** Aynı sayfada "KKD Tarama Profili" → baret+yelek etkin → Kaydet.
5. **.env:** `cd workers/realtime-camera-worker && cp config.example.env .env` →
   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ROBOFLOW_API_KEY doldur →
   `set -a; source .env; set +a`
6. **cameras.json:** `cp cameras.example.json cameras.json` → içine:
   `{"<kamera-id>": "webcam:0"}` (veya `"test:./ornek-santiye.mp4"`).
7. **Worker:** `pip install -r requirements.txt && python main.py --config cameras.json`
   → logda "▶ başladı" + profil satırı görün.
8. **Heartbeat:** /cameras → "Uçtan Uca Hazırlık" → "Worker bağlantısı ✓ (DEMO/test akışı modu)".
9. **Model:** Aynı panelde "AI çıkarımı ✓ — model: rf-27 · son çıkarım: N ms".
   (✖ ise ROBOFLOW_API_KEY eksik — sayfa bunu açıkça söyler.)
10. **Gerçek tespit:** Webcam önünde baretsiz dur (veya test videosunda baretsiz
    sahne) → ≤60 sn içinde "Canlı İhlal Olayları" tablosuna "Baretsiz çalışan"
    düşer (gerçek çıkarımdan; güven + model sürümüyle).
11. **/cameras:** kamera kartında son kare/tespit zamanlarını göster.
12. **/events:** olay "· Canlı Kamera" etiketiyle ihlal raporunda.
13. **Dışa aktarma:** /events → CSV ve PDF; /cameras → 17 kolonlu kamera CSV'si.
14. **Dürüst kapanış:** Demo modu etiketi, validation_status=pending, "doğruluk
    sahada ölçülür", görüntü saklanmaz (metadata-only), 7/24 taahhüdü yok.

Sorun giderme: worker görünmüyor → 2 dk bekle (heartbeat) veya logda Supabase
hatasına bak · olay düşmüyor → profil kayıtlı mı + RF anahtarı doğru mu ·
webcam açılmıyor → macOS kamera izni (Sistem Ayarları → Gizlilik).
