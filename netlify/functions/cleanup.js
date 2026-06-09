// MIA — Veri Saklama / Temizlik İşi (Production Infra — Faz 4)
// api_usage tablosundaki 60 günden eski rate-limit/kota log kayıtlarını siler.
// Netlify scheduled function (netlify.toml: schedule). Service role ile çalışır.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

exports.handler = async function () {
    const SB_URL = process.env.SUPABASE_URL;
    const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SB_URL || !SB_KEY) return { statusCode: 500, body: "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" };

    const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const url = SB_URL.replace(/\/$/, "") + "/rest/v1/api_usage?created_at=lt." + encodeURIComponent(cutoff);
    try {
        const r = await fetch(url, {
            method: "DELETE",
            headers: {
                apikey: SB_KEY, Authorization: "Bearer " + SB_KEY,
                "Content-Type": "application/json", Prefer: "return=minimal",
            },
        });
        return { statusCode: r.ok ? 200 : 502, body: JSON.stringify({ ok: r.ok, cutoff: cutoff, status: r.status }) };
    } catch (err) {
        return { statusCode: 502, body: JSON.stringify({ error: "cleanup failed: " + (err && err.message || err) }) };
    }
};
