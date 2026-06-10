// Netlify Function: /api/detect → Roboflow Hosted Inference (proxy).
// PRODUCTION HARDENING (Faz 1): origin allowlist + Supabase JWT zorunlu +
// rate-limit + aylık kota + loglama. Yetkisiz kullanıcı AI kredisi tüketemez.
// API anahtarı sunucuda kalır. Env: ROBOFLOW_API_KEY, SUPABASE_URL,
// SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, (ops.) MIA_ALLOWED_ORIGINS.

const guard = require("./lib/guard");

exports.handler = async function (event) {
    // 1) Güvenlik: origin + kimlik (login zorunlu) + rate-limit + kota
    const g = await guard.enforce(event, { endpoint: "detect", perMin: 30, perMonth: 300, auth: "user" });
    if (!g.ok) return g.response;

    const apiKey = process.env.ROBOFLOW_API_KEY;
    if (!apiKey) return guard.resp(500, { error: "ROBOFLOW_API_KEY env var not configured" }, g.origin);

    const q = event.queryStringParameters || {};
    const model = (q.model || "construction-site-safety/27").toString();
    const confidence = (q.confidence || "35").toString();
    const overlap = (q.overlap || "30").toString();

    let image;
    try { image = JSON.parse(event.body || "{}").image; }
    catch (e) { return guard.resp(400, { error: "invalid JSON body" }, g.origin); }
    if (!image) return guard.resp(400, { error: "missing 'image' in body" }, g.origin);

    const url = "https://serverless.roboflow.com/" + model +
        "?api_key=" + encodeURIComponent(apiKey) +
        "&confidence=" + encodeURIComponent(confidence) +
        "&overlap=" + encodeURIComponent(overlap);

    try {
        const rf = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: image
        });
        const text = await rf.text();
        // 2) Kullanım kaydı (kota/rate sayımı + denetim)
        await guard.logUsage(g.subject, g.subjectType, "detect", rf.status, g.orgId);
        return { statusCode: rf.status, headers: guard.corsHeaders(g.origin), body: text };
    } catch (err) {
        await guard.logUsage(g.subject, g.subjectType, "detect", 502, g.orgId);
        return guard.resp(502, { error: "Roboflow upstream failed: " + (err && err.message || err) }, g.origin);
    }
};
