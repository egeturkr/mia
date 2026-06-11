# Gerçek Zamanlı Kamera Runbook (MIA ekibi içi)

## 1. Kamera ekleme (uygulamadan — owner/admin)
cameras.html → + Kamera Ekle → ad/konum/tip/saha + maskeli adres (örn. `rtsp://***@192.168.1.50`)
→ Ekle → ekranda çıkan **kamera ID'sini kopyala** (worker eşlemesi için).

## 2. Worker kurulumu (ayrı sunucu/yerel makine — 10 dk)
```bash
cd workers/realtime-camera-worker
pip install -r requirements.txt
cp cameras.example.json cameras.json     # kamera ID → gerçek RTSP adresi (ŞİFRELER YALNIZ BURADA)
export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ROBOFLOW_API_KEY=...
export ALERT_EMAIL=info@miaissagligi.com   # opsiyonel yüksek-risk e-postası (RESEND_API_KEY ile)
python main.py
```
Test akışı (RTSP olmadan dene): cameras.json'da `"<id>": "test:./ornek.mp4"` veya `"webcam:0"`.
Üretim: Fly.io/Render/mini-PC'de systemd servisi; `WORKER_ID` ile adlandır.

## 3. RTSP bağlantı testi
`ffplay "rtsp://kullanici:sifre@ip:554/yol"` (veya VLC) worker host'unda görüntü veriyorsa worker da açar.
Açılmıyorsa: kamera port 554 açık mı, kullanıcı/şifre, yol (`/stream1`, `/h264` üretici dokümana göre),
ağ/VPN erişimi. Worker açamazsa kamera `error/offline` olur ve üstel geri çekilmeyle yeniden dener.

## 4. Çevrimdışı kamera ayıklama
Panelde kırmızı nokta + "Son kare: X önce" → worker loguna bak (maskeli URL ile hata yazar) →
camera_health_logs son kayıtları → ağ/kamera tarafını düzelt; worker otomatik yeniden bağlanır.

## 5. Yanlış pozitifler
Olayı "Yok say" işaretle (kayıt kalır, status=dismissed) → tekrar ediyorsa worker'da
`RF_CONFIDENCE` yükselt (örn. 50) veya kamera açısını düzelt → örnekler eval setine
(PHASE2 akışı) → kalibrasyon pilot verisiyle yapılır.

## 6. Duraklat / kimlik bilgisi iptali
Panelden "Duraklat" (worker bir sonraki döngüde durumu görür ve... not: v1'de worker başlangıçta
kamera listesini okur — duraklatma için worker'ı yeniden başlat). Kimlik iptali: kamera şifresini
kameradan değiştir → cameras.json'u güncelle → worker'ı yeniden başlat.

## 7. Müşteriye anlatım (dürüst dil)
"Yakın gerçek zamanlı: kameranızdan birkaç saniyede bir kare örnekleyip AI ile analiz ediyoruz;
yüksek riskli ihlalde dakikalar içinde panelde görür, e-posta alırsınız. 7/24 kesintisiz izleme
taahhüdü pilot aşamasında vermiyoruz; doğruluk sahanızda ölçülerek raporlanır."
