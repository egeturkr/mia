# MIA — Sprint 1: Baseline Değerlendirme & Veri Toplama

Bu klasör, mevcut PPE tespit modelinin (`construction-site-safety/27`, Roboflow) **kendi
sahalarımızdaki gerçek doğruluğunu** ölçmek için kurulmuştur. Roboflow'un ilan ettiği
~%70 mAP genel bir rakamdır; bizim geçiş noktası senaryomuzdaki performansı bilmiyoruz.
Önce baseline'ı ölçeriz, sonra iyileştirmeyi buna göre planlarız.

## 1. Klasör yapısı

```
eval/
  baseline_eval.py        # değerlendirme harness'ı
  dataset/
    images/               # test görselleri (.jpg/.png)
    labels/               # her görselle aynı isimde .txt (YOLO formatı)
    classes.txt           # sınıf isimleri, model sırasıyla
  baseline_report.json    # script çıktısı (otomatik üretilir)
```

`classes.txt` (model sırası — değiştirme):

```
Hardhat
NO-Hardhat
Safety Vest
NO-Safety Vest
Mask
NO-Mask
Person
machinery
vehicle
Safety Cone
```

## 2. Etiket formatı (YOLO)

Her görsel için aynı isimde bir `.txt`. Her satır bir kutu:

```
<class_id> <cx> <cy> <w> <h>
```

Hepsi 0–1 arası normalize (cx,cy kutu merkezi; w,h genişlik/yükseklik). `class_id`,
`classes.txt` sırasındandır (Hardhat=0, NO-Hardhat=1, ...). Etiketleme için Roboflow
Annotate, CVAT veya Label Studio kullanılabilir; üçü de YOLO export verir.

## 3. Çalıştırma

```bash
pip install requests --break-system-packages
export ROBOFLOW_API_KEY=xxxx          # private key, repoya KOYMA
python eval/baseline_eval.py \
  --images eval/dataset/images \
  --labels eval/dataset/labels \
  --classes eval/dataset/classes.txt \
  --conf 0.35 --iou 0.5
```

Çıktı: sınıf bazında precision / recall / F1 / AP@0.5, genel mAP@0.5 ve iş-kritik
**ihlal tespiti** (NO-Hardhat + NO-Safety Vest + NO-Mask) aggregate'i. Üretimde kullanılan
eşiklerle (conf 0.35, overlap 30) ölçer, böylece rapor gerçek davranışı yansıtır.

## 4. Geçiş noktası veri toplama spec'i

Mostar feedback'i: kamera asıl değeri **geçiş noktalarında** (koğuş, saha girişi,
yemekhane giriş-çıkışı) veriyor. Baseline setini bu senaryoyu temsil edecek şekilde topla.

Hedef ilk set: **≥ 300 görsel**, şu dağılımla:

- Senaryo: %60 geçiş noktası (kapı/turnike önü, tek/çift kişi geçişi), %40 genel saha.
- Çeşitlilik: gündüz/akşam, farklı ışık, baretli + baretsiz, yelekli + yeleksiz karışık.
- Zorluk: kısmi kapanma (occlusion), uzak/küçük figür, kalabalık kare örnekleri dahil.
- Negatif örnek: PPE'siz sahne, sadece araç/makine olan kareler (false-positive ölçümü için).

Etiketleme kuralları:

- Sadece 10 model sınıfını etiketle; baret/yelek **kişi üzerinde** değerlendirilir.
- Baret görünüyorsa `Hardhat`, kafa açıkça baretsizse `NO-Hardhat`. Belirsizse etiketleme.
- Yelek için aynı mantık: `Safety Vest` / `NO-Safety Vest`.
- Her etiketçi aynı kılavuzu kullanmalı; tutarlılık için %10'luk örnekte çift-etiketleme
  yapıp anlaşmazlık oranına bak.

## 5. Başarı kriteri (Sprint 1 KPI)

- Baseline raporu üretilmiş, sayısal mAP@0.5 ve ihlal P/R kayıt altında.
- Hedef (S2 için): baret/yelek ihlal tespiti precision ≥ %90, false-positive < %5.
  Baseline bu hedefin neresinde olduğumuzu gösterecek.

## 6. Event veri modeli

Bkz. `event_schema.json` — S2 (alarm) ve S3 (panel) sprintlerinin temeli. Hem demo hem
canlı analiz aynı şemayı üretmeli ki Supabase `analyses` tablosu ve dashboard tutarlı olsun.
