# MIA Masaüstü Uygulaması (v0.2.0 — yerli müşteri uygulaması)

Faz 18: ince web kabuğu → **tam yerli kurumsal uygulama**. Büyük inşaat
müşterileri için: kamera bağla, KKD tespiti cihazda çalışsın, olaylar buluta
senkron olsun, rapor tek tıkla çıksın.

## Ne yapar
- **Cihaz üstü AI**: `models/mia-ppe-yolov8s.onnx` (YOLOv8s, 10 sınıf).
  onnxruntime-web (WebGPU→WASM) ile çalışır. **Kareler şantiyeden çıkmaz** —
  buluta yalnız olay meta verisi yazılır (KVKK dostu). MIA'nın kendi eğitimli
  sürümleri `ml/` hattıyla üretilir ve bu dosyanın yerine geçer (ml/README.md).
- **MIA Vision Engine** (`renderer/js/tracker.js` — bizim yazılımımız, modelden
  bağımsız): kişi takibi (kalıcı P1, P2… ID'leri), KKD kutularını geometrik
  olarak kişiye eşleme (baret üst bant, yelek gövde bandı), **kare oylamalı
  doğrulama** (ihlal ancak 6 karenin 4'ünde görülürse raporlanır → yanlış
  pozitif düşer). Olaylar `person_track_id` ile kişi bazında yazılır; ekipman
  takılıp tekrar çıkarılırsa YENİ olay sayılır.
- **Motor seçimi**: varsayılan tamamen cihaz üstü (bulut bağımlılığı yok);
  hibrit/bulut (rf-27 `/api/detect`) Ayarlar'dan seçilebilir.
- **Saha Veri Toplama Modu** (varsayılan KAPALI, KVKK onayı şart): kararsız /
  ihlalli kareler YOLO formatında yerelde birikir → `ml/` eğitim hattının
  girdisi → MIA'nın kendi TR şantiye modeli (v2).
- **Kaynaklar**: Mac webcam/USB (getUserMedia) + RTSP IP kamera (paketli ffmpeg,
  ana süreçte çözülür) + kayıtlı video dosyası analizi.
- **Canlı etiketleme**: kutu + sınıf + güven overlay'i; ihlalde masaüstü bildirimi.
- **Olay motoru**: KKD profiline saygılı (kapalı ekipman ihlal üretmez), dedup
  60 sn kamera+tip, **offline kuyruk** (disk) → `/api/camera-event` (yeni Netlify fn).
- **Raporlar**: dönem bazlı özet, PDF (printToPDF) + CSV dışa aktarma, TR/EN.
- **Güvenlik**: RTSP kimlik bilgileri YALNIZ bu cihazda `safeStorage`
  (macOS Keychain) ile şifreli; buluta yalnız maskeli URL. nodeIntegration kapalı,
  contextIsolation+sandbox açık, CSP'li renderer, API çağrıları ana süreçten.

## Geliştirme
```bash
cd apps/desktop
npm install          # postinstall: vendor kopyalanır (supabase-js, ort + wasm)
npm start
npm test             # tespit motoru birim testleri (letterbox/NMS/dedup)
```

## macOS dağıtımı
```bash
npm run release:mac  # build + SHA256 + releases/ + manifest.json güncelle
```
Script sonunda GitHub Release yükleme ve `hosted_url` adımları yazdırılır.
İmzalama/notarization için Apple Developer hesabı gerekir (pilot: imzasız, sağ tık → Aç).

## Mimari notlar
- `main.js` ana süreç: pencere, IPC, ffmpeg RTSP→MJPEG boru hattı, PDF/CSV,
  disk deposu, safeStorage. `preload.js` daraltılmış köprü (`window.mia`).
- `renderer/js/`: `core` (Supabase+org), `detect` (ONNX+bulut), `events` (olay
  motoru+kuyruk), `sources` (webcam/rtsp/video döngüsü), `views`, `app`, `i18n`.
- Sunucu tarafı: `netlify/functions/camera-event.js` — JWT + org üyelik +
  kamera sahipliği doğrulaması, service_role ile `camera_events` insert.
- Sınıf eşlemesi `js/detector.js` (web) ve `workers/.../ppe_registry.py` ile senkron.
