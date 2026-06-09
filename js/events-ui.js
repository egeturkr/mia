// === MIA — İhlal Raporu görsel katmanı (UI add-on) ===
// js/events.js'e DOKUNMAZ. Onun yüklediği window._evRaw verisini okur ve
// salt görsel ekler: Orta/Düşük kartları, 3 analitik grafik, risk sekmeleri,
// tablo araması. Sekmeler mevcut #fRisk select'ini tetikler (mevcut filtre
// mantığı aynen kullanılır); arama yalnızca görünür satırları gizler/gösterir.
(function () {
    if (!document.getElementById("evBody") || !document.getElementById("evTabs")) return;

    function tr() { return (typeof currentLang === "undefined" ? "tr" : currentLang) === "tr"; }
    var VIOLATION = { no_hardhat: "Baret", no_helmet: "Baret", no_vest: "Yelek", no_mask: "Maske" };
    var I18N = {
        tr: { med: "Orta Riskli", low: "Düşük Riskli",
              timeT: "İhlallerin Zaman İçindeki Dağılımı", riskT: "Risk Seviyesine Göre Dağılım", catT: "İhlal Kategorileri",
              tabs: ["Tüm İhlaller", "Yüksek Risk", "Orta Risk", "Düşük Risk"],
              search: "İhlal ara...", high: "Yüksek Risk", mid: "Orta Risk", lowR: "Düşük Risk", total: "Toplam",
              other: "Özet Kayıt" },
        en: { med: "Medium Risk", low: "Low Risk",
              timeT: "Violations Over Time", riskT: "Distribution by Risk Level", catT: "Violation Categories",
              tabs: ["All Violations", "High Risk", "Medium Risk", "Low Risk"],
              search: "Search violations...", high: "High Risk", mid: "Medium Risk", lowR: "Low Risk", total: "Total",
              other: "Summary Entry" }
    };
    function L() { return I18N[tr() ? "tr" : "en"]; }
    function setText(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
    var charts = { time: null, risk: null };

    // --- events.js ile birebir aynı veri açma/filtre semantiği (salt okuma) ---
    function flattenLite(analyses) {
        var rows = [];
        (analyses || []).forEach(function (a) {
            var evts = null;
            if (a.detections_json) { try { evts = JSON.parse(a.detections_json); } catch (e) { evts = null; } }
            if (evts && evts.length) {
                evts.forEach(function (e) {
                    if (!VIOLATION[e.type]) return;
                    rows.push({ created_at: a.created_at, ppe: VIOLATION[e.type], risk: e.risk_level || "Orta" });
                });
            } else if ((a.violations_count || 0) > 0) {
                rows.push({ created_at: a.created_at, ppe: "-", risk: (a.safety_score || 100) < 60 ? "Yüksek" : "Orta" });
            }
        });
        return rows;
    }
    function periodCutoff(period) {
        if (period === "all") return 0;
        var d = new Date();
        if (period === "week") d.setDate(d.getDate() - 7); else d.setMonth(d.getMonth() - 1);
        return d.getTime();
    }
    function val(id) { var el = document.getElementById(id); return el ? el.value : "all"; }
    function filtered(rows) {
        var cut = periodCutoff(val("fPeriod")), risk = val("fRisk"), ppe = val("fPpe");
        return rows.filter(function (r) {
            if (cut && new Date(r.created_at).getTime() < cut) return false;
            if (risk !== "all" && r.risk !== risk) return false;
            if (ppe !== "all" && r.ppe !== ppe) return false;
            return true;
        });
    }

    // --- Grafikler ---
    function drawCharts(rows) {
        var grid = document.getElementById("evAnalytics");
        if (!grid) return;
        if (typeof Chart === "undefined" || !(window._evRaw || []).length) { grid.style.display = "none"; return; }
        grid.style.display = "grid";

        var isLight = document.documentElement.getAttribute("data-theme") === "light";
        var textColor = isLight ? "#475569" : "#a1a1aa";
        var gridColor = isLight ? "#e2e8f0" : "#27272a";
        var l = L();
        Object.keys(charts).forEach(function (k) { if (charts[k]) { charts[k].destroy(); charts[k] = null; } });

        // 1. Zaman dağılımı — son 30 gün
        var byDay = {};
        rows.forEach(function (r) { var k = new Date(r.created_at).toISOString().slice(0, 10); byDay[k] = (byDay[k] || 0) + 1; });
        var labels = [], values = [];
        for (var i = 29; i >= 0; i--) {
            var d = new Date(); d.setDate(d.getDate() - i);
            var k2 = d.toISOString().slice(0, 10);
            labels.push(d.toLocaleDateString(tr() ? "tr-TR" : "en-US", { day: "numeric", month: "short" }));
            values.push(byDay[k2] || 0);
        }
        var timeCtx = document.getElementById("evChartTime");
        if (timeCtx) {
            charts.time = new Chart(timeCtx, {
                type: "line",
                data: { labels: labels, datasets: [{ data: values, borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 2, fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: "#ef4444" }] },
                options: {
                    responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: textColor, maxTicksLimit: 8, font: { size: 11 } } },
                        y: { grid: { color: gridColor }, ticks: { color: textColor, precision: 0, font: { size: 11 } }, beginAtZero: true }
                    },
                    plugins: { legend: { display: false }, tooltip: { backgroundColor: isLight ? "#fff" : "#1a1a1a", titleColor: isLight ? "#0f172a" : "#fff", bodyColor: textColor, borderColor: gridColor, borderWidth: 1 } }
                }
            });
        }

        // 2. Risk dağılımı — donut
        var high = 0, med = 0, low = 0;
        rows.forEach(function (r) { if (r.risk === "Yüksek") high++; else if (r.risk === "Düşük") low++; else med++; });
        var riskCtx = document.getElementById("evChartRisk");
        if (riskCtx) {
            charts.risk = new Chart(riskCtx, {
                type: "doughnut",
                data: {
                    labels: [l.high + " (" + high + ")", l.mid + " (" + med + ")", l.lowR + " (" + low + ")"],
                    datasets: [{ data: [high, med, low], backgroundColor: ["#ef4444", "#D4AF37", "#22c55e"], borderColor: isLight ? "#fff" : "#0a0a0a", borderWidth: 2 }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, cutout: "68%",
                    plugins: { legend: { position: "bottom", labels: { color: textColor, padding: 12, usePointStyle: true, pointStyle: "circle", boxWidth: 8, font: { size: 12 } } } }
                }
            });
        }

        // 3. Kategoriler — progress listesi
        var catEl = document.getElementById("evCatList");
        if (catEl) {
            var cats = {};
            rows.forEach(function (r) { var key = r.ppe === "-" ? l.other : r.ppe; cats[key] = (cats[key] || 0) + 1; });
            var entries = Object.keys(cats).map(function (k) { return [k, cats[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
            var total = rows.length || 1;
            var colors = ["#ef4444", "#D4AF37", "#60a5fa", "#22c55e", "#a78bfa"];
            var html = "";
            entries.forEach(function (e, idx) {
                var pct = Math.round(e[1] / total * 100);
                html += '<div class="ev-cat-row"><span class="ev-cat-name">' + e[0] + '</span>' +
                    '<span class="ev-cat-bar"><span class="ev-cat-fill" style="width:' + pct + '%;background:' + colors[idx % colors.length] + ';"></span></span>' +
                    '<span class="ev-cat-val">' + e[1] + ' (%' + pct + ')</span></div>';
            });
            catEl.innerHTML = html || '<div style="color:var(--text-muted);font-size:0.85rem;text-align:center;">—</div>';
        }
    }

    function refresh() {
        var rows = filtered(flattenLite(window._evRaw || []));
        setText("evMed", rows.filter(function (r) { return r.risk === "Orta"; }).length);
        setText("evLow", rows.filter(function (r) { return r.risk === "Düşük"; }).length);
        drawCharts(rows);
        applySearch();
    }

    function applyLabels() {
        var l = L();
        setText("lblMed", l.med); setText("lblLow", l.low);
        setText("evAnTimeTitle", l.timeT); setText("evAnRiskTitle", l.riskT); setText("evAnCatTitle", l.catT);
        var tabs = document.querySelectorAll("#evTabs .ev-tab");
        for (var i = 0; i < tabs.length; i++) tabs[i].textContent = l.tabs[i] || tabs[i].textContent;
        var s = document.getElementById("evSearch");
        if (s) s.placeholder = l.search;
    }

    // --- Risk sekmeleri: mevcut #fRisk select'ini tetikler ---
    function syncTabs() {
        var cur = val("fRisk");
        var tabs = document.querySelectorAll("#evTabs .ev-tab");
        Array.prototype.forEach.call(tabs, function (t) {
            t.classList.toggle("active", t.getAttribute("data-risk") === cur);
        });
    }
    Array.prototype.forEach.call(document.querySelectorAll("#evTabs .ev-tab"), function (t) {
        t.addEventListener("click", function () {
            var sel = document.getElementById("fRisk");
            if (!sel) return;
            sel.value = t.getAttribute("data-risk");
            sel.dispatchEvent(new Event("change")); // events.js render()'ı çalıştırır
            syncTabs();
        });
    });

    // --- Arama: salt görsel satır gizleme (export/filtre mantığına dokunmaz) ---
    function applySearch() {
        var s = document.getElementById("evSearch");
        var q = s ? s.value.trim().toLowerCase() : "";
        var rows = document.querySelectorAll("#evBody tr");
        Array.prototype.forEach.call(rows, function (r) {
            if (r.querySelector("td[colspan]")) { r.style.display = ""; return; }
            r.style.display = (!q || r.textContent.toLowerCase().indexOf(q) !== -1) ? "" : "none";
        });
    }
    var searchEl = document.getElementById("evSearch");
    if (searchEl) searchEl.addEventListener("input", applySearch);
    var bodyEl = document.getElementById("evBody");
    if (window.MutationObserver && bodyEl) new MutationObserver(applySearch).observe(bodyEl, { childList: true });

    // --- Tetikleyiciler ---
    ["fPeriod", "fRisk", "fPpe"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener("change", function () { syncTabs(); setTimeout(refresh, 0); });
    });
    // Tema değişince grafik renklerini tazele
    if (window.MutationObserver) {
        new MutationObserver(function () { refresh(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    }
    // Dil değişimini events.js ile aynı yöntemle izle
    var prevLang = tr();
    setInterval(function () { if (tr() !== prevLang) { prevLang = tr(); applyLabels(); refresh(); } }, 600);
    // Veri yüklenene kadar bekle (events.js window._evRaw'ı doldurur)
    applyLabels();
    var wait = setInterval(function () {
        if (window._evRaw) { clearInterval(wait); refresh(); }
    }, 250);
})();
