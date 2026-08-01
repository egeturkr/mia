// === MIA Masaüstü — KKD Ekipman Kaydı (TEK GERÇEK KAYNAK) ===
// Web eşdeğeri: js/ppe-registry.js · Worker eşdeğeri: workers/.../ppe_registry.py
// ÜÇÜ SENKRON TUTULUR. Bir ekipmanın taranıp taranamayacağı YALNIZ burada belirlenir.
//
// DÜRÜSTLÜK KURALI: status alanı modelin GERÇEK yeteneğini yansıtır.
//   supported         → modelde ok+violation sınıfı var, saha doğrulaması yapıldı
//   experimental      → sınıf modelde var, saha yanlış-pozitif oranı ölçülmedi
//   requires_training → modelde sınıf YOK → UI'da KİLİTLİ, asla olay üretmez
// Yeni model (ml/ hattı) sınıf eklediğinde burada terfi ettirilir; kod değişmez.
//
// GEOMETRİ: KKD kutusunun kişi kutusundaki dikey bandı (üstten oran) — Vision
// Engine kişi-ekipman eşlemesini bununla yapar. Yeni sınıf eklerken band girin.
(function () {
    "use strict";

    var REGISTRY = [
        {
            key: "helmet", status: "supported",
            label: { tr: "Baret", en: "Hard hat" },
            okClass: "Hardhat", violationClass: "NO-Hardhat",
            eventType: "no_helmet", risk: "high",
            band: [0.00, 0.45],
            note: { tr: "Cihaz üstü modelle tespit edilir.", en: "Detected by the on-device model." }
        },
        {
            key: "safety_vest", status: "supported",
            label: { tr: "Reflektörlü Yelek", en: "Safety vest" },
            okClass: "Safety Vest", violationClass: "NO-Safety Vest",
            eventType: "no_vest", risk: "high",
            band: [0.15, 0.75],
            note: { tr: "Cihaz üstü modelle tespit edilir.", en: "Detected by the on-device model." }
        },
        {
            key: "mask", status: "experimental",
            label: { tr: "Maske / Solunum Koruma", en: "Mask / respirator" },
            okClass: "Mask", violationClass: "NO-Mask",
            eventType: "no_mask", risk: "medium",
            band: [0.00, 0.40],
            note: { tr: "Sınıf modelde var; şantiyede yanlış pozitif oranı henüz ölçülmedi.",
                    en: "Class exists in the model; false-positive rate on site not yet measured." }
        },
        // --- Aşağıdakiler MEVCUT MODELDE YOK → kilitli. ml/ eğitim hattı bunları açar.
        {
            key: "safety_glasses", status: "requires_training",
            label: { tr: "Koruyucu Gözlük", en: "Safety glasses" },
            okClass: null, violationClass: null,
            eventType: "ppe_violation", risk: "medium",
            band: [0.00, 0.30],
            note: { tr: "Model eğitimi gerekir (ml/ hattı). Küçük nesne — yüz açısı kritik.",
                    en: "Requires model training. Small object — face angle is critical." }
        },
        {
            key: "gloves", status: "requires_training",
            label: { tr: "Eldiven", en: "Gloves" },
            okClass: null, violationClass: null,
            eventType: "ppe_violation", risk: "medium",
            band: [0.30, 0.85],
            note: { tr: "Model eğitimi gerekir (ml/ hattı). El görünürlüğü değişken.",
                    en: "Requires model training. Hand visibility varies." }
        },
        {
            key: "safety_harness", status: "requires_training",
            label: { tr: "Emniyet Kemeri", en: "Safety harness" },
            okClass: null, violationClass: null,
            eventType: "ppe_violation", risk: "critical",
            band: [0.20, 0.70],
            note: { tr: "Yüksekte çalışma için kritik — özel eğitim verisi gerekir.",
                    en: "Critical for work at height — requires dedicated training data." }
        },
        {
            key: "safety_boots", status: "requires_training",
            label: { tr: "İş Ayakkabısı", en: "Safety boots" },
            okClass: null, violationClass: null,
            eventType: "ppe_violation", risk: "medium",
            band: [0.80, 1.00],
            note: { tr: "Model eğitimi gerekir — alt kadraj/kamera açısı planlanmalı.",
                    en: "Requires model training — lower framing / camera angle needed." }
        },
        {
            key: "ear_protection", status: "requires_training",
            label: { tr: "Kulak Koruyucu", en: "Ear protection" },
            okClass: null, violationClass: null,
            eventType: "ppe_violation", risk: "medium",
            band: [0.00, 0.35],
            note: { tr: "Model eğitimi gerekir — baretle karışma riski yüksek.",
                    en: "Requires model training — high confusion risk with hard hats." }
        }
    ];

    var byKey = {};
    REGISTRY.forEach(function (r) { byKey[r.key] = r; });

    // Taranabilir = modelde gerçekten sınıfı olanlar (supported + experimental).
    function scannable() {
        return REGISTRY.filter(function (r) { return r.status !== "requires_training"; });
    }
    function isLocked(key) {
        var r = byKey[key];
        return !r || r.status === "requires_training";
    }
    // Vision Engine'in kullandığı geometri haritası — kayıttan ÜRETİLİR.
    function geometry() {
        var g = {};
        scannable().forEach(function (r) {
            g[r.key] = { okCls: r.okClass, noCls: r.violationClass, band: r.band };
        });
        return g;
    }
    function label(key, lang) {
        var r = byKey[key];
        return r ? (r.label[lang] || r.label.tr) : key;
    }
    // Varsayılan profil: supported AÇIK, experimental KAPALI, kilitli KAPALI.
    function defaultProfile() {
        var p = {};
        REGISTRY.forEach(function (r) { p[r.key] = r.status === "supported"; });
        return p;
    }
    // Profil temizliği: kilitli ekipman ASLA açık kalamaz (dürüstlük korumasi).
    function sanitize(profile) {
        var out = defaultProfile();
        Object.keys(out).forEach(function (k) {
            if (profile && typeof profile[k] === "boolean") out[k] = profile[k];
            if (isLocked(k)) out[k] = false;
        });
        return out;
    }

    var api = {
        REGISTRY: REGISTRY, byKey: byKey, scannable: scannable, isLocked: isLocked,
        geometry: geometry, label: label, defaultProfile: defaultProfile, sanitize: sanitize
    };
    if (typeof window !== "undefined") window.miaPpe = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api; // Node testleri
})();
