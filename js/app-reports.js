// === MIA Uygulaması — Rapor Merkezi (Faz 17) ===
// Dönemsel GERÇEK özet (camera_events + analyses) + export denetim izi (report_exports).

(function () {
    if (!document.getElementById("rpSummary")) return;
    var $ = function (id) { return document.getElementById(id); };
    var esc = window.miaEsc || function (s) { return String(s == null ? "" : s); };
    var fmtT = function (d) { return d ? new Date(d).toLocaleString("tr-TR") : "—"; };
    var user = null, lastSummary = null;

    function load() {
        var days = parseInt($("rpPeriod").value, 10);
        var since = new Date(Date.now() - days * 86400000).toISOString();
        var oid = window.MIAOrg && window.MIAOrg.currentId();

        var camP = oid
            ? supabase.from("camera_events").select("event_type,risk_level,status,created_at")
                .eq("org_id", oid).gte("created_at", since).limit(1000)
            : Promise.resolve({ data: [] });
        var anaQ = supabase.from("analyses").select("created_at,violations_count").gte("created_at", since);
        anaQ = oid ? anaQ.or("user_id.eq." + user.id + ",org_id.eq." + oid) : anaQ.eq("user_id", user.id);

        Promise.all([camP, anaQ]).then(function (res) {
            var evs = (res[0].data || []).filter(function (e) { return (e.event_type || "").indexOf("no_") === 0; });
            var anas = res[1].data || [];
            var vidV = anas.reduce(function (s, a) { return s + (a.violations_count || 0); }, 0);
            var high = evs.filter(function (e) { return e.risk_level === "high" || e.risk_level === "critical"; }).length;
            var open = evs.filter(function (e) { return e.status === "open"; }).length;
            lastSummary = { days: days, cam_total: evs.length, cam_high: high, cam_open: open,
                            video_analyses: anas.length, video_violations: vidV };
            $("rpSummary").innerHTML =
                '<table class="t"><thead><tr><th>Kaynak</th><th>Kayıt</th><th>İhlal</th><th>Yüksek Risk</th><th>Açık</th></tr></thead><tbody>' +
                "<tr><td><b>Canlı Kamera</b></td><td>" + evs.length + " olay</td><td>" + evs.length + "</td><td>" + high + "</td><td>" + open + "</td></tr>" +
                "<tr><td><b>Yüklenen Video</b></td><td>" + anas.length + " analiz</td><td>" + vidV + "</td><td colspan='2' class='ca-muted'>detay: İhlal Raporu</td></tr>" +
                "</tbody></table>" +
                '<p class="ca-muted" style="margin:.6rem 0 0;">Rakamlar gerçek kayıtlardır; canlı olaylar AI ön değerlendirmesidir (saha doğrulaması pilotta).</p>';
        });
    }

    $("rpPeriod").addEventListener("change", load);
    $("rpCsvBtn").addEventListener("click", function () {
        if (!lastSummary) return;
        var s = lastSummary;
        var lines = ["Dönem (gün),Canlı Kamera Olayı,Yüksek Risk,Açık,Video Analizi,Video İhlali",
            [s.days, s.cam_total, s.cam_high, s.cam_open, s.video_analyses, s.video_violations].join(",")];
        var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = "mia-ozet-" + s.days + "gun-" + Date.now() + ".csv";
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 200);
        if (window.MIAReport) window.MIAReport.logExport(null, null, "csv", { source: "app_summary", days: s.days });
    });

    function history() {
        supabase.from("report_exports").select("*").order("created_at", { ascending: false }).limit(25)
            .then(function (r) {
                var rows = r.data || [];
                $("rpHistory").innerHTML = (r.error || !rows.length)
                    ? '<div class="empty">Henüz dışa aktarma kaydı yok.</div>'
                    : '<table class="t"><thead><tr><th>Zaman</th><th>Tür</th><th>Kaynak</th></tr></thead><tbody>' +
                      rows.map(function (x) {
                          return "<tr><td>" + fmtT(x.created_at) + "</td><td>" + esc(x.format || x.export_type || "—") +
                              "</td><td class='ca-muted'>" + esc((x.metadata && (x.metadata.source || "")) || "—") + "</td></tr>";
                      }).join("") + "</tbody></table>";
            });
    }

    document.addEventListener("mia-app-ready", function (ev) {
        user = ev.detail.user;
        load(); history();
    });
})();
