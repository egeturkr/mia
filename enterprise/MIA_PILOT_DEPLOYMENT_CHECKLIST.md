# MIA Pilot Devreye Alma Kontrol Listesi

Sıra önemlidir — hukuk tamamlanmadan kamera AÇILMAZ.

## 1. Hukuki hazırlık (ZORUNLU ön şart)
- [ ] Müşteri yazılı onayı (kamera görüntüsü AI analizi için)
- [ ] KVKK hukuki dayanak + aydınlatma metni (çalışanlara)
- [ ] Saha bildirim panoları ("AI destekli kamera analizi yapılmaktadır")
- [ ] Pilot sözleşmesi/protokolü imzalı

## 2. Hesap ve platform
- [ ] Organizasyon hesabı + owner daveti
- [ ] Saha kaydı (organization_sites)
- [ ] Plan aktivasyonu (manuel billing runbook)
- [ ] Supabase schema güncel (Blok 17 dahil)

## 3. Kamera ve ağ
- [ ] Kamera listesi (model, IP, RTSP yolu, konum)
- [ ] Ağ erişim kararı: sahada mini PC (önerilen) / VPN'li bulut VM
- [ ] RTSP test: worker host'unda `ffplay` ile görüntü doğrulandı
- [ ] Kameralar panelden eklendi (maskeli adres), ID'ler toplandı

## 4. Worker kurulumu
- [ ] Worker host hazır (Python 3.10+, requirements kurulu)
- [ ] `.env` dolduruldu (config.example.env'den) — Roboflow/model anahtarı dahil
- [ ] `cameras.json` (id → gerçek RTSP; YALNIZ worker host'unda)
- [ ] KKD profili panelden seçildi (vars. baret+yelek)
- [ ] `python main.py --config cameras.json` test çalıştırması

## 5. Doğrulama
- [ ] Panel "Uçtan Uca Hazırlık" 5 adım ✓
- [ ] Heartbeat + model sürümü + gecikme görünüyor
- [ ] Gerçek test tespiti olay olarak düştü (test akışı/webcam ile)
- [ ] /events raporunda "Canlı Kamera" etiketiyle görünüyor
- [ ] CSV/PDF dışa aktarma çalışıyor

## 6. Pilot işletimi
- [ ] İlk 2 hafta = kalibrasyon (müşteriye açıkça söylendi)
- [ ] Yanlış pozitif inceleme rutini (safety_manager "yok say" akışı)
- [ ] Eval verisi toplama başladı (MIA_PPE_MODEL_EVALUATION_PLAN.md)
- [ ] Haftalık pilot raporu (pilot modülü)
- [ ] Pilot sonu: başarı kriterleri raporu + go/no-go (MIA_PILOT_SUCCESS_CRITERIA.md)
