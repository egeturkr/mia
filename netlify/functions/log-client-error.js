// MIA — İstemci Hata Logu (Faz 10). JWT zorunlu + 10/dk limit + sanitizasyon.
// Token, localStorage, video içeriği veya hassas form değerleri ASLA saklanmaz.

const guard = require("./lib/guard");
const log = require("./lib/log");

exports.handler = async function (event) {
    const origin = guard.getOrigin(event);
    if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: guard.corsHeaders(origin), body: "" };
    if (event.httpMethod !== "POST") return guard.resp(405, { error: "POST only" }, origin);
    if (!guard.isOriginAllowed(origin)) return guard.resp(403, { error: "origin not allowed" }, origin);

    const token = guard.bearer(event);
    const user = token ? await guard.verifyUser(token) : null;
    if (!user) return guard.resp(401, { error: "authentication required" }, origin);

    const subject = "user:" + user.id;
    const minAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const n = await guard.countSince(subject, "clienterr", minAgo, 10);
    if (n === null) return guard.resp(503, { error: "unavailable" }, origin);
    if (n >= 10) return guard.resp(429, { error: "rate limit" }, origin);

    let p;
    try { p = JSON.parse(event.body || "{}"); } catch (e) { return guard.resp(400, { error: "invalid JSON" }, origin); }

    await log.logError({
        source: "frontend",
        severity: ["warning", "error", "critical"].indexOf(p.severity) !== -1 ? p.severity : "error",
        code: p.code ? String(p.code).slice(0, 40) : null,
        message: p.message || "client error",
        stack: p.stack || null,                       // yalnız hash'lenir, ham stack saklanmaz
        userId: user.id,
        route: p.route ? String(p.route).slice(0, 120) : null,
        fn: "log-client-error",
        meta: { ua: (event.headers["user-agent"] || "").slice(0, 120) },
    });
    await guard.logUsage(subject, "user", "clienterr", 200);
    return guard.resp(200, { ok: true }, origin);
};
