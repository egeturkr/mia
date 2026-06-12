// === MIA Uygulaması — Sahalar (Faz 17) ===
// organization_sites + kamera atamaları + saha bazlı izleme durumu (gerçek veriler).

(function () {
    if (!document.getElementById("stList")) return;
    var $ = function (id) { return document.getElementById(id); };
    var esc = window.miaEsc || function (s) { return String(s == null ? "" : s); };

    document.addEventListener("mia-app-ready", function () {
        var oid = window.MIAOrg && window.MIAOrg.currentId();
        if (!oid) { $("stList").innerHTML = '<div class="empty">Organizasyon bulunamadı.</div>'; return; }
        Promise.all([
            supabase.from("organization_sites").select("*").eq("org_id", oid).order("created_at"),
            supabase.from("cameras").select("id,name,site_id,health_status,status").eq("org_id", oid).neq("status", "archived"),
            supabase.from("ppe_detection_profiles").select("site_id,name").eq("org_id", oid)
        ]).then(function (res) {
            var sites = (res[0].data) || [];
            var cams = (res[1].data) || [];
            var profs = (res[2].data) || [];
            if (res[0].error) { $("stList").innerHTML = '<div class="empty">Saha tabloları okunamadı.</div>'; return; }
            if (!sites.length) { $("stList").innerHTML = '<div class="empty">Henüz saha tanımlanmamış — Organizasyon sayfasından ekleyin.</div>'; return; }
            $("stList").innerHTML = '<table class="t"><thead><tr><th>Saha</th><th>Durum</th><th>Kameralar</th><th>İzleme</th><th>KKD Profili</th></tr></thead><tbody>' +
                sites.map(function (s) {
                    var sc = cams.filter(function (c) { return c.site_id === s.id; });
                    var on = sc.filter(function (c) { return c.health_status === "online"; }).length;
                    var prof = profs.filter(function (p) { return p.site_id === s.id; })[0];
                    return "<tr><td><b>" + esc(s.name) + "</b><div class='ca-muted'>" + esc(s.city || "") + "</div></td>" +
                        '<td><span class="b ' + (s.status === "active" ? "b-ok" : "b-mut") + '">' + esc(s.status || "—") + "</span></td>" +
                        "<td>" + (sc.length ? sc.length + " kamera" : "—") + "</td>" +
                        "<td>" + (!sc.length ? '<span class="b b-mut">kamera yok</span>'
                            : on ? '<span class="b b-ok">' + on + "/" + sc.length + " çevrimiçi</span>"
                            : '<span class="b b-bad">çevrimdışı</span>') + "</td>" +
                        "<td class='ca-muted'>" + (prof ? esc(prof.name) : "org varsayılanı") + "</td></tr>";
                }).join("") + "</tbody></table>" +
                (cams.some(function (c) { return !c.site_id; })
                    ? '<p class="ca-muted" style="margin:.6rem 0 0;">Not: ' + cams.filter(function (c) { return !c.site_id; }).length +
                      " kamera henüz bir sahaya atanmadı.</p>" : "");
        });
    });
})();
