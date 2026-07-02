// === MIA Masaüstü — İzleme Kaynakları + MIA Vision Engine Döngüsü ===
// Kaynak türleri: webcam (getUserMedia) | rtsp (ana süreç ffmpeg → IPC kare)
//               | video (yerel dosya <video>)
// Döngü: kare al → model tespiti (detect.js) → MIA Vision Engine (tracker.js:
// takip + kişi-KKD eşleme + kare oylama) → overlay → DOĞRULANMIŞ olayları raporla.
(function () {
    "use strict";

    var COLORS = {
        violation: "#FF4D4D", ok: "#37D67A", pending: "#FF8A3D",
        person: "#F5A300", context: "#9AA0A6"
    };
    var EQUIP_LABELS = {
        helmet: { tr: "Baret", en: "Helmet" },
        safety_vest: { tr: "Yelek", en: "Vest" },
        mask: { tr: "Maske", en: "Mask" }
    };
    var CONTEXT_CLS = { "machinery": 1, "vehicle": 1, "Safety Cone": 1 };

    var tiles = new Map();      // tileId → tile
    var rtspFrames = new Map(); // tileId → { img, ts }

    // Ana süreçten gelen RTSP kareleri
    window.mia.onRtspFrame(function (f) {
        var t = tiles.get(f.id);
        if (!t) return;
        var img = new Image();
        img.onload = function () {
            rtspFrames.set(f.id, { img: img, ts: f.ts });
            t.lastFrameTs = f.ts;
            if (t.els && t.els.status) t.els.status.textContent = "● " + new Date(f.ts).toLocaleTimeString();
            if (t.els && t.els.preview) {
                var pc = t.els.preview;
                pc.width = img.naturalWidth; pc.height = img.naturalHeight;
                pc.getContext("2d").drawImage(img, 0, 0);
            }
        };
        img.src = f.dataUrl;
    });
    window.mia.onRtspStatus(function (s) {
        var t = tiles.get(s.id);
        if (t && t.els && t.els.status) t.els.status.textContent = s.status + (s.message ? " · " + s.message : "");
        if (t && s.status === "error") t.rtspError = s.message;
    });

    // ---- Kare kaynağı soyutlaması ---------------------------------------------
    function grabFrame(tile) {
        if (tile.kind === "rtsp") {
            var f = rtspFrames.get(tile.id);
            if (!f || Date.now() - f.ts > 30000) return null;
            return { src: f.img, w: f.img.naturalWidth, h: f.img.naturalHeight };
        }
        var v = tile.els.video;
        if (!v || v.readyState < 2 || v.videoWidth === 0) return null;
        if (tile.kind === "video" && v.paused) return null;
        return { src: v, w: v.videoWidth, h: v.videoHeight };
    }

    // ---- Overlay: MIA Vision Engine katmanı --------------------------------------
    // Kişi kutuları: kalıcı ID (P1, P2…) + ekipman durum çipleri (✓/✗/…)
    // Bağlam nesneleri (makine/araç/koni): ince gri kutu.
    function drawOverlay(tile, engineOut, rawDets, srcW, srcH, meta) {
        var cv = tile.els.overlay;
        var box = tile.els.wrap.getBoundingClientRect();
        cv.width = Math.round(box.width); cv.height = Math.round(box.height);
        var ctx = cv.getContext("2d");
        ctx.clearRect(0, 0, cv.width, cv.height);
        var r = Math.min(cv.width / srcW, cv.height / srcH);
        var ox = (cv.width - srcW * r) / 2, oy = (cv.height - srcH * r) / 2;
        var lang = window.miaI18n.getLang();
        var profile = window.miaCore.state.settings.profile;

        // Bağlam nesneleri (ince)
        ctx.font = "600 10px Inter, sans-serif";
        rawDets.forEach(function (d) {
            if (!CONTEXT_CLS[d.cls]) return;
            ctx.strokeStyle = COLORS.context; ctx.lineWidth = 1;
            ctx.strokeRect(d.x * r + ox, d.y * r + oy, d.w * r, d.h * r);
            ctx.fillStyle = COLORS.context;
            ctx.fillText(d.cls, d.x * r + ox + 3, d.y * r + oy + 11);
        });

        // Kişi track'leri
        engineOut.tracks.forEach(function (tr) {
            if (!tr.fresh) return;
            var hasVio = Object.keys(tr.equip).some(function (k) { return profile[k] && tr.equip[k] === "violation"; });
            var x = tr.box.x * r + ox, y = tr.box.y * r + oy, w = tr.box.w * r, h = tr.box.h * r;
            ctx.strokeStyle = hasVio ? COLORS.violation : COLORS.person;
            ctx.lineWidth = hasVio ? 3 : 2;
            ctx.strokeRect(x, y, w, h);

            // ID etiketi
            ctx.font = "700 12px Inter, sans-serif";
            var idLabel = tr.id;
            var tw = ctx.measureText(idLabel).width + 12;
            ctx.fillStyle = hasVio ? COLORS.violation : COLORS.person;
            ctx.fillRect(x - 1, Math.max(0, y - 19), tw, 19);
            ctx.fillStyle = "#050505";
            ctx.fillText(idLabel, x + 5, Math.max(13, y - 5));

            // Ekipman durum çipleri (profilde açık olanlar)
            ctx.font = "600 10px Inter, sans-serif";
            var cy2 = y + h + 13;
            var cx2 = x;
            Object.keys(tr.equip).forEach(function (k) {
                if (!profile[k]) return;
                var stt = tr.equip[k];
                var sym = stt === "ok" ? "✓" : stt === "violation" ? "✗" : stt === "pending" ? "?" : "·";
                var lbl = sym + " " + (EQUIP_LABELS[k] ? EQUIP_LABELS[k][lang] || EQUIP_LABELS[k].tr : k);
                var cw = ctx.measureText(lbl).width + 10;
                ctx.fillStyle = stt === "ok" ? COLORS.ok : stt === "violation" ? COLORS.violation :
                               stt === "pending" ? COLORS.pending : COLORS.context;
                ctx.fillRect(cx2, cy2 - 10, cw, 14);
                ctx.fillStyle = "#050505";
                ctx.fillText(lbl, cx2 + 5, cy2 + 1);
                cx2 += cw + 5;
            });
        });

        if (meta && tile.els.engineBadge) {
            tile.els.engineBadge.textContent = "MIA-VE · " + meta.engine + (meta.ms != null ? " · " + meta.ms + " ms" : "");
        }
    }

    // ---- Veri toplama (MIA'ya ait saha veri seti) ----------------------------------
    // Ayarlar'dan açılır (varsayılan KAPALI — KVKK). İhlal onaylanan veya modelin
    // KARARSIZ kaldığı (0.30–0.55) kareler YOLO formatında yerelde birikir →
    // ml/ eğitim hattına girdi olur. 30 sn/kamera hız sınırı.
    var CLS_INDEX = { "Hardhat": 0, "Mask": 1, "NO-Hardhat": 2, "NO-Mask": 3, "NO-Safety Vest": 4,
                      "Person": 5, "Safety Cone": 6, "Safety Vest": 7, "machinery": 8, "vehicle": 9 };
    function maybeCollect(tile, frame, dets, hadConfirmed) {
        var s = window.miaCore.state.settings;
        if (!s.dataCollect) return;
        var now = Date.now();
        if (tile.lastCollectTs && now - tile.lastCollectTs < 30000) return;
        var uncertain = dets.some(function (d) { return d.conf >= 0.30 && d.conf <= 0.55; });
        if (!hadConfirmed && !uncertain) return;
        tile.lastCollectTs = now;
        var c = document.createElement("canvas");
        var scale = Math.min(1, 1280 / Math.max(frame.w, frame.h));
        c.width = Math.round(frame.w * scale); c.height = Math.round(frame.h * scale);
        c.getContext("2d").drawImage(frame.src, 0, 0, c.width, c.height);
        var labels = dets.filter(function (d) { return CLS_INDEX[d.cls] != null; }).map(function (d) {
            var cx = (d.x + d.w / 2) / frame.w, cy = (d.y + d.h / 2) / frame.h;
            return CLS_INDEX[d.cls] + " " + cx.toFixed(6) + " " + cy.toFixed(6) + " " +
                   (d.w / frame.w).toFixed(6) + " " + (d.h / frame.h).toFixed(6);
        });
        window.mia.datasetSave({
            name: now + "_" + String(tile.cameraRowId || tile.id).slice(0, 8),
            jpegDataUrl: c.toDataURL("image/jpeg", 0.85),
            labelText: labels.join("\n")
        });
    }

    // ---- Tespit döngüsü -----------------------------------------------------------
    async function tick(tile) {
        if (!tile.running || tile.busy) return;
        var frame = grabFrame(tile);
        if (!frame) return;
        tile.busy = true;
        try {
            var st = window.miaCore.state;
            var auth = await window.miaCore.authHeaders();
            var res = await window.miaDetect.detect(frame.src, frame.w, frame.h, {
                mode: st.settings.engine, confidence: st.settings.confidence, auth: auth
            });
            // MIA Vision Engine: takip + eşleme + oylama
            var engineOut = tile.tracker.update(res.detections, Date.now());
            tile.lastDetections = res.detections;
            drawOverlay(tile, engineOut, res.detections, frame.w, frame.h, res);

            var produced = window.miaEvents.ingestConfirmed(engineOut.confirmed, res.detections, st.settings.profile, {
                orgId: st.org && st.org.id, cameraId: tile.cameraRowId, siteId: tile.siteId,
                engine: res.engine, lang: st.settings.lang, cameraName: tile.name
            });
            maybeCollect(tile, frame, res.detections, produced.length > 0);

            tile.stats.frames++;
            tile.stats.violations += produced.length;
            if (produced.length && tile.els.alert) {
                tile.els.alert.textContent = produced.map(function (p) { return p.title + " (" + p.trackId + ")"; }).join(" · ");
                tile.els.alert.className = "tile-alert show";
                setTimeout(function () { tile.els.alert.className = "tile-alert"; }, 5000);
            }
            if (tile.onFrame) tile.onFrame(res, produced, engineOut);
        } catch (e) {
            if (tile.els.engineBadge) tile.els.engineBadge.textContent = "hata: " + String(e.message || e).slice(0, 60);
        } finally { tile.busy = false; }
    }

    // ---- Kaynak yaşam döngüsü -------------------------------------------------------
    // opts: { id, cameraRowId, siteId, name, kind, rtspUrl, videoUrl, els, onFrame }
    async function start(opts) {
        var tile = Object.assign({
            running: true, busy: false, stats: { frames: 0, violations: 0 },
            lastDetections: [], tracker: new window.miaTracker.Tracker()
        }, opts);
        tiles.set(tile.id, tile);

        if (tile.kind === "webcam") {
            tile.stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 } }, audio: false });
            tile.els.video.srcObject = tile.stream;
            await tile.els.video.play();
        } else if (tile.kind === "rtsp") {
            var r = await window.mia.rtspStart({ id: tile.id, url: tile.rtspUrl, fps: Math.max(0.2, 1 / (window.miaCore.state.settings.intervalSec || 2)) });
            if (!r.ok) throw new Error(r.error || "rtsp start failed");
        } else if (tile.kind === "video") {
            tile.els.video.src = tile.videoUrl;
            await tile.els.video.play();
        }
        var iv = Math.max(500, (window.miaCore.state.settings.intervalSec || 2) * 1000);
        tile.timer = setInterval(function () { tick(tile); }, iv);
        tick(tile);
        return tile;
    }

    function stop(id) {
        var t = tiles.get(id);
        if (!t) return;
        t.running = false;
        clearInterval(t.timer);
        if (t.kind === "rtsp") window.mia.rtspStop(id);
        if (t.stream) { t.stream.getTracks().forEach(function (tr) { tr.stop(); }); t.stream = null; }
        if (t.els && t.els.video) { t.els.video.srcObject = null; t.els.video.removeAttribute("src"); }
        rtspFrames.delete(id);
        tiles.delete(id);
    }
    function stopAll() { for (var id of [...tiles.keys()]) stop(id); }
    function get(id) { return tiles.get(id); }
    function count() { return tiles.size; }

    window.miaSources = { start: start, stop: stop, stopAll: stopAll, get: get, count: count, COLORS: COLORS };
})();
