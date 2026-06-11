// MIA — Ödeme Başlatma / Sağlayıcı Soyutlaması (Faz 6)
// Sağlayıcılar: manual (CANLI) · iyzico (sandbox-hazır iskelet) · stripe (arayüz rezerve).
// GÜVENLİK: hiçbir gizli anahtar istemciye dönmez; sahte "ödeme başarılı" YOKTUR.
// Manual: niyet kaydı (pending payment_record) açar ve havale talimatı döner —
// aktivasyon, ödeme gerçekten alındıktan sonra MIA ekibi tarafından yapılır (runbook).
//
// Env: BILLING_PROVIDER=manual|iyzico (vars. manual), BILLING_MODE=sandbox|live (vars. sandbox),
//      IYZICO_API_KEY, IYZICO_SECRET_KEY, IYZICO_BASE_URL (sandbox: https://sandbox-api.iyzipay.com)

const guard = require("./lib/guard");
const log = require("./lib/log");

const PLAN_PRICES = { giris: 4000, kamera_ai: 12000, pro: 25000 }; // kurumsal: özel teklif

function restBase() { return (process.env.SUPABASE_URL || "").replace(/\/$/, "") + "/rest/v1/"; }
function svcH(extra) {
    const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
    return Object.assign({ apikey: k, Authorization: "Bearer " + k, "Content-Type": "application/json" }, extra || {});
}

exports.handler = async function (event) {
    const origin = guard.getOrigin(event);
    if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: guard.corsHeaders(origin), body: "" };
    if (event.httpMethod !== "POST") return guard.resp(405, { error: "POST only" }, origin);
    if (!guard.isOriginAllowed(origin)) return guard.resp(403, { error: "origin not allowed" }, origin);

    const token = guard.bearer(event);
    const user = token ? await guard.verifyUser(token) : null;
    if (!user) return guard.resp(401, { error: "authentication required" }, origin);

    let p;
    try { p = JSON.parse(event.body || "{}"); } catch (e) { return guard.resp(400, { error: "invalid JSON" }, origin); }
    const planKey = (p.plan || "").toString();
    if (!PLAN_PRICES[planKey]) return guard.resp(400, { error: "invalid plan (kurumsal → demo-talep)" }, origin);

    // Org bağlamı: başlık + üyelik doğrulaması; org için yalnız owner/admin plan başlatabilir.
    const orgCtx = await guard.resolveOrgContext(user.id, event);
    if (orgCtx && ["owner", "admin"].indexOf(orgCtx.role) === -1)
        return guard.resp(403, { error: "billing requires owner/admin role" }, origin);

    const provider = (process.env.BILLING_PROVIDER || "manual").toLowerCase();
    const mode = (process.env.BILLING_MODE || "sandbox").toLowerCase();

    // --- iyzico: anahtar yoksa GÜVENLE reddet; adaptör imzası sonraki iş (sahte başarı yok) ---
    if (provider === "iyzico") {
        if (!process.env.IYZICO_API_KEY || !process.env.IYZICO_SECRET_KEY) {
            return guard.resp(503, { error: "iyzico_not_configured",
                message: "iyzico anahtarları tanımlı değil — manuel ödeme akışı kullanılıyor.", fallback: "manual" }, origin);
        }
        // TODO(iyzico): checkout-form initialize + IYZWSv2 imzası. Canlı tahsilat
        // BILLING_MODE=live + gerçek merchant onayı olmadan AÇILMAZ.
        return guard.resp(501, { error: "iyzico_adapter_pending",
            message: "iyzico adaptörü hazırlanıyor (mode=" + mode + ") — manuel ödeme akışı kullanılabilir.", fallback: "manual" }, origin);
    }

    // --- manual: niyet kaydı (pending) + havale talimatı ---
    const row = {
        org_id: orgCtx ? orgCtx.orgId : null,
        user_id: user.id,
        provider: "manual",
        amount: PLAN_PRICES[planKey],
        currency: "TRY",
        status: "pending",
        payment_method: "bank_transfer",
        metadata: { plan: planKey, source: "create-checkout", mode: mode },
    };
    try {
        const r = await fetch(restBase() + "payment_records", {
            method: "POST", headers: svcH({ Prefer: "return=representation" }), body: JSON.stringify(row),
        });
        const res = await r.json();
        if (!r.ok) return guard.resp(502, { error: "intent failed", detail: res }, origin);
        const rec = Array.isArray(res) ? res[0] : res;
        log.logEvent({ type: "billing_checkout_created", source: "billing", userId: user.id,
            orgId: orgCtx ? orgCtx.orgId : null, fn: "create-checkout", meta: { plan: planKey } });
        return guard.resp(200, {
            ok: true, provider: "manual", payment_record_id: rec.id,
            plan: planKey, amount: row.amount, currency: "TRY",
            next: "Satış ekibi sizinle iletişime geçecek. Havale/EFT sonrası abonelik MIA tarafından aktive edilir — ödeme platform dışında alınır, burada otomatik tahsilat YAPILMAZ.",
        }, origin);
    } catch (err) {
        return guard.resp(502, { error: "checkout failed: " + (err && err.message || err) }, origin);
    }
};
