# MIA Güvenlik ve Gizlilik Genel Bakış (müşteri sorularına hazır)

## Mimari ilkeler
- **Kamera şifreleri MIA'ya gelmez.** RTSP kimlik bilgileri yalnız müşteri
  onaylı worker cihazında (sahadaki mini PC / özel VM) yerel dosyada durur;
  veritabanına, panele, uygulamalara asla yazılmaz. Panelde yalnız maskeli adres görünür.
- **Görüntü saklanmaz.** Olaylar metadata'dır (zaman, kamera, tespit sınıfı,
  güven, model sürümü). Snapshot saklama ancak müşteri onayı + KVKK dayanağı +
  saklama/silme politikası + özel bucket + imzalı URL ile, ayrı projeyle açılır.
- **Worker tabanlı izole işleme.** Video akışı internetten paneline değil,
  worker cihazından AI servisine kare-kare gider; panel yalnız olay kayıtlarını okur.

## Erişim kontrolü
Organizasyon bazlı izolasyon (Postgres RLS — satır seviyesinde) · roller:
owner/admin (yönetim), safety_manager (olay inceleme), viewer (salt okuma) ·
olay INSERT yalnız sunucu anahtarıyla (worker) — kullanıcılar olay üretemez/değiştiremez
(inceleme durumu hariç) · tüm sayfalar kimlik doğrulamalı, paylaşım linkleri tokenli.

## Uygulama güvenliği
Masaüstü/mobil uygulamalar canlı platformun güvenli kabuğudur: hiçbir API
anahtarı/şifre içermez ve saklamaz; yalnız miaissagligi.com'a gezinir; dış
linkler sistem tarayıcısında açılır. Yükleyiciler imza + SHA256 + malware
taraması tamamlanmadan yayınlanmaz (docs/MIA_APP_DOWNLOAD_SECURITY_STATEMENT.md).

## Altyapı
Statik frontend (Netlify, CSP/security header'lar) · Supabase (AB bölgesi
Postgres, RLS) · sunucu fonksiyonları fail-closed (eksik yapılandırmada işlem
reddedilir) · loglar kimlik bilgisi maskeler · izleme: /api/health + olay/hata kayıtları.

## KVKK
Çalışan görüntüsü işleme ancak: işveren onayı + aydınlatma + saha bildirimi +
hukuki dayanak sonrası. Veri sahibi talepleri (erişim/silme) platformda
(dogrulama/veri talep akışı). Pilot öncesi hukuk incelemesi zorunlu tutulur —
MIA bu adımı atlayarak kurulum YAPMAZ.

## Dürüst sınırlar
Henüz: bağımsız güvenlik denetimi/pentest raporu yok · ISO 27001/SOC2 yok ·
7/24 SLA yok. Bunlar kurumsal sözleşme aşamasında yol haritası olarak konuşulur.
