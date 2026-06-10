# Pilot Hukuki Kontrol Listesi (OPERASYONEL — HUKUKİ DANIŞMANLIK DEĞİLDİR)

> ⚠️ **Bu doküman bir hukuki sözleşme veya hukuki danışmanlık değildir.** Aşağıdaki tüm metinler
> ve süreçler, pilota başlamadan önce bir **hukuk danışmanı tarafından incelenip onaylanmalıdır.**
> Bu liste yalnızca "neyin hazır olması gerektiğini" takip eden operasyonel bir kontrol listesidir.

## Pilot başlamadan önce hazır olması gerekenler

| # | Madde | Sorumlu | Hukukçu onayı |
|---|---|---|---|
| 1 | **Pilot sözleşmesi** — kapsam, bedel (₺25.000), süre, veri işleme rolleri (veri sorumlusu = müşteri işveren, veri işleyen = MIA), sorumluluk sınırı, fesih | MIA + müşteri | GEREKLİ |
| 2 | **KVKK aydınlatma metni** — işlenen veri (çalışan görüntüsü), amaç (İSG/KKD analizi), hukuki dayanak, saklama süresi, haklar | MIA hazırlar, müşteri yayınlar | GEREKLİ |
| 3 | **Açık işleme rızası / hukuki dayanak değerlendirmesi** — çalışan görüntüsü işlemenin dayanağı (açık rıza mı, işverenin meşru menfaati/İSG yükümlülüğü mü) hukukçuyla netleştirilir | Hukukçu | GEREKLİ |
| 4 | **İşveren veri işleme onayı** — müşterinin, sahasında video toplanıp MIA'ya aktarılmasına yazılı onayı | Müşteri imzalar | GEREKLİ |
| 5 | **Çalışan bilgilendirme afişi** — geçiş noktalarına asılır: "Bu alanda İSG amaçlı görüntü analizi yapılmaktadır" + iletişim | Saha sorumlusu asar | Şablon onayı GEREKLİ |
| 6 | **Sınır ötesi aktarım açıklaması** — görüntüler Roboflow/Modal (ABD) altyapısında işlenir; aydınlatma metninde açıkça belirtilir, aktarım mekanizması hukukçuyla teyit edilir | MIA | GEREKLİ |
| 7 | **Veri saklama taahhüdü** — pilot verisinin saklama süresi (öneri: pilot bitişi + 90 gün) ve silme prosedürü yazılı | MIA | GEREKLİ |
| 8 | **AI destekli analiz feragatnamesi** — tüm raporlarda mevcut (Faz 2 hardening): "AI destekli ön değerlendirme; sertifikalı İSG denetiminin yerine geçmez" | MIA (canlı) | Mevcut metnin onayı |

## Platformda zaten canlı olan altyapı

- Sürümlü rıza kayıt sistemi (`consents` tablosu — kabul + zaman damgası + doküman sürümü, append-only audit trail).
- Görüntü işleme + sınır ötesi aktarım rıza modalı (analiz başlamadan, js/legal.js).
- Tüm rapor ve çıktılarında AI feragatnamesi.
- KVKK / Gizlilik / Kullanım Şartları sayfaları (üzerlerinde "hukuk danışmanı incelemesi gerekir" notu mevcuttur — bu inceleme hâlâ YAPILMADI).

## Açık hukuki borçlar (pilot öncesi kapatılmalı)

1. VERBİS kayıt yükümlülüğü değerlendirmesi (veri sorumlusu/işleyen sıfatları).
2. Roboflow ve Modal ile veri işleme sözleşmeleri (DPA) — mevcut değil.
3. Tüm şablonların (1–8) hukukçu imzası.
4. Veri ihlali bildirim prosedürü (72 saat) taslağı.
