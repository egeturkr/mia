# Faz 9 — Rapor Kalitesi, Güven & Doğrulanabilirlik

## Ne değişti
- **js/report-meta.js (yeni):** Rapor ID üretimi (`MIA-RPT-YYYYMMDD-XXXXXX`, crypto-random),
  SHA-256 bütünlük hash'i (crypto.subtle, ilk 16 hex; desteklenmeyen ortamda dürüstçe null),
  model/doğrulama bilgisi (validation_latest.json'dan — **sayı asla uydurulmaz**), export logu.
- **Ana PDF (app.js — dashboard + paylaşılan rapor):** Rapor ID başlıkta · "AI & Metodoloji"
  bölümü (model, sürüm, doğrulama durumu, sınırlar) · "Önerilen Aksiyonlar" (4 pratik, jenerik
  madde — saha verisi iddiası yok) · Rapor bütünlüğü bloğu (ID + üretim zamanı + hash + paylaşım
  uyarısı) · disclaimer TEK kez (mevcut Faz 2 bloğu korundu, çoğaltılmadı).
- **Detector PDF:** Rapor ID + model satırı (canlı/DEMO ayrımı dahil) + doğrulama satırı.
- **rapor.html (paylaşılan):** model + doğrulama durumu satırı; kamusal-link uyarısı (Faz 7) korunur;
  özel org/CRM/pilot/billing verisi paylaşılan sayfaya GİRMEZ (yalnız analiz satırı render edilir).
- **CSV (events.js):** "Model" kolonu (rf-27) + export logu. Mevcut kolonlar değişmedi.
- **Pilot haftalık şablonu:** Pilot ID + Rapor ID + AI doğrulama durumu satırı.
- **report_exports tablosu:** pdf/csv/shared_link/json olayları; report_id + hash + model
  metadata'da. RLS: okuma kendi/org; yazma kendi adına. (Ayrı `analysis_reports` tablosu yerine
  bilinçli sadelik — analyses akışına dokunulmadı.)

## Dürüstlük kuralları
Doğrulama "pending" iken her rapor şunu yazar: *"Bu model için saha verisiyle ölçülmüş doğrulama
sonucu henüz yayınlanmamıştır."* Ölçüm yapılınca (Faz 2 koşusu) otomatik olarak ölçülen mAP görünür.
Bilinmeyen alanlar "bilinmiyor/—" gösterilir. Hash yasal onaylı imza DEĞİLDİR — değişiklik tespiti
için pratik bütünlük kodudur. Eski raporlar: "Eski rapor — bütünlük metaverisi mevcut değil."

## Sınırlar / kalan riskler
Eski analizlerin raporlarında ID/hash yok (yeniden üretilince alır) · pdf_base64 legacy depolama
sürüyor (Storage migration'ı gelecek işi) · tam değiştirilemez audit log yok · org/saha adı PDF'te
yalnız mevcutsa görünür (org bağlamı yoksa boş) · ölçülmüş doğrulama hâlâ Mostar verisi bekliyor.

## Rollback
`git revert <commit>` — report-meta.js bağımsız; tüm çağrılar `window.MIAReport &&` korumalı,
yokluğunda eski davranış birebir döner. report_exports tablosu zararsız kalır.
