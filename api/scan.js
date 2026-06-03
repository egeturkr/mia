// MIA — Tarama ingestion endpoint (Sprint 4). Vercel serverless.
// Headless geçiş noktası okuyucuları (RFID gateway veya kiosk) buraya tarama
// gönderir; sunucu KKD'leri çözer, uyumluluğu hesaplar ve scans tablosuna yazar.
//
// Güvenlik: okuyucular tarayıcı değil → anon RLS yerine paylaşılan gizli token.
//   Header:  x-scan-token: <MIA_SCAN_TOKEN>
//   Env:     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MIA_SCAN_TOKEN
//
// POST JSON: {
//   user_id,                       // hesap (firma) sahibinin MIA user id'si
//   worker_code,                   // okutulan rozet kodu
//   equipment_codes: ["..."],      // okutulan KKD etiketleri
//   checkpoint_id?, required?,      // required: {"helmet":true,"vest":true}
//   source?                        // "rfid" | "qr" (default "rfid")
// }
//
// Not: Giriş yapmış kullanıcının telefonla yaptığı tarama tarama.html üzerinden
// doğrudan Supabase'e (RLS ile) yazılır; bu endpoint donanım okuyucular içindir.

export default async function handler(req, res) {
    if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

    const SB_URL = process.env.SUPABASE_URL;
    const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const TOKEN = process.env.MIA_SCAN_TOKEN;
    if (!SB_URL || !SB_KEY || !TOKEN) {
        res.status(500).json({ error: "Missing env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / MIA_SCAN_TOKEN" });
        return;
    }
    if ((req.headers["x-scan-token"] || "") !== TOKEN) {
        res.status(401).json({ error: "invalid scan token" }); return;
    }

    const p = req.body || {};
    const userId = (p.user_id || "").toString();
    const workerCode = (p.worker_code || "").toString();
    const codes = Array.isArray(p.equipment_codes) ? p.equipment_codes.map(String) : [];
    if (!userId || !workerCode) { res.status(400).json({ error: "user_id and worker_code required" }); return; }

    const required = (p.required && typeof p.required === "object") ? p.required : { helmet: true, vest: true };
    const source = p.source === "qr" ? "qr" : "rfid";

    const H = { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" };
    const rest = (path) => SB_URL.replace(/\/$/, "") + "/rest/v1/" + path;

    try {
        // 1) İşçiyi rozet kodundan çöz
        const wq = await fetch(rest(`workers?user_id=eq.${userId}&code=eq.${encodeURIComponent(workerCode)}&select=id,full_name&limit=1`), { headers: H });
        const workers = await wq.json();
        const worker = Array.isArray(workers) && workers[0] ? workers[0] : null;

        // 2) Okutulan etiketleri ekipmana çöz (sadece bu hesabın, bu işçiye atanmış/atanmamış)
        let present = {};
        if (codes.length) {
            const inList = codes.map((c) => `"${c.replace(/"/g, "")}"`).join(",");
            const eq = await fetch(rest(`equipment?user_id=eq.${userId}&code=in.(${encodeURIComponent(inList)})&select=type,assigned_worker_id`), { headers: H });
            const items = await eq.json();
            (Array.isArray(items) ? items : []).forEach((it) => {
                // Atanmışsa sadece doğru işçiye aitse say (yanlış baret başkasının olabilir)
                if (it.assigned_worker_id && worker && it.assigned_worker_id !== worker.id) return;
                present[it.type] = true;
            });
        }

        // 3) Uyumluluk
        const missing = Object.keys(required).filter((k) => required[k] && !present[k]);
        const compliant = !!worker && missing.length === 0;

        // 4) Kayıt
        const row = {
            user_id: userId,
            checkpoint_id: p.checkpoint_id || null,
            worker_id: worker ? worker.id : null,
            worker_code: workerCode,
            worker_name: worker ? worker.full_name : null,
            ppe_present: present,
            required: required,
            missing: missing,
            compliant: compliant,
            source: source
        };
        const ins = await fetch(rest("scans"), { method: "POST", headers: Object.assign({ Prefer: "return=representation" }, H), body: JSON.stringify(row) });
        const saved = await ins.json();
        if (!ins.ok) { res.status(502).json({ error: "insert failed", detail: saved }); return; }

        res.status(200).json({
            ok: true,
            worker_found: !!worker,
            worker_name: worker ? worker.full_name : null,
            present, missing, compliant,
            scan: Array.isArray(saved) ? saved[0] : saved
        });
    } catch (err) {
        res.status(502).json({ error: "scan failed: " + (err && err.message || err) });
    }
}
