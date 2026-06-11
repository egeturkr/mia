# MIA Uygulama İndirme Güvenlik Beyanı

*Müşterilere ve kullanıcılara açık resmi beyan — download sayfası ve satış
görüşmelerinde bu dilin dışına çıkılmaz.*

## Uygulamalarımız ne saklar, ne saklamaz
MIA masaüstü (Windows/macOS/Linux) ve mobil (Android/iOS) uygulamaları, canlı
MIA platformunu güvenli bir kabukta açar. Bu uygulamalar **hiçbir kamera
şifresi (RTSP), API anahtarı veya sunucu gizli bilgisi içermez ve saklamaz.**
Kamera erişim bilgileri yalnızca müşterinin onayladığı, sahada veya müşteriye
özel ortamda çalışan MIA worker cihazında durur.

## Yükleyici yayın politikamız
Hiçbir kurulum dosyası şu adımlar tamamlanmadan kamuya yayınlanmaz:
1. **Kod imzalama** (Windows Authenticode / macOS Developer ID + notarization / Android keystore)
2. **SHA256 checksum** üretimi ve yayını (bütünlük doğrulaması için)
3. **Kötü amaçlı yazılım taraması** (bağımsız tarama hizmetiyle)
4. **Sürüm incelemesi** ve sürüm notları

Mevcut masaüstü/mobil sürümler (0.1.0-pilot) **kurum içi pilot adayıdır** —
"doğrulanmış" olarak işaretlenmedikçe kamuya açık değildir ve kurumsal
müşterilere kontrollü olarak sağlanır.

## Dürüstlük notu
Taranmamış hiçbir dosya için "virüssüz" ifadesi kullanmayız. Kaynak kodumuz ve
yapılandırmamız güvenli olacak şekilde tasarlanmıştır; ancak her sürüm dosyası
ayrıca imzalanıp taranmadan güvenlik iddiası yapılmaz.

## Kullanıcılar için
- Uygulamaları yalnızca resmi alan adından indirin: **miaissagligi.com**
- İndirme sonrası SHA256 değerini yayınlanan checksum ile karşılaştırın.
- E-posta/mesajla gelen "MIA yükleyicisi" eklerine itibar etmeyin — biz
  yükleyiciyi e-posta ekiyle göndermeyiz.
- Şüpheli dosya için: info@miaissagligi.com
