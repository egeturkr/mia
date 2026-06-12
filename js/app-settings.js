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

    // Sürüm güvenlik durumu — manifest TEK gerçek kaynak; pending alanlar dürüstçe pending
    fetch("/releases/manifest.json").then(function (x) { return x.ok ? x.json() : null; })
        .then(function (m) {
            var el = $("seRelease"); if (!el) return;
            if (!m) { el.innerHTML = '<div class="empty">Sürüm manifesti okunamadı.</div>'; return; }
            var a = (m.artifacts || [])[0] || {};
            var row = function (k, ok, txtOk, txtNo) {
                return "<div style='display:flex;justify-content:space-between;padding:.32rem 0;border-bottom:1px solid #1d1d1d;'>" +
                    "<span>" + k + '</span><span class="b ' + (ok ? "b-ok" : "b-warn") + '">' + (ok ? txtOk : txtNo) + "</span></div>";
            };
            el.innerHTML =
                row("Sürüm kanalı", m.release_channel === "internal-pilot", m.release_channel, m.release_channel) +
                row("Sürüm", true, m.version || "—", "") +
                row("Kod imzalama", !!a.signed, "imzalı", "beklemede") +
                row("Apple notarization", !!a.notarized, "tamamlandı", "beklemede") +
                row("Malware taraması", !!a.malware_scanned, "tarandı", "beklemede") +
                row("SHA256 checksum", !!a.sha256, "mevcut", "yok") +
                "<div class='ca-muted' style='margin-top:.5rem;line-height:1.6;'>" +
                "Snapshot saklama: <b>kapalı</b> (varsayılan) · Kamera kimlik bilgileri: yalnız worker " +
                "cihazında · Uygulama kabuğu: hiçbir gizli anahtar içermez/saklamaz." +
                (a.sha256 ? "<br>SHA256: <code style='font-size:.62rem;word-break:break-all;'>" + esc(a.sha256) + "</code>" : "") +
                "</div>";
        }).catch(function () { var el = $("seRelease"); if (el) el.innerHTML = '<div class="empty">Sürüm manifesti okunamadı.</div>'; });

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
