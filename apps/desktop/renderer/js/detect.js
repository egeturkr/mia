// === MIA Masaüstü — Hibrit Tespit Motoru ===
// 1) BİRİNCİL: cihaz üstü YOLOv8s KKD modeli (ONNX Runtime Web).
//    Sınıflar (models/mia-ppe-yolov8s.onnx metadata'sından, rf-27 ile birebir):
//    0 Hardhat, 1 Mask, 2 NO-Hardhat, 3 NO-Mask, 4 NO-Safety Vest,
//    5 Person, 6 Safety Cone, 7 Safety Vest, 8 machinery, 9 vehicle
// 2) YEDEK: Roboflow rf-27 (/api/detect proxy, ana süreç üzerinden) — yalnız
//    'hybrid'/'cloud' modunda ve ONNX kullanılamazsa/başarısızsa.
// Kareler cihazda işlenir; buluta görüntü YALNIZ cloud fallback'te gider.
(function () {
    "use strict";

    var NAMES = ["Hardhat", "Mask", "NO-Hardhat", "NO-Mask", "NO-Safety Vest",
                 "Person", "Safety Cone", "Safety Vest", "machinery", "vehicle"];
    var MODEL_URL = "/models/mia-ppe-yolov8s.onnx"; // mia://app/models/... (main.js protokol handler'ı)
    var INPUT = 640;

    var session = null, initPromise = null, engineInfo = { backend: null, ready: false, error: null };

    // ---- ONNX oturumu (webgpu → wasm sırasıyla dener) -------------------------
    // Sağlamlık: model önce URL'den, olmazsa ANA SÜREÇTEN bayt olarak yüklenir
    // (mia:// fetch'i herhangi bir nedenle takılırsa bile model çalışır).
    // wasmPaths MUTLAK verilir — göreli çözümleme sürprizleri elenir.
    function init() {
        if (initPromise) return initPromise;
        initPromise = (async function () {
            if (typeof ort === "undefined") { engineInfo.error = "ort yüklenemedi"; return engineInfo; }
            try { ort.env.wasm.wasmPaths = new URL("vendor/", location.href).toString(); }
            catch (e) { ort.env.wasm.wasmPaths = "vendor/"; }
            ort.env.wasm.numThreads = 1; // worker/COI gerektirmez — en uyumlu mod
            var errors = [];

            // Model kaynağı: URL → IPC bayt fallback
            var sources = [MODEL_URL];
            try {
                var mr = await window.mia.modelRead();
                if (mr.ok && mr.data) {
                    var u8 = mr.data instanceof Uint8Array ? mr.data : new Uint8Array(mr.data.data || mr.data);
                    sources.push(u8);
                } else if (mr.error) errors.push("ipc: " + mr.error);
            } catch (e) { errors.push("ipc: " + String(e && e.message || e)); }

            var providers = [["webgpu", "wasm"], ["wasm"]];
            for (var s = 0; s < sources.length; s++) {
                for (var i = 0; i < providers.length; i++) {
                    try {
                        session = await ort.InferenceSession.create(sources[s], { executionProviders: providers[i] });
                        engineInfo.backend = providers[i][0] + (s === 1 ? "+ipc" : "");
                        engineInfo.ready = true;
                        engineInfo.error = null;
                        return engineInfo;
                    } catch (e) {
                        errors.push(providers[i][0] + "/" + (s === 0 ? "url" : "bytes") + ": " + String(e && e.message || e));
                    }
                }
            }
            engineInfo.error = errors.join(" | ").slice(0, 500);
            console.error("[MIA] ONNX init başarısız:", engineInfo.error);
            return engineInfo;
        })();
        return initPromise;
    }

    // ---- Ön işleme: letterbox 640x640 (gri dolgu 114) --------------------------
    // Dönüş: {tensor, r, dx, dy} — r ölçek, dx/dy dolgu ofseti (kutu geri dönüşümü için).
    var _cv = document.createElement("canvas"); _cv.width = INPUT; _cv.height = INPUT;
    var _cx = _cv.getContext("2d", { willReadFrequently: true });

    function letterbox(src, sw, sh) {
        var r = Math.min(INPUT / sw, INPUT / sh);
        var nw = Math.round(sw * r), nh = Math.round(sh * r);
        var dx = Math.floor((INPUT - nw) / 2), dy = Math.floor((INPUT - nh) / 2);
        _cx.fillStyle = "rgb(114,114,114)";
        _cx.fillRect(0, 0, INPUT, INPUT);
        _cx.drawImage(src, 0, 0, sw, sh, dx, dy, nw, nh);
        var img = _cx.getImageData(0, 0, INPUT, INPUT).data;
        var n = INPUT * INPUT;
        var data = new Float32Array(3 * n);
        for (var p = 0; p < n; p++) {           // HWC uint8 → CHW float [0,1]
            data[p]         = img[p * 4]     / 255;
            data[n + p]     = img[p * 4 + 1] / 255;
            data[2 * n + p] = img[p * 4 + 2] / 255;
        }
        return { tensor: new ort.Tensor("float32", data, [1, 3, INPUT, INPUT]), r: r, dx: dx, dy: dy };
    }

    // ---- YOLOv8 çıktı çözümü: [1,14,8400] → kutular ----------------------------
    function decode(out, r, dx, dy, confThr) {
        var d = out.data, np = out.dims[2], nc = out.dims[1] - 4; // 8400, 10
        var dets = [];
        for (var i = 0; i < np; i++) {
            var best = 0, cls = -1;
            for (var c = 0; c < nc; c++) {
                var s = d[(4 + c) * np + i];
                if (s > best) { best = s; cls = c; }
            }
            if (best < confThr) continue;
            var cx = d[i], cy = d[np + i], w = d[2 * np + i], h = d[3 * np + i];
            dets.push({
                x: (cx - w / 2 - dx) / r, y: (cy - h / 2 - dy) / r,
                w: w / r, h: h / r,
                cls: NAMES[cls], conf: best
            });
        }
        return nms(dets, 0.45);
    }

    // ---- Sınıf bazlı NMS (IoU) --------------------------------------------------
    function iou(a, b) {
        var x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
        var x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
        var inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
        var uni = a.w * a.h + b.w * b.h - inter;
        return uni > 0 ? inter / uni : 0;
    }
    function nms(dets, thr) {
        dets.sort(function (a, b) { return b.conf - a.conf; });
        var keep = [];
        for (var i = 0; i < dets.length; i++) {
            var ok = true;
            for (var j = 0; j < keep.length; j++) {
                if (keep[j].cls === dets[i].cls && iou(keep[j], dets[i]) > thr) { ok = false; break; }
            }
            if (ok) keep.push(dets[i]);
        }
        return keep;
    }

    // ---- Küresel çıkarım kuyruğu ---------------------------------------------------
    // KURUMSAL: 4+ kamera aynı anda izlenirken ort oturumuna EŞZAMANLI run çağrısı
    // kararsızlık yaratır. Tüm çıkarımlar tek kuyruktan sırayla geçer — kamera
    // sayısı artsa da motor sağlam kalır (adaptif döngü zaten hızı dengeler).
    var runChain = Promise.resolve();
    function runExclusive(fn) {
        var p = runChain.then(fn, fn);
        runChain = p.then(function () { }, function () { }); // hata kuyruğu kilitlemesin
        return p;
    }

    // ---- Cihaz üstü tespit --------------------------------------------------------
    // src: <video> | <canvas> | <img> (doğal boyutları verilmeli)
    async function detectLocal(src, sw, sh, confThr) {
        await init();
        if (!session) throw new Error("onnx-unavailable: " + (engineInfo.error || ""));
        var pre = letterbox(src, sw, sh);
        var t0 = performance.now();
        var res = await runExclusive(function () { return session.run({ images: pre.tensor }); });
        var out = res[Object.keys(res)[0]];
        var dets = decode(out, pre.r, pre.dx, pre.dy, confThr || 0.4);
        return { detections: dets, ms: Math.round(performance.now() - t0), engine: "onnx-" + engineInfo.backend };
    }

    // ---- Bulut yedeği: Roboflow rf-27 (/api/detect, ana süreç üzerinden) ---------
    async function detectCloud(src, sw, sh, confThr, auth) {
        var c = document.createElement("canvas");
        var scale = Math.min(1, 960 / Math.max(sw, sh));
        c.width = Math.round(sw * scale); c.height = Math.round(sh * scale);
        c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
        var b64 = c.toDataURL("image/jpeg", 0.75).split(",")[1];
        var r = await window.mia.apiFetch({
            pathName: "/api/detect?confidence=" + Math.round((confThr || 0.4) * 100),
            method: "POST",
            headers: auth,
            body: { image: b64 }
        });
        if (!r.ok || r.status !== 200) throw new Error("cloud-detect " + r.status + ": " + (r.body || r.error || "").slice(0, 120));
        var out = JSON.parse(r.body);
        var dets = (out.predictions || []).map(function (p) {
            return { x: (p.x - p.width / 2) / scale, y: (p.y - p.height / 2) / scale,
                     w: p.width / scale, h: p.height / scale, cls: p.class, conf: p.confidence };
        });
        return { detections: dets, ms: null, engine: "roboflow-rf27" };
    }

    // ---- Hibrit giriş noktası ------------------------------------------------------
    // mode: 'onnx' | 'cloud' | 'hybrid' (varsayılan: önce cihaz, hata olursa bulut)
    async function detect(src, sw, sh, opts) {
        opts = opts || {};
        var mode = opts.mode || "hybrid", thr = opts.confidence || 0.4;
        if (mode === "cloud") return detectCloud(src, sw, sh, thr, opts.auth);
        try { return await detectLocal(src, sw, sh, thr); }
        catch (e) {
            if (mode === "onnx") throw e;
            return detectCloud(src, sw, sh, thr, opts.auth);
        }
    }

    window.miaDetect = { detect: detect, init: init, info: function () { return engineInfo; }, NAMES: NAMES,
                         _internals: { nms: nms, iou: iou, decode: decode } };
})();
