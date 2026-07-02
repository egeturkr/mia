// === MIA Masaüstü — Olay Motoru ===
// Tespitler → MIA güvenlik olayları. Kurallar worker'la (src/ppe_registry.py) uyumlu:
// - Yalnız org'un KKD profilinde AÇIK ekipmanlar ihlal üretir.
// - Dedup: aynı kamera + olay tipi 60 sn'de en fazla 1 olay.
// - Kuyruk diske yazılır (offline dayanıklılık) → /api/camera-event'e toplu gönderilir.
// - Kritik ihlalde masaüstü bildirimi.
(function () {
    "use strict";

    // Ekipman → olay eşlemesi (ppe-registry.js ile senkron).
    // camera_events.event_type CHECK kısıtı: no_helmet|no_vest|no_mask|ppe_violation|...
    // MIA Vision Engine (tracker.js) ekipman ANAHTARIYLA doğrulanmış ihlal üretir.
    var VIOLATIONS = {
        helmet:      { type: "no_helmet", risk: "high",   cls: "NO-Hardhat",
                       tr: "Baretsiz çalışan tespit edildi (doğrulandı)", en: "Worker without hardhat (confirmed)" },
        safety_vest: { type: "no_vest",   risk: "high",   cls: "NO-Safety Vest",
                       tr: "Yelek eksikliği tespit edildi (doğrulandı)", en: "Missing safety vest (confirmed)" },
        mask:        { type: "no_mask",   risk: "medium", cls: "NO-Mask",
                       tr: "Maske eksikliği tespit edildi (doğrulandı)", en: "Missing mask (confirmed)" }
    };

    var DEDUP_MS = 60 * 1000;       // kamera+tip başına 1 olay / 60 sn
    var FLUSH_MS = 10 * 1000;       // kuyruk boşaltma periyodu
    var MAX_QUEUE = 2000;           // disk kuyruğu tavanı (en eskiler düşer)

    var lastEmit = {};              // "camId|type" → ts
    var queue = [];                 // bekleyen olaylar
    var stats = { queued: 0, sent: 0, failed: 0, lastError: null, lastSentAt: null };
    var flushTimer = null, loaded = false;

    async function load() {
        if (loaded) return;
        queue = (await window.mia.storeGet("eventQueue")) || [];
        loaded = true;
    }
    function persist() { window.mia.storeSet("eventQueue", queue); }

    // ---- MIA Vision Engine'den DOĞRULANMIŞ ihlalleri işle --------------------------
    // confirmed: tracker.js çıktısı [{trackId, equip, conf}] — kare oylamasından geçmiş.
    // rawDets:   o karedeki ham kutular (kanıt olarak detections_json'a yazılır)
    // profile:   { helmet:true, safety_vest:true, mask:false } (ayarlardan)
    // ctx:       { orgId, cameraId, siteId, engine, lang, cameraName }
    // Dönüş: bu karede üretilen olaylar (UI rozetleri için).
    function ingestConfirmed(confirmed, rawDets, profile, ctx) {
        var now = Date.now(), out = [];
        (confirmed || []).forEach(function (c) {
            var v = VIOLATIONS[c.equip];
            if (!v || !profile[c.equip]) return; // profilde kapalı ekipman ihlal üretmez
            // Dedup: kamera+tip+track — aynı kişi 60 sn'de bir; farklı kişi (track) ayrı olay.
            var key = ctx.cameraId + "|" + v.type + "|" + c.trackId;
            if (lastEmit[key] != null && now - lastEmit[key] < DEDUP_MS) return;
            lastEmit[key] = now;
            var ev = {
                client_event_id: (crypto.randomUUID ? crypto.randomUUID() : String(now) + Math.random()),
                org_id: ctx.orgId,
                site_id: ctx.siteId || null,
                camera_id: ctx.cameraId,
                event_type: v.type,
                risk_level: v.risk,
                confidence: c.conf,
                person_track_id: c.trackId,
                missing_equipment: [c.equip],
                frame_timestamp: new Date(now).toISOString(),
                detections_json: {
                    engine: "mia-vision-v1",
                    boxes: (rawDets || []).map(function (x) {
                        return { cls: x.cls, conf: Math.round(x.conf * 100) / 100,
                                 x: Math.round(x.x), y: Math.round(x.y), w: Math.round(x.w), h: Math.round(x.h) };
                    })
                },
                model_name: (ctx.engine || "mia-ppe") + "+mia-vision-v1",
                model_version: "0.3.0"
            };
            queue.push(ev);
            if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
            stats.queued++;
            out.push({ type: v.type, risk: v.risk, trackId: c.trackId,
                       title: ctx.lang === "en" ? v.en : v.tr, conf: c.conf });
        });
        if (out.length) {
            persist();
            out.forEach(function (o) {
                if (o.risk === "high" || o.risk === "critical") window.mia.notify("MIA — " + o.title,
                    (ctx.cameraName || "") + " · " + o.trackId + " · " + Math.round(o.conf * 100) + "%");
            });
        }
        return out;
    }

    // ---- Kuyruk boşaltma -----------------------------------------------------------
    async function flush(getAuth) {
        await load();
        if (!queue.length) return;
        var auth = await getAuth();
        if (!auth) return; // oturum yoksa bekle
        var batch = queue.slice(0, 25);
        var r = await window.mia.apiFetch({
            pathName: "/api/camera-event", method: "POST",
            headers: auth, body: { events: batch }
        });
        if (r.ok && r.status === 200) {
            var res = {}; try { res = JSON.parse(r.body); } catch (e) { /* boş */ }
            queue.splice(0, batch.length);
            stats.sent += (res.inserted != null ? res.inserted : batch.length);
            stats.lastSentAt = Date.now(); stats.lastError = null;
            persist();
        } else if (r.status === 401 || r.status === 403) {
            stats.lastError = "auth (" + r.status + ")";      // oturum yenilenince düzelir — kuyruk KORUNUR
        } else if (r.status === 400) {
            queue.splice(0, batch.length); persist();          // bozuk parti — sonsuz döngüye girme
            stats.failed += batch.length; stats.lastError = "bad batch";
        } else {
            stats.lastError = "network (" + (r.status || r.error || "?") + ")"; // tekrar denenecek
        }
    }

    function startFlusher(getAuth) {
        if (flushTimer) return;
        flushTimer = setInterval(function () { flush(getAuth).catch(function (e) { stats.lastError = String(e); }); }, FLUSH_MS);
        flush(getAuth).catch(function () { /* ilk deneme sessiz */ });
    }

    window.miaEvents = {
        ingestConfirmed: ingestConfirmed, startFlusher: startFlusher, flush: flush,
        stats: function () { return Object.assign({ pending: queue.length }, stats); },
        VIOLATIONS: VIOLATIONS,
        _internals: { lastEmit: lastEmit, DEDUP_MS: DEDUP_MS }
    };
})();
