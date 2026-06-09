// MIA — Kullanım & Plan Özeti (Billing — Faz 5)
// /api/usage → giriş yapan kullanıcının planını, bu ayki AI kullanımını ve kotasını döner.
// hesap.html bunu gösterir. Auth: Supabase JWT (Bearer). Origin allowlist uygulanır.

const guard = require("./lib/guard");

exports.handler = async function (event) {
    const origin = guard.getOrigin(event);
    if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: guard.corsHeaders(origin), body: "" };
    if (event.httpMethod !== "GET" && event.httpMethod !== "POST")
        return guard.resp(405, { error: "GET only" }, origin);
    // Origin zorunlu DEĞİL: aynı-origin GET'lerde tarayıcı Origin göndermez.
    // Gerçek koruma JWT'dir (read-only, durum değiştirmez). Yabancı origin VARSA reddet.
    if (origin && !guard.isOriginAllowed(origin)) return guard.resp(403, { error: "origin not allowed" }, origin);

    const token = guard.bearer(event);
    const user = token ? await guard.verifyUser(token) : null;
    if (!user) return guard.resp(401, { error: "authentication required" }, origin);

    const plan = await guard.resolvePlan(user.id);
    const limit = guard.PLAN_QUOTAS[plan] || guard.PLAN_QUOTAS.free;
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const used = await guard.countSinceGroup("user:" + user.id, ["detect", "analyze"], since30, limit);

    return guard.resp(200, {
        plan: plan,
        quota_monthly_ai: limit,
        used_monthly_ai: used == null ? null : used,
        remaining: (used == null) ? null : Math.max(0, limit - used),
        window: "30d",
    }, origin);
};
