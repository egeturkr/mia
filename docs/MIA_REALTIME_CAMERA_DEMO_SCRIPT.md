# MIA Canlı Kamera Demo Script'i (iç kullanım — inşaat firmasına sunum)

Süre: ~15 dk. Ton: profesyonel, dürüst, kurumsal. ASLA: sahte tespit gösterme,
"7/24 izliyoruz" deme, desteklenmeyen KKD'yi çalışıyor gibi anlatma.

## Hazırlık (demo öncesi, 10 dk)
1. Worker'ı test akışıyla başlat (kendi makinende/mini PC'de):
   `cd workers/realtime-camera-worker && python main.py --config cameras.json`
   (cameras.json: `"<kamera-id>": "test:./ornek-santiye.mp4"` veya `"webcam:0"`)
2. cameras.html → "Uçtan Uca Hazırlık" panelinde 5 adımın ✓ olduğunu doğrula.
3. Demo org'unda 1-2 GERÇEK analiz ve birkaç gerçek kamera olayı bulunsun. Sahte veri ASLA.

## Akış
1. **Aç** (web veya masaüstü uygulama): "Aynı platform web, Windows, macOS, mobil — tek hesap."
2. **Dashboard**: gerçek analiz özeti, risk dağılımı. "Bunlar yüklenen videolardan gerçek AI sonuçları."
3. **Canlı Kamera paneli**: kamera ızgarası + sağlık durumu. Hazırlık panelini göster:
   "Sistem durumunu sizden saklamayız — worker kopuksa panel bunu açıkça söyler."
4. **KKD Profili**: "Ne taranacağını SİZ seçersiniz." Toggle'ları göster.
5. **Dürüstlük anı (güven kazandırır)**: "Bugün baret ve yelek tespiti destekleniyor; maske deneysel.
   Eldiven, kemer, gözlük model eğitimi gerektiriyor — yol haritamızda. Yapamadığımızı
   yapıyormuş gibi göstermeyiz; kilitli görüyorsunuz."
6. **Canlı tespit**: test akışında baretsiz kare → 1 dk içinde olay tablosuna düşer.
   "Demo modundayız (etiketi görüyorsunuz); sahanızda aynı zincir kendi kameranızla çalışır."
7. **Worker sağlığı**: son sinyal, son kare zamanı. "Aynı kamera+ihlal 60 sn'de tek olay —
   spam yok. Yüksek riskte 5 dk'da en çok 1 e-posta."
8. **İnceleme**: olayı "İncelendi/Yok say" işaretle. "İSG uzmanınız son karar verici — AI ön değerlendirmedir."
9. **İhlal Raporu**: kaynak etiketleri (Canlı Kamera / Yüklenen Video) → CSV ve PDF indir.
10. **KVKK/kanıt**: "Görüntü karelerini SAKLAMIYORUZ — olaylar metadata. Kayıt isterseniz:
    onayınız, çalışan aydınlatması ve saklama politikasıyla, hukuk onayından sonra açılır."
11. **Kurulum**: "Sahanıza mini PC veya buluta worker kurarız; kameralarınızın şifresi yalnız
    o cihazda kalır — bizim sunucularımıza, panele, hiçbir yere gitmez."
12. **Kapanış**: "2 haftalık kalibrasyonlu pilot öneriyoruz: doğruluğu SAHANIZDA ölçer,
    raporla birlikte sunarız. SLA ve 7/24 izleme taahhüdü pilot sonrası konuşulur."

## Sorulara hazır cevaplar
- "Doğruluk kaç?" → "Saha doğrulaması yapılmadan rakam vermiyoruz; pilotta birlikte ölçeriz."
- "Canlı video izleyebilir miyim?" → "Bilinçli olarak yok — gizlilik ve maliyet. Olay+durum gösteriyoruz."
- "Yanlış alarm olur mu?" → "İlk haftalarda olabilir; 'yok say' ile işaretlersiniz, eşikleri kalibre ederiz."
