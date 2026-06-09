// MIA — Sağlık & Yapılandırma Kontrolü (Production Infra — Faz 4)
// /api/health → zorunlu ortam değişkenlerinin tanımlı OLUP olmadığını (değerleri
// SIZDIRMADAN, yalnızca boolean) ve endpoint envanterini döner. Uptime izleyiciler
// ve deploy sonrası doğrulama içindir. Sır göstermez; sadece "set mi" bilgisini verir.

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

    var body = {
        service: "MIA",
        status: criticalMissing.length === 0 ? "ok" : "misconfigured",
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
        statusCode: criticalMissing.length === 0 ? 200 : 503,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify(body, null, 2),
    };
};
