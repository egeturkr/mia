// Netlify Function: /api/camera-event → masaüstü uygulamadan güvenlik olayı alımı.
// camera_events INSERT yalnız service_role'dedir (RLS) — bu fonksiyon köprüdür:
//   1) Kimlik: Supabase JWT (Bearer) zorunlu — guard.verifyUser
//   2) Yetki: kullanıcı org'un AKTİF üyesi olmalı (service_role ile doğrulanır)
//   3) Kamera: event.camera_id GERÇEKTEN o org'a ait olmalı (spoof engeli)
//   4) Şema: event_type/risk_level allowlist; bilinmeyen alanlar ATILIR
//   5) Rate-limit: kullanıcı başına 120 istek/dk (toplu gönderim 25'li — bol yeter)
// AI kotası TÜKETMEZ (detect/analyze grubuna yazmaz) — olay alımı veri kaybına yol açmamalı.
// Masaüstü istemci Origin başlığı GÖNDERMEZ (ana süreç fetch) — guard.enforce yerine
// burada yerel akış: origin varsa allowlist'te olmalı; yoksa Bearer zorunlu.

const guard = require("./lib/guard");

const EVENT_TYPES = ["ppe_violation", "no_helmet", "no_vest", "no_mask",
    "restricted_area", "unsafe_behavior", "camera_offline", "worker_error"];
const RISK_LEVELS = ["low", "medium", "high", "critical"];
const MAX_BATCH = 25;

function restBase() { return (process.env.SUPABASE_URL || "").replace(/\/$/, "") + "/rest/v1/"; }
function svcHeaders() {
    const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
    return { apikey: k, Authorization: "Bearer " + k, "Content-Type": "application/json" };
}

exports.handler = async function (event) {
    const origin = guard.getOrigin(event);
    if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: guard.corsHeaders(origin), body: "" };
    if (event.httpMethod !== "POST") return guard.resp(405, { error: "POST only" }, origin);

    // Origin: tarayıcıysa allowlist zorunlu; yerli istemci (origin'siz) Bearer ile geçer.
    if (origin && !guard.isOriginAllowed(origin)) return guard.resp(403, { error: "origin not allowed" }, origin);

    const token = guard.bearer(event);
    const user = token ? await guard.verifyUser(token) : null;
    if (!user) return guard.resp(401, { error: "authentication required" }, origin);

    // Rate-limit: 120/dk (api_usage üzerinden, fail-closed)
    const subject = "user:" + user.id;
    const minAgo = new Date(Date.now() - 60000).toISOString();
    const minCount = await guard.countSince(subject, "camera-event", minAgo, 120);
    if (minCount === null) return guard.resp(503, { error: "rate limiter unavailable" }, origin);
    if (minCount >= 120) return guard.resp(429, { error: "rate limit exceeded", retry_after: 60 }, origin);

    let body;
    try { body = JSON.parse(event.body || "{}"); }
    catch (e) { return guard.resp(400, { error: "invalid JSON body" }, origin); }
    const events = Array.isArray(body.events) ? body.events.slice(0, MAX_BATCH) : null;
    if (!events || !events.length) return guard.resp(400, { error: "missing 'events' array" }, origin);

    // Org bağlamı: partideki TÜM olaylar aynı org'a ait olmalı + kullanıcı aktif üye olmalı.
    const orgId = String(events[0].org_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(orgId)) return guard.resp(400, { error: "invalid org_id" }, origin);
    if (events.some(ev => String(ev.org_id) !== orgId)) return guard.resp(400, { error: "mixed org batch" }, origin);

    try {
        const mr = await fetch(restBase() + "organization_memberships?org_id=eq." + encodeURIComponent(orgId) +
            "&user_id=eq." + encodeURIComponent(user.id) + "&status=eq.active&select=role&limit=1",
            { headers: svcHeaders() });
        const mem = mr.ok ? await mr.json() : [];
        if (!Array.isArray(mem) || !mem[0]) return guard.resp(403, { error: "not an active org member" }, origin);

        // Kameralar gerçekten bu org'un mu? (tek sorguda topla)
        const camIds = [...new Set(events.map(ev => String(ev.camera_id || "")))];
        if (camIds.some(id => !/^[0-9a-f-]{36}$/i.test(id))) return guard.resp(400, { error: "invalid camera_id" }, origin);
        const cr = await fetch(restBase() + "cameras?org_id=eq." + encodeURIComponent(orgId) +
            "&id=in.(" + camIds.map(encodeURIComponent).join(",") + ")&select=id,site_id",
            { headers: svcHeaders() });
        const cams = cr.ok ? await cr.json() : [];
        const camMap = new Map((cams || []).map(c => [c.id, c]));
        if (camIds.some(id => !camMap.has(id))) return guard.resp(403, { error: "camera not in org" }, origin);

        // Şema temizliği — yalnız bilinen alanlar, allowlist değerler.
        const rows = [];
        for (const ev of events) {
            if (EVENT_TYPES.indexOf(ev.event_type) === -1) return guard.resp(400, { error: "invalid event_type: " + ev.event_type }, origin);
            const cam = camMap.get(String(ev.camera_id));
            rows.push({
                org_id: orgId,
                site_id: ev.site_id || cam.site_id || null,
                camera_id: ev.camera_id,
                event_type: ev.event_type,
                risk_level: RISK_LEVELS.indexOf(ev.risk_level) !== -1 ? ev.risk_level : "medium",
                confidence: (typeof ev.confidence === "number" && ev.confidence >= 0 && ev.confidence <= 1) ? ev.confidence : null,
                frame_timestamp: ev.frame_timestamp && !isNaN(Date.parse(ev.frame_timestamp))
                    ? new Date(ev.frame_timestamp).toISOString() : new Date().toISOString(),
                detections_json: (ev.detections_json && typeof ev.detections_json === "object")
                    ? ev.detections_json : null,
                model_name: String(ev.model_name || "mia-desktop").slice(0, 80),
                model_version: String(ev.model_version || "").slice(0, 40) || null,
                person_track_id: ev.person_track_id ? String(ev.person_track_id).slice(0, 40) : null,
                missing_equipment: Array.isArray(ev.missing_equipment)
                    ? ev.missing_equipment.slice(0, 10).map(x => String(x).slice(0, 40)) : null,
                status: "open"
            });
        }

        const ir = await fetch(restBase() + "camera_events", {
            method: "POST",
            headers: Object.assign({ Prefer: "return=minimal" }, svcHeaders()),
            body: JSON.stringify(rows)
        });
        await guard.logUsage(subject, "user", "camera-event", ir.status, orgId);
        if (!ir.ok) {
            const detail = (await ir.text()).slice(0, 200);
            return guard.resp(502, { error: "insert failed", detail }, origin);
        }
        // Kamera sağlık damgası (en iyi çaba — hata isteği düşürmez)
        try {
            const nowIso = new Date().toISOString();
            await fetch(restBase() + "cameras?id=in.(" + camIds.map(encodeURIComponent).join(",") + ")", {
                method: "PATCH",
                headers: Object.assign({ Prefer: "return=minimal" }, svcHeaders()),
                body: JSON.stringify({ last_detection_at: nowIso, last_frame_at: nowIso, health_status: "online" })
            });
        } catch (e) { /* sessiz */ }
        return guard.resp(200, { ok: true, inserted: rows.length }, origin);
    } catch (err) {
        return guard.resp(502, { error: "upstream error", detail: String(err && err.message || err).slice(0, 120) }, origin);
    }
};
