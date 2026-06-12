// === MIA Uygulaması — Takım (Faz 17) ===
// Org üyeleri (salt görüntüleme; davet/rol yönetimi web organizasyon sayfasında).

(function () {
    if (!document.getElementById("tmMembers")) return;
    var $ = function (id) { return document.getElementById(id); };
    var esc = window.miaEsc || function (s) { return String(s == null ? "" : s); };
    var ROLE = { owner: ["Sahip", "b-warn"], admin: ["Yönetici", "b-warn"],
                 safety_manager: ["İSG Uzmanı", "b-ok"], viewer: ["İzleyici", "b-mut"] };

    document.addEventListener("mia-app-ready", function () {
        var oid = window.MIAOrg && window.MIAOrg.currentId();
        if (!oid) { $("tmMembers").innerHTML = '<div class="empty">Organizasyon bulunamadı.</div>'; return; }
        supabase.from("organization_memberships").select("email,role,status,joined_at")
            .eq("org_id", oid).order("joined_at").then(function (r) {
                var rows = (r.data || []).filter(function (m) { return m.status === "active"; });
                $("tmMembers").innerHTML = (r.error || !rows.length)
                    ? '<div class="empty">Üye listesi okunamadı veya boş.</div>'
                    : '<table class="t"><thead><tr><th>E-posta</th><th>Rol</th><th>Katılım</th></tr></thead><tbody>' +
                      rows.map(function (m) {
                          var rr = ROLE[m.role] || [m.role, "b-mut"];
                          return "<tr><td>" + esc(m.email || "—") + "</td>" +
                              '<td><span class="b ' + rr[1] + '">' + rr[0] + "</span></td>" +
                              "<td class='ca-muted'>" + (m.joined_at ? new Date(m.joined_at).toLocaleDateString("tr-TR") : "—") + "</td></tr>";
                      }).join("") + "</tbody></table>";
            });
    });
})();
