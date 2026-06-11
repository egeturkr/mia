// === MIA — Hafif İstemci İzleme (Faz 10) ===
// Yakalanmamış hatalar → /api/log-client-error (JWT'li, oturum başına en çok 5).
// Ürün olayları → system_events (yalnız kendi adına, info, RLS'li).
// KURALLAR: token/localStorage/video içeriği/form değerleri ASLA gönderilmez;
// izleme hatası ürünü ASLA bozmaz.

(function () {
    var M = (window.MIAMonitor = window.MIAMonitor || {});
    var errCount = 0, MAX_ERR = 5;

    function token() {
        if (!(window.supabase && supabase.auth)) return Promise.resolve(null);
        return supabase.auth.getSession().then(function (r) {
            return (r && r.data && r.data.session && r.data.session.access_token) || null;
        }).catch(function () { return null; });
    }

    M.error = function (message, stack, code) {
        if (errCount >= MAX_ERR) return;
        errCount++;
        token().then(function (tok) {
            if (!tok) return; // anonim hatalar gönderilmez (spam önleme)
            fetch("/api/log-client-error", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok },
                body: JSON.stringify({
                    message: String(message || "").slice(0, 300),
                    stack: stack ? String(stack).slice(0, 1000) : null,
                    code: code || null,
                    route: location.pathname
                })
            }).catch(function () {});
        });
    };

    // Ürün olayı — system_events'e doğrudan (RLS: kendi adına, source=frontend, info).
    M.event = function (type, meta) {
        try {
            if (!(window.supabase && supabase.auth)) return;
            supabase.auth.getSession().then(function (r) {
                var s = r && r.data && r.data.session;
                if (!s) return;
                supabase.from("system_events").insert({
                    event_type: String(type).slice(0, 60), severity: "info", source: "frontend",
                    user_id: s.user.id,
                    org_id: (window.MIAOrg && window.MIAOrg.currentId()) || null,
                    route: location.pathname, metadata: meta || null
                }).then(function (res) {
                    if (res.error) console.warn("[MIA-ops] olay yazılamadı (migration?):", res.error.message);
                });
            });
        } catch (e) { /* asla bozma */ }
    };

    window.addEventListener("error", function (e) {
        M.error(e.message || "window.onerror", e.error && e.error.stack, "onerror");
    });
    window.addEventListener("unhandledrejection", function (e) {
        var r = e.reason || {};
        M.error(r.message || String(r).slice(0, 200), r.stack, "unhandledrejection");
    });
})();
