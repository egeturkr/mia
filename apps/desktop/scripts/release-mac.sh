#!/usr/bin/env bash
# === MIA Masaüstü — macOS release scripti ===
# Kullanım (yalnız macOS'ta, apps/desktop içinde):  npm run release:mac
# 1) dmg build  2) SHA256 + boyut  3) releases/desktop/macos'a kopyala
# 4) releases/manifest.json + checksums.sha256 güncelle (download.html manifest'ten okur)
# NOT: hosted_url manifest'e OTOMATİK YAZILMAZ — GitHub Release'e dmg yüklendikten
# sonra URL elle (veya aşağıdaki MIA_HOSTED_URL env ile) girilir. Dürüstlük kuralı:
# hosted_url yoksa download sayfası "Talep Et" gösterir, kırık link asla.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./package.json').version")
echo "→ MIA masaüstü v${VERSION} macOS build"

npm run dist:mac

DMG=$(ls -t dist/*.dmg | head -1)
[ -f "$DMG" ] || { echo "HATA: dmg üretilemedi"; exit 1; }

SHA=$(shasum -a 256 "$DMG" | awk '{print $1}')
SIZE=$(stat -f%z "$DMG")
NAME=$(basename "$DMG")
REPO_ROOT="$(cd ../.. && pwd)"
DEST="$REPO_ROOT/releases/desktop/macos"

mkdir -p "$DEST"
# Eski pilot dmg'leri temizle (repo şişmesin) — yalnız yeni sürüm kalır
rm -f "$DEST"/*.dmg
cp "$DMG" "$DEST/"

echo "→ SHA256: $SHA"
echo "→ Boyut : $SIZE bytes"

# manifest.json güncelle
node - "$VERSION" "$NAME" "$SHA" "$SIZE" <<'EOF'
const fs = require("fs"), path = require("path");
const [,, version, name, sha, size] = process.argv;
// cwd = apps/desktop (script başında cd edildi)
const mf = path.join(process.cwd(), "..", "..", "releases", "manifest.json");
const m = JSON.parse(fs.readFileSync(mf, "utf8"));
m.version = version;
const hosted = process.env.MIA_HOSTED_URL || null;
const idx = m.artifacts.findIndex(a => a.platform === "macOS");
const art = {
    platform: "macOS", architecture: "arm64",
    file_name: name, path: "releases/desktop/macos/" + name,
    sha256: sha, size_bytes: parseInt(size, 10),
    signed: false, notarized: false, malware_scanned: false,
    distribution: "internal-pilot",
    hosted_url: hosted || (idx !== -1 ? null : null)
};
if (idx !== -1) m.artifacts[idx] = art; else m.artifacts.push(art);
m.security_status = { signed: false, notarized: false, malware_scanned: false, sha256_generated: true };
fs.writeFileSync(mf, JSON.stringify(m, null, 2) + "\n");
console.log("→ releases/manifest.json güncellendi (hosted_url: " + (hosted || "YOK — GitHub Release sonrası elle ekleyin") + ")");
EOF

# checksums dosyası
echo "$SHA  releases/desktop/macos/$NAME" > "$REPO_ROOT/releases/checksums.sha256"

echo ""
echo "✔ Tamamlandı. Sonraki adımlar:"
echo "  1) git add -A && git commit -m 'release: masaüstü v${VERSION}' && git push"
echo "  2) GitHub Release oluştur (tag v${VERSION}) ve dmg'yi yükle:"
echo "     $DEST/$NAME"
echo "  3) manifest.json'daki macOS artefaktına hosted_url'i ELLE ekle ve tekrar push et."
echo "     DİKKAT: bu scripti tekrar ÇALIŞTIRMA — yeni build SHA'yı değiştirir,"
echo "     GitHub'a yüklenen dosyayla uyuşmaz."
