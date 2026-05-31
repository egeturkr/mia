// === MIA Video Safety Hazard Detector ===
// Hybrid: real Roboflow inference (Live mode) + simulation fallback (Demo mode).

(function() {
    // ===== Roboflow config =====
    // Publishable key — safe for client-side. Domain restrict on Roboflow Settings → API Keys.
    var ROBOFLOW = {
        apiKey: "rf_CKNU6nQdF4d2SiFJRb27yfK5P9I2",
        // 10-class construction PPE model: Hardhat, NO-Hardhat, Safety Vest, NO-Safety Vest,
        // Mask, NO-Mask, Person, machinery, vehicle, Safety Cone. mAP ~70%, 2800+ images.
        model: "construction-site-safety/27",
        endpoint: "https://detect.roboflow.com",  // classic REST endpoint (most reliable)
        confidence: 35,                            // %35+ confidence
        overlap: 30,                               // NMS overlap
        maxFrames: 10,                             // cost guard — 15 credit free tier'da güvenli
        frameStrideSec: 2                          // her N saniyede 1 frame
    };

    // Roboflow class → MIA event mapping. NO-* sınıflar ihlal demek (Yüksek risk).
    var ROBOFLOW_CLASS_MAP = {
        "Hardhat":         { event: "hardhat_ok", risk: "Düşük", ppe: "Baret",
                             tr: { title: "Baret kullanılıyor (güvenli)", desc: "Personel uygun koruyucu baret kullanıyor." },
                             en: { title: "Hardhat detected (compliant)", desc: "Worker is wearing the required protective hardhat." } },
        "NO-Hardhat":      { event: "no_hardhat", risk: "Yüksek", ppe: "Baret",
                             tr: { title: "Baretsiz çalışan tespit edildi", desc: "Koruyucu baret takmayan personel tespit edildi." },
                             en: { title: "Worker without hardhat", desc: "Personnel detected without the required protective hardhat." } },
        "Safety Vest":     { event: "vest_ok", risk: "Düşük", ppe: "Yelek",
                             tr: { title: "Güvenlik yeleği kullanılıyor", desc: "Personel yüksek görünürlüklü güvenlik yeleği giyiyor." },
                             en: { title: "Safety vest detected (compliant)", desc: "Worker is wearing a high-visibility safety vest." } },
        "NO-Safety Vest":  { event: "no_vest", risk: "Yüksek", ppe: "Yelek",
                             tr: { title: "Yelek eksikliği tespit edildi", desc: "Yüksek görünürlüklü güvenlik yeleği takmayan personel görüldü." },
                             en: { title: "Missing safety vest", desc: "Worker detected without the required high-visibility vest." } },
        "Mask":            { event: "mask_ok", risk: "Düşük", ppe: "Maske",
                             tr: { title: "Maske kullanılıyor", desc: "Personel uygun maske kullanıyor." },
                             en: { title: "Mask detected (compliant)", desc: "Worker is wearing a protective mask." } },
        "NO-Mask":         { event: "no_mask", risk: "Orta", ppe: "Maske",
                             tr: { title: "Maske eksikliği", desc: "Solunum koruyucu maske kullanmayan personel görüldü." },
                             en: { title: "Missing mask", desc: "Worker detected without a respiratory protective mask." } },
        "Person":          { event: "person", risk: "Düşük", ppe: "Person",
                             tr: { title: "Personel tespit edildi", desc: "Sahada personel hareketi gözlemlendi." },
                             en: { title: "Person detected", desc: "Personnel movement observed on site." } },
        "machinery":       { event: "machinery", risk: "Orta", ppe: "Makine",
                             tr: { title: "İş makinesi tespit edildi", desc: "Operasyon bölgesinde aktif iş makinesi var, dikkat." },
                             en: { title: "Machinery detected", desc: "Active construction machinery in operation zone — caution." } },
        "vehicle":         { event: "vehicle", risk: "Orta", ppe: "Araç",
                             tr: { title: "Araç tespit edildi", desc: "Şantiye araç hareketi gözlemlendi." },
                             en: { title: "Vehicle detected", desc: "Construction vehicle movement observed." } },
        "Safety Cone":     { event: "cone", risk: "Düşük", ppe: "Trafik Kon",
                             tr: { title: "Güvenlik konisi tespit edildi", desc: "Trafik/yön düzenleme konisi." },
                             en: { title: "Safety cone detected", desc: "Traffic / area marker cone." } }
    };

    var EVENT_TYPES = [
        {
            key: "no_helmet",
            tr: { title: "Baretsiz çalışan tespit edildi", desc: "Belirlenen bölgede koruyucu baret takmayan personel görüldü." },
            en: { title: "Worker without helmet detected", desc: "A person was observed without a protective helmet in the marked zone." },
            ppe: "Baret",
            risk: "Yüksek"
        },
        {
            key: "no_vest",
            tr: { title: "Yelek eksikliği", desc: "Yüksek görünürlüklü güvenlik yeleği takmayan kişi tespit edildi." },
            en: { title: "Missing safety vest", desc: "A worker was detected without the required high-visibility safety vest." },
            ppe: "Yelek",
            risk: "Orta"
        },
        {
            key: "restricted_zone",
            tr: { title: "Tehlikeli bölgeye giriş", desc: "Yetkisiz personelin kısıtlanmış / tehlikeli bölgeye girişi gözlemlendi." },
            en: { title: "Entry into hazardous zone", desc: "Unauthorized personnel observed entering a restricted hazard zone." },
            ppe: "Zone",
            risk: "Yüksek"
        },
        {
            key: "fall_risk",
            tr: { title: "Düşme riski", desc: "Yüksek kotta korkuluk veya emniyet kemeri olmadan çalışma tespit edildi." },
            en: { title: "Fall risk detected", desc: "Working at height observed without guardrails or harness." },
            ppe: "Harness",
            risk: "Yüksek"
        },
        {
            key: "no_gloves",
            tr: { title: "Eldiven eksikliği", desc: "El yaralanması riski taşıyan operasyonda eldiven kullanılmadığı görüldü." },
            en: { title: "Missing gloves", desc: "Gloves were not used during an operation with elevated hand-injury risk." },
            ppe: "Eldiven",
            risk: "Düşük"
        }
    ];

    var ANALYSIS_STEPS = [
        { pct: 8,  tr: "Video yükleniyor...",                en: "Loading video..." },
        { pct: 22, tr: "Kareler ayrıştırılıyor...",          en: "Extracting frames..." },
        { pct: 40, tr: "Nesne tespiti çalıştırılıyor...",    en: "Running object detection..." },
        { pct: 60, tr: "PPE sınıflandırması yapılıyor...",   en: "Classifying PPE..." },
        { pct: 78, tr: "Tehlike bölgeleri eşleştiriliyor...", en: "Mapping hazard zones..." },
        { pct: 92, tr: "Rapor oluşturuluyor...",             en: "Generating report..." },
        { pct: 100, tr: "Analiz tamamlandı",                  en: "Analysis complete" }
    ];

    // State
    var state = {
        file: null,
        videoDurationSec: 0,
        events: [],
        startedAt: null,
        finishedAt: null,
        currentFilter: "all"
    };

    // Elements
    var $ = function(id) { return document.getElementById(id); };
    var els = {
        uploadPanel:    $("uploadPanel"),
        previewPanel:   $("previewPanel"),
        resultsPanel:   $("resultsPanel"),
        uploadZone:     $("uploadZone"),
        fileInput:      $("detFileInput"),
        browseBtn:      $("detBrowseBtn"),
        videoPreview:   $("detVideoPreview"),
        videoName:      $("videoName"),
        videoSize:      $("videoSize"),
        removeBtn:      $("removeVideoBtn"),
        startBtn:       $("startAnalysisBtn"),
        progressBar:    $("progressBar"),
        progressStep:   $("progressStep"),
        progressPct:    $("progressPct"),
        progressFill:   $("progressFill"),
        progressEta:    $("progressEta"),
        controlStatus:  $("controlStatus"),
        // Overlay + timeline
        overlay:        $("detOverlay"),
        timeline:       $("detTimeline"),
        tlTrack:        document.querySelector("#detTimeline .det-timeline-track"),
        tlMarkers:      $("detTimelineMarkers"),
        tlCursor:       $("detTimelineCursor"),
        tlProgress:     $("detTimelineProgress"),
        // Results
        totalHazards:   $("totalHazards"),
        highRisk:       $("highRisk"),
        avgConfidence:  $("avgConfidence"),
        processedTime:  $("processedTime"),
        eventsGrid:     $("eventsGrid"),
        downloadJson:   $("downloadJsonBtn"),
        resetBtn:       $("resetBtn"),
        filterPills:    document.querySelectorAll(".det-pill")
    };

    function fmtSize(bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + " KB";
        if (bytes < 1024*1024*1024) return (bytes/(1024*1024)).toFixed(1) + " MB";
        return (bytes/(1024*1024*1024)).toFixed(2) + " GB";
    }
    function fmtTime(sec) {
        sec = Math.max(0, Math.floor(sec));
        var m = Math.floor(sec/60), s = sec % 60;
        return m + ":" + (s < 10 ? "0" : "") + s;
    }
    function getLang() {
        try { return localStorage.getItem("mia_lang") || "tr"; } catch (e) { return "tr"; }
    }

    function setFile(file) {
        if (!file) return;
        // 100MB limit
        if (file.size > 100 * 1024 * 1024) {
            alert(getLang() === "tr"
                ? "Dosya çok büyük. Maksimum 100 MB."
                : "File too large. Max 100 MB.");
            return;
        }
        state.file = file;
        var url = URL.createObjectURL(file);
        els.videoPreview.src = url;
        els.videoPreview.onloadedmetadata = function() {
            state.videoDurationSec = els.videoPreview.duration || 0;
        };
        els.videoName.textContent = file.name;
        els.videoSize.textContent = fmtSize(file.size);
        els.uploadPanel.style.display = "none";
        els.previewPanel.style.display = "block";
        els.resultsPanel.style.display = "none";
        els.progressBar.style.display = "none";
    }

    function resetAll() {
        state = { file: null, videoDurationSec: 0, events: [], startedAt: null, finishedAt: null, currentFilter: "all" };
        if (els.videoPreview.src) { try { URL.revokeObjectURL(els.videoPreview.src); } catch (e) {} els.videoPreview.removeAttribute("src"); els.videoPreview.load(); }
        els.uploadPanel.style.display = "block";
        els.previewPanel.style.display = "none";
        els.resultsPanel.style.display = "none";
        els.fileInput.value = "";
        // Cleanup overlay + timeline
        stopOverlayLoop();
        if (els.timeline) els.timeline.style.display = "none";
        if (els.tlMarkers) els.tlMarkers.innerHTML = "";
        if (els.overlay) { var ctx = els.overlay.getContext("2d"); ctx && ctx.clearRect(0, 0, els.overlay.width, els.overlay.height); }
        if (els.controlStatus) els.controlStatus.classList.remove("is-done");
    }

    // Timeline click → seek (excluding marker clicks which are handled separately)
    if (els.tlTrack) {
        els.tlTrack.addEventListener("click", function(e) {
            var rect = els.tlTrack.getBoundingClientRect();
            var pct = (e.clientX - rect.left) / rect.width;
            seekTo(pct * (state.videoDurationSec || 0));
        });
    }

    // Resize canvas on metadata load + window resize
    if (els.videoPreview) {
        els.videoPreview.addEventListener("loadedmetadata", resizeCanvas);
        els.videoPreview.addEventListener("loadeddata", resizeCanvas);
    }
    window.addEventListener("resize", resizeCanvas);

    // === UPLOAD HANDLERS ===
    els.browseBtn.addEventListener("click", function() { els.fileInput.click(); });
    els.uploadZone.addEventListener("click", function(e) {
        if (e.target.closest(".det-btn")) return;
        els.fileInput.click();
    });
    els.fileInput.addEventListener("change", function(e) {
        var f = e.target.files && e.target.files[0];
        if (f) setFile(f);
    });
    ["dragenter","dragover"].forEach(function(ev){
        els.uploadZone.addEventListener(ev, function(e){
            e.preventDefault(); e.stopPropagation();
            els.uploadZone.classList.add("is-dragover");
        });
    });
    ["dragleave","drop"].forEach(function(ev){
        els.uploadZone.addEventListener(ev, function(e){
            e.preventDefault(); e.stopPropagation();
            els.uploadZone.classList.remove("is-dragover");
        });
    });
    els.uploadZone.addEventListener("drop", function(e){
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) setFile(f);
    });
    els.removeBtn.addEventListener("click", resetAll);

    // === ANALYSIS SIMULATION ===
    function generateEvents() {
        // Deterministic-ish pseudo-random based on file size so re-running same file feels stable
        var seed = (state.file ? state.file.size : Date.now()) % 1000000;
        function rng() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }

        var dur = Math.max(20, state.videoDurationSec || 60);
        var count = 5 + Math.floor(rng() * 6); // 5-10 events
        var events = [];
        for (var i = 0; i < count; i++) {
            var type = EVENT_TYPES[Math.floor(rng() * EVENT_TYPES.length)];
            var confidence = 70 + Math.floor(rng() * 28); // 70-97
            var ts = Math.floor(rng() * Math.max(1, dur - 3));
            // Override risk for variety: high-confidence + critical PPE => Yüksek, mid => Orta, low conf => Düşük
            var risk = type.risk;
            if (confidence < 78 && risk === "Yüksek") risk = "Orta";
            if (confidence >= 90 && risk === "Düşük") risk = "Orta";
            // Normalized bounding box (0..1 of video frame). Width ~ person-shape.
            var bw = 0.10 + rng() * 0.12;     // 10-22% width
            var bh = 0.22 + rng() * 0.20;     // 22-42% height
            var bx = 0.05 + rng() * (0.95 - bw - 0.05);
            var by = 0.10 + rng() * (0.90 - bh - 0.10);
            var dwell = 1.2 + rng() * 1.8;    // 1.2-3.0s on screen
            events.push({
                id: "EVT-" + (1000 + i),
                type: type.key,
                ppe: type.ppe,
                title_tr: type.tr.title,
                title_en: type.en.title,
                desc_tr: type.tr.desc,
                desc_en: type.en.desc,
                timestamp_sec: ts,
                timestamp: fmtTime(ts),
                duration_sec: +dwell.toFixed(2),
                bbox: { x: +bx.toFixed(3), y: +by.toFixed(3), w: +bw.toFixed(3), h: +bh.toFixed(3) },
                risk_level: risk,
                confidence: confidence,
                status: confidence >= 85 ? "Onaylandı" : (confidence >= 75 ? "İnceleme" : "Belirsiz")
            });
        }
        events.sort(function(a, b) { return a.timestamp_sec - b.timestamp_sec; });
        return events;
    }

    // === ROBOFLOW LIVE INFERENCE ===
    // Mod state: "demo" (default) | "live"
    var inferenceMode = "demo";
    try {
        var saved = localStorage.getItem("mia_det_mode");
        if (saved === "live" || saved === "demo") inferenceMode = saved;
    } catch (e) {}

    function setInferenceMode(mode) {
        inferenceMode = mode;
        try { localStorage.setItem("mia_det_mode", mode); } catch (e) {}
        var modeLabel = document.getElementById("detModeLabel");
        if (modeLabel) modeLabel.textContent = mode === "live" ? "Canlı AI" : "Demo";
    }

    // Capture a frame from the video at given timestamp → JPEG base64
    function captureFrame(timestampSec) {
        return new Promise(function(resolve, reject) {
            var video = els.videoPreview;
            if (!video) return reject(new Error("no video"));
            var seekHandler = function() {
                video.removeEventListener("seeked", seekHandler);
                try {
                    var canvas = document.createElement("canvas");
                    var w = video.videoWidth || 1280;
                    var h = video.videoHeight || 720;
                    // Downscale if huge — Roboflow accepts up to ~1920px, but smaller = faster
                    var maxDim = 800;
                    var scale = Math.min(1, maxDim / Math.max(w, h));
                    canvas.width = Math.floor(w * scale);
                    canvas.height = Math.floor(h * scale);
                    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
                    // dataURL (base64 JPEG) — strip prefix for Roboflow
                    var dataUrl = canvas.toDataURL("image/jpeg", 0.85);
                    var base64 = dataUrl.split(",")[1];
                    resolve({ base64: base64, w: canvas.width, h: canvas.height, t: timestampSec });
                } catch (e) { reject(e); }
            };
            video.addEventListener("seeked", seekHandler);
            video.currentTime = Math.min(timestampSec, video.duration || timestampSec);
        });
    }

    // POST a frame to Roboflow Hosted API → predictions[]
    function callRoboflow(frame) {
        var url = ROBOFLOW.endpoint + "/" + ROBOFLOW.model +
                  "?api_key=" + ROBOFLOW.apiKey +
                  "&confidence=" + ROBOFLOW.confidence +
                  "&overlap=" + ROBOFLOW.overlap;
        console.log("[MIA] Roboflow POST →", url.replace(ROBOFLOW.apiKey, "***"), "frame size:", frame.base64.length, "bytes");
        return fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: frame.base64
        }).then(function(r) {
            if (!r.ok) {
                return r.text().then(function(txt) {
                    throw new Error("Roboflow HTTP " + r.status + ": " + txt.slice(0, 200));
                });
            }
            return r.json();
        }).then(function(json) {
            console.log("[MIA] Roboflow response @ t=" + frame.t.toFixed(1) + "s:", json.predictions ? json.predictions.length + " detections" : json);
            // Convert Roboflow predictions → MIA event format
            var preds = json.predictions || [];
            // Normalize bboxes to 0..1 of source frame, then events
            return preds.map(function(p, i) {
                var map = ROBOFLOW_CLASS_MAP[p.class] || { event: p.class, risk: "Orta", ppe: p.class, tr: { title: p.class, desc: "" }, en: { title: p.class, desc: "" } };
                var conf = Math.round((p.confidence || 0) * 100);
                // Roboflow returns x,y as center; w,h
                var W = frame.w, H = frame.h;
                var bx = (p.x - p.width / 2) / W;
                var by = (p.y - p.height / 2) / H;
                var bw = p.width / W;
                var bh = p.height / H;
                return {
                    id: "RF-" + Math.floor(frame.t) + "-" + i,
                    type: map.event,
                    ppe: map.ppe,
                    title_tr: map.tr.title,
                    title_en: map.en.title,
                    desc_tr: map.tr.desc,
                    desc_en: map.en.desc,
                    timestamp_sec: Math.floor(frame.t),
                    timestamp: fmtTime(frame.t),
                    duration_sec: 1.8,
                    bbox: { x: +bx.toFixed(3), y: +by.toFixed(3), w: +bw.toFixed(3), h: +bh.toFixed(3) },
                    risk_level: map.risk,
                    confidence: conf,
                    status: conf >= 85 ? "Onaylandı" : (conf >= 70 ? "İnceleme" : "Belirsiz"),
                    _source: "roboflow",
                    _class: p.class
                };
            });
        });
    }

    // Run live inference across the video — returns event[] (deduplicated)
    function runLiveAnalysis() {
        var dur = state.videoDurationSec || 0;
        if (!dur) return Promise.reject(new Error("video duration unknown"));
        var stride = ROBOFLOW.frameStrideSec;
        var sampleCount = Math.min(ROBOFLOW.maxFrames, Math.max(3, Math.floor(dur / stride)));
        var times = [];
        for (var i = 0; i < sampleCount; i++) {
            times.push((i + 0.5) * (dur / sampleCount));
        }
        var allEvents = [];
        var done = 0;
        // Sequential to respect rate limits + simpler progress
        function next() {
            if (done >= times.length) return Promise.resolve(allEvents);
            var t = times[done++];
            var lang = getLang();
            els.progressStep.textContent = (lang === "tr" ? "Frame " : "Frame ") + done + "/" + times.length + " — Roboflow AI";
            var pct = 30 + Math.floor((done / times.length) * 65);
            els.progressPct.textContent = pct + "%";
            els.progressFill.style.width = pct + "%";
            return captureFrame(t)
                .then(callRoboflow)
                .then(function(events) { allEvents = allEvents.concat(events); })
                .catch(function(e) { console.warn("Frame " + done + " inference failed:", e); })
                .then(next);
        }
        return next();
    }

    // === OVERLAY (canvas bounding boxes) ===
    var rafId = null;
    function riskColor(risk) {
        if (risk === "Yüksek") return { stroke: "#ef4444", fill: "rgba(239,68,68,0.12)" };
        if (risk === "Orta")   return { stroke: "#f59e0b", fill: "rgba(245,158,11,0.12)" };
        return { stroke: "#22c55e", fill: "rgba(34,197,94,0.12)" };
    }

    function resizeCanvas() {
        if (!els.overlay || !els.videoPreview) return;
        var w = els.videoPreview.clientWidth;
        var h = els.videoPreview.clientHeight;
        if (!w || !h) return;
        var dpr = window.devicePixelRatio || 1;
        els.overlay.width = Math.floor(w * dpr);
        els.overlay.height = Math.floor(h * dpr);
        els.overlay.style.width = w + "px";
        els.overlay.style.height = h + "px";
        var ctx = els.overlay.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawOverlay() {
        if (!els.overlay) return;
        var ctx = els.overlay.getContext("2d");
        var W = els.videoPreview.clientWidth;
        var H = els.videoPreview.clientHeight;
        ctx.clearRect(0, 0, W, H);
        if (!state.events || !state.events.length) return;
        var t = els.videoPreview.currentTime || 0;
        var lang = getLang();
        var active = state.events.filter(function(e) {
            return t >= e.timestamp_sec && t < e.timestamp_sec + (e.duration_sec || 2);
        });
        active.forEach(function(e) {
            var c = riskColor(e.risk_level);
            var x = e.bbox.x * W, y = e.bbox.y * H, w = e.bbox.w * W, h = e.bbox.h * H;
            // Box
            ctx.fillStyle = c.fill;
            ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = c.stroke;
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, w, h);
            // Corner ticks
            var t1 = Math.min(14, w * 0.25);
            ctx.beginPath();
            ctx.moveTo(x, y + t1); ctx.lineTo(x, y); ctx.lineTo(x + t1, y);
            ctx.moveTo(x + w - t1, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + t1);
            ctx.moveTo(x + w, y + h - t1); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - t1, y + h);
            ctx.moveTo(x + t1, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - t1);
            ctx.lineWidth = 3;
            ctx.strokeStyle = c.stroke;
            ctx.stroke();
            // Label
            var label = (lang === "tr" ? e.title_tr : e.title_en) + "  " + e.confidence + "%";
            ctx.font = "600 12px Inter, -apple-system, sans-serif";
            var pad = 6;
            var metrics = ctx.measureText(label);
            var lw = metrics.width + pad * 2;
            var lh = 22;
            var lx = x;
            var ly = Math.max(0, y - lh - 4);
            ctx.fillStyle = c.stroke;
            ctx.fillRect(lx, ly, lw, lh);
            ctx.fillStyle = "#fff";
            ctx.textBaseline = "middle";
            ctx.fillText(label, lx + pad, ly + lh / 2);
        });
    }

    function tickOverlay() {
        drawOverlay();
        updateTimelineCursor();
        rafId = requestAnimationFrame(tickOverlay);
    }
    function startOverlayLoop() { if (rafId == null) tickOverlay(); }
    function stopOverlayLoop() { if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; } }

    // === TIMELINE ===
    function renderTimelineMarkers() {
        if (!els.tlMarkers) return;
        els.tlMarkers.innerHTML = "";
        var dur = state.videoDurationSec || 1;
        var lang = getLang();
        state.events.forEach(function(e) {
            var pct = (e.timestamp_sec / dur) * 100;
            var m = document.createElement("div");
            m.className = "det-timeline-marker " + (e.risk_level === "Yüksek" ? "high" : e.risk_level === "Orta" ? "med" : "low");
            m.style.left = pct + "%";
            m.title = e.timestamp + " • " + (lang === "tr" ? e.title_tr : e.title_en);
            m.addEventListener("click", function(ev) {
                ev.stopPropagation();
                seekTo(e.timestamp_sec);
                highlightCard(e.id);
            });
            els.tlMarkers.appendChild(m);
        });
    }

    function updateTimelineCursor() {
        if (!els.tlCursor || !state.events.length) return;
        var dur = state.videoDurationSec || 1;
        var pct = ((els.videoPreview.currentTime || 0) / dur) * 100;
        els.tlCursor.style.left = pct + "%";
        if (els.tlProgress) els.tlProgress.style.width = pct + "%";
    }

    function seekTo(sec) {
        if (!els.videoPreview) return;
        els.videoPreview.currentTime = Math.max(0, sec);
        try { els.videoPreview.play(); } catch (e) {}
    }

    function highlightCard(id) {
        var cards = els.eventsGrid.querySelectorAll(".det-card");
        Array.prototype.forEach.call(cards, function(c) {
            c.classList.toggle("is-active", c.getAttribute("data-event-id") === id);
        });
        var active = els.eventsGrid.querySelector('.det-card.is-active');
        if (active) active.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function setStatus(text) {
        var span = els.controlStatus.querySelector("span");
        if (span) span.textContent = text;
    }

    function runAnalysis() {
        if (!state.file) return;
        state.startedAt = Date.now();
        els.startBtn.disabled = true;
        els.startBtn.classList.add("is-loading");
        els.progressBar.style.display = "block";
        els.controlStatus.classList.add("is-running");
        var lang = getLang();
        setStatus(lang === "tr" ? "Analiz çalışıyor..." : "Analysis running...");

        // === LIVE MODE: gerçek Roboflow inference ===
        if (inferenceMode === "live") {
            els.progressStep.textContent = lang === "tr" ? "Video hazırlanıyor..." : "Preparing video...";
            els.progressPct.textContent = "10%";
            els.progressFill.style.width = "10%";
            els.progressEta.textContent = lang === "tr" ? "~" + (ROBOFLOW.maxFrames * 2) + " sn" : "~" + (ROBOFLOW.maxFrames * 2) + "s";

            // Pause video for stable frame capture
            try { els.videoPreview.pause(); } catch (e) {}

            runLiveAnalysis()
                .then(function(events) {
                    console.log("[MIA] Live analysis complete — total events:", events.length);
                    state.events = events;
                    // 0 detection — kullaniciya net mesaj, fallback yok
                    if (!events.length) {
                        els.progressStep.textContent = lang === "tr"
                            ? "0 tespit — videoda PPE/işçi/ekipman görünmüyor"
                            : "0 detections — no PPE/worker/equipment visible in video";
                        els.progressStep.style.color = "#f59e0b";
                    } else {
                        els.progressStep.textContent = lang === "tr" ? "Analiz tamamlandı" : "Analysis complete";
                        els.progressStep.style.color = "";
                    }
                    els.progressPct.textContent = "100%";
                    els.progressFill.style.width = "100%";
                    finishAnalysis();
                })
                .catch(function(err) {
                    console.error("[MIA] Live analysis failed:", err);
                    // Inline error in progress bar (not just alert)
                    els.progressStep.textContent = (lang === "tr" ? "❌ Canlı AI hatası: " : "❌ Live AI error: ") + (err.message || err);
                    els.progressStep.style.color = "#ef4444";
                    els.progressFill.style.background = "#ef4444";
                    setTimeout(function() {
                        if (confirm(lang === "tr"
                            ? "Canlı AI başarısız oldu:\n\n" + (err.message || err) + "\n\nDemo moduna geçip simüle edelim mi?"
                            : "Live AI failed:\n\n" + (err.message || err) + "\n\nFall back to demo mode?")) {
                            els.progressStep.style.color = "";
                            els.progressFill.style.background = "";
                            setInferenceMode("demo");
                            runDemoAnalysis();
                        } else {
                            // Reset UI so user can retry
                            els.startBtn.disabled = false;
                            els.startBtn.classList.remove("is-loading");
                            els.controlStatus.classList.remove("is-running");
                            els.progressBar.style.display = "none";
                            els.progressStep.style.color = "";
                            els.progressFill.style.background = "";
                        }
                    }, 300);
                });
            return;
        }

        // === DEMO MODE: sentetik ===
        runDemoAnalysis();
    }

    function runDemoAnalysis() {
        var lang = getLang();
        var idx = 0;
        var totalDuration = 4500 + Math.floor((state.file.size / (1024*1024)) * 80);
        var stepGap = Math.max(350, Math.floor(totalDuration / ANALYSIS_STEPS.length));

        function tick() {
            if (idx >= ANALYSIS_STEPS.length) {
                state.events = generateEvents();
                finishAnalysis();
                return;
            }
            var s = ANALYSIS_STEPS[idx];
            els.progressStep.textContent = lang === "tr" ? s.tr : s.en;
            els.progressPct.textContent = s.pct + "%";
            els.progressFill.style.width = s.pct + "%";
            var remaining = (ANALYSIS_STEPS.length - idx - 1) * (stepGap / 1000);
            els.progressEta.textContent = remaining > 0 ? (lang === "tr" ? "≈ " + Math.ceil(remaining) + " sn" : "≈ " + Math.ceil(remaining) + "s") : (lang === "tr" ? "Bitti" : "Done");
            idx++;
            setTimeout(tick, stepGap);
        }
        tick();
    }

    function finishAnalysis() {
        state.finishedAt = Date.now();
        // state.events already populated — live: Roboflow results, demo: generateEvents().
        // Do NOT regenerate here or real detections get overwritten.
        renderResults();
        els.previewPanel.style.display = "block";
        els.resultsPanel.style.display = "block";
        els.startBtn.disabled = false;
        els.startBtn.classList.remove("is-loading");
        els.controlStatus.classList.remove("is-running");
        els.controlStatus.classList.add("is-done");
        setStatus(getLang() === "tr" ? "Analiz tamamlandı" : "Analysis complete");
        // Timeline & overlay
        if (els.timeline) els.timeline.style.display = "block";
        resizeCanvas();
        renderTimelineMarkers();
        startOverlayLoop();
        setTimeout(function(){
            els.resultsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 200);
    }

    els.startBtn.addEventListener("click", runAnalysis);

    // === RESULTS RENDER ===
    function riskClass(risk) {
        if (risk === "Yüksek") return "det-card-high";
        if (risk === "Orta") return "det-card-med";
        return "det-card-low";
    }
    function riskBadge(risk) {
        if (risk === "Yüksek") return '<span class="det-badge det-badge-high">Yüksek</span>';
        if (risk === "Orta") return '<span class="det-badge det-badge-med">Orta</span>';
        return '<span class="det-badge det-badge-low">Düşük</span>';
    }
    function statusBadge(status) {
        if (status === "Onaylandı") return '<span class="det-status det-status-ok">' + status + '</span>';
        if (status === "İnceleme") return '<span class="det-status det-status-warn">' + status + '</span>';
        return '<span class="det-status det-status-info">' + status + '</span>';
    }
    function eventIcon(key) {
        var icons = {
            no_helmet:       '<path d="M3 18v-3a9 9 0 0 1 18 0v3"/><rect x="2" y="18" width="20" height="3" rx="1"/>',
            no_vest:         '<path d="M16 3l-4 3-4-3-5 2v6l3 1v8h12v-8l3-1V5l-5-2z"/><line x1="12" y1="6" x2="12" y2="20"/>',
            restricted_zone: '<polygon points="12 2 22 22 2 22 12 2"/><line x1="12" y1="10" x2="12" y2="15"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
            fall_risk:       '<polyline points="3 21 12 12 21 21"/><polyline points="3 14 12 5 21 14"/>',
            no_gloves:       '<path d="M7 11V5a2 2 0 0 1 4 0v6"/><path d="M11 11V4a2 2 0 0 1 4 0v7"/><path d="M15 11V6a2 2 0 0 1 4 0v8c0 4.4-3.6 8-8 8-3 0-6-1.5-7-4l-3-6c-.5-1 0-2 1-2.5 1-.5 2 0 2.5 1l1.5 3"/>'
        };
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' + (icons[key] || '<circle cx="12" cy="12" r="10"/>') + '</svg>';
    }

    function renderResults() {
        var evts = state.events;
        var lang = getLang();
        // Summary
        els.totalHazards.textContent = evts.length;
        var highCount = evts.filter(function(e){ return e.risk_level === "Yüksek"; }).length;
        els.highRisk.textContent = highCount;
        var avg = evts.length ? Math.round(evts.reduce(function(s,e){ return s + e.confidence; }, 0) / evts.length) : 0;
        els.avgConfidence.textContent = avg + "%";
        var processed = state.finishedAt && state.startedAt ? Math.floor((state.finishedAt - state.startedAt)/1000) : 0;
        // Display the analyzed video duration instead of wall-clock processing time
        var videoDur = Math.floor(state.videoDurationSec || 0);
        els.processedTime.textContent = fmtTime(videoDur);

        // Cards
        var filter = state.currentFilter;
        var html = "";
        var shown = evts.filter(function(e){ return filter === "all" || e.risk_level === filter; });
        if (!shown.length) {
            html = '<div class="det-empty">' + (lang === "tr" ? "Bu filtrede tespit yok." : "No detections for this filter.") + '</div>';
        } else {
            shown.forEach(function(e){
                var title = lang === "tr" ? e.title_tr : e.title_en;
                var desc  = lang === "tr" ? e.desc_tr  : e.desc_en;
                html += [
                    '<div class="det-card ' + riskClass(e.risk_level) + '" data-event-id="' + e.id + '" data-ts="' + e.timestamp_sec + '">',
                        '<div class="det-card-top">',
                            '<div class="det-card-icon">', eventIcon(e.type), '</div>',
                            '<div class="det-card-meta">',
                                '<div class="det-card-id">', e.id, ' · ', e.timestamp, '</div>',
                                '<div class="det-card-title">', title, '</div>',
                            '</div>',
                            riskBadge(e.risk_level),
                        '</div>',
                        '<p class="det-card-desc">', desc, '</p>',
                        '<div class="det-card-foot">',
                            '<div class="det-confidence">',
                                '<div class="det-conf-track"><div class="det-conf-fill" style="width:', e.confidence, '%"></div></div>',
                                '<span class="det-conf-val">%', e.confidence, '</span>',
                            '</div>',
                            statusBadge(e.status),
                        '</div>',
                    '</div>'
                ].join("");
            });
        }
        els.eventsGrid.innerHTML = html;
        // Bind click → seek video + scroll
        var cards = els.eventsGrid.querySelectorAll(".det-card");
        Array.prototype.forEach.call(cards, function(c) {
            c.addEventListener("click", function() {
                var ts = parseFloat(c.getAttribute("data-ts")) || 0;
                seekTo(ts);
                highlightCard(c.getAttribute("data-event-id"));
                if (els.videoPreview) els.videoPreview.scrollIntoView({ behavior: "smooth", block: "center" });
            });
        });
    }

    // Filter pills
    Array.prototype.forEach.call(els.filterPills, function(btn){
        btn.addEventListener("click", function(){
            Array.prototype.forEach.call(els.filterPills, function(b){ b.classList.remove("active"); });
            btn.classList.add("active");
            state.currentFilter = btn.getAttribute("data-filter") || "all";
            renderResults();
        });
    });

    // JSON Download
    els.downloadJson.addEventListener("click", function(){
        var report = {
            generated_at: new Date().toISOString(),
            tool: "MIA Video Safety Hazard Detector",
            version: "1.0-demo",
            file: state.file ? { name: state.file.name, size_bytes: state.file.size, duration_sec: state.videoDurationSec } : null,
            summary: {
                total_hazards: state.events.length,
                high_risk_count: state.events.filter(function(e){ return e.risk_level === "Yüksek"; }).length,
                medium_risk_count: state.events.filter(function(e){ return e.risk_level === "Orta"; }).length,
                low_risk_count: state.events.filter(function(e){ return e.risk_level === "Düşük"; }).length,
                average_confidence: state.events.length ? Math.round(state.events.reduce(function(s,e){ return s + e.confidence; }, 0) / state.events.length) : 0
            },
            detections: state.events.map(function(e){
                return {
                    id: e.id,
                    type: e.type,
                    ppe: e.ppe,
                    timestamp_sec: e.timestamp_sec,
                    timestamp: e.timestamp,
                    duration_sec: e.duration_sec,
                    bbox_normalized: e.bbox,
                    risk_level: e.risk_level,
                    confidence: e.confidence,
                    status: e.status,
                    title: { tr: e.title_tr, en: e.title_en },
                    description: { tr: e.desc_tr, en: e.desc_en }
                };
            })
        };
        var blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "mia-hazard-report-" + Date.now() + ".json";
        document.body.appendChild(a);
        a.click();
        setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 200);
    });

    els.resetBtn.addEventListener("click", resetAll);

    // Re-render on language change (the existing setLanguage updates data-i18n nodes; detector cards use innerHTML so we hook into it)
    var prevLang = getLang();
    setInterval(function(){
        var cur = getLang();
        if (cur !== prevLang) { prevLang = cur; if (state.events.length) renderResults(); }
    }, 600);

    // === Mode toggle init ===
    function initModeToggle() {
        var pills = document.querySelectorAll(".det-mode-pill");
        if (!pills.length) return;
        // Set initial active
        Array.prototype.forEach.call(pills, function(p) {
            p.classList.toggle("active", p.getAttribute("data-mode") === inferenceMode);
        });
        var label = document.getElementById("detModeLabel");
        if (label) label.textContent = inferenceMode === "live" ? "Canlı AI" : "Demo";
        Array.prototype.forEach.call(pills, function(p) {
            p.addEventListener("click", function() {
                var mode = p.getAttribute("data-mode");
                Array.prototype.forEach.call(pills, function(x) { x.classList.remove("active"); });
                p.classList.add("active");
                setInferenceMode(mode);
            });
        });
    }
    initModeToggle();
})();
