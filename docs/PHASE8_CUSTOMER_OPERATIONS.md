# Faz 8 — Müşteri Operasyonları / İç CRM

Amaç: 60 hedef → 24 keşif → 12 demo → 5-6 ücretli pilot → 2-3 müşteri hattını takip eden
hafif iç araç. Salesforce DEĞİL; "ne oldu, sırada ne var"ı unutturmayan minimum sistem.

## Tablolar (RLS: okuma=sahip/org üyesi · yazma=sahip/org owner-admin · görüşme notu=+safety_manager · viewer salt okuma)
`customer_accounts` (firma+durum+öncelik+kaynak+pilot bağı) · `customer_contacts` (karar vericiler)
· `sales_opportunities` (aşama+beklenen değer+kapanış) · `customer_interactions` (görüşme günlüğü)
· `sales_tasks` (takipler) · `case_study_candidates` (vaka izni takibi) · `crm_admins`
(gelen demo taleplerini okuyabilenler — service_role yönetir, dennizoge@gmail.com tohumlu).

## Durum tanımları
**Firma:** target (listede) → contacted (ilk temas) → discovery_scheduled/completed (keşif) →
demo_sent (kişisel analiz raporu gönderildi) → pilot_proposed → pilot_active → **customer** / lost.
**Fırsat:** lead → discovery → demo → pilot_proposed → paid_pilot → negotiation → won/lost.
**Vaka:** not_started → candidate → permission_requested → approved → published / rejected.
Otomatik yayın YOK — müşteri izni olmadan isim/logo/rakam kullanılmaz.

## Akışlar (customers.html)
1. **Hedef ekle:** + Hedef Firma → ad/segment/şehir/kaynak/öncelik.
2. **Keşif logu:** firma detayı → Görüşme Günlüğü → tür+özet+sonraki aksiyon+takip tarihi.
3. **Fırsat:** detayda Fırsatlar → "4 haftalık pilot", ₺25.000, aşama, kapanış tarihi.
4. **Takip:** Takip Görevleri → görev+tarih; ana sayfada "Açık Takipler" (geciken filtresi).
5. **Pilot bağı:** detayda "Pilota bağla" → pilot durumu+ödeme durumu görünür (pilot modu yeniden yazılmadı).
6. **Gelen talep dönüştürme:** crm_admin isen "Gelen Demo Talepleri" paneli → Firmaya Dönüştür
   (source=inbound, kişi otomatik eklenir, orijinal demo_request SİLİNMEZ, id metadata'da).
7. **Vaka hazırlığı:** detayda durum+başlık+metrikler — yalnız izin takibi, yayın aracı değil.

## Pilot/Billing entegrasyonu
Pilot: linked_pilot_id ile hafif bağ; pilot durum+payment_status müşteri kartında okunur (salt okuma).
Billing: pilot ödeme durumu üzerinden; abonelik detayları hesap sayfasında kalır (çift yönetim yok).

## Yapmadıkları (bilinçli)
E-posta kampanyası/otomasyonu yok · analitik pano yok (7 sayaç kartı var) · dış CRM entegrasyonu yok
· veri kalitesi manuel girişe bağlı · müşteri tarafı görmez (iç araç, noindex, giriş zorunlu).

## Rollback
`git revert <commit>`; tablolar zararsız kalır. Tam temizlik: case_study_candidates, sales_tasks,
customer_interactions, sales_opportunities, customer_contacts, customer_accounts, crm_admins drop +
demo_requests'teki "crm admins read" politikasını kaldır.
