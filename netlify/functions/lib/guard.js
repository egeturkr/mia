// === MIA — API Güvenlik Guard (Production Hardening — Faz 1) ===
// Sunucusuz fonksiyonlar için paylaşılan koruma katmanı:
//   1) Origin allowlist (CORS) — yalnızca bilinen domainlerden tarayıcı çağrısı
//   2) Kimlik doğrulama       — Supabase JWT (Bearer) → gerçek kullanıcı
//   3) Rate-limit + aylık kota — api_usage tablosu üzerinden (service_role)
//   4) Loglama                — her istek api_usage'a yazılır
//
// Yan etki minimal: saf yardımcılar dışa açılır (test edilebilir). Node 18+
// global fetch kullanır (Netlify Functions). CommonJS — fonksiyonlardan require edilir.

const crypto = require("crypto");

// ---- Origin allowlist -------------------------------------------------------
// MIA_ALLOWED_ORIGINS env (virgülle) ile genişletilebilir. Varsayılan: canlı
// domain + www + Netlify deploy preview'leri (*.netlify.app).
function allowedOrigins() {
  const env = (process.env.MIA_ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  return new Set([
    "https://miaissagligi.com",
    "https://www.miaissagligi.com",
    ...env,
  ]);
}
function isOriginAllowed(origin) {
  if (!origin) return false;
  if (allowedOrigins().has(origin)) return true;
  // Netlify deploy preview / şube dağıtımları
  try {
    const host = new URL(origin).host;
    if (/\.netlify\.app$/.test(host)) return true;
  } catch (e) { /* geçersiz origin */ }
  return false;
}

function corsHeaders(origin) {
  const h = {
    "Content-Type": "application/json",
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-scan-token",
    "Access-Control-Max-Age": "86400",
  };
  if (origin && isOriginAllowed(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

function getOrigin(event) {
  const hh = event.headers || {};
  return hh.origin || hh.Origin || "";
}
function getClientIp(event) {
  const hh = event.headers || {};
  return (hh["x-nf-client-connection-ip"] ||
    (hh["x-forwarded-for"] || "").split(",")[0].trim() ||
    hh["client-ip"] || "unknown");
}
function ipHash(ip) {
  return "ip:" + crypto.createHash("sha256").update(String(ip)).digest("hex").slice(0, 24);
}
function bearer(event) {
  const hh = event.headers || {};
  const a = hh.authorization || hh.Authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(a);
  return m ? m[1] : null;
}
function resp(status, obj, origin) {
  return { statusCode: status, headers: corsHeaders(origin), body: JSON.stringify(obj) };
}

// ---- Supabase auth (JWT doğrulama) -----------------------------------------
// Access token'ı Supabase Auth'a sorar; geçerliyse kullanıcı döner. Bu yöntem
// iptal/expiry'yi de yakalar (yerel imza doğrulamasından daha güvenli).
async function verifyUser(token) {
  const SB_URL = process.env.SUPABASE_URL;
  const ANON = process.env.SUPABASE_ANON_KEY;
  if (!SB_URL || !ANON || !token) return null;
  try {
    const r = await fetch(SB_URL.replace(/\/$/, "") + "/auth/v1/user", {
      headers: { apikey: ANON, Authorization: "Bearer " + token },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? u : null;
  } catch (e) { return null; }
}

// ---- Rate-limit + kota (api_usage) -----------------------------------------
function restBase() { return (process.env.SUPABASE_URL || "").replace(/\/$/, "") + "/rest/v1/"; }
function svcHeaders() {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { apikey: k, Authorization: "Bearer " + k, "Content-Type": "application/json" };
}

async function countSince(subject, endpoint, sinceIso, cap) {
  // En fazla cap+1 kayıt çek, uzunlukla say (küçük pencereler için yeterli/ucuz).
  const url = restBase() + "api_usage?select=id&subject=eq." + encodeURIComponent(subject) +
    "&endpoint=eq." + encodeURIComponent(endpoint) +
    "&created_at=gte." + encodeURIComponent(sinceIso) +
    "&limit=" + (cap + 1);
  const r = await fetch(url, { headers: svcHeaders() });
  if (!r.ok) return null; // sayım başarısızsa fail-open YAPMA → çağıran karar verir
  const rows = await r.json();
  return Array.isArray(rows) ? rows.length : null;
}

async function logUsage(subject, subjectType, endpoint, status) {
  try {
    await fetch(restBase() + "api_usage", {
      method: "POST",
      headers: Object.assign({ Prefer: "return=minimal" }, svcHeaders()),
      body: JSON.stringify({ subject, subject_type: subjectType, endpoint, status: status || null }),
    });
  } catch (e) { /* loglama hatası isteği düşürmesin */ }
}

// ---- Ana koruma akışı -------------------------------------------------------
// opts: { endpoint, perMin, perMonth, auth: 'user' | 'user-or-ip', anonPerDay }
// Döner: { ok:true, origin, subject, subjectType, user } | { ok:false, response }
async function enforce(event, opts) {
  const origin = getOrigin(event);

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { ok: false, response: { statusCode: 204, headers: corsHeaders(origin), body: "" } };
  }
  if (event.httpMethod !== "POST") {
    return { ok: false, response: resp(405, { error: "POST only" }, origin) };
  }
  // Origin allowlist (tarayıcı çağrıları için zorunlu)
  if (!isOriginAllowed(origin)) {
    return { ok: false, response: resp(403, { error: "origin not allowed" }, origin) };
  }

  // Kimlik
  let subject, subjectType, user = null, perMonth = opts.perMonth;
  const token = bearer(event);
  user = token ? await verifyUser(token) : null;

  if (user) {
    subject = "user:" + user.id; subjectType = "user";
  } else if (opts.auth === "user-or-ip") {
    // Anonim demo: IP bazlı sıkı limit
    subject = ipHash(getClientIp(event)); subjectType = "ip";
    perMonth = opts.anonPerDay || 5; // gün bazında değerlendirilecek (aşağıda pencere)
  } else {
    return { ok: false, response: resp(401, { error: "authentication required" }, origin) };
  }

  // Rate-limit (dakika)
  const nowMs = Date.now();
  const minAgo = new Date(nowMs - 60 * 1000).toISOString();
  const perMin = opts.perMin || 30;
  const minCount = await countSince(subject, opts.endpoint, minAgo, perMin);
  if (minCount === null) {
    return { ok: false, response: resp(503, { error: "rate limiter unavailable" }, origin) };
  }
  if (minCount >= perMin) {
    return { ok: false, response: { statusCode: 429, headers: Object.assign({ "Retry-After": "60" }, corsHeaders(origin)), body: JSON.stringify({ error: "rate limit exceeded", retry_after: 60 }) } };
  }

  // Kota (kullanıcı: aylık / anonim: günlük)
  const windowMs = subjectType === "ip" ? 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  const sinceIso = new Date(nowMs - windowMs).toISOString();
  const used = await countSince(subject, opts.endpoint, sinceIso, perMonth);
  if (used === null) {
    return { ok: false, response: resp(503, { error: "quota check unavailable" }, origin) };
  }
  if (used >= perMonth) {
    return { ok: false, response: resp(402, { error: "quota exceeded", limit: perMonth, window: subjectType === "ip" ? "day" : "month" }, origin) };
  }

  return { ok: true, origin, subject, subjectType, user, resp, logUsage };
}

module.exports = {
  enforce, resp, corsHeaders, isOriginAllowed, getOrigin, getClientIp,
  ipHash, bearer, verifyUser, logUsage, countSince,
};
