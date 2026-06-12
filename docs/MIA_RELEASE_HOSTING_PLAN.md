# MIA Sürüm Barındırma Planı (Faz 19)

## Neden binary git'e girmez
101 MB DMG → repo şişer, her clone yavaşlar, Netlify deploy limitlerini zorlar,
geri çekme (revoke) imkânsızlaşır. Bu yüzden `releases/desktop|mobile/**`
gitignore'ludur; repo yalnız **manifest + checksum** tutar (bütünlük kanıtı).

## /download davranışı (uygulandı)
download sayfası `releases/manifest.json`'u okur:
- artefakt VAR + `hosted_url` VAR → **İndir** butonu (gerçek link)
- artefakt VAR + `hosted_url` YOK → **"Pilot Build Talep Et"** + SHA256 + dürüst
  güvenlik durumu (imzasız/taranmamış uyarısı) — KIRIK LİNK ASLA gösterilmez
- artefakt YOK → varsayılan "Talep Et / Yakında"

## Önerilen barındırma kademeleri
1. **GitHub Releases** (erken pilot, ÖNERİLEN İLK ADIM):
   `gh release create v0.1.0-pilot "releases/desktop/macos/MIA AI Safety Intelligence-0.1.0-pilot-arm64.dmg" --title "0.1.0-pilot" --notes "Kurum içi pilot — imzasız" --prerelease`
   → çıkan URL'i manifest'teki artefakta `"hosted_url": "..."` olarak ekle → push.
   (verify script hosted_url'i KORUR, silmez.)
2. **S3 / Cloudflare R2** (kurumsal teslimat): özel bucket + süreli imzalı link;
   müşteriye e-postayla checksum ile birlikte iletilir.
3. **İmzalı müşteri teslimatı**: sözleşmeli müşterilere doğrudan, SHA256 doğrulama talimatıyla.

## Sürümleme ve geri çekme
- Sürüm: `MAJOR.MINOR.PATCH-channel` (0.1.0-pilot → 0.1.1-pilot → 0.2.0-beta).
- Her sürüm: build → verify script → imza/tarama → hosted_url → sürüm notu.
- **Geri çekme:** hosted_url'i manifest'ten sil + barındırılan dosyayı kaldır
  (GitHub Release'i sil / R2 objesini sil) → download sayfası otomatik "talep et"e döner.

## Yayın şartı (değişmedi)
hosted_url eklemeden ÖNCE: kod imzalama + notarization + SHA256 + malware
taraması. İmzasız build yalnız kontrollü pilot teslimatıyla paylaşılır.
