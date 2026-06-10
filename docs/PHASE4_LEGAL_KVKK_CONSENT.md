# Faz 4 — Hukuk, KVKK, Rıza & Veri Yönetişimi Sertleştirme

> **Bu doküman hukuki tavsiye değildir.** MIA ekibi tarafından operasyonel hazırlık amacıyla
> hazırlanmıştır. Pilot kullanımdan önce yetkili hukuk danışmanı tarafından incelenmeli ve
> onaylanmalıdır. **MIA tam KVKK uyumu iddia etmemektedir.**

## Ne uygulandı

| Bileşen | Durum |
|---|---|
| Rıza türleri (8) + sürümlü kayıt | `js/legal.js` VERSIONS + DOC_REGISTRY; consents tablosuna lang/pilot_id/metadata kolonları (geri uyumlu fallback'li) |
| Detector rıza kapısı | Canlı analizde KVKK + görüntü işleme + sınır ötesi + AI feragatnamesi tek modalda; kabul edilmişse gösterilmez; demo modu muaf |
| Pilot hukuki hazırlık | `pilot_legal_reviews` tablosu + pilot detayında durum paneli; onaysızken "video TOPLAMAYIN" uyarısı; onay yalnızca elle |
| Pilot checklist genişletmesi | +3 madde: çalışan bilgilendirme, sınır ötesi gözden geçirme, saklama anlaşması (eski pilotlara otomatik eklenir) |
| Veri talepleri | `data_subject_requests` + hesap sayfasında talep formu/listesi; rıza dışa aktarımı anında JSON indirir; işleme MANUEL |
| Doküman sürüm kaydı | `legal_document_versions` tablosu (public read, service yazar) + JS registry — ikisi senkron tutulur |
| Alt-işleyen kaydı | docs/SUBPROCESSORS_DRAFT.md + legal-readiness sayfasında özet — hiçbir DPA imzalı değil |
| Saklama politikası | docs/DATA_RETENTION_POLICY_DRAFT.md + sayfada özet; otomatik silme yalnız api_usage (60g, zaten canlıydı) |
| İç durum sayfası | `legal-readiness.html` (giriş zorunlu): sürümler, kabuller, alt-işleyenler, saklama, pilotlar, açık talepler, hukukçu bekleyenler |
| PDF feragatnameleri | Zaten canlıydı (Faz 2 hardening) — değiştirilmedi, çift eklenmedi |

## Rıza türleri ve sürümler (v1.0, 2026-06-10)

`terms`, `privacy`, `kvkk`, `image_processing`, `cross_border`, `ai_disclaimer`,
`pilot_site_notice`, `data_retention`. Kayıt alanları: user_id/email/subject, document_key,
version, lang, page, user_agent, pilot_id (ops.), metadata (ops.), accepted_at.
Ham IP saklanmaz (bilinçli — sunucu tarafı ip-hash yalnızca api_usage'da).

## Akışlar

**İlk canlı analiz:** Detector → Analizi Başlat (Canlı AI) → 4 rıza geçerli sürümde kayıtlı değilse
modal → tek onayla 4 kayıt consents'e düşer → analiz başlar. Sonraki analizlerde modal çıkmaz.
Demo modu rıza istemez (görüntü hiçbir sunucuya gitmez).

**Pilot hukuki hazırlık:** Pilot detayı → Hukuki Hazırlık paneli → durum: Başlanmadı → Devam Ediyor →
İncelemeye Hazır → (gerçek hukukçu onayıyla) Onaylı. Onaylı değilken kırmızı "video toplamayın" uyarısı
görünür. Sistem onay ÜRETMEZ; teknik engelleme yoktur (bilinçli), güçlü uyarı vardır.

**Veri talebi:** Hesap → Veri Talepleri → tür + detay → gönder → ekip Supabase'den manuel inceler
(under_review → completed/rejected). Hedef 30 gün. consent_export anında JSON da indirir.

## Saha videosu toplanmadan ÖNCE tamamlanması zorunlu

1. Hukukçu onayı: KVKK metinleri, rıza dayanağı, pilot sözleşmesi, saha afişi, işveren onayı.
2. Roboflow + Modal DPA'ları.
3. VERBİS değerlendirmesi.
4. Pilot hukuki hazırlık durumunun "Hukukçu Onayladı" yapılması.

## Hâlâ hukukçu gerektiren açık maddeler

legal-readiness.html'deki liste geçerli: metin onayları, işleme dayanağı, VERBİS, DPA'lar,
sınır ötesi mekanizma, ihlal bildirimi prosedürü, saklama resmileştirmesi. **Hiçbiri kapanmadı.**

## Rollback

`git revert <commit>` — yeni tablolar kullanılmadan kalır (zararsız); tam temizlik:
`drop table pilot_legal_reviews, data_subject_requests, legal_document_versions;`
ve consents'ten: `alter table consents drop column lang, drop column pilot_id, drop column metadata;`
legal.js fallback'i sayesinde kolon silinse bile rıza kaydı çalışmaya devam eder.
