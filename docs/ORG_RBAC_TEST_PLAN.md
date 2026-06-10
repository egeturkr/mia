# Org / RBAC Test Planı

Staging'de (veya ikinci tarayıcı profilleriyle canlıda) koşulacak elle test seti.
Önkoşul: `supabase/schema.sql` çalıştırıldı; 3 test hesabı: A (kurucu), B (davetli), C (yabancı).

## 1. Legacy regresyon (A — mevcut hesap)

| # | Test | Beklenen |
|---|---|---|
| 1.1 | Giriş/çıkış, dil, tema | Değişiklik yok |
| 1.2 | Dashboard | Eski analizler aynen görünür (org_id NULL satırlar user_id fallback'i) |
| 1.3 | Detector canlı analiz → kaydet | Yeni satır org_id'li; dashboard + ihlal raporunda görünür |
| 1.4 | PDF / CSV / paylaş / sil | Çalışır |
| 1.5 | QR tarama, pilot sayfası, hesap sayfası, rıza modalı | Çalışır |
| 1.6 | İlk girişte konsol | "Kişisel organizasyon oluşturuldu" logu; organization.html'de org görünür |

## 2. Davet / üyelik

| # | Test | Beklenen |
|---|---|---|
| 2.1 | A → organization.html → B'yi `safety_manager` davet et | Link panoya kopyalanır, davet "Bekliyor" |
| 2.2 | B (girişsiz) linki açar | "Önce giriş yap" + doğru next yönlendirmesi |
| 2.3 | B farklı e-postayla giriş yapıp linki açar | `email_mismatch` hatası |
| 2.4 | B doğru e-postayla kabul eder | "Ekibe katıldın", üye listesinde görünür, davet "Kabul edildi" |
| 2.5 | A daveti iptal eder (yeni davet) → kabul denenir | `not_pending` |
| 2.6 | Expired test: expires_at'i geçmişe çek (SQL) → kabul | `expired` |

## 3. Rol yetkileri (RLS — UI atlatılarak da denenecek: konsoldan supabase.from çağrısı)

| # | Rol | Test | Beklenen |
|---|---|---|---|
| 3.1 | safety_manager (B) | Org'lu analiz görüntüleme | Görür (dashboard A'nın org analizlerini gösterir) |
| 3.2 | B | Canlı analiz çalıştır + kaydet | Başarılı (insert politikası staff'a açık) |
| 3.3 | B | A'nın analizini silme (konsoldan delete) | RLS reddeder (0 satır etkilenir) |
| 3.4 | B | Üye davet (konsoldan invitations insert) | RLS reddeder |
| 3.5 | viewer (B rolü düşürülür) | Analiz başlat | UI: buton kilitli; konsoldan insert → RLS reddeder |
| 3.6 | viewer | Dashboard/ihlal raporu görüntüleme | Görür; silme butonları görünmez |
| 3.7 | admin (B yükseltilir) | Pilot oluştur/yönet, üye davet (İSG/izleyici) | Başarılı |
| 3.8 | admin | Owner'ın rolünü değiştirme/çıkarma (konsoldan update) | RLS reddeder |
| 3.9 | A (owner) | B'yi çıkar (status=removed) | B dashboard'da org verisini artık GÖREMEZ |

## 4. İzolasyon

| # | Test | Beklenen |
|---|---|---|
| 4.1 | C (yabancı) konsoldan `organizations`, `analyses` (A'nın org_id'siyle or filtresi) okur | 0 satır |
| 4.2 | C, A'nın davet token'ını tahmin edemez; rastgele token RPC | `invalid_token` |
| 4.3 | C kendi kişisel org'unu görür, A'nınkini görmez | ✓ |

## 5. Çoklu org

| # | Test | Beklenen |
|---|---|---|
| 5.1 | B iki org'a üye → organization.html'de seçici görünür | ✓ |
| 5.2 | Org değiştir → dashboard verisi değişir | Seçilen org + kendi legacy verisi |

Kayıt: her koşuda tarih + sonuç bu dosyanın altına işlenir.

## Koşu kaydı

| Tarih | Koşan | Sonuç | Not |
|---|---|---|---|
| — | — | — | Henüz koşulmadı (staging önerilir) |
