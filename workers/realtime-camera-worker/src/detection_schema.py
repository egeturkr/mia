# MIA — Normalize Tespit Şeması (Faz 15)
# Worker, modele özgü yanıt biçimine her yerde bağlı OLMAMALI. Her adaptör
# tespitleri bu şemaya çevirir; MIA çekirdeği yalnız bu şemayı tanır.
#
# Normalize tespit:
# {
#   "class_name":  "no_helmet",        # MIA kanonik sınıfı
#   "display_name": "Baretsiz",        # TR görünen ad
#   "confidence":  0.87,               # 0..1
#   "bbox": {"x":..,"y":..,"width":..,"height":..},   # normalize 0..1
#   "source_model": "roboflow",
#   "raw_class_name": "NO-Hardhat",    # modelin ham sınıf adı (denetim izi)
# }

# Ham model sınıfı (küçük harf, ayraçlar normalize) → MIA kanonik sınıfı.
# YALNIZ modelin gerçekten verebildiği sınıflar olay üretebilir; bu harita
# ad çeşitliliğini toplar, yetenek İCAT ETMEZ.
CANONICAL_MAP = {
    # pozitif KKD
    "hardhat": "helmet", "helmet": "helmet", "baret": "helmet",
    "safety vest": "safety_vest", "vest": "safety_vest",
    "reflective vest": "safety_vest", "yelek": "safety_vest",
    "mask": "mask", "maske": "mask",
    # doğrudan ihlal (negatif) sınıfları
    "no hardhat": "no_helmet", "no helmet": "no_helmet", "baretsiz": "no_helmet",
    "no safety vest": "no_safety_vest", "no vest": "no_safety_vest", "yeleksiz": "no_safety_vest",
    "no mask": "no_mask", "maskesiz": "no_mask",
    # bağlam
    "person": "person", "worker": "person",
    "safety cone": "safety_cone", "machinery": "machinery", "vehicle": "vehicle",
}

DISPLAY_NAMES_TR = {
    "helmet": "Baret", "no_helmet": "Baretsiz",
    "safety_vest": "Reflektörlü Yelek", "no_safety_vest": "Yeleksiz",
    "mask": "Maske", "no_mask": "Maskesiz",
    "person": "Kişi", "safety_cone": "Güvenlik Konisi",
    "machinery": "İş Makinesi", "vehicle": "Araç",
}


def canonical_class(raw_name):
    """Ham model sınıf adını MIA kanonik sınıfına çevirir; bilinmeyen → None."""
    key = str(raw_name or "").strip().lower().replace("-", " ").replace("_", " ")
    key = " ".join(key.split())
    return CANONICAL_MAP.get(key)


def make_detection(raw_class, confidence, bbox, source_model):
    """Normalize tespit nesnesi üretir. confidence 0..1, bbox normalize 0..1."""
    canon = canonical_class(raw_class)
    return {
        "class_name": canon,                      # None ise MIA bu sınıfı tanımıyor
        "display_name": DISPLAY_NAMES_TR.get(canon, str(raw_class)),
        "confidence": round(float(confidence), 4),
        "bbox": {"x": round(bbox[0], 4), "y": round(bbox[1], 4),
                 "width": round(bbox[2], 4), "height": round(bbox[3], 4)},
        "source_model": source_model,
        "raw_class_name": str(raw_class),
    }
