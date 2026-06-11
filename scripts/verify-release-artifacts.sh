#!/usr/bin/env bash
# MIA — Sürüm Artefakt Doğrulama (Faz 16)
# releases/ içindeki GERÇEK dosyalar için SHA256 üretir, manifest.json'u günceller.
# YAPMAZ: malware taraması, imza, dış yükleme, sahte "güvenli" işareti.
set -euo pipefail
cd "$(dirname "$0")/.."

DIR="releases"
MANIFEST="$DIR/manifest.json"
SUMS="$DIR/checksums.sha256"

if command -v shasum >/dev/null; then HASHER="shasum -a 256"; else HASHER="sha256sum"; fi

# Gerçek artefaktlar (gitkeep/manifest/checksum/README hariç)
mapfile -t FILES < <(find "$DIR" -type f \
  ! -name ".gitkeep" ! -name "manifest.json" ! -name "checksums.sha256" \
  ! -name "README.md" ! -name ".gitignore" | sort)

echo "== MIA sürüm doğrulama — $(date -u +%Y-%m-%dT%H:%M:%SZ) =="
if [ ${#FILES[@]} -eq 0 ]; then
  echo "Gerçek artefakt YOK. manifest.json artifacts=[] olarak kalır (dürüst durum)."
  echo "Build üretimi: releases/README.md"
  exit 0
fi

echo "Bulunan artefaktlar:"; printf '  %s\n' "${FILES[@]}"
: > "$SUMS"
for f in "${FILES[@]}"; do $HASHER "$f" >> "$SUMS"; done
echo "" && echo "Checksum yazıldı: $SUMS"

# manifest.json güncelle (yalnız gerçek dosyalar + sha256_generated=true)
python3 - "$MANIFEST" "$SUMS" <<'PYEOF'
import json, sys, os
manifest, sums = sys.argv[1], sys.argv[2]
m = json.load(open(manifest))
arts = []
for line in open(sums):
    h, _, path = line.strip().partition("  ")
    if path:
        arts.append({"path": path, "sha256": h, "size_bytes": os.path.getsize(path)})
m["artifacts"] = arts
m["security_status"]["sha256_generated"] = True
# imza/notarization/malware ASLA otomatik true yapılmaz — manuel doğrulama gerekir
json.dump(m, open(manifest, "w"), indent=2, ensure_ascii=False)
print(f"manifest.json güncellendi: {len(arts)} artefakt")
PYEOF

echo ""
echo "GÜVENLİK DURUMU (manuel doğrulama ZORUNLU — bu script otomatik 'güvenli' demez):"
echo "  signed:          manuel kontrol gerekli (Win Authenticode / mac codesign)"
echo "  notarized:       manuel kontrol gerekli (xcrun notarytool history)"
echo "  malware_scanned: manuel kontrol gerekli (VirusTotal vb.)"
echo ""
echo "Checksum üretildi. Kamuya yayın ÖNCESİ malware taraması ve imza manuel yapılmalıdır."
echo "Tamamlanınca manifest.json security_status alanlarını ELLE true yapın ve sürüm notuna işleyin."
