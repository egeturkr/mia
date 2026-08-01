# macOS Kod İmzalama ve Notarization — MIA Masaüstü

Amaç: müşterinin indirdiği `.dmg` çift tıkla, uyarısız kurulsun. Bugün imzasız
build'de macOS "geliştirici doğrulanamadı" diyor ve kullanıcı sağ tık → Aç
yapmak zorunda kalıyor — kurumsal satışta güven kaybı.

**Kod tarafı HAZIR.** Sertifika Mac'e kurulduğu anda `npm run release:mac`
otomatik olarak imzalı + notarize build üretir; sertifika yoksa eskisi gibi
imzasız üretmeye devam eder (hiçbir şey bozulmaz).

---

## 1) Apple Developer Program üyeliği (~$99/yıl)

1. https://developer.apple.com/programs/ → **Enroll**
2. Kurumsal (Organization) üyelik **D-U-N-S numarası** ister ve 1-2 hafta sürebilir.
   Bireysel (Individual) üyelik genelde 24-48 saatte onaylanır ve imzalama için
   yeterlidir — sertifikadaki isim şirket yerine kişi adı görünür.
   MIA için tavsiye: pilot hız gerekiyorsa **Individual ile başla**, sonra
   Organization'a geç (sertifikayı yenilemek gerekir).
3. Onay e-postasını bekle.

## 2) Developer ID Application sertifikası

En kolay yol Xcode ile:
1. Xcode → Settings → Accounts → Apple ID'ni ekle
2. Team'i seç → **Manage Certificates…** → sol alt **+** → **Developer ID Application**
3. Kurulduğunu doğrula:
   ```bash
   security find-identity -v -p codesigning | grep "Developer ID Application"
   ```
   Bir satır dönmeli. (Bu komut release scriptinin de kullandığı kontroldür.)

> Xcode kullanmak istemezsen: developer.apple.com → Certificates → **+** →
> Developer ID Application → CSR yükle → indir → çift tıkla (Keychain'e girer).

## 3) Notarization kimlik bilgileri

Apple'a build'i doğrulatmak için iki yöntemden biri (biri yeterli):

### A) Apple ID + uygulamaya özel şifre (en hızlı)
1. https://appleid.apple.com → Oturum Aç → **App-Specific Passwords** → yeni şifre üret
   (Apple ID şifreni ASLA doğrudan kullanma.)
2. Team ID'ni öğren: developer.apple.com → Membership → **Team ID** (10 karakter)
3. Kabuğuna ekle (`~/.zshrc`):
   ```bash
   export APPLE_ID="dennizoge@gmail.com"
   export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
   export APPLE_TEAM_ID="XXXXXXXXXX"
   ```
   Sonra: `source ~/.zshrc`

### B) App Store Connect API anahtarı (CI için daha iyi)
```bash
export APPLE_API_KEY="/Users/denizoge/.private_keys/AuthKey_XXXX.p8"
export APPLE_API_KEY_ID="XXXXXXXXXX"
export APPLE_API_ISSUER="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

> GÜVENLİK: bu değerler repoya **girmez**. `~/.zshrc` yerel kalır; CI'da
> GitHub Secrets kullanılır.

## 4) İmzalı sürüm üret

```bash
cd apps/desktop
npm run release:mac
```

Script sırayla: sertifikayı bulur → imzalar → Apple'a notarize'a gönderir
(**2-15 dk** sürebilir, sabırlı ol) → `codesign --verify` ve `spctl --assess`
ile GERÇEKTEN doğrular → `releases/manifest.json`'a `signed: true`,
`notarized: true` yazar ve kanalı `stable` yapar.

Site tarafında ek iş yok: download sayfası manifest'i okuduğu için
"imzasız / notarize edilmemiş" uyarıları otomatik kalkar.

## 5) Son kullanıcı doğrulaması

İmzalı dmg indirildikten sonra:
```bash
spctl --assess --type install ~/Downloads/MIA*.dmg    # "accepted" demeli
codesign -dv --verbose=4 /Applications/"MIA AI Safety Intelligence.app"
```

---

## Sorun giderme

| Hata | Çözüm |
|---|---|
| `The executable does not have the Hardened Runtime enabled` | `package.json` → `mac.hardenedRuntime: true` (zaten ayarlı) |
| `com.apple.security.cs.allow-jit entitlement required` | `build/entitlements.mac.plist` içinde mevcut — dosyanın `mac.entitlements` ile eşleştiğini doğrula |
| Uygulama açılıyor ama **AI motoru başlamıyor** (imzalı sürümde) | `allow-unsigned-executable-memory` + `disable-library-validation` gerekli — ONNX WASM için; entitlements dosyasında var |
| `invalid signature` / notarization reddi | `dist/` klasörünü sil, temiz build al: `rm -rf dist && npm run release:mac` |
| Notarization çok uzun sürüyor | Apple kuyruğu; 15 dk'yı geçerse `xcrun notarytool history --apple-id ... ` ile durumu sorgula |
| Sertifika yok ama imzalı build istiyorum | Önce adım 1-2. Sertifika yoksa script bilinçli olarak imzasız üretir. |

## Maliyet ve süre özeti

| Kalem | Süre | Maliyet |
|---|---|---|
| Apple Developer (Individual) | 1-2 gün | $99/yıl |
| Apple Developer (Organization) | 1-2 hafta (D-U-N-S) | $99/yıl |
| Sertifika kurulumu | 10 dk | — |
| İlk imzalı build + notarization | 20-30 dk | — |
