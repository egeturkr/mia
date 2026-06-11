# Go-Live Test Planı (canlıda elle koşulacak — ~45 dk)

Önkoşul: son deploy + schema.sql koşulmuş + 2 test hesabı (A=senin hesabın/crm_admin, B=temiz hesap).
Her satır işaretlenir; ❌ çıkarsa OPS_RUNBOOK'a bak. Koşu tarihi/sonucu en alta yazılır.

## A. Auth (B hesabıyla)
[ ] Kayıt → doğrulama e-postası → link → giriş [ ] Çıkış → korumalı sayfa (dashboard) girişe atar
[ ] Şifre sıfırlama uçtan uca [ ] Girişte konsol: "Kişisel organizasyon oluşturuldu"

## B. Çekirdek AI (A hesabı, Canlı AI)
[ ] detector yüklenir, mod "Canlı AI" [ ] İLK analizde rıza modalı; onay sonrası bir daha çıkmaz
[ ] .txt yükleme reddi (tür) · 10dk+ video reddi (süre) [ ] Kısa şantiye videosu → analiz → tespitler/0-tespit mesajı net
[ ] Dashboard'da yeni kayıt + İhlal Raporu'nda olaylar [ ] Konsolda analysis_started/completed logları

## C. Raporlama (A)
[ ] PDF: Rapor ID + AI&Metodoloji ("henüz yayınlanmamıştır") + Öneriler + tek disclaimer + Bütünlük bloğu
[ ] CSV iner, Model kolonu var [ ] Paylaş → linki gizli pencerede aç (girişsiz görünür + kamusal uyarı)
[ ] Sil → dashboard+ihlal raporundan düşer, paylaşım linki ölür [ ] Supabase report_exports'ta pdf/csv/shared_link satırları

## D. Org/RBAC (A davet eder, B kabul eder)
[ ] Davet linki → B yanlış e-postayla hata, doğru e-postayla katılır [ ] B=viewer: detector butonu kilitli; konsoldan insert → RLS reddi; silme butonları görünmez
[ ] B=safety_manager'a yükselt: analiz çalıştırabilir [ ] B'yi çıkar: org verisini artık görmez
[ ] B kendi hesabından A'nın org/analiz/CRM verisini GÖREMEZ (izolasyon)

## E. Pilot + CRM (A)
[ ] Pilot oluştur → 12 maddelik checklist → hukuki panelde kırmızı "video toplamayın" uyarısı (onaysızken)
[ ] Analiz bağla → metrikler dolar → haftalık rapor ("analizlerden doldur") → Raporu Kopyala
[ ] Ödeme durumu kaydet → payment_records satırı [ ] customers: firma+kişi+fırsat+görüşme+görev → tamamla → pilot bağla
[ ] Gelen demo talebi paneli görünür (A=crm_admin) → dönüştürme çalışır

## F. Billing + Güvenlik + İzleme
[ ] hesap: plan/kullanım/"Bu ay X/150 AI çağrısı" [ ] Planı Seç → niyet kaydı mesajı (sahte başarı YOK)
[ ] Girişsiz `curl -X POST https://miaissagligi.com/api/detect` → 401 [ ] Yanlış secret'la billing-webhook → 401
[ ] Konsolda CSP hatası yok; PDF/grafik/QR/tema/dil (TR/EN/ES) çalışır
[ ] /api/health → healthy + billing **manual** (MIA_BILLING_SECRET eklendikten sonra) [ ] /ops → A'da dolu, B'de "erişim yok"

## Koşu kaydı
| Tarih | Koşan | Sonuç | Notlar |
|---|---|---|---|
| — | — | — | Henüz koşulmadı |
