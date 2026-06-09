// MIA — Ödeme Sağlayıcı Webhook'u (Billing — Faz 5, SAĞLAYICIDAN BAĞIMSIZ STUB)
// Amaç: ödeme sağlayıcısı (iyzico/Stripe) entegre edildiğinde abonelik durumunu
// subscriptions tablosuna yazan tek giriş noktası. Şu an sağlayıcı yok; bu uç,
// paylaşılan gizli token ile korunan kanonik bir upsert sağlar. Sağlayıcı bağlanınca
// burada sağlayıcıya özel İMZA DOĞRULAMASI eklenir (TODO) ve olay → bu şemaya map'lenir.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MIA_BILLING_SECRET
// POST JSON: { user_id, plan, status, provider?, provider_customer_id?,
//              provider_subscription_id?, current_period_end? }
//   header: x-billing-secret: <MIA_BILLING_SECRET>

const VALID_PLANS = ["free", "giris", "kamera_ai", "pro", "kurumsal"];
const VALID_STATUS = ["active", "trialing", "past_due", "canceled"];

exports.handler = async function (event) {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: JSON.stringify({ error: "POST only" }) };

    const SB_URL = process.env.SUPABASE_URL;
    const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const SECRET = process.env.MIA_BILLING_SECRET;
    if (!SB_URL || !SB_KEY || !SECRET)
        return { statusCode: 500, body: JSON.stringify({ error: "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / MIA_BILLING_SECRET" }) };

    const hdr = event.headers || {};
    if ((hdr["x-billing-secret"] || hdr["X-Billing-Secret"] || "") !== SECRET)
        return { statusCode: 401, body: JSON.stringify({ error: "invalid billing secret" }) };

    // TODO (sağlayıcı bağlanınca): iyzico/Stripe imza doğrulaması + olay tipi map'leme.

    let p;
    try { p = JSON.parse(event.body || "{}"); } catch (e) { return { statusCode: 400, body: JSON.stringify({ error: "invalid JSON" }) }; }

    const user_id = (p.user_id || "").toString();
    const plan = (p.plan || "free").toString();
    const status = (p.status || "active").toString();
    if (!user_id) return { statusCode: 400, body: JSON.stringify({ error: "user_id required" }) };
    if (VALID_PLANS.indexOf(plan) === -1) return { statusCode: 400, body: JSON.stringify({ error: "invalid plan" }) };
    if (VALID_STATUS.indexOf(status) === -1) return { statusCode: 400, body: JSON.stringify({ error: "invalid status" }) };

    const row = {
        user_id: user_id, plan: plan, status: status,
        provider: p.provider || null,
        provider_customer_id: p.provider_customer_id || null,
        provider_subscription_id: p.provider_subscription_id || null,
        current_period_end: p.current_period_end || null,
        updated_at: new Date().toISOString(),
    };
    const H = { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json",
                Prefer: "resolution=merge-duplicates,return=representation" };
    try {
        // upsert (user_id unique) — POST with on_conflict
        const url = SB_URL.replace(/\/$/, "") + "/rest/v1/subscriptions?on_conflict=user_id";
        const r = await fetch(url, { method: "POST", headers: H, body: JSON.stringify(row) });
        const out = await r.json();
        if (!r.ok) return { statusCode: 502, body: JSON.stringify({ error: "upsert failed", detail: out }) };
        return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: true, subscription: Array.isArray(out) ? out[0] : out }) };
    } catch (err) {
        return { statusCode: 502, body: JSON.stringify({ error: "webhook failed: " + (err && err.message || err) }) };
    }
};
