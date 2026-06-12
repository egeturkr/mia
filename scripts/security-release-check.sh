#!/usr/bin/env bash
# MIA — Sürüm Güvenlik Kontrolü (Faz 20, macOS Bash 3.2 uyumlu)
# manifest.json'u doğrular ve güvenlik özeti üretir.
# ASLA: malware_scanned'i otomatik true yapmaz, dosya yüklemez, sonuç uydurmaz.
set -eu
cd "$(dirname "$0")/.."

MANIFEST="releases/manifest.json"
echo "== MIA sürüm güvenlik kontrolü — $(date -u +%Y-%m-%dT%H:%M:%SZ) =="

python3 - "$MANIFEST" <<'PYEOF'
import json, sys

m = json.load(open(sys.argv[1]))   # geçersiz JSON ise burada patlar (istenen)
fail = []
warn = []

for k in ("product", "version", "release_channel", "artifacts", "security_status"):
    if k not in m:
        fail.append(f"manifest alanı eksik: {k}")

for i, a in enumerate(m.get("artifacts", [])):
    tag = a.get("file_name") or f"artifact[{i}]"
    if not a.get("sha256") or len(a["sha256"]) != 64:
        fail.append(f"{tag}: SHA256 eksik/geçersiz")
    for flag in ("signed", "notarized", "malware_scanned"):
        if not isinstance(a.get(flag), bool):
            fail.append(f"{tag}: '{flag}' açık boolean olmalı (true/false)")
    if a.get("hosted_url"):
        if not str(a["hosted_url"]).startswith("https://"):
            fail.append(f"{tag}: hosted_url https değil")
        if a.get("signed") is False or a.get("malware_scanned") is False:
            warn.append(f"{tag}: KAMUYA BARINDIRILIYOR ama "
                        f"signed={a.get('signed')} / malware_scanned={a.get('malware_scanned')} — "
                        "yalnız kontrollü pilot dağıtımı için uygundur; geniş duyuru YAPMAYIN")

print(f"Ürün: {m.get('product')} · Sürüm: {m.get('version')} · Kanal: {m.get('release_channel')}")
print(f"Artefakt sayısı: {len(m.get('artifacts', []))}")
print()
print("— GÜVENLİK ÖZETİ —")
for a in m.get("artifacts", []):
    print(f"  {a.get('platform','?')}/{a.get('architecture','?')}  {a.get('file_name','?')}")
    print(f"    sha256: {'✓' if a.get('sha256') else '✗'} · imza: {'✓' if a.get('signed') else 'BEKLEMEDE'}"
          f" · notarization: {'✓' if a.get('notarized') else 'BEKLEMEDE'}"
          f" · malware taraması: {'✓' if a.get('malware_scanned') else 'BEKLEMEDE'}"
          f" · hosted: {'✓' if a.get('hosted_url') else '—'}")
print()
for w in warn:
    print("UYARI:", w)
for f in fail:
    print("HATA:", f)
print()
if fail:
    print("SONUÇ: BAŞARISIZ — yukarıdaki hataları düzeltin.")
    sys.exit(1)
print("SONUÇ: GEÇTİ" + (" (uyarılarla)" if warn else "") + ".")
print("Hatırlatma: malware taraması/imza yalnız MANUEL süreçle true yapılır;")
print("bu script hiçbir güvenlik alanını otomatik işaretlemez.")
PYEOF
