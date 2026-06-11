// === MIA — Türkiye İnşaat KKD Ekipman Kaydı (Faz 13) ===
// TEK GERÇEK KAYNAK: hangi ekipman taranabilir, hangi model sınıfıyla, hangi durumda.
// Worker tarafı eşdeğeri: workers/realtime-camera-worker/src/ppe_registry.py (senkron tutun).
//
// DÜRÜSTLÜK KURALI: status alanı modelin (construction-site-safety/27 = rf-27)
// GERÇEK yeteneğini yansıtır. rf-27 sınıfları: Hardhat, NO-Hardhat, Safety Vest,
// NO-Safety Vest, Mask, NO-Mask, Person, Safety Cone, machinery, vehicle.
// Desteklenmeyen ekipman "requires_training" işaretlenir ve ETKİNLEŞTİRİLEMEZ —
// sahte tespit vaadi yoktur. Model eğitilince burada (ve .py'de) terfi ettirilir.
//
//   supported         → şimdi tespit edilir (modelde NO-* ihlal sınıfı var)
//   experimental      → sınıf modelde var ama saha doğrulaması yetersiz
//   requires_training → modelde sınıf YOK; eğitim verisi gerekir (UI'da kilitli)
(function () {
    var REGISTRY = [
        { key: "helmet",         label_tr: "Baret",            label_en: "Hard hat",
          status: "supported",   violation_class: "NO-Hardhat",     ok_class: "Hardhat",
          violation_type: "no_helmet", default_risk: "high",
          note_tr: "rf-27 ile tespit edilir; saha doğrulaması pilotta ölçülür." },
        { key: "safety_vest",    label_tr: "Reflektörlü Yelek", label_en: "Safety vest",
          status: "supported",   violation_class: "NO-Safety Vest", ok_class: "Safety Vest",
          violation_type: "no_vest", default_risk: "high",
          note_tr: "rf-27 ile tespit edilir; saha doğrulaması pilotta ölçülür." },
        { key: "mask",           label_tr: "Maske / Solunum Koruma", label_en: "Mask / respirator",
          status: "experimental", violation_class: "NO-Mask",       ok_class: "Mask",
          violation_type: "no_mask", default_risk: "medium",
          note_tr: "Modelde sınıf var; inşaat sahasında yanlış pozitif oranı henüz ölçülmedi." },
        { key: "gloves",         label_tr: "Eldiven",          label_en: "Gloves",
          status: "requires_training", violation_class: null, ok_class: null,
          violation_type: "no_gloves", default_risk: "medium",
          note_tr: "rf-27 bu sınıfı içermiyor — model eğitimi gerekir (yol haritası)." },
        { key: "safety_glasses", label_tr: "Koruyucu Gözlük",  label_en: "Safety glasses",
          status: "requires_training", violation_class: null, ok_class: null,
          violation_type: "no_glasses", default_risk: "medium",
          note_tr: "rf-27 bu sınıfı içermiyor — model eğitimi gerekir." },
        { key: "safety_harness", label_tr: "Emniyet Kemeri",   label_en: "Safety harness",
          status: "requires_training", violation_class: null, ok_class: null,
          violation_type: "no_harness", default_risk: "critical",
          note_tr: "Yüksekte çalışma için kritik — özel eğitim verisi gerekir." },
        { key: "safety_boots",   label_tr: "İş Ayakkabısı",    label_en: "Safety boots",
          status: "requires_training", violation_class: null, ok_class: null,
          violation_type: "no_boots", default_risk: "low",
          note_tr: "rf-27 bu sınıfı içermiyor — model eğitimi gerekir." },
        { key: "ear_protection", label_tr: "Kulak Koruyucu",   label_en: "Ear protection",
          status: "requires_training", violation_class: null, ok_class: null,
          violation_type: "no_ear_protection", default_risk: "low",
          note_tr: "rf-27 bu sınıfı içermiyor — model eğitimi gerekir." }
    ];
    // Bağlam sınıfları (ekipman değil; tespit/ileri analitik için):
    var CONTEXT_CLASSES = ["Person", "Safety Cone", "machinery", "vehicle"];

    window.MIAPpeRegistry = {
        all: function () { return REGISTRY.slice(); },
        get: function (key) {
            for (var i = 0; i < REGISTRY.length; i++) if (REGISTRY[i].key === key) return REGISTRY[i];
            return null;
        },
        selectable: function () {  // UI'da etkinleştirilebilir olanlar
            return REGISTRY.filter(function (r) { return r.status !== "requires_training"; });
        },
        contextClasses: CONTEXT_CLASSES,
        statusLabel: function (s) {
            return s === "supported" ? "Destekleniyor"
                 : s === "experimental" ? "Deneysel"
                 : "Model eğitimi gerekir";
        }
    };
})();
