// === MIA — Tespit Sonrası İşleme (False-Positive Azaltma) — Sprint 2 ===
// Roboflow ham tespitlerini panele/alarma vermeden önce temizler:
//   1) Min kutu boyutu filtresi   — çok küçük/uzak kutular gürültüdür.
//   2) Sınıf bazlı güven eşiği     — ihlal sınıfları (NO-*) için daha yüksek bar.
//   3) Sınıf-içi NMS (dedup)       — aynı karede çakışan aynı sınıf kutularını birleştir.
//   4) Çelişki çözümü              — aynı yerde Hardhat vs NO-Hardhat → yüksek güveni tut.
//
// Saf fonksiyon: aynı girdi → aynı çıktı, yan etki yok. Hem tarayıcıda
// (window.MIAPostProcess) hem Node'da (module.exports) çalışır, test edilebilir.

(function (root, factory) {
    var api = factory();
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    if (root) root.MIAPostProcess = api;
})(typeof window !== "undefined" ? window : null, function () {

    var DEFAULTS = {
        minBoxArea: 0.0008,        // normalize alan (w*h); ~ kareye %0.08'den küçük at
        confViolation: 50,         // NO-Hardhat/NO-Vest/NO-Mask için min güven (%)
        confDefault: 35,           // diğer sınıflar için min güven (%)
        nmsIou: 0.5,               // aynı sınıf çakışma eşiği
        conflictIou: 0.45,         // ok vs NO-* çelişki eşiği
        timeBucketSec: 1           // aynı "kare" sayılacak zaman penceresi
    };

    var VIOLATION = { no_hardhat: 1, no_vest: 1, no_mask: 1, no_helmet: 1 };
    // Çelişen çiftler (uyumlu ↔ ihlal): aynı bölgede ikisi birden olamaz.
    var CONFLICT = { hardhat_ok: "no_hardhat", no_hardhat: "hardhat_ok",
                     vest_ok: "no_vest", no_vest: "vest_ok",
                     mask_ok: "no_mask", no_mask: "mask_ok" };

    function area(b) { return Math.max(0, b.w) * Math.max(0, b.h); }

    function iou(a, b) {
        var ax2 = a.x + a.w, ay2 = a.y + a.h, bx2 = b.x + b.w, by2 = b.y + b.h;
        var ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
        var iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
        var inter = ix * iy;
        if (inter <= 0) return 0;
        var ua = area(a) + area(b) - inter;
        return ua > 0 ? inter / ua : 0;
    }

    function minConf(type, o) {
        return VIOLATION[type] ? o.confViolation : o.confDefault;
    }

    // Olayları zaman kovasına göre grupla (aynı karedeki tespitler birlikte değerlendirilir)
    function bucketKey(e, o) {
        return Math.floor((e.timestamp_sec || 0) / o.timeBucketSec);
    }

    function process(events, opts) {
        var o = Object.assign({}, DEFAULTS, opts || {});
        if (!Array.isArray(events)) return [];

        // 1+2) boyut ve güven filtresi
        var kept = events.filter(function (e) {
            if (!e || !e.bbox) return false;
            if (area(e.bbox) < o.minBoxArea) return false;
            if ((e.confidence || 0) < minConf(e.type, o)) return false;
            return true;
        });

        // kovalara ayır
        var buckets = {};
        kept.forEach(function (e) {
            var k = bucketKey(e, o);
            (buckets[k] = buckets[k] || []).push(e);
        });

        var out = [];
        Object.keys(buckets).forEach(function (k) {
            var group = buckets[k].slice().sort(function (a, b) { return (b.confidence || 0) - (a.confidence || 0); });
            var survivors = [];
            group.forEach(function (e) {
                var drop = false;
                for (var i = 0; i < survivors.length; i++) {
                    var s = survivors[i];
                    var ov = iou(e.bbox, s.bbox);
                    // 3) aynı sınıf NMS
                    if (e.type === s.type && ov >= o.nmsIou) { drop = true; break; }
                    // 4) çelişki: aynı bölgede uyumlu vs ihlal → yüksek güvenli zaten survivors'ta, bunu at
                    if (CONFLICT[e.type] === s.type && ov >= o.conflictIou) { drop = true; break; }
                }
                if (!drop) survivors.push(e);
            });
            out = out.concat(survivors);
        });

        out.sort(function (a, b) { return (a.timestamp_sec || 0) - (b.timestamp_sec || 0); });
        return out;
    }

    return { process: process, _iou: iou, _defaults: DEFAULTS };
});
