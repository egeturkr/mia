// MIA — Ödeme Sağlayıcı Webhook'u (Faz 6 — sertleştirilmiş, sağlayıcıdan bağımsız)
// Abonelik/ödeme durumunu yazan TEK sunucu girişi. Güvenlik:
//   * x-billing-secret zorunlu (MIA_BILLING_SECRET) — yanlışsa 401, eksikse 500 (fail-closed)
//   * idempotency: event_id billing_events'e unique yazılır; tekrar gelen olay no-op
//   * ödeme durumu ASLA frontend'den kabul edilmez — yalnız bu uç + service_role yazar
//   * sağlayıcı (iyzico/Stripe) bağlanınca sağlayıcıya özel imza doğrulaması buraya eklenir
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MIA_BILLING_SECRET
// POST JSON:
//   { event_id, type: 'subscription'|'payment',
//     user_id?, org_id?, plan?, status?, provider?, provider_subscription_id?,
//     current_period_start?, current_period_end?, quota_overrides?,
//     payment?: { amount, currency, status, provider_payment_id, payment_method, pilot_id?, subscription_id? } }

const VALID_PLANS = ["free", "giris", "kamera_ai", "pro", "kurumsal"];
const VALID_SUB_STATUS = ["active", "trialing", "past_due", "canceled", "unpaid", "manual_active", "pilot_active"];
const VALID_PAY_STATUS = ["pending", "paid", "failed", "refunded", "manual_confirmed"];

function restBase() { return (process.env.SUPABASE_URL || "").replace(/\/$/, "") + "/rest/v1/"; }
function H(extra) {
    const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
    return Object.assign({ apikey: k, Authorization: "Bearer " + k, "Content-Type": "application/json" }, extra || {});
}
function out(code, obj) { return { statusCode: code, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) }; }

exports.handler = async function (event) {
    if (event.httpMethod !== "POST") return out(405, { error: "POST only" });
    const SECRET = process.env.MIA_BILLING_SECRET;
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !SECRET)
        return out(500, { error: "billing env not configured" }); // fail-closed: eksik env'de hiçbir şey yazılmaz

    const hdr = event.headers || {};
    if ((hdr["x-billing-secret"] || hdr["X-Billing-Secret"] || "") !== SECRET)
        return out(401, { error: "invalid billing secret" });

    let p;
    try { p = JSON.parse(event.body || "{}"); } catch (e) { return out(400, { error: "invalid JSON" }); }

    // --- İdempotency: aynı event_id ikinci kez gelirse no-op ---
    const eventId = (p.event_id || "").toString();
    const provider = (p.provider || "manual").toString();
    if (eventId) {
        try {
            const ins = await fetch(restBase() + "billing_events", {
                method: "POST",
                headers: H({ Prefer: "return=representation" }),
                body: JSON.stringify({ provider: provider, event_id: eventId, payload: p }),
            });
            if (!ins.ok) {
                const txt = await ins.text();
                if (/duplicate|unique|23505/i.test(txt)) return out(200, { ok: true, duplicate: true });
                // billing_events tablosu yoksa (migration eksik) idempotency'siz devam etme — fail-closed
                return out(500, { error: "billing_events unavailable (run migration)", detail: txt.slice(0, 200) });
            }
        } catch (e) { return out(500, { error: "idempotency check failed" }); }
    }

    try {
        // --- Abonelik güncellemesi ---
        if (!p.type || p.type === "subscription") {
            const plan = (p.plan || "free").toString();
            const status = (p.status || "active").toString();
            if (VALID_PLANS.indexOf(plan) === -1) return out(400, { error: "invalid plan" });
            if (VALID_SUB_STATUS.indexOf(status) === -1) return out(400, { error: "invalid status" });
            if (!p.user_id && !p.org_id) return out(400, { error: "user_id or org_id required" });

            const row = {
                plan: plan, status: status, provider: p.provider || null,
                provider_customer_id: p.provider_customer_id || null,
                provider_subscription_id: p.provider_subscription_id || null,
                current_period_start: p.current_period_start || null,
                current_period_end: p.current_period_end || null,
                quota_overrides: p.quota_overrides || null,
                updated_at: new Date().toISOString(),
            };
            // Var olan satırı bul (org öncelikli), yoksa ekle — on_conflict'e bağımlı değil.
            const filter = p.org_id
                ? "org_id=eq." + encodeURIComponent(p.org_id)
                : "user_id=eq." + encodeURIComponent(p.user_id) + "&org_id=is.null";
            const exist = await fetch(restBase() + "subscriptions?" + filter + "&select=id&limit=1", { headers: H() });
            const rows = exist.ok ? await exist.json() : [];
            let r2;
            if (rows[0]) {
                r2 = await fetch(restBase() + "subscriptions?id=eq." + rows[0].id, {
                    method: "PATCH", headers: H({ Prefer: "return=representation" }), body: JSON.stringify(row),
                });
            } else {
                row.org_id = p.org_id || null;
                row.user_id = p.user_id || null;
                r2 = await fetch(restBase() + "subscriptions", {
                    method: "POST", headers: H({ Prefer: "return=representation" }), body: JSON.stringify(row),
                });
            }
            const res = await r2.json();
            if (!r2.ok) return out(502, { error: "subscription write failed", detail: res });
            return out(200, { ok: true, subscription: Array.isArray(res) ? res[0] : res });
        }

        // --- Ödeme kaydı ---
        if (p.type === "payment" && p.payment) {
            const pay = p.payment;
            const pst = (pay.status || "pending").toString();
            if (VALID_PAY_STATUS.indexOf(pst) === -1) return out(400, { error: "invalid payment status" });
            const row = {
                org_id: p.org_id || null, user_id: p.user_id || null,
                subscription_id: pay.subscription_id || null, pilot_id: pay.pilot_id || null,
                provider: provider, provider_payment_id: pay.provider_payment_id || null,
                amount: pay.amount, currency: pay.currency || "TRY",
                status: pst, payment_method: pay.payment_method || "manual",
                paid_at: pst === "paid" ? new Date().toISOString() : null,
                metadata: pay.metadata || null, updated_at: new Date().toISOString(),
            };
            const r3 = await fetch(restBase() + "payment_records", {
                method: "POST", headers: H({ Prefer: "return=representation" }), body: JSON.stringify(row),
            });
            const res3 = await r3.json();
            if (!r3.ok) return out(502, { error: "payment write failed", detail: res3 });
            return out(200, { ok: true, payment: Array.isArray(res3) ? res3[0] : res3 });
        }

        return out(400, { error: "unknown type" });
    } catch (err) {
        return out(502, { error: "webhook failed: " + (err && err.message || err) });
    }
};
