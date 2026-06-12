# MIA Model İyileştirme Planı (Faz 18)

Hedef: profesyonele yakın tespit kalitesi — DÜRÜST yoldan. Ölçülmemiş hiçbir
doğruluk iddia edilmez. Ölçüm çerçevesi: MIA_PPE_MODEL_EVALUATION_PLAN.md

## 1. Mevcut yetenek (gerçek durum)
Model: Roboflow `construction-site-safety/27` (rf-27), adaptör katmanı üzerinden.
Üretilen sınıflar: baret/yelek (destekli, doğrudan NO-* ihlal sınıfı), maske
(deneysel). Eldiven/gözlük/kemer/bot/kulaklık: modelde YOK — kilitli.
Boru hattı: kare → RoboflowAdapter → normalize şema → profil filtresi →
dedup → camera_events. Kişi-KKD ilişkilendirme: kare-seviyesi bağlam (frame_level).

## 2. Eşik kalibrasyonu (müşteri/saha başına)
`DEFAULT_CONFIDENCE_THRESHOLD` (vars. 0.45) worker env'inde saha başına ayarlanır:
çok yanlış alarm → 0.50-0.60'a yükselt; kaçırma fazla → 0.35-0.40'a düşür,
"yok say" akışıyla dengele. Her değişiklik eval planındaki ölçümle doğrulanır;
kalibrasyon değerleri pilot raporuna yazılır. Saha farklıysa worker'lar ayrı
env ile çalıştırılır (kamera başına eşik v2).

## 3. FP/FN inceleme döngüsü (haftalık, pilot boyunca)
1. dismissed olayları çek (FP adayları) + İSG ekibinin bildirdiği kaçırmalar (FN).
2. Kök neden sınıflandır: açı / ışık / mesafe / kapanma / sınıf karışıklığı.
3. Çözüm ataması: eşik → §2 · açı/ışık → kamera düzeltme · sistematik model
   hatası → örnekleri eğitim setine (§4).
4. Haftalık pilot raporuna FP/saat trendini işle.

## 4. Yeni KKD sınıfları eğitimi (kilitli sınıfları açma yolu)
Şart: sınıf başına ≥1500 etiketli TR şantiye görseli (çeşitlilik matrisi eval
planında) + müşteri veri onayı. Süreç: veri topla → etiketle (CVAT) → Roboflow'da
fork/yeni proje eğit → eval ile rf-27'ye karşı ölç → hedefleri geçerse:
ppe_registry'de (py+js SENKRON) sınıfı 'experimental'e terfi ettir →
1 pilot sahada gözlem → 'supported'. UI kilidi ancak bu süreçten sonra açılır.

## 5. Özel model'e geçiş (Roboflow bağımsızlığı)
Adaptör katmanı sayesinde tek nokta: `src/` altına yeni adaptör (örn.
`yolo_adapter.py`, ONNX/Ultralytics) yaz → normalize şemaya çevir →
`model_adapter.get_adapter()`'a kaydet → env: `MODEL_PROVIDER=yolo`.
Çekirdek worker/uygulama DEĞİŞMEZ. Avantaj: maliyet (kare başına API ücreti
kalkar), gecikme (yerel GPU), veri gizliliği (kare dışarı çıkmaz).
Şart: kendi modelimiz eval'de Roboflow'u geçmeden geçiş YAPILMAZ.

## 6. Yapılandırma (bugün mevcut)
`ROBOFLOW_MODEL_ID` / `ROBOFLOW_MODEL_VERSION` env'den değiştirilebilir;
uygulama AI Tespit sayfasında aktif model kimliğini worker metadata'sından
gösterir — panelde görünen her zaman GERÇEKTE çalışan modeldir.
