# Faz 5 — Organizasyon Hesapları + RBAC

## Neden

B2B satışın ön şartı: bir inşaat firmasının İSG ekibi (müdür + uzmanlar + yöneticiler) aynı
veriyi paylaşabilmeli. Önceki model tamamen `user_id` bazlıydı — tek kullanıcı, paylaşım yok.

## Veri modeli

| Tablo | İçerik |
|---|---|
| `organizations` | Firma hesabı (ad, slug, owner_user_id, fatura e-postası, şehir…) |
| `organization_memberships` | Üyelikler: role (owner/admin/safety_manager/viewer) + status (active/invited/removed), unique(org,user) |
| `organization_invitations` | E-posta + rol + benzersiz token + 14 gün geçerlilik + durum |
| `organization_sites` | Saha/proje hiyerarşisi (Firma → Saha → Analiz) |
| Veri tabloları | NULLABLE `org_id` (+bazılarına `site_id`): analyses, workers, equipment, checkpoints, scans, pilot_* |

Yardımcılar (SECURITY DEFINER — RLS özyinelemesini önler): `is_org_member(org, roles[])`,
`is_org_owner_direct(org)`, `accept_org_invite(token)` (davet kabulü tamamen sunucuda:
token + pending + süre + e-posta eşleşmesi doğrulanır).

## Roller

| Yetki | owner | admin | safety_manager | viewer |
|---|---|---|---|---|
| Org bilgisi düzenleme / silme | ✓ / ✓ | ✓ / ✗ | ✗ | ✗ |
| Üye davet | ✓ (admin dahil) | ✓ (yalnız İSG/izleyici) | ✗ | ✗ |
| Rol değiştirme / üye çıkarma | ✓ | ✓ (owner/admin hariç) | ✗ | ✗ |
| Analiz yükleme/çalıştırma | ✓ | ✓ | ✓ | ✗ |
| Analiz silme | ✓ | ✓ | ✗ | ✗ |
| Panel/ihlal raporu görüntüleme | ✓ | ✓ | ✓ | ✓ |
| Pilot yönetimi | ✓ | ✓ | yalnız haftalık rapor | ✗ |
| Saha yönetimi | ✓ | ✓ | ✗ | ✗ |

## Migration stratejisi (geri uyumluluk)

1. **Mevcut RLS politikalarına DOKUNULMADI.** Org politikaları YANLARINA eklendi — Postgres'te
   aynı eylemin permissive politikaları OR ile birleşir; eski user_id erişimi aynen sürer.
2. `org_id` kolonları **nullable** — mevcut satırlar değişmedi, backfill YOK.
3. İlk girişte üyeliği olmayan kullanıcıya otomatik **kişisel organizasyon** açılır (org.js);
   legacy verisi user_id fallback'iyle görünmeye devam eder.
4. Sorgular `user_id.eq.ben OR org_id.eq.seçili-org` — tek satır iki kez gelmez (OR birleşimi).
5. Migration koşulmadıysa: org.js tabloyu bulamaz → `available=false` → her sayfa eski
   user_id akışıyla çalışır; detector insert'i kolon hatasında org alanlarını düşürüp dener.

## Akışlar

- **Org oluşturma:** otomatik (ilk giriş) veya organization.html. Kurucu owner olur
  (memberships insert politikası: kendi owner kaydını yalnızca org sahibinin açabilmesi
  `is_org_owner_direct` ile garanti).
- **Davet:** organization.html → e-posta + rol → kayıt + link panoya (`accept-invite.html?token=…`);
  e-posta gönderimi manuel (mailto linki hazır) — SMTP'li otomatik gönderim sonraki iş.
- **Kabul:** davetli, davet edilen e-postayla giriş yapıp linki açar → `accept_org_invite` RPC →
  üyelik aktive + davet accepted + org localStorage'a seçilir.
- **Org değiştirme:** organization.html'deki seçici (localStorage `mia_org`); dashboard/ihlal
  raporu/pilot sorguları seçili org'u kullanır.
- **Org kapsamlı analiz:** detector kaydı seçili org_id ile yazar → tüm üyeler görür.

## Güvenlik özeti

Gerçek yaptırım RLS'te; UI kısıtları (silme butonu gizleme, viewer'da analiz başlatma kilidi,
davet panelinin rol bazlı görünürlüğü) yalnızca UX. Başka org'un verisi: üyelik yoksa
`is_org_member` false → satır görünmez. Davet token'ı yalnızca RPC üzerinden tüketilir;
invitee davet satırını doğrudan okuyamaz. Tek owner'ın çıkarılması/rol düşürmesi UI'da
engellenir (DB'de owner-update yetkisi yalnız owner'da). Admin, owner/admin satırlarını
güncelleyemez (politika USING'i hedef satırın rolüne bakar).

## Bilinen sınırlar

- SSO/SAML, SCIM yok. Faturalandırma/kota hâlâ kullanıcı bazlı (Faz 6'da org'a bağlanır).
- Audit log yok (tablolardaki updated_at + consents dışında).
- QR/tarama (workers/equipment/checkpoints/scans) kolonları hazır ama UI'ları hâlâ user-scoped
  yazar; org'a taşıma sonraki iterasyon.
- E-posta daveti manuel link; davetli e-postası büyük/küçük harf duyarsız eşleştirilir.
- `site_id` kolonları hazır; detector'da saha seçici henüz yok (null yazılır).

## Rollback

`git revert <commit>` → frontend org'suz çalışır (org.js fallback'leri sayesinde tablolar dursa
bile sorun çıkmaz). Tam DB temizliği: `drop function accept_org_invite, is_org_member,
is_org_owner_direct; drop table organization_invitations, organization_sites,
organization_memberships, organizations cascade;` + org politikalarını drop et
(org_id kolonları nullable — bırakılabilir, zararsız).
