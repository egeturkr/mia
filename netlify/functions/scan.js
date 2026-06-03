// MIA — Tarama ingestion (Sprint 4). Netlify function eşdeğeri (api/scan.js ile aynı mantık).
// netlify.toml: /api/scan -> /.netlify/functions/scan
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MIA_SCAN_TOKEN

exports.handler = async function (event) {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: JSON.stringify({ error: "POST only" }) };

    const SB_URL = process.env.SUPABASE_URL;
    const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const TOKEN = process.env.MIA_SCAN_TOKEN;
    if (!SB_URL || !SB_KEY || !TOKEN) return { statusCode: 500, body: JSON.stringify({ error: "Missing env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / MIA_SCAN_TOKEN" }) };

    const hdr = event.headers || {};
    if ((hdr["x-scan-token"] || hdr["X-Scan-Token"] || "") !== TOKEN) return { statusCode: 401, body: JSON.stringify({ error: "invalid scan token" }) };

    let p;
    try { p = JSON.parse(event.body || "{}"); } catch (e) { return { statusCode: 400, body: JSON.stringify({ error: "invalid JSON" }) }; }

    const userId = (p.user_id || "").toString();
    const workerCode = (p.worker_code || "").toString();
    const codes = Array.isArray(p.equipment_codes) ? p.equipment_codes.map(String) : [];
    if (!userId || !workerCode) return { statusCode: 400, body: JSON.stringify({ error: "user_id and worker_code required" }) };

    const required = (p.required && typeof p.required === "object") ? p.required : { helmet: true, vest: true };
    const source = p.source === "qr" ? "qr" : "rfid";
    const H = { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" };
    const rest = (path) => SB_URL.replace(/\/$/, "") + "/rest/v1/" + path;

    try {
        const wq = await fetch(rest(`workers?user_id=eq.${userId}&code=eq.${encodeURIComponent(workerCode)}&select=id,full_name&limit=1`), { headers: H });
        const workers = await wq.json();
        const worker = Array.isArray(workers) && workers[0] ? workers[0] : null;

        let present = {};
        if (codes.length) {
            const inList = codes.map((c) => `"${c.replace(/"/g, "")}"`).join(",");
            const eq = await fetch(rest(`equipment?user_id=eq.${userId}&code=in.(${encodeURIComponent(inList)})&select=type,assigned_worker_id`), { headers: H });
            const items = await eq.json();
            (Array.isArray(items) ? items : []).forEach((it) => {
                if (it.assigned_worker_id && worker && it.assigned_worker_id !== worker.id) return;
                present[it.type] = true;
            });
        }

        const missing = Object.keys(required).filter((k) => required[k] && !present[k]);
        const compliant = !!worker && missing.length === 0;
        const row = {
            user_id: userId, checkpoint_id: p.checkpoint_id || null,
            worker_id: worker ? worker.id : null, worker_code: workerCode,
            worker_name: worker ? worker.full_name : null,
            ppe_present: present, required: required, missing: missing,
            compliant: compliant, source: source
        };
        const ins = await fetch(rest("scans"), { method: "POST", headers: Object.assign({ Prefer: "return=representation" }, H), body: JSON.stringify(row) });
        const saved = await ins.json();
        if (!ins.ok) return { statusCode: 502, body: JSON.stringify({ error: "insert failed", detail: saved }) };

        return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({
            ok: true, worker_found: !!worker, worker_name: worker ? worker.full_name : null,
            present, missing, compliant, scan: Array.isArray(saved) ? saved[0] : saved
        }) };
    } catch (err) {
        return { statusCode: 502, body: JSON.stringify({ error: "scan failed: " + (err && err.message || err) }) };
    }
};
