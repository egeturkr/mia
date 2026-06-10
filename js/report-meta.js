// === MIA — Rapor Meta & Doğrulanabilirlik (Faz 9) ===
// Rapor ID (MIA-RPT-YYYYMMDD-XXXXXX), SHA-256 bütünlük hash'i, model/doğrulama
// bilgisi (eval/validation_latest.json + model_registry.json'dan — sayı UYDURMAZ)
// ve export geçmişi kaydı. Tüm fonksiyonlar zarif düşer: tablo/dosya yoksa rapor
// üretimi ASLA engellenmez (meta "bilinmiyor" olur).

(function () {
    var R = (window.MIAReport = window.MIAReport || {});
    var _modelCache = null;

    R.newReportId = function () {
        var d = new Date();
        var ymd = d.getFullYear() + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2);
        var rnd = "";
        try {
            var a = new Uint8Array(4); crypto.getRandomValues(a);
            rnd = Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("").slice(0, 6).toUpperCase();
        } catch (e) { rnd = Math.random().toString(36).slice(2, 8).toUpperCase(); }
        return "MIA-RPT-" + ymd + "-" + rnd;
    };

    // SHA-256 (ilk 16 hex) — gizli veri içermez; istikrarlı özet alanlarından üretilir.
    R.hash = function (obj) {
        try {
            var txt = JSON.stringify(obj);
            if (window.crypto && crypto.subtle && window.isSecureContext) {
                return crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt)).then(function (buf) {
                    return Array.prototype.map.call(new Uint8Array(buf), function (b) {
                        return ("0" + b.toString(16)).slice(-2);
                    }).join("").slice(0, 16).toUpperCase();
                }).catch(function () { return null; });
            }
        } catch (e) {}
        return Promise.resolve(null); // eski tarayıcı/insecure context — dürüst fallback
    };

    // Model + doğrulama durumu (önbellekli). Asla sayı uydurmaz.
    R.modelInfo = function () {
        if (_modelCache) return Promise.resolve(_modelCache);
        return fetch("eval/validation_latest.json", { cache: "no-store" })
            .then(function (r) { return r.ok ? r.json() : null; })
            .catch(function () { return null; })
            .then(function (v) {
                _modelCache = {
                    model: (v && v.model) || "construction-site-safety/27",
                    version: (v && v.model_version) || "rf-27",
                    status: (v && v.status) || "unknown",            // pending | measured | unknown
                    dataset: (v && v.dataset_name) || null,
                    measured_at: (v && v.measured_at) || null,
                    mAP50: (v && v.status === "measured") ? v.mAP50 : null
                };
                return _modelCache;
            });
    };

    R.validationLine = function (info, lang) {
        var tr = (lang || "tr") === "tr";
        if (info && info.status === "measured") {
            return tr
                ? "Saha doğrulaması: ÖLÇÜLDÜ (" + (info.dataset || "saha seti") + ", " + (info.measured_at || "") + "). mAP@0.5: " + Math.round((info.mAP50 || 0) * 100) + "%."
                : "Field validation: MEASURED (" + (info.dataset || "field set") + ", " + (info.measured_at || "") + "). mAP@0.5: " + Math.round((info.mAP50 || 0) * 100) + "%.";
        }
        return tr
            ? "Bu model için saha verisiyle ölçülmüş doğrulama sonucu henüz yayınlanmamıştır."
            : "Measured field validation results have not yet been published for this model.";
    };

    // Rapor üretimi için tüm metayı topla (her alan başarısız olabilir → null).
    R.prepare = function (row) {
        var reportId = R.newReportId();
        var generatedAt = new Date().toISOString();
        return R.modelInfo().then(function (info) {
            return R.hash({
                report_id: reportId, analysis_id: row && row.id, video: row && row.video_name,
                score: row && row.safety_score, violations: row && row.violations_count,
                model: info.version, generated_at: generatedAt
            }).then(function (h) {
                return { reportId: reportId, generatedAt: generatedAt, model: info, hash: h };
            });
        }).catch(function () {
            return { reportId: reportId, generatedAt: generatedAt,
                     model: { model: "unknown", version: "unknown", status: "unknown" }, hash: null };
        });
    };

    // Export geçmişi — tablo yoksa veya oturum yoksa sessizce geçer.
    R.logExport = function (analysisId, reportId, type, meta) {
        try {
            var sb = window.supabase;
            if (!sb || !sb.auth) return;
            sb.auth.getSession().then(function (r) {
                var s = r && r.data && r.data.session;
                if (!s) return;
                sb.from("report_exports").insert({
                    analysis_id: analysisId || null, report_id: reportId || null,
                    user_id: s.user.id,
                    org_id: (window.MIAOrg && window.MIAOrg.currentId()) || null,
                    export_type: type, metadata: meta || null
                }).then(function (res) {
                    if (res.error) console.warn("[MIA] export logu yazılamadı (migration?):", res.error.message);
                });
            });
        } catch (e) { /* rapor üretimini asla engelleme */ }
    };
})();
