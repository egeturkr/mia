#!/usr/bin/env bash
# === MIA Masaüstü — macOS release scripti (imza farkındalıklı) ===
# Kullanım (yalnız macOS'ta, apps/desktop içinde):  npm run release:mac
#
# AKIŞ:
#   1) Developer ID sertifikası VAR MI diye bakar
#      · varsa  → imzalı + notarize build (APPLE_* env değişkenleri gerekir)
#      · yoksa  → imzasız build (eski davranış aynen korunur, uyarı verir)
#   2) dmg üretir, SHA256 + boyut hesaplar
#   3) İmza/notarization durumunu GERÇEKTEN doğrular (codesign + spctl)
#   4) releases/ altına kopyalar, manifest.json'u DOĞRULANMIŞ durumla günceller
#
# DÜRÜSTLÜK KURALI: manifest'teki signed/notarized alanları tahmin değil, ölçüm
# sonucudur. hosted_url otomatik YAZILMAZ — GitHub Release sonrası elle eklenir.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./package.json').version")
echo "→ MIA masaüstü v${VERSION} macOS build"

# ---- 1) Sertifika tespiti ---------------------------------------------------
SIGN_MODE="unsigned"
if security find-identity -v -p codesigning 2>/dev/null | grep -q "Developer ID Application"; then
    SIGN_MODE="signed"
    echo "→ Developer ID sertifikası bulundu — imzalı build"
    if [ -z "${APPLE_API_KEY:-}" ] && { [ -z "${APPLE_ID:-}" ] || [ -z "${APPLE_APP_SPECIFIC_PASSWORD:-}" ] || [ -z "${APPLE_TEAM_ID:-}" ]; }; then
        echo "   UYARI: notarization kimlik bilgileri yok (APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID"
        echo "   veya APPLE_API_KEY + APPLE_API_KEY_ID + APPLE_API_ISSUER). Notarization ATLANACAK."
        echo "   Ayrıntı: docs/MACOS_CODE_SIGNING.md"
        NOTARIZE_FLAG="-c.mac.notarize=false"
    else
        NOTARIZE_FLAG=""
        echo "   Notarization kimlik bilgileri hazır (Apple'a gönderilecek — 2-15 dk sürebilir)"
    fi
else
    echo "→ Developer ID sertifikası YOK — imzasız pilot build üretilecek."
    echo "   Kamuya açık dağıtım için: docs/MACOS_CODE_SIGNING.md"
    NOTARIZE_FLAG="-c.mac.notarize=false -c.mac.hardenedRuntime=false"
fi

# ---- 2) Build ----------------------------------------------------------------
npx electron-builder --mac dmg ${NOTARIZE_FLAG}

DMG=$(ls -t dist/*.dmg | head -1)
[ -f "$DMG" ] || { echo "HATA: dmg üretilemedi"; exit 1; }

APP="dist/mac-arm64/MIA AI Safety Intelligence.app"
SHA=$(shasum -a 256 "$DMG" | awk '{print $1}')
SIZE=$(stat -f%z "$DMG")
NAME=$(basename "$DMG")

# ---- 3) İmza / notarization DOĞRULAMASI (tahmin değil, ölçüm) ------------------
SIGNED=false
NOTARIZED=false
if [ -d "$APP" ]; then
    if codesign --verify --deep --strict "$APP" >/dev/null 2>&1; then
        SIGNED=true
        echo "→ codesign doğrulaması: GEÇTİ"
    else
        echo "→ codesign doğrulaması: imzasız/başarısız"
    fi
    # spctl: Gatekeeper kabul ediyor mu (notarize edilmiş + imzalı ise 'accepted')
    if spctl --assess --type execute "$APP" >/dev/null 2>&1; then
        NOTARIZED=true
        echo "→ Gatekeeper (spctl) değerlendirmesi: KABUL"
    else
        echo "→ Gatekeeper (spctl) değerlendirmesi: RET (imzasız veya notarize edilmemiş)"
    fi
fi

echo "→ SHA256: $SHA"
echo "→ Boyut : $SIZE bytes"

REPO_ROOT="$(cd ../.. && pwd)"
DEST="$REPO_ROOT/releases/desktop/macos"
mkdir -p "$DEST"
rm -f "$DEST"/*.dmg      # eski sürümler repo dizininde birikmesin
cp "$DMG" "$DEST/"

# ---- 4) manifest.json güncelle ------------------------------------------------
node - "$VERSION" "$NAME" "$SHA" "$SIZE" "$SIGNED" "$NOTARIZED" <<'EOF'
const fs = require("fs"), path = require("path");
const [, , version, name, sha, size, signedStr, notarizedStr] = process.argv;
const signed = signedStr === "true", notarized = notarizedStr === "true";
// cwd = apps/desktop (script başında cd edildi)
const mf = path.join(process.cwd(), "..", "..", "releases", "manifest.json");
const m = JSON.parse(fs.readFileSync(mf, "utf8"));
m.version = version;
const hosted = process.env.MIA_HOSTED_URL || null;
const idx = m.artifacts.findIndex(a => a.platform === "macOS");
m.artifacts[idx !== -1 ? idx : m.artifacts.length] = {
    platform: "macOS", architecture: "arm64",
    file_name: name, path: "releases/desktop/macos/" + name,
    sha256: sha, size_bytes: parseInt(size, 10),
    signed: signed, notarized: notarized, malware_scanned: false,
    distribution: (signed && notarized) ? "public" : "internal-pilot",
    hosted_url: hosted
};
m.release_channel = (signed && notarized) ? "stable" : "internal-pilot";
m.security_status = { signed: signed, notarized: notarized, malware_scanned: false, sha256_generated: true };
fs.writeFileSync(mf, JSON.stringify(m, null, 2) + "\n");
console.log("→ releases/manifest.json güncellendi (signed: " + signed + ", notarized: " + notarized +
    ", hosted_url: " + (hosted || "YOK — GitHub Release sonrası ELLE ekleyin") + ")");
EOF

echo "$SHA  releases/desktop/macos/$NAME" > "$REPO_ROOT/releases/checksums.sha256"

echo ""
echo "✔ Tamamlandı (mod: $SIGN_MODE · imzalı: $SIGNED · Gatekeeper: $NOTARIZED)"
echo "  1) git add -A && git commit -m 'release: masaüstü v${VERSION}' && git push"
echo "  2) GitHub Release oluştur (tag v${VERSION}) ve dmg'yi yükle:"
echo "     $DEST/$NAME"
echo "  3) manifest.json'daki macOS artefaktına hosted_url'i ELLE ekle ve tekrar push et."
echo "     DİKKAT: bu scripti tekrar ÇALIŞTIRMA — yeni build SHA'yı değiştirir,"
echo "     GitHub'a yüklenen dosyayla uyuşmaz."
