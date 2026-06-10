# Raporlama Runbook (MIA ekibi içi)

**Rapor üretme:** Dashboard → analiz kartı → PDF (kaydedilmiş analiz, tam meta) veya
Detector → sonuç ekranı → PDF Raporu (anlık analiz). Her yeni PDF'te Rapor ID + üretim zamanı +
bütünlük kodu otomatik.

**Paylaşma:** Dashboard → Paylaş → link panoya (`rapor.html?t=...`). Link, BİLEN HERKESE açıktır —
müşteriye bunu söyle. Export geçmişine `shared_link` olarak düşer.

**Paylaşımı iptal:** Kullanıcı analizi siler; ekip tarafı: Supabase → analyses → `share_token = null`.

**Rapor metasını doğrulama:** PDF altındaki Rapor ID'yi Supabase → `report_exports`'ta ara →
metadata'daki hash PDF'tekiyle eşleşmeli. Eşleşmiyorsa rapor üretiminden sonra değiştirilmiş olabilir.

**Müşteriye sınırları anlatma (3 cümle):** "Rapor AI destekli ön değerlendirmedir; sertifikalı İSG
denetiminin yerine geçmez. Analiz örneklenen karelere dayanır; kısa olaylar kaçabilir. Doğruluk
sayısını ancak sahanızda ölçtükten sonra söyleriz — şu an doğrulama [yayınlanmadı/ölçüldü: X]."

**Eski raporlar:** Faz 9 öncesi PDF'lerde ID/hash yoktur; aynı analizden PDF'i yeniden üretmek
yeterlidir (yeni ID alır; eski PDF "legacy" sayılır).

**İSG incelemesi için CSV:** İhlal Raporu → filtrele → CSV. Kolonlar: tarih, analiz, zaman, ihlal,
KKD, risk, güven, model. Boş alan = veri yok (asla doldurulmaz).

**Export geçmişi inceleme:** Supabase → `report_exports` (kim, ne zaman, hangi tür, hangi analiz).
