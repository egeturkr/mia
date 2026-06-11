// MIA — Sağlık & Yapılandırma Kontrolü (Production Infra — Faz 4)
// /api/health → zorunlu ortam değişkenlerinin tanımlı OLUP olmadığını (değerleri
// SIZDIRMADAN, yalnızca boolean) ve endpoint envanterini döner. Uptime izleyiciler
// ve deploy sonrası doğrulama içindir. Sır göstermez; sadece "set mi" bilgisini verir.

const log = require("./lib/log");

// Supabase'e gerçek sorgu — yapılandırma DOĞRU MU çalışıyor testi (sır sızdırmaz).
async function pingSupabase() {
    var t0 = Date.now();
    try {
        var k = process.env.SUPABASE_SERVICE_ROLE_KEY;
        var r = await fetch((process.env.SUPABASE_URL || "").replace(/\/$/, "") +
            "/rest/v1/api_usage?select=id&limit=1",
            { headers: { apikey: k, Authorization: "Bearer " + k } });
        return { ok: r.ok, ms: Date.now() - t0 };
    } catch (e) { return { ok: false, ms: Date.now() - t0 }; }
}

exports.handler = async function () {
    var required = {
        SUPABASE_URL: !!process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        ROBOFLOW_API_KEY: !!process.env.ROBOFLOW_API_KEY,
        MODAL_URL: !!process.env.MODAL_URL,
        RESEND_API_KEY: !!process.env.RESEND_API_KEY,
        MIA_SCAN_TOKEN: !!process.env.MIA_SCAN_TOKEN,
    };
    var missing = Object.keys(required).filter(function (k) { return !required[k]; });

    // İsteğe bağlı; eksikliği "kritik" sayılmaz (örn. headless RFID kullanılmıyorsa scan token).
    var optional = ["MIA_SCAN_TOKEN", "MIA_ALLOWED_ORIGINS"];
    var criticalMissing = missing.filter(function (k) { return optional.indexOf(k) === -1; });

    // Faz 10: canlı kontroller
    var sb = await pingSupabase();
    var checks = {
        supabase: sb.ok ? "healthy" : "down",
        supabase_latency_ms: sb.ms,
        ai_config: (required.ROBOFLOW_API_KEY && required.MODAL_URL) ? "configured" : "missing",
        billing: process.env.MIA_BILLING_SECRET ? ((process.env.BILLING_PROVIDER || "manual")) : "not_configured",
        email: required.RESEND_API_KEY ? "configured" : "missing",
    };
    var overall = !sb.ok ? "down" : (criticalMissing.length === 0 ? "healthy" : "degraded");
    // health_checks tablosuna yaz (başarısızlık yutulur) + Supabase düşükse hata logla
    log.logHealth("api_health", overall, sb.ms, criticalMissing.length ? ("missing: " + criticalMissing.join(",")) : null);
    if (!sb.ok) log.logError({ source: "api", severity: "critical", code: "supabase_down", message: "health: Supabase ping failed", fn: "health" });

    var body = {
        service: "MIA",
        status: overall === "healthy" ? "ok" : overall,
        health: overall,
        checks: checks,
        time: new Date().toISOString(),
        env: required,                       // yalnızca boolean
        critical_missing: criticalMissing,
        endpoints: {
            "/api/detect":  { auth: "supabase-jwt", limit: "30/min", quota: "300/month" },
            "/api/analyze": { auth: "jwt-or-ip",    limit: "5/min",  quota: "user 300/month · anon 3/day" },
            "/api/scan":    { auth: "scan-token",   limit: "120/min", quota: "-" },
            "/api/notify":  { auth: "server",       limit: "-", quota: "-" },
            "/api/health":  { auth: "public",       limit: "-", quota: "-" }
        }
    };
    return {
        statusCode: overall === "down" ? 503 : (criticalMissing.length === 0 ? 200 : 503),
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify(body, null, 2),
    };
};
