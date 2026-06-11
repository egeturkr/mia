# MIA — KKD Ekipman Kaydı (worker tarafı) — js/ppe-registry.js ile SENKRON tutun.
# DÜRÜSTLÜK: yalnız modelin (rf-27) gerçekten içerdiği sınıflar 'supported/experimental'.
# requires_training ekipmanlar worker'da ASLA olay üretmez (model sınıfı yok).

REGISTRY = {
    "helmet": {
        "status": "supported", "violation_class": "NO-Hardhat", "ok_class": "Hardhat",
        "violation_type": "no_helmet", "default_risk": "high",
    },
    "safety_vest": {
        "status": "supported", "violation_class": "NO-Safety Vest", "ok_class": "Safety Vest",
        "violation_type": "no_vest", "default_risk": "high",
    },
    "mask": {
        "status": "experimental", "violation_class": "NO-Mask", "ok_class": "Mask",
        "violation_type": "no_mask", "default_risk": "medium",
    },
    # requires_training — model sınıfı YOK, olay üretilemez:
    "gloves": {"status": "requires_training", "violation_class": None, "ok_class": None,
               "violation_type": "no_gloves", "default_risk": "medium"},
    "safety_glasses": {"status": "requires_training", "violation_class": None, "ok_class": None,
                       "violation_type": "no_glasses", "default_risk": "medium"},
    "safety_harness": {"status": "requires_training", "violation_class": None, "ok_class": None,
                       "violation_type": "no_harness", "default_risk": "critical"},
    "safety_boots": {"status": "requires_training", "violation_class": None, "ok_class": None,
                     "violation_type": "no_boots", "default_risk": "low"},
    "ear_protection": {"status": "requires_training", "violation_class": None, "ok_class": None,
                       "violation_type": "no_ear_protection", "default_risk": "low"},
}

VALID_RISKS = ("low", "medium", "high", "critical")
DEFAULT_REQUIRED = {"helmet": True, "safety_vest": True, "mask": False}


def build_violation_map(required_equipment, risk_rules=None):
    """Profilin etkin ekipmanından model-sınıfı → (violation_type, risk) haritası üretir.

    required_equipment: {"helmet": true, "safety_vest": true, ...} (profilden)
    risk_rules:         {"helmet": "high", ...} (opsiyonel geçersiz kılma)
    requires_training ekipmanlar SESSİZCE atlanır (tespit edilemez — dürüstlük).
    """
    req = required_equipment if isinstance(required_equipment, dict) else DEFAULT_REQUIRED
    rules = risk_rules if isinstance(risk_rules, dict) else {}
    vmap = {}
    for key, enabled in req.items():
        if not enabled:
            continue
        item = REGISTRY.get(key)
        if not item or not item["violation_class"]:
            continue  # desteklenmeyen ekipman: olay üretme
        risk = rules.get(key) or item["default_risk"]
        if risk not in VALID_RISKS:
            risk = item["default_risk"]
        vmap[item["violation_class"]] = (item["violation_type"], risk, key)
    return vmap


def equipment_summary(required_equipment, predictions):
    """Olay kaydı için detected/missing/required ekipman özetleri (sınıf adlarından)."""
    req = required_equipment if isinstance(required_equipment, dict) else DEFAULT_REQUIRED
    # Eski biçim ("class") ve Faz 15 normalize biçim ("raw_class_name") desteklenir
    classes = {p.get("class") or p.get("raw_class_name") for p in (predictions or [])}
    detected, missing = {}, {}
    for key, enabled in req.items():
        item = REGISTRY.get(key)
        if not enabled or not item or not item["violation_class"]:
            continue
        if item["ok_class"] in classes:
            detected[key] = True
        if item["violation_class"] in classes:
            missing[key] = True
    return {"required": {k: v for k, v in req.items() if v}, "detected": detected, "missing": missing}
