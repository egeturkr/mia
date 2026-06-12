#!/usr/bin/env bash
# MIA — Sürüm Artefakt Doğrulama (Faz 16, macOS Bash 3.2 uyumlu)
# releases/ içindeki GERÇEK dosyalar için SHA256 üretir, manifest.json'u günceller.
# YAPMAZ: malware taraması, imza, dış yükleme, sahte "güvenli" işareti.
# Not: mapfile/array kullanılmaz (macOS default Bash 3.2); boşluklu dosya adları desteklenir.
set -eu
cd "$(dirname "$0")/.."

DIR="releases"
MANIFEST="$DIR/manifest.json"
SUMS="$DIR/checksums.sha256"

if command -v shasum >/dev/null 2>&1; then HASHER="shasum -a 256"; else HASHER="sha256sum"; fi

# Gerçek artefakt listesi (metadata dosyaları hariç) — geçici dosyada, boşluk güvenli
LIST="$(mktemp)"
trap 'rm -f "$LIST"' EXIT
find "$DIR" -type f \
  ! -name ".gitkeep" ! -name "manifest.json" ! -name "checksums.sha256" \
  ! -name "README.md" ! -name ".gitignore" ! -name ".DS_Store" \
  | sort > "$LIST"

COUNT=$(grep -c . "$LIST" || true)

echo "== MIA sürüm doğrulama — $(date -u +%Y-%m-%dT%H:%M:%SZ) =="
if [ "$COUNT" -eq 0 ]; then
  echo "Gerçek artefakt YOK. manifest.json artifacts=[] olarak kalır (dürüst durum)."
  echo "Build üretimi: releases/README.md"
  exit 0
fi

echo "Bulunan artefaktlar ($COUNT):"
while IFS= read -r f; do
  [ -n "$f" ] && echo "  $f"
done < "$LIST"

: > "$SUMS"
while IFS= read -r f; do
  [ -n "$f" ] && $HASHER "$f" >> "$SUMS"
done < "$LIST"
echo ""
echo "Checksum yazıldı: $SUMS"

# manifest.json güncelle (yalnız gerçek dosyalar + sha256_generated=true)
python3 - "$MANIFEST" "$SUMS" <<'PYEOF'
import json, sys, os
manifest, sums = sys.argv[1], sys.argv[2]
m = json.load(open(manifest))
arts = []
for line in open(sums):
    line = line.rstrip("\n")
    if not line:
        continue
    h, _, path = line.partition("  ")          # shasum biçimi: "<hash>  <yol>"
    path = path.lstrip("*")                     # binary modu işareti olabilir
    if path and os.path.isfile(path):
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
