#!/usr/bin/env bash
# MIA — Sürüm Artefakt Doğrulama (Faz 15)
# releases/ içindeki build dosyaları için SHA256 manifesti üretir.
# UYARI: Bu script malware taraması YAPMAZ — checksum üretir ve hatırlatır.
# Hiçbir şey dışarı yüklenmez; sahte tarama sonucu üretilmez.
set -euo pipefail

DIR="${1:-releases}"
if [ ! -d "$DIR" ] || [ -z "$(ls -A "$DIR" 2>/dev/null)" ]; then
  echo "HATA: '$DIR' yok veya boş. Önce build üretin (docs/DESKTOP_MOBILE_APP_BUILD_GUIDE.md)."
  exit 1
fi

MANIFEST="$DIR/SHA256SUMS.txt"
echo "# MIA sürüm manifesti — $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$MANIFEST"
echo "" && echo "== Dosyalar =="
ls -lh "$DIR" | grep -v SHA256SUMS || true

echo "" && echo "== SHA256 =="
if command -v shasum >/dev/null; then HASHER="shasum -a 256"; else HASHER="sha256sum"; fi
find "$DIR" -type f ! -name "SHA256SUMS.txt" -exec $HASHER {} \; | tee -a "$MANIFEST"

echo ""
echo "Manifest yazıldı: $MANIFEST"
echo ""
echo "SONRAKİ ZORUNLU ADIMLAR (bu script yapmaz):"
echo "  1. Her dosyayı antivirüs/malware ile tarayın (örn. VirusTotal'a manuel yükleme)."
echo "  2. Platform imzası: Windows Authenticode / macOS notarization / Android keystore."
echo "  3. Tarama + imza TAMAMLANMADAN download sayfasına link KOYMAYIN."
