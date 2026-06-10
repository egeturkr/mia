// MIA — Yüksek risk e-posta uyarısı (Faz 7'de SERTLEŞTİRİLDİ).
// ÖNCEKİ RİSK: kimliksizdi ve 'to' serbestti → Resend hesabıyla rastgele adrese spam atılabilirdi.
// ŞİMDİ: Supabase JWT zorunlu + alıcı YALNIZCA oturum sahibinin kendi e-postası +
// origin allowlist + dakikada 3 istek limiti + kullanım logu. RESEND_API_KEY sunucuda kalır.

const guard = require("./lib/guard");

exports.handler = async function (event) {
    const origin = guard.getOrigin(event);
    if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: guard.corsHeaders(origin), body: "" };
    if (event.httpMethod !== "POST") return guard.resp(405, { error: "POST only" }, origin);
    if (!guard.isOriginAllowed(origin)) return guard.resp(403, { error: "origin not allowed" }, origin);

    const token = guard.bearer(event);
    const user = token ? await guard.verifyUser(token) : null;
    if (!user) return guard.resp(401, { error: "authentication required" }, origin);

    // Rate limit: kullanıcı başına 3/dk (uyarı e-postası bundan sık gerekmez)
    const subject = "user:" + user.id;
    const minAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const minCount = await guard.countSince(subject, "notify", minAgo, 3);
    if (minCount === null) return guard.resp(503, { error: "rate limiter unavailable" }, origin);
    if (minCount >= 3) return guard.resp(429, { error: "rate limit exceeded" }, origin);

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return guard.resp(500, { error: "RESEND_API_KEY env var not configured" }, origin);
    const from = process.env.MIA_FROM_EMAIL || "MIA İş Sağlığı <bildirim@miaissagligi.com>";

    let p;
    try { p = JSON.parse(event.body || "{}"); }
    catch (e) { return guard.resp(400, { error: "invalid JSON body" }, origin); }

    // KURAL: alıcı her zaman oturum sahibinin doğrulanmış e-postası — body'deki 'to' YOK SAYILIR.
    const to = (user.email || "").toString().trim();
    if (!to || to.indexOf("@") === -1) return guard.resp(400, { error: "account has no email" }, origin);

    const tr = (p.lang || "tr") === "tr";
    const score = Number(p.safety_score) || 0;
    const violations = Number(p.violations_count) || 0;
    const safe = Number(p.safe_count) || 0;
    const name = (p.video_name || "Video").toString().slice(0, 120);
    const list = Array.isArray(p.violations) ? p.violations.slice(0, 10) : [];

    const subjectLine = tr
        ? `⚠️ Yüksek riskli analiz: ${name} (Güvenlik skoru %${score})`
        : `⚠️ High-risk analysis: ${name} (Safety score ${score}%)`;

    const t = tr ? {
        head: "Yüksek riskli analiz tespit edildi",
        intro: "Aşağıdaki analizde güvenlik skoru kritik eşiğin altında kaldı:",
        video: "Video", scoreL: "Güvenlik skoru", viol: "İhlal", safeL: "Uygun",
        detail: "İhlal detayları", time: "Zaman", type: "Tür", conf: "Güven",
        cta: "Panele git", foot: "Bu e-posta MIA İş Sağlığı tarafından otomatik gönderildi.",
        disc: "Bu uyarı AI destekli bir ön değerlendirmedir ve sertifikalı İSG denetiminin yerine geçmez."
    } : {
        head: "High-risk analysis detected",
        intro: "The following analysis scored below the critical safety threshold:",
        video: "Video", scoreL: "Safety score", viol: "Violations", safeL: "Compliant",
        detail: "Violation details", time: "Time", type: "Type", conf: "Conf.",
        cta: "Open dashboard", foot: "This email was sent automatically by MIA.",
        disc: "This alert is an AI-assisted preliminary assessment and does not replace a certified OHS inspection."
    };

    const esc = (s) => String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
    const detailRows = list.map((v) =>
        `<tr><td style="padding:6px 0;font-size:13px;color:#B8B8B8;">${esc(v.timestamp || (v.timestamp_sec != null ? v.timestamp_sec + "s" : "-"))}</td><td style="padding:6px 0;font-size:13px;color:#FFFFFF;">${esc(v.type || "-")}</td><td style="padding:6px 0;text-align:right;font-size:13px;color:#D4AF37;">${esc(v.confidence != null ? "%" + v.confidence : "-")}</td></tr>`).join("");
    const detailBlock = list.length ? `
      <div style="margin-top:20px;background:#161616;border:1px solid rgba(212,175,55,.25);border-radius:12px;padding:16px 20px;">
        <div style="font-size:13px;color:#6E6E6E;margin-bottom:8px;">${t.detail}</div>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="font-size:11px;color:#6E6E6E;">${t.time}</td><td style="font-size:11px;color:#6E6E6E;">${t.type}</td><td style="font-size:11px;color:#6E6E6E;text-align:right;">${t.conf}</td></tr>
          ${detailRows}
        </table>
      </div>` : "";

    const html = `
    <div style="background:#0A0A0A;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:560px;margin:0 auto;background:#111111;border:1px solid rgba(212,175,55,.3);border-radius:16px;padding:28px;">
        <div style="font-size:22px;font-weight:800;color:#D4AF37;margin-bottom:14px;">MIA</div>
        <h2 style="color:#FFFFFF;font-size:18px;margin:0 0 8px;">${t.head}</h2>
        <p style="color:#B8B8B8;font-size:14px;margin:0 0 18px;">${t.intro}</p>
        <div style="background:#161616;border-radius:12px;padding:16px 20px;">
          <div style="font-size:13px;color:#6E6E6E;">${t.video}</div>
          <div style="font-size:15px;color:#FFFFFF;margin-bottom:10px;">${esc(name)}</div>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="font-size:13px;color:#6E6E6E;">${t.scoreL}</td>
              <td style="font-size:13px;color:#6E6E6E;">${t.viol}</td>
              <td style="font-size:13px;color:#6E6E6E;">${t.safeL}</td>
            </tr>
            <tr>
              <td style="font-size:20px;font-weight:700;color:#EF4444;">%${score}</td>
              <td style="font-size:20px;font-weight:700;color:#EF4444;">${violations}</td>
              <td style="font-size:20px;font-weight:700;color:#22C55E;">${safe}</td>
            </tr>
          </table>
        </div>
        ${detailBlock}
        <a href="https://miaissagligi.com/dashboard.html" style="display:inline-block;margin-top:20px;background:#D4AF37;color:#0A0A0A;font-weight:700;font-size:14px;padding:10px 22px;border-radius:8px;text-decoration:none;">${t.cta}</a>
        <p style="color:#6E6E6E;font-size:11px;margin:22px 0 0;">${t.foot}</p>
        <p style="color:#555;font-size:10px;margin:6px 0 0;">${t.disc}</p>
      </div>
    </div>`;

    try {
        const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({ from, to, subject: subjectLine, html }),
        });
        const out = await r.json().catch(() => ({}));
        await guard.logUsage(subject, "user", "notify", r.status);
        if (!r.ok) return guard.resp(502, { error: "email send failed" }, origin); // sağlayıcı detayını sızdırma
        return guard.resp(200, { ok: true, id: out.id || null }, origin);
    } catch (err) {
        await guard.logUsage(subject, "user", "notify", 502);
        return guard.resp(502, { error: "email send failed" }, origin);
    }
};
