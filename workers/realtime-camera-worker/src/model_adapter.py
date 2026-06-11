# MIA — Model Adaptör Katmanı + Muhafazakâr Kişi-KKD İlişkilendirme (Faz 15)
#
# get_adapter(): yapılandırmaya göre adaptör seçer (bugün: roboflow).
# associate_frame(): kare-seviyesi DÜRÜST ilişkilendirme — sahte tracking yok.
#
# İLİŞKİLENDİRME GERÇEĞİ (dürüst):
# rf-27 ihlali DOĞRUDAN negatif sınıf olarak verir (no_helmet, no_safety_vest).
# Bu birincil ve güvenilir yoldur. Kişi-kutusu örtüşmesi yalnız BAĞLAM metadata'sı
# üretir (kaç kişi, ihlal kutusu bir kişiyle örtüşüyor mu) — kalıcı kişi kimliği
# (person_track_id) ÜRETİLMEZ; gerçek takip altyapısı yokken kişi sayısı/kimliği
# iddia edilmez. Olaylar kare-seviyesi ihlaldir ve validation_status=pending taşır.


def get_adapter(provider, **kwargs):
    if provider == "roboflow":
        from roboflow_adapter import RoboflowAdapter
        return RoboflowAdapter(**kwargs)
    raise ValueError(f"bilinmeyen model sağlayıcı: {provider}")


def _overlap_ratio(a, b):
    """a kutusunun b ile kesişiminin a alanına oranı (0..1)."""
    ax2, ay2 = a["x"] + a["width"], a["y"] + a["height"]
    bx2, by2 = b["x"] + b["width"], b["y"] + b["height"]
    ix = max(0.0, min(ax2, bx2) - max(a["x"], b["x"]))
    iy = max(0.0, min(ay2, by2) - max(a["y"], b["y"]))
    area = a["width"] * a["height"]
    return (ix * iy) / area if area > 0 else 0.0


def _region_ok(violation_canon, vbox, pbox):
    """Muhafazakâr bölge kontrolü: baret kişinin ÜST bölgesinde, yelek GÖVDE
    bölgesinde beklenir. Bölge dışıysa ilişki 'zayıf' sayılır."""
    if pbox["height"] <= 0:
        return False
    rel_y = (vbox["y"] + vbox["height"] / 2 - pbox["y"]) / pbox["height"]  # kutu merkezi, kişi içi oran
    if violation_canon == "no_helmet":
        return rel_y <= 0.45          # üst bölge (baş)
    if violation_canon == "no_safety_vest":
        return 0.15 <= rel_y <= 0.85  # gövde
    return True                        # diğerleri için bölge şartı yok


def associate_frame(detections, min_overlap=0.3):
    """Normalize tespit listesi → kare bağlam özeti (metadata).

    Döner: {person_count, violations: [{class_name, confidence,
            association: strong|weak|none}], association_mode: 'frame_level'}
    'strong' = ihlal kutusu bir kişi kutusuyla yeterince örtüşüyor VE beklenen
    bölgede. Zayıf ilişki olayı ENGELLEMEZ (doğrudan negatif sınıf zaten kanıt)
    ama metadata'da dürüstçe işaretlenir — güç iddiası şişirilmez.
    """
    persons = [d for d in detections if d.get("class_name") == "person"]
    out = []
    for d in detections:
        c = d.get("class_name")
        if not c or not c.startswith("no_"):
            continue
        assoc = "none"
        for p in persons:
            if _overlap_ratio(d["bbox"], p["bbox"]) >= min_overlap:
                assoc = "strong" if _region_ok(c, d["bbox"], p["bbox"]) else "weak"
                if assoc == "strong":
                    break
        out.append({"class_name": c, "confidence": d["confidence"], "association": assoc})
    return {"person_count": len(persons), "violations": out, "association_mode": "frame_level"}
