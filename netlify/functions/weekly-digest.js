// MIA haftalık güvenlik özeti — Netlify Scheduled Function.
// Her kullanıcının son 7 gündeki analizlerini toplar ve e-posta ile gönderir.
// Sunucu tarafı çalışır; gizli anahtarlar Netlify env vars'ta tutulur:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, (ops.) MIA_FROM_EMAIL
// Zamanlama netlify.toml içinde tanımlıdır (schedule = "0 7 * * 1" → Pazartesi 07:00 UTC).

exports.handler = async function () {
    const SB_URL = process.env.SUPABASE_URL;
    const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const RESEND = process.env.RESEND_API_KEY;
    const from = process.env.MIA_FROM_EMAIL || "MIA İş Sağlığı <bildirim@miaissagligi.com>";

    if (!SB_URL || !SB_KEY || !RESEND) {
        return { statusCode: 500, body: "Missing env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / RESEND_API_KEY" };
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const sbHeaders = { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" };

    try {
        // 1) Son 7 günün analizleri.
        const aRes = await fetch(
            SB_URL + "/rest/v1/analyses?select=user_id,safety_score,violations_count,safe_count&created_at=gte." + encodeURIComponent(since),
            { headers: sbHeaders }
        );
        if (!aRes.ok) return { statusCode: 502, body: "Supabase analyses query failed: " + aRes.status };
        const rows = await aRes.json();

        if (!Array.isArray(rows) || !rows.length) {
            return { statusCode: 200, body: "No analyses in the last 7 days — nothing to send." };
        }

        // 2) Kullanıcı bazında topla.
        const byUser = {};
        rows.forEach(function (r) {
            const id = r.user_id;
            if (!id) return;
            if (!byUser[id]) byUser[id] = { count: 0, scoreSum: 0, viol: 0, safe: 0, high: 0 };
            const u = byUser[id];
            u.count++;
            u.scoreSum += Number(r.safety_score) || 0;
            u.viol += Number(r.violations_count) || 0;
            u.safe += Number(r.safe_count) || 0;
            if ((Number(r.safety_score) || 0) < 60) u.high++;
        });

        // 3) E-posta adreslerini al (auth admin).
        const uRes = await fetch(SB_URL + "/auth/v1/admin/users?per_page=1000", { headers: sbHeaders });
        if (!uRes.ok) return { statusCode: 502, body: "Supabase admin users query failed: " + uRes.status };
        const uJson = await uRes.json();
        const users = uJson.users || uJson || [];
        const emailById = {};
        users.forEach(function (u) { if (u && u.id) emailById[u.id] = u.email; });

        // 4) Her kullanıcıya özet gönder.
        let sent = 0, failed = 0;
        for (const id in byUser) {
            const to = emailById[id];
            if (!to) continue;
            const u = byUser[id];
            const avg = Math.round(u.scoreSum / u.count);
            const subject = "MIA haftalık güvenlik özeti — " + u.count + " analiz";
            const html = digestHtml(u, avg);
            try {
                const r = await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: { Authorization: "Bearer " + RESEND, "Content-Type": "application/json" },
                    body: JSON.stringify({ from: from, to: [to], subject: subject, html: html })
                });
                if (r.ok) sent++; else failed++;
            } catch (e) { failed++; }
        }

        return { statusCode: 200, body: "Weekly digest done. sent=" + sent + " failed=" + failed };
    } catch (err) {
        return { statusCode: 502, body: "weekly-digest error: " + (err && err.message || err) };
    }
};

function digestHtml(u, avg) {
    const avgColor = avg >= 80 ? "#22c55e" : avg >= 60 ? "#D4AF37" : "#ef4444";
    function row(label, value, color) {
        return '<tr><td style="padding:8px 0;font-size:13px;color:#6E6E6E;">' + label +
            '</td><td style="padding:8px 0;text-align:right;font-weight:700;color:' + (color || "#FFFFFF") + ';">' + value + '</td></tr>';
    }
    return '<!doctype html><html><body style="margin:0;background:#0A0A0A;font-family:Arial,Helvetica,sans-serif;color:#FFFFFF;">' +
        '<div style="max-width:560px;margin:0 auto;padding:32px 24px;">' +
        '<div style="font-size:22px;font-weight:700;color:#D4AF37;letter-spacing:.5px;">MIA</div>' +
        '<h1 style="font-size:20px;margin:24px 0 8px;">Haftalık güvenlik özeti</h1>' +
        '<p style="color:#B8B8B8;font-size:14px;line-height:1.6;margin:0 0 24px;">Son 7 gündeki analizlerinizin özeti aşağıdadır.</p>' +
        '<div style="background:#161616;border:1px solid rgba(212,175,55,.25);border-radius:12px;padding:20px;">' +
        '<table style="width:100%;border-collapse:collapse;">' +
        row("Toplam analiz", u.count) +
        row("Ortalama güvenlik skoru", "%" + avg, avgColor) +
        row("Yüksek riskli analiz", u.high, u.high ? "#ef4444" : "#22c55e") +
        row("Toplam ihlal", u.viol) +
        row("Toplam uygun", u.safe, "#22c55e") +
        '</table></div>' +
        '<a href="https://miaissagligi.com/dashboard.html" style="display:inline-block;margin-top:24px;background:#D4AF37;color:#0A0A0A;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;">Panele git</a>' +
        '<p style="color:#555;font-size:12px;margin-top:32px;">Bu e-posta MIA İş Sağlığı tarafından otomatik gönderildi.</p>' +
        '</div></body></html>';
}
