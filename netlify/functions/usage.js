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

    // Faz 6: org-aware — x-mia-org başlığı varsa (ve üyelik doğrulanırsa) org planı/kullanımı.
    const orgCtx = await guard.resolveOrgContext(user.id, event);
    const planCtx = await guard.resolvePlanContext(user.id, orgCtx ? orgCtx.orgId : null);
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const used = (planCtx.scope === "org" && orgCtx)
        ? await guard.countOrgUsage(orgCtx.orgId, ["detect", "analyze"], since30, planCtx.limit)
        : await guard.countSinceGroup("user:" + user.id, ["detect", "analyze"], since30, planCtx.limit);

    return guard.resp(200, {
        plan: planCtx.plan,
        scope: planCtx.scope,
        org_id: orgCtx ? orgCtx.orgId : null,
        org_role: orgCtx ? orgCtx.role : null,
        quota_monthly_ai: planCtx.limit,
        used_monthly_ai: used == null ? null : used,
        remaining: (used == null) ? null : Math.max(0, planCtx.limit - used),
        window: "30d",
    }, origin);
};
