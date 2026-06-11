// Netlify Function: /api/analyze → Modal video analiz backend (proxy).
// PRODUCTION HARDENING (Faz 1): Modal URL artık istemcide HARDCODED DEĞİL —
// MODAL_URL env'inde tutulur. Origin allowlist + rate-limit + kota uygulanır.
// Akış: giriş yapan kullanıcı → aylık kota; anonim demo ziyaretçi → IP bazlı
// günlük sıkı limit (özellik korunur ama AI kredisi suistimali engellenir).
// Env: MODAL_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.

const guard = require("./lib/guard");
const log = require("./lib/log");

exports.handler = async function (event) {
    // Modal video çıkarımı pahalı → dakika limiti düşük, anonim gün limiti sıkı.
    const g = await guard.enforce(event, {
        endpoint: "analyze", perMin: 5, perMonth: 300, auth: "user-or-ip", anonPerDay: 3,
    });
    if (!g.ok) return g.response;

    const MODAL_URL = process.env.MODAL_URL;
    if (!MODAL_URL) return guard.resp(500, { error: "MODAL_URL env var not configured" }, g.origin);

    // Gövdeyi olduğu gibi ilet (geriye uyumlu: { video, confidence, generate_report })
    let payload = event.body || "{}";
    try { JSON.parse(payload); } catch (e) { return guard.resp(400, { error: "invalid JSON body" }, g.origin); }

    try {
        const r = await fetch(MODAL_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
        });
        const text = await r.text();
        await guard.logUsage(g.subject, g.subjectType, "analyze", r.status, g.orgId);
        return { statusCode: r.status, headers: guard.corsHeaders(g.origin), body: text };
    } catch (err) {
        await guard.logUsage(g.subject, g.subjectType, "analyze", 502, g.orgId);
        await log.logError({ source: "ai_pipeline", code: "modal_upstream", message: "analyze upstream failed",
            userId: g.user && g.user.id, orgId: g.orgId, route: "/api/analyze", fn: "analyze" });
        return guard.resp(502, { error: "Modal upstream failed: " + (err && err.message || err) }, g.origin);
    }
};
