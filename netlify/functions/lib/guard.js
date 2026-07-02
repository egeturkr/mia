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
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-scan-token, x-mia-org",
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

// Birden çok endpoint için birleşik sayım (plan AI kotası: detect + analyze birlikte).
async function countSinceGroup(subject, endpoints, sinceIso, cap) {
  const inList = endpoints.map(function (e) { return '"' + e + '"'; }).join(",");
  const url = restBase() + "api_usage?select=id&subject=eq." + encodeURIComponent(subject) +
    "&endpoint=in.(" + encodeURIComponent(inList) + ")" +
    "&created_at=gte." + encodeURIComponent(sinceIso) +
    "&limit=" + (cap + 1);
  const r = await fetch(url, { headers: svcHeaders() });
  if (!r.ok) return null;
  const rows = await r.json();
  return Array.isArray(rows) ? rows.length : null;
}

// Plana göre aylık AI kotası (plans.js ile aynı; değiştirirken ikisini de güncelle).
// HOTFIX (birim düzeltmesi): kota birimi "AI çağrısı"dır (işlenen kare / Modal isteği),
// "analiz" değil. Canlı analiz video başına ~10 kare gönderir; eski free=10 değeri
// TEK videoda tükeniyor ve sonraki tüm kareler 402 alıyordu (boş sonuç bug'ı).
// Limitler ~15 analiz/ay eşdeğerine ölçeklendi. Güvenlik mantığı DEĞİŞMEDİ (fail-closed).
const PLAN_QUOTAS = { free: 150, giris: 450, kamera_ai: 4500, pro: 15000, kurumsal: 100000 };

// Kullanıcının aktif planını çöz (abonesi yoksa 'free').
async function resolvePlan(userId) {
  try {
    const url = restBase() + "subscriptions?user_id=eq." + encodeURIComponent(userId) +
      "&select=plan,status&limit=1";
    const r = await fetch(url, { headers: svcHeaders() });
    if (!r.ok) return "free";
    const rows = await r.json();
    const s = Array.isArray(rows) && rows[0];
    if (!s) return "free";
    if (["active", "trialing"].indexOf(s.status) === -1) return "free";
    return PLAN_QUOTAS[s.plan] ? s.plan : "free";
  } catch (e) { return "free"; }
}

async function logUsage(subject, subjectType, endpoint, status, orgId) {
  try {
    const row = { subject, subject_type: subjectType, endpoint, status: status || null };
    if (orgId) row.org_id = orgId;
    let r = await fetch(restBase() + "api_usage", {
      method: "POST",
      headers: Object.assign({ Prefer: "return=minimal" }, svcHeaders()),
      body: JSON.stringify(row),
    });
    // org_id kolonu yoksa (migration koşulmadıysa) onsuz tekrar dene — geri uyumluluk.
    if (!r.ok && orgId) {
      delete row.org_id;
      await fetch(restBase() + "api_usage", {
        method: "POST",
        headers: Object.assign({ Prefer: "return=minimal" }, svcHeaders()),
        body: JSON.stringify(row),
      });
    }
  } catch (e) { /* loglama hatası isteği düşürmesin */ }
}

// ---- Faz 6: org bağlamı + org-aware plan/kota çözümü -------------------------
// İstemci x-mia-org başlığı gönderir; üyelik SERVICE ROLE ile doğrulanır
// (başlığa körü körüne güvenilmez). Üye değilse org bağlamı YOK sayılır.
async function resolveOrgContext(userId, event) {
  const hh = event.headers || {};
  const orgId = (hh["x-mia-org"] || hh["X-Mia-Org"] || "").toString().trim();
  if (!orgId || !userId) return null;
  if (!/^[0-9a-f-]{36}$/i.test(orgId)) return null;
  try {
    const url = restBase() + "organization_memberships?org_id=eq." + encodeURIComponent(orgId) +
      "&user_id=eq." + encodeURIComponent(userId) + "&status=eq.active&select=role&limit=1";
    const r = await fetch(url, { headers: svcHeaders() });
    if (!r.ok) return null;
    const rows = await r.json();
    return (Array.isArray(rows) && rows[0]) ? { orgId: orgId, role: rows[0].role } : null;
  } catch (e) { return null; }
}

const ACTIVE_SUB_STATUSES = ["active", "trialing", "manual_active", "pilot_active"];

// Abonelik satırı → {plan, limit}. quota_overrides.monthly_ai varsa onu kullanır.
function planFromSub(sub) {
  const plan = (sub && PLAN_QUOTAS[sub.plan]) ? sub.plan : "free";
  let limit = PLAN_QUOTAS[plan];
  const ov = sub && sub.quota_overrides;
  if (ov && typeof ov.monthly_ai === "number" && ov.monthly_ai > 0) limit = ov.monthly_ai;
  return { plan: plan, limit: limit };
}

async function fetchSub(filter) {
  try {
    const url = restBase() + "subscriptions?" + filter + "&select=plan,status,quota_overrides&limit=1";
    const r = await fetch(url, { headers: svcHeaders() });
    if (!r.ok) return null;
    const rows = await r.json();
    const s = Array.isArray(rows) && rows[0];
    return (s && ACTIVE_SUB_STATUSES.indexOf(s.status) !== -1) ? s : null;
  } catch (e) { return null; }
}

// Çözüm sırası: org aboneliği → kişisel abonelik → free.
async function resolvePlanContext(userId, orgId) {
  if (orgId) {
    const orgSub = await fetchSub("org_id=eq." + encodeURIComponent(orgId));
    if (orgSub) return Object.assign(planFromSub(orgSub), { scope: "org" });
  }
  const userSub = await fetchSub("user_id=eq." + encodeURIComponent(userId) + "&org_id=is.null");
  if (userSub) return Object.assign(planFromSub(userSub), { scope: "user" });
  return { plan: "free", limit: PLAN_QUOTAS.free, scope: "user" };
}

// Org bazlı aylık kullanım sayımı (tüm üyelerin detect+analyze toplamı).
async function countOrgUsage(orgId, endpoints, sinceIso, cap) {
  const inList = endpoints.map(function (e) { return '"' + e + '"'; }).join(",");
  const url = restBase() + "api_usage?select=id&org_id=eq." + encodeURIComponent(orgId) +
    "&endpoint=in.(" + encodeURIComponent(inList) + ")" +
    "&created_at=gte." + encodeURIComponent(sinceIso) + "&limit=" + (cap + 1);
  try {
    const r = await fetch(url, { headers: svcHeaders() });
    if (!r.ok) return null;
    const rows = await r.json();
    return Array.isArray(rows) ? rows.length : null;
  } catch (e) { return null; }
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
  // Origin allowlist (tarayıcı çağrıları için zorunlu).
  // Faz 18 istisnası: YERLİ istemciler (masaüstü uygulaması) Origin başlığı
  // GÖNDERMEZ — origin tamamen yoksa VE Bearer token taşıyorsa geçer (token
  // hemen aşağıda doğrulanır; geçersizse yine reddedilir). Origin VARSA
  // (tarayıcı bağlamı) allowlist şartı aynen korunur — CSRF duruşu değişmez.
  const nativeClient = !origin && !!bearer(event);
  if (!isOriginAllowed(origin) && !nativeClient) {
    return { ok: false, response: resp(403, { error: "origin not allowed" }, origin) };
  }

  // Kimlik
  let subject, subjectType, user = null, perMonth = opts.perMonth;
  const token = bearer(event);
  user = token ? await verifyUser(token) : null;

  // Yerli istemcide anonim düşüş YOK: token geçersizse direkt 401.
  if (nativeClient && !user) {
    return { ok: false, response: resp(401, { error: "authentication required" }, origin) };
  }

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

  // Kota — kullanıcı: org aboneliği → kişisel abonelik → free (Faz 6 org-aware);
  //        anonim: IP başına günlük.
  var plan = null, orgCtx = null, planCtx = null;
  var used, limit, windowLabel;
  if (subjectType === "user") {
    orgCtx = await resolveOrgContext(user.id, event);
    planCtx = await resolvePlanContext(user.id, orgCtx ? orgCtx.orgId : null);
    plan = planCtx.plan;
    limit = planCtx.limit;
    var since30 = new Date(nowMs - 30 * 24 * 60 * 60 * 1000).toISOString();
    if (planCtx.scope === "org" && orgCtx) {
      // Org kotası: tüm üyelerin toplam kullanımı. Sayım başarısızsa fail-closed.
      used = await countOrgUsage(orgCtx.orgId, ["detect", "analyze"], since30, limit);
    } else {
      used = await countSinceGroup(subject, ["detect", "analyze"], since30, limit);
    }
    windowLabel = "month";
  } else {
    limit = perMonth; // anonim günlük
    var since1 = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
    used = await countSince(subject, opts.endpoint, since1, limit);
    windowLabel = "day";
  }
  if (used === null) {
    return { ok: false, response: resp(503, { error: "quota check unavailable" }, origin) };
  }
  if (used >= limit) {
    try {
      require("./log").logEvent({ type: "quota_exceeded", severity: "warning", source: "api",
        userId: user ? user.id : null, orgId: orgCtx ? orgCtx.orgId : null,
        fn: opts.endpoint, meta: { plan: plan, limit: limit } });
    } catch (e) { /* loglama isteği düşürmesin */ }
    return { ok: false, response: resp(402, { error: "quota exceeded", plan: plan, limit: limit, window: windowLabel }, origin) };
  }

  return { ok: true, origin, subject, subjectType, user, plan: plan,
           orgId: (orgCtx && planCtx && planCtx.scope === "org") ? orgCtx.orgId : (orgCtx ? orgCtx.orgId : null),
           resp: resp, logUsage: logUsage };
}

module.exports = {
  enforce, resp, corsHeaders, isOriginAllowed, getOrigin, getClientIp,
  ipHash, bearer, verifyUser, logUsage, countSince, countSinceGroup,
  resolveOrgContext, resolvePlanContext, countOrgUsage,
  resolvePlan, PLAN_QUOTAS,
};
