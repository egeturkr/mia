# Faz 3 — Ücretli Pilot Modu

Amaç: MIA'yı gerçek bir inşaat firmasıyla **ücretli 4 haftalık pilot** çalıştırabilir hale getirmek.
Pilot, mevcut analiz sisteminin ÜZERİNDE bir operasyon katmanıdır — ikinci bir analiz sistemi değildir.

## Teklif

| | |
|---|---|
| Bedel | **₺25.000** (tek seferlik; aboneliğe dönüşümde ilk yıl faturasından düşülür) |
| Süre | 4 hafta |
| Kapsam | Tek şantiye, 2–3 geçiş noktası |
| İçerik | Yüklenen video analizi · haftalık güvenlik raporu · AI doğrulama desteği · gerekirse insan incelemesi |
| Çıktı | 4 haftalık rapor + kapanış ROI sunumu + abonelik teklifi |

Bedava pilot VERİLMEZ — bedava pilot, müşteri tarafında öncelik almayan pilottur.

## 4 haftalık yapı

| Hafta | İş |
|---|---|
| 0 (ön) | Sözleşme + KVKK paketi (bkz. PILOT_LEGAL_CHECKLIST.md). İmzasız/asılmamış aydınlatma ile video çekilmez. |
| 1 | Onboarding: saha keşfi, geçiş noktası seçimi, çekim protokolü eğitimi (PILOT_VIDEO_COLLECTION_PROTOCOL.md), hesap + panel eğitimi (1 saat). |
| 2–3 | Günlük video → detector ile analiz → analizleri pilota bağla → cuma günü haftalık rapor. İlk hafta her video insan tarafından doğrulanır (FP ayıklama + eval verisi). |
| 4 | Kapanış: ROI raporu genel müdüre sunulur, abonelik teklifi masaya konur. |

## Operasyon akışı (pilot.html)

1. **Pilot oluştur** → kontrol listesi (9 madde) otomatik açılır.
2. **Kontrol listesini tamamla** → sözleşme, KVKK, saha afişi, işveren onayı, protokol, saha sorumlusu, rapor takvimi, AI doğrulama, kapanış toplantısı.
3. **Videolar detector'dan analiz edilir** (mevcut akış — değişmedi).
4. **Analizleri pilota bağla** (Bağlı Analizler bölümü) → metrikler otomatik hesaplanır.
5. **Haftalık rapor**: "Bağlı analizlerden doldur" → notları ekle → kaydet → "Raporu Kopyala" ile müşteriye gönder.
6. **Durumu ilerlet**: Taslak → Teklif → Aktif → Tamamlandı → **Dönüştü** / Kaybedildi.

## Başarı metrikleri ve ROI

Bkz. PILOT_SUCCESS_METRICS.md. Kapanış sunumunun iskeleti: 4 haftalık ihlal trendi,
en riskli nokta/saat, ölçülmüş AI doğruluğu (eval koşusu), raporlama süresi tasarrufu,
ceza/kaza riski anlatısı. Sayılar yalnızca gerçek pilot verisinden gelir.

## Dönüşüm süreci

1. Hafta 4 başında kapanış toplantısı GM ile planlanır (İSG müdürüyle değil).
2. ROI sunumu + 12 aylık Kamera AI (₺12.000/ay) teklifi; pilot bedeli ilk yıldan düşülür.
3. Dönüşümde pilot durumu **converted** yapılır, vaka çalışması yazımı başlar, 3 tanıştırma istenir.
4. Dönüşmezse **lost** + kayıp nedeni notlara işlenir.

## Sınırlar (dürüst)

- Bu bir İÇ operasyon aracıdır; müşteri pilot.html'i görmez.
- Sözleşme/KVKK şablonları hukukçu onayı GEREKTİRİR — bu doküman hukuki danışmanlık değildir.
- Faturalama manueldir (Faz 6'ya kadar): banka havalesi + e-fatura.
- Organizasyon hesapları yoktur (Faz 5): pilot verisi, pilotu yöneten MIA kullanıcısının hesabına bağlıdır.
