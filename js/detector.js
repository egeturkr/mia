// === MIA Video Safety Hazard Detector ===
// Client-side demo. Simulates AI inference and produces synthetic detection events.
// This page is intentionally self-contained and does not call any backend.

(function() {
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
    }

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
            var ts = Math.floor(rng() * dur);
            // Override risk for variety: high-confidence + critical PPE => Yüksek, mid => Orta, low conf => Düşük
            var risk = type.risk;
            if (confidence < 78 && risk === "Yüksek") risk = "Orta";
            if (confidence >= 90 && risk === "Düşük") risk = "Orta";
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
                risk_level: risk,
                confidence: confidence,
                status: confidence >= 85 ? "Onaylandı" : (confidence >= 75 ? "İnceleme" : "Belirsiz")
            });
        }
        events.sort(function(a, b) { return a.timestamp_sec - b.timestamp_sec; });
        return events;
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

        var idx = 0;
        var totalDuration = 4500 + Math.floor((state.file.size / (1024*1024)) * 80); // scale with size
        var stepGap = Math.max(350, Math.floor(totalDuration / ANALYSIS_STEPS.length));

        function tick() {
            if (idx >= ANALYSIS_STEPS.length) {
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
        state.events = generateEvents();
        renderResults();
        els.previewPanel.style.display = "block";
        els.resultsPanel.style.display = "block";
        els.startBtn.disabled = false;
        els.startBtn.classList.remove("is-loading");
        els.controlStatus.classList.remove("is-running");
        els.controlStatus.classList.add("is-done");
        setStatus(getLang() === "tr" ? "Analiz tamamlandı" : "Analysis complete");
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
                    '<div class="det-card ' + riskClass(e.risk_level) + '">',
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
})();
