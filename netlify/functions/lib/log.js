// === MIA — Sunucu Tarafı İzleme Yardımcısı (Faz 10) ===
// system_events / system_errors yazımı. KURALLAR: log hatası ürünü ASLA bozmaz;
// sır/token/ham içerik loglanmaz (sanitize); tablo yoksa sessizce console.warn.

const crypto = require("crypto");

function restBase() { return (process.env.SUPABASE_URL || "").replace(/\/$/, "") + "/rest/v1/"; }
function H() {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { apikey: k, Authorization: "Bearer " + k, "Content-Type": "application/json", Prefer: "return=minimal" };
}
function enabled() { return (process.env.OPS_LOGGING_ENABLED || "true") !== "false"; }

// Token/anahtar desenlerini ayıkla + uzunluk sınırla.
function sanitize(s) {
  return String(s == null ? "" : s)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/eyJ[A-Za-z0-9._-]{20,}/g, "[JWT_REDACTED]")
    .replace(/(api[_-]?key|secret|token|password)["'\s:=]+[^\s"',}]{6,}/gi, "$1=[REDACTED]")
    .slice(0, 500);
}
function newRequestId() { return crypto.randomBytes(8).toString("hex"); }
function stackHash(stack) {
  if (!stack) return null;
  return crypto.createHash("sha256").update(String(stack)).digest("hex").slice(0, 12);
}

async function insert(table, row) {
  if (!enabled() || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const r = await fetch(restBase() + table, { method: "POST", headers: H(), body: JSON.stringify(row) });
    if (!r.ok) console.warn("[MIA-ops] " + table + " yazılamadı (migration?):", r.status);
  } catch (e) { console.warn("[MIA-ops] log hatası (yutuldu):", e && e.message); }
}

async function logEvent(opts) {
  await insert("system_events", {
    event_type: opts.type, severity: opts.severity || "info", source: opts.source || "api",
    user_id: opts.userId || null, org_id: opts.orgId || null,
    route: opts.route || null, function_name: opts.fn || null,
    message: opts.message ? sanitize(opts.message) : null, metadata: opts.meta || null,
  });
}

async function logError(opts) {
  await insert("system_errors", {
    source: opts.source || "api", severity: opts.severity || "error",
    error_code: opts.code || null, message: sanitize(opts.message || "unknown"),
    stack_hash: stackHash(opts.stack), user_id: opts.userId || null, org_id: opts.orgId || null,
    route: opts.route || null, function_name: opts.fn || null,
    request_id: opts.requestId || null, metadata: opts.meta || null,
  });
}

async function logHealth(name, status, latencyMs, message) {
  await insert("health_checks", {
    check_name: name, status: status, latency_ms: latencyMs == null ? null : Math.round(latencyMs),
    message: message ? sanitize(message) : null,
  });
}

module.exports = { logEvent, logError, logHealth, sanitize, newRequestId, stackHash };
