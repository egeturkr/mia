// === MIA Uygulaması — Ayarlar (Faz 17) ===
(function () {
    if (!document.getElementById("seAccount")) return;
    var $ = function (id) { return document.getElementById(id); };
    var esc = window.miaEsc || function (s) { return String(s == null ? "" : s); };
    var user = null;

    document.addEventListener("mia-app-ready", function (ev) {
        user = ev.detail.user;
        var cur = window.MIAOrg && window.MIAOrg.current();
        var ROLE = { owner: "Sahip", admin: "Yönetici", safety_manager: "İSG Uzmanı", viewer: "İzleyici" };
        $("seAccount").innerHTML =
            "<b style='color:#ECECEC;'>" + esc(user.email) + "</b>" +
            "<div style='margin-top:.4rem;'>Organizasyon: " + esc(cur ? cur.name : "Kişisel Alan") +
            " · Rol: " + (ROLE[window.MIAOrg && window.MIAOrg.role()] || "—") + "</div>" +
            "<div class='ca-muted' style='margin-top:.3rem;'>Aynı hesap web sitesinde (miaissagligi.com) de geçerlidir.</div>";

        // Ortam bilgisi — gerçek /api/health
        fetch("/api/health").then(function (x) { return x.ok ? x.json() : null; }).then(function (h) {
            if (!h) { $("seEnv").innerHTML = '<div class="empty">Sağlık ucuna erişilemiyor.</div>'; return; }
            var c = h.checks || {};
            var row = function (k, v, ok) {
                return "<div style='display:flex;justify-content:space-between;padding:.32rem 0;border-bottom:1px solid #1d1d1d;'>" +
                    "<span>" + k + '</span><span class="b ' + (ok ? "b-ok" : "b-warn") + '">' + v + "</span></div>";
            };
            $("seEnv").innerHTML =
                row("Platform", h.health === "healthy" ? "sağlıklı" : h.health, h.health === "healthy") +
                row("Veritabanı", c.supabase + (c.supabase_latency_ms ? " · " + c.supabase_latency_ms + " ms" : ""), c.supabase === "healthy") +
                row("AI yapılandırması", c.ai_config || "—", c.ai_config === "configured") +
                row("Canlı worker", c.realtime_worker === "connected" ? "bağlı" : "bağlı değil", c.realtime_worker === "connected") +
                row("Aktif kamera", String(c.active_cameras != null ? c.active_cameras : "—"), (c.active_cameras || 0) > 0) +
                "<div class='ca-muted' style='margin-top:.5rem;'>Uygulama v0.1.0-pilot · " + esc(location.hostname) + "</div>";
        }).catch(function () { $("seEnv").innerHTML = '<div class="empty">Sağlık ucuna erişilemiyor.</div>'; });
    });

    $("sePassBtn").addEventListener("click", function () {
        if (!user) return;
        supabase.auth.resetPasswordForEmail(user.email, {
            redirectTo: "https://miaissagligi.com/sifre-sifirla.html"
        }).then(function (r) {
            $("seMsg").textContent = r.error ? "Gönderilemedi: " + r.error.message
                : "✓ Şifre sıfırlama bağlantısı e-postanıza gönderildi.";
        });
    });
})();
