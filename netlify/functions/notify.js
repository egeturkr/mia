// MIA high-risk email alert. Runs server-side so RESEND_API_KEY stays secret.
// netlify.toml redirects /api/notify -> /.netlify/functions/notify.
// Set RESEND_API_KEY (and optionally MIA_FROM_EMAIL) in Netlify env vars.
// Expects POST JSON: { to, lang, video_name, safety_score, violations_count, safe_count }.

exports.handler = async function (event) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: JSON.stringify({ error: "POST only" }) };
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        return { statusCode: 500, body: JSON.stringify({ error: "RESEND_API_KEY env var not configured" }) };
    }
    const from = process.env.MIA_FROM_EMAIL || "MIA İş Sağlığı <bildirim@miaissagligi.com>";

    let p;
    try { p = JSON.parse(event.body || "{}"); }
    catch (e) { return { statusCode: 400, body: JSON.stringify({ error: "invalid JSON body" }) }; }

    const to = (p.to || "").toString().trim();
    if (!to || to.indexOf("@") === -1) {
        return { statusCode: 400, body: JSON.stringify({ error: "missing/invalid 'to'" }) };
    }

    const tr = (p.lang || "tr") === "tr";
    const score = Number(p.safety_score) || 0;
    const violations = Number(p.violations_count) || 0;
    const safe = Number(p.safe_count) || 0;
    const name = (p.video_name || (tr ? "Video" : "Video")).toString().slice(0, 120);
    const list = Array.isArray(p.violations) ? p.violations.slice(0, 10) : [];

    const subject = tr
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

    const esc = (s) => String(s == null ? "" : s).replace(/</g, "&lt;");
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

    const html = `<!doctype html><html><body style="margin:0;background:#0A0A0A;font-family:Arial,Helvetica,sans-serif;color:#FFFFFF;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="font-size:22px;font-weight:700;color:#D4AF37;letter-spacing:.5px;">MIA</div>
    <h1 style="font-size:20px;margin:24px 0 8px;color:#FFFFFF;">${t.head}</h1>
    <p style="color:#B8B8B8;font-size:14px;line-height:1.6;margin:0 0 24px;">${t.intro}</p>
    <div style="background:#161616;border:1px solid rgba(212,175,55,.25);border-radius:12px;padding:20px;">
      <div style="font-size:13px;color:#6E6E6E;">${t.video}</div>
      <div style="font-size:16px;font-weight:600;margin:2px 0 16px;">${name.replace(/</g,"&lt;")}</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;"><span style="font-size:13px;color:#6E6E6E;">${t.scoreL}</span></td>
          <td style="padding:8px 0;text-align:right;font-size:18px;font-weight:700;color:#ef4444;">%${score}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;"><span style="font-size:13px;color:#6E6E6E;">${t.viol}</span></td>
          <td style="padding:8px 0;text-align:right;font-weight:600;">${violations}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;"><span style="font-size:13px;color:#6E6E6E;">${t.safeL}</span></td>
          <td style="padding:8px 0;text-align:right;font-weight:600;color:#22c55e;">${safe}</td>
        </tr>
      </table>
    </div>
    ${detailBlock}
    <a href="https://miaissagligi.com/dashboard.html" style="display:inline-block;margin-top:24px;background:#D4AF37;color:#0A0A0A;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;">${t.cta}</a>
    <p style="color:#6E6E6E;font-size:11px;line-height:1.5;margin-top:24px;border-top:1px solid #222;padding-top:12px;">${t.disc}</p>
    <p style="color:#555;font-size:12px;margin-top:12px;">${t.foot}</p>
  </div>
</body></html>`;

    try {
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({ from: from, to: [to], subject: subject, html: html })
        });
        const text = await res.text();
        return { statusCode: res.status, headers: { "Content-Type": "application/json" }, body: text };
    } catch (err) {
        return { statusCode: 502, body: JSON.stringify({ error: "Resend upstream failed: " + (err && err.message || err) }) };
    }
};
