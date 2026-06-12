// === MIA Uygulaması — AI Tespit Durumu (Faz 17) ===
// Registry (gerçek model yetenekleri) + worker session metadata (model/latency/çıkarım).

(function () {
    if (!document.getElementById("adClasses")) return;
    var $ = function (id) { return document.getElementById(id); };
    var esc = window.miaEsc || function (s) { return String(s == null ? "" : s); };
    var RISK = { low: "Düşük", medium: "Orta", high: "Yüksek", critical: "Kritik" };

    // Sınıf tablosu (ppe-registry — tek gerçek kaynak)
    var rows = window.MIAPpeRegistry ? window.MIAPpeRegistry.all() : [];
    $("adClasses").innerHTML = rows.map(function (it) {
        var cls = it.status === "supported" ? "b-ok" : it.status === "experimental" ? "b-warn" : "b-mut";
        return "<tr" + (it.status === "requires_training" ? ' style="opacity:.6"' : "") + "><td><b>" + esc(it.label_tr) + "</b></td>" +
            '<td><span class="b ' + cls + '">' + window.MIAPpeRegistry.statusLabel(it.status) + "</span></td>" +
            "<td>" + (RISK[it.default_risk] || it.default_risk) + "</td>" +
            "<td class='ca-muted'>" + esc(it.note_tr) + "</td></tr>";
    }).join("");

    document.addEventListener("mia-app-ready", function () {
        // Worker / çıkarım durumu
        supabase.from("camera_worker_sessions").select("last_heartbeat_at,metadata")
            .order("last_heartbeat_at", { ascending: false }).limit(1).then(function (r) {
                var row = r.data && r.data[0];
                var fresh = row && row.last_heartbeat_at && (Date.now() - new Date(row.last_heartbeat_at).getTime()) < 120000;
                var m = (row && row.metadata) || {};
                $("adWorker").textContent = fresh ? "Bağlı" : "Bağlı değil";
                $("adWorker").className = "v " + (fresh ? "ok" : "bad");
                var inferOn = fresh && m.inference !== false;
                $("adInfer").textContent = !fresh ? "—" : m.inference === false ? "Kapalı" : "Aktif";
                $("adInfer").className = "v " + (!fresh ? "" : m.inference === false ? "bad" : "ok");
                $("adModel").textContent = (fresh && m.model) || "—";
                $("adLatency").textContent = (fresh && m.perf_ms && m.perf_ms.infer_ms != null) ? m.perf_ms.infer_ms + " ms" : "—";
            });

        // Aktif profil
        var oid = window.MIAOrg && window.MIAOrg.currentId();
        if (!oid) { $("adProfile").innerHTML = '<div class="empty">Organizasyon bulunamadı.</div>'; return; }
        supabase.from("ppe_detection_profiles").select("*").eq("org_id", oid)
            .eq("is_default", true).is("site_id", null).limit(1).then(function (r) {
                var p = r.data && r.data[0];
                var req = (p && p.required_equipment) || { helmet: true, safety_vest: true };
                var on = Object.keys(req).filter(function (k) { return req[k]; });
                $("adProfile").innerHTML =
                    (p ? "<b style='color:#ECECEC;'>" + esc(p.name) + "</b>" : "<b style='color:#ECECEC;'>Varsayılan</b> <span class='ca-muted'>(kaydedilmemiş — baret+yelek)</span>") +
                    '<div style="margin-top:.6rem;display:flex;gap:.4rem;flex-wrap:wrap;">' +
                    on.map(function (k) {
                        var it = window.MIAPpeRegistry && window.MIAPpeRegistry.get(k);
                        return '<span class="b b-ok">' + esc(it ? it.label_tr : k) + "</span>";
                    }).join("") + "</div>" +
                    '<p class="ca-muted" style="margin:.6rem 0 0;">Kapalı ekipmanlar ihlal üretmez; profil değişikliği worker yeniden başlatılınca etkinleşir.</p>';
            });
    });
})();
