// === MIA Uygulaması — QR Saha Doğrulama Katmanı (Faz 19) ===
// GERÇEK tablolara bağlanır: workers (rozet), equipment (KKD etiketi),
// checkpoints (geçiş noktası), scans (giriş/uyum kayıtları). RLS yaptırımı
// sunucudadır; kayıt yoksa dürüst boş durum gösterilir — sahte kayıt YOK.

(function () {
    if (!document.getElementById("qrWorkers")) return;
    var $ = function (id) { return document.getElementById(id); };
    var esc = window.miaEsc || function (s) { return String(s == null ? "" : s); };
    var ago = function (d) {
        if (!d) return "—";
        var s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
        return s < 3600 ? Math.floor(s / 60) + " dk önce" : s < 86400 ? Math.floor(s / 3600) + " sa önce"
             : Math.floor(s / 86400) + " gün önce";
    };

    document.addEventListener("mia-app-ready", function () {
        var week = new Date(Date.now() - 7 * 86400000).toISOString();
        function cnt(q, el, cls) {
            q.then(function (r) {
                var n = r.count != null ? r.count : (r.data || []).length;
                $(el).textContent = r.error ? "—" : n;
                if (cls && !r.error && n > 0) $(el).className = "v " + cls;
            });
        }
        cnt(supabase.from("workers").select("id", { count: "exact", head: true }).eq("active", true), "qrWorkers");
        cnt(supabase.from("equipment").select("id", { count: "exact", head: true }), "qrEquip");
        cnt(supabase.from("checkpoints").select("id", { count: "exact", head: true }), "qrCheckpoints");
        cnt(supabase.from("scans").select("id", { count: "exact", head: true }).gte("created_at", week), "qrScans");
        cnt(supabase.from("scans").select("id", { count: "exact", head: true })
            .gte("created_at", week).eq("compliant", false), "qrNoncomp", "bad");

        // Son geçiş taramaları (gerçek scans kayıtları)
        supabase.from("scans").select("worker_name,worker_code,compliant,missing,created_at,source")
            .order("created_at", { ascending: false }).limit(6).then(function (r) {
                var rows = r.data || [];
                $("qrRecentScans").innerHTML = (r.error || !rows.length)
                    ? '<div class="empty">Henüz tarama kaydı yok — Tarama Ekranı ile geçiş noktası kurun.</div>'
                    : rows.map(function (s) {
                        return '<div style="display:flex;justify-content:space-between;gap:.5rem;padding:.4rem 0;border-bottom:1px solid #1d1d1d;font-size:.82rem;">' +
                            "<span><b>" + esc(s.worker_name || s.worker_code || "—") + "</b>" +
                            ' <span class="ca-muted">' + esc(s.source || "qr") + "</span></span>" +
                            "<span>" + (s.compliant
                                ? '<span class="b b-ok">uyumlu</span>'
                                : '<span class="b b-bad">eksik: ' + esc((s.missing || []).join(", ") || "?") + "</span>") +
                            ' <span class="ca-muted">' + ago(s.created_at) + "</span></span></div>";
                    }).join("");
            });
    });
})();
