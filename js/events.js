// === MIA — İhlal Raporu (Sprint 3) ===
// Tüm analizlerin detections_json'ını olay seviyesine açar, KKD ihlallerini
// (NO-*) filtrelenebilir tek bir tabloda gösterir, CSV/PDF dışa aktarır.
// Global `supabase`, `currentLang`, `t` js/app.js'ten gelir.

(function () {
    if (!document.getElementById("evBody")) return;

    var TR = { tr: 1 };
    function tr() { return (typeof currentLang === "undefined" ? "tr" : currentLang) === "tr"; }

    var VIOLATION = { no_hardhat: "Baret", no_helmet: "Baret", no_vest: "Yelek", no_mask: "Maske" };
    var I18N = {
        tr: { title: "İhlal Raporu", sub: "Tüm analizlerdeki KKD ihlalleri — olay bazında",
              total: "Toplam İhlal", high: "Yüksek Risk", hardhat: "Baret İhlali", vest: "Yelek İhlali",
              date: "Tarih", video: "Analiz", time: "Zaman", type: "İhlal", ppe: "KKD", risk: "Risk", conf: "Güven",
              empty: "Bu filtrede ihlal yok.", loading: "Yükleniyor…",
              note: "Olay detayları henüz kaydedilmemiş. Olay bazlı rapor için Supabase'de analyses tablosuna detections_json (jsonb) kolonu eklenmeli — o zamana kadar analiz başına ihlal sayıları gösteriliyor." },
        en: { title: "Violation Report", sub: "PPE violations across all analyses — per event",
              total: "Total Violations", high: "High Risk", hardhat: "Hardhat Violations", vest: "Vest Violations",
              date: "Date", video: "Analysis", time: "Time", type: "Violation", ppe: "PPE", risk: "Risk", conf: "Conf.",
              empty: "No violations for this filter.", loading: "Loading…",
              note: "Event details not yet stored. For per-event reporting, add a detections_json (jsonb) column to the analyses table in Supabase — until then, per-analysis violation counts are shown." }
    };
    function L() { return I18N[tr() ? "tr" : "en"]; }

    var allRows = [];     // {date, created_at, video, time, timeSec, typeKey, typeLabel, ppe, risk, conf}
    var degraded = false; // detections_json yoksa özet moduna düş

    function setText(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }

    function applyI18n() {
        var l = L();
        setText("evTitle", l.title); setText("evSub", l.sub);
        setText("lblTotal", l.total); setText("lblHigh", l.high);
        setText("lblHardhat", l.hardhat); setText("lblVest", l.vest);
        setText("thDate", l.date); setText("thVideo", l.video); setText("thTime", l.time);
        setText("thType", l.type); setText("thPpe", l.ppe); setText("thRisk", l.risk); setText("thConf", l.conf);
    }

    function riskBadge(r) {
        var cls = r === "Yüksek" ? "ev-high" : r === "Orta" ? "ev-med" : "ev-low";
        return '<span class="ev-badge ' + cls + '">' + r + "</span>";
    }
    function esc(s) { return String(s == null ? "" : s).replace(/[<>&]/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]; }); }

    function periodCutoff(period) {
        if (period === "all") return 0;
        var d = new Date();
        if (period === "week") d.setDate(d.getDate() - 7);
        else d.setMonth(d.getMonth() - 1);
        return d.getTime();
    }

    function currentFilters() {
        var src = document.getElementById("fSource"); // opsiyonel (yalnız app sayfasında var)
        return {
            period: document.getElementById("fPeriod").value,
            risk: document.getElementById("fRisk").value,
            ppe: document.getElementById("fPpe").value,
            source: src ? src.value : "all"
        };
    }

    function filtered() {
        var f = currentFilters(), cut = periodCutoff(f.period);
        return allRows.filter(function (r) {
            if (cut && new Date(r.created_at).getTime() < cut) return false;
            if (f.risk !== "all" && r.risk !== f.risk) return false;
            if (f.ppe !== "all" && r.ppe !== f.ppe) return false;
            if (f.source === "camera" && r.source !== "camera") return false;
            if (f.source === "video" && r.source === "camera") return false;
            return true;
        });
    }

    function render() {
        var l = L(), rows = filtered();
        setText("evTotal", rows.length);
        setText("evHigh", rows.filter(function (r) { return r.risk === "Yüksek"; }).length);
        setText("evHardhat", rows.filter(function (r) { return r.ppe === "Baret"; }).length);
        setText("evVest", rows.filter(function (r) { return r.ppe === "Yelek"; }).length);

        var note = document.getElementById("evNote");
        if (degraded) { note.style.display = "block"; note.textContent = l.note; }
        else note.style.display = "none";

        var body = document.getElementById("evBody");
        if (!rows.length) { body.innerHTML = '<tr><td colspan="7" class="ev-empty">' + l.empty + "</td></tr>"; return; }
        var html = "";
        rows.forEach(function (r) {
            html += "<tr><td>" + esc(r.date) + "</td><td>" + esc(r.video) + "</td><td>" + esc(r.time) +
                "</td><td>" + esc(r.typeLabel) + "</td><td>" + esc(r.ppe) + "</td><td>" + riskBadge(r.risk) +
                "</td><td>" + (r.conf != null ? "%" + r.conf : "-") + "</td></tr>";
        });
        body.innerHTML = html;
    }

    function flatten(analyses) {
        var rows = [], anyDetections = false;
        analyses.forEach(function (a) {
            var dt = new Date(a.created_at).toLocaleDateString(tr() ? "tr-TR" : "en-US");
            var evts = null;
            if (a.detections_json) { try { evts = JSON.parse(a.detections_json); } catch (e) { evts = null; } }
            if (evts && evts.length) {
                anyDetections = true;
                evts.forEach(function (e) {
                    if (!VIOLATION[e.type]) return;
                    rows.push({
                        date: dt, created_at: a.created_at, video: a.video_name || "Video",
                        time: e.timestamp || (e.timestamp_sec != null ? e.timestamp_sec + "s" : "-"),
                        timeSec: e.timestamp_sec || 0,
                        typeKey: e.type, typeLabel: (tr() ? e.title_tr : e.title_en) || e.type,
                        ppe: VIOLATION[e.type], risk: e.risk_level || "Orta", conf: e.confidence
                    });
                });
            } else if ((a.violations_count || 0) > 0) {
                // detections_json yok → analiz başına özet satır
                rows.push({
                    date: dt, created_at: a.created_at, video: a.video_name || "Video", time: "-",
                    timeSec: 0, typeKey: "summary",
                    typeLabel: (tr() ? "İhlal" : "Violations") + " ×" + a.violations_count,
                    ppe: "-", risk: (a.safety_score || 100) < 60 ? "Yüksek" : "Orta", conf: null
                });
            }
        });
        degraded = !anyDetections && rows.length > 0;
        rows.sort(function (x, y) { return new Date(y.created_at) - new Date(x.created_at) || y.timeSec - x.timeSec; });
        return rows;
    }

    // Faz 13: canlı kamera olayları — kaynak etiketiyle aynı rapora eklenir.
    // Yüklenen-video satırları DEĞİŞMEZ; kamera satırları source:"camera" taşır.
    var CAM_LABEL = { no_helmet: { tr: "Baretsiz çalışan", en: "No helmet" },
                      no_vest: { tr: "Yeleksiz çalışan", en: "No vest" },
                      no_mask: { tr: "Maskesiz çalışan", en: "No mask" } };
    function flattenCams(camEvents) {
        var rows = [];
        (camEvents || []).forEach(function (e) {
            if (!VIOLATION[e.event_type]) return;   // yalnız KKD ihlalleri rapora girer
            if (e.status === "dismissed") return;   // yok sayılanlar rapora girmez
            var d = new Date(e.frame_timestamp || e.created_at);
            var lbl = CAM_LABEL[e.event_type];
            rows.push({
                date: d.toLocaleDateString(tr() ? "tr-TR" : "en-US"),
                created_at: e.created_at,
                video: ((e.cameras && e.cameras.name) || "Kamera") + (tr() ? " · Canlı Kamera" : " · Live Camera"),
                time: d.toLocaleTimeString(tr() ? "tr-TR" : "en-US"), timeSec: 0,
                typeKey: e.event_type,
                typeLabel: (lbl ? (tr() ? lbl.tr : lbl.en) : e.event_type),
                ppe: VIOLATION[e.event_type],
                risk: (e.risk_level === "high" || e.risk_level === "critical") ? "Yüksek"
                    : e.risk_level === "low" ? "Düşük" : "Orta",
                conf: e.confidence, source: "camera"
            });
        });
        return rows;
    }
    function mergedRows() {
        var rows = flatten(window._evRaw || []).concat(flattenCams(window._evCamRaw || []));
        rows.sort(function (x, y) { return new Date(y.created_at) - new Date(x.created_at) || y.timeSec - x.timeSec; });
        return rows;
    }

    function exportCsv() {
        var l = L(), rows = filtered();
        var mv = "rf-27"; // model sürümü (model_registry.json ile senkron)
        var head = [l.date, l.video, l.time, l.type, l.ppe, l.risk, l.conf, "Model", tr() ? "Kaynak" : "Source"];
        var lines = [head.join(",")];
        rows.forEach(function (r) {
            var src = r.source === "camera" ? (tr() ? "Canlı Kamera" : "Live Camera") : (tr() ? "Yüklenen Video" : "Uploaded Video");
            var cells = [r.date, r.video, r.time, r.typeLabel, r.ppe, r.risk, r.conf != null ? r.conf + "%" : "", mv, src];
            lines.push(cells.map(function (c) { return '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"'; }).join(","));
        });
        var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = "mia-ihlal-raporu-" + Date.now() + ".csv";
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 200);
        if (window.MIAReport) window.MIAReport.logExport(null, null, "csv", { source: "events", rows: rows.length });
    }

    function exportPdf() {
        if (!window.jspdf || !window.jspdf.jsPDF) { alert("PDF kütüphanesi yüklenemedi."); return; }
        var l = L(), rows = filtered();
        var doc = new window.jspdf.jsPDF({ unit: "pt", format: "a4" });
        var pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight(), margin = 40;
        doc.setFillColor(10, 10, 10); doc.rect(0, 0, pageW, 70, "F");
        doc.setTextColor(212, 175, 55); doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text("MIA", margin, 40);
        doc.setTextColor(255, 255, 255); doc.setFontSize(11); doc.setFont("helvetica", "normal"); doc.text(l.title, margin, 58);
        doc.setFontSize(9); doc.setTextColor(180, 180, 180);
        doc.text(new Date().toLocaleString(tr() ? "tr-TR" : "en-US"), pageW - margin, 40, { align: "right" });
        var y = 96;
        var cols = [{ x: margin, w: 70, h: l.date }, { x: margin + 70, w: 150, h: l.video },
                    { x: margin + 220, w: 55, h: l.time }, { x: margin + 275, w: 150, h: l.type },
                    { x: margin + 425, w: 60, h: l.risk }, { x: margin + 485, w: 55, h: l.conf }];
        function header() {
            doc.setFillColor(20, 20, 20); doc.rect(margin, y, pageW - margin * 2, 20, "F");
            doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
            cols.forEach(function (c) { doc.text(String(c.h), c.x + 4, y + 14); }); y += 20;
        }
        header(); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
        var rc = { "Yüksek": [239, 68, 68], "Orta": [212, 175, 55], "Düşük": [34, 197, 94] };
        rows.forEach(function (r, i) {
            if (y > pageH - 50) { doc.addPage(); y = margin; header(); doc.setFont("helvetica", "normal"); doc.setFontSize(8); }
            if (i % 2 === 0) { doc.setFillColor(248, 248, 248); doc.rect(margin, y, pageW - margin * 2, 18, "F"); }
            doc.setTextColor(20, 20, 20);
            doc.text(String(r.date), cols[0].x + 4, y + 12);
            doc.text(doc.splitTextToSize(String(r.video), cols[1].w - 8)[0], cols[1].x + 4, y + 12);
            doc.text(String(r.time), cols[2].x + 4, y + 12);
            doc.text(doc.splitTextToSize(String(r.typeLabel), cols[3].w - 8)[0], cols[3].x + 4, y + 12);
            var c = rc[r.risk] || [110, 110, 110]; doc.setTextColor(c[0], c[1], c[2]); doc.setFont("helvetica", "bold");
            doc.text(String(r.risk), cols[4].x + 4, y + 12); doc.setFont("helvetica", "normal"); doc.setTextColor(20, 20, 20);
            doc.text(r.conf != null ? r.conf + "%" : "-", cols[5].x + 4, y + 12);
            y += 18;
        });
        if (!rows.length) { doc.setTextColor(110, 110, 110); doc.text(l.empty, margin + 4, y + 14); }
        doc.save("MIA-ihlal-raporu-" + Date.now() + ".pdf");
    }

    function load() {
        // Faz 5: org seçiliyse org analizleri + legacy kişisel analizler (OR).
        var run = function (orgId) {
            var q = supabase.from("analyses").select("*");
            q = orgId ? q.or("user_id.eq." + window._evUser.id + ",org_id.eq." + orgId) : q.eq("user_id", window._evUser.id);
            q.order("created_at", { ascending: false }).then(function (r) {
                window._evRaw = r.data || [];
                allRows = mergedRows();
                render();
                // Faz 13: canlı kamera olayları (tablo yoksa/org yoksa sessizce atlanır)
                if (!orgId) return;
                supabase.from("camera_events").select("*, cameras(name)").eq("org_id", orgId)
                    .order("created_at", { ascending: false }).limit(500).then(function (c) {
                        if (c.error || !c.data || !c.data.length) return;
                        window._evCamRaw = c.data;
                        allRows = mergedRows();
                        render();
                    });
            });
        };
        if (window.MIAOrg && window.MIAOrg.ready) window.MIAOrg.ready.then(function () { run(window.MIAOrg.currentId()); });
        else run(null);
    }

    function init() {
        applyI18n();
        ["fPeriod", "fRisk", "fPpe"].forEach(function (id) {
            document.getElementById(id).addEventListener("change", render);
        });
        var fs = document.getElementById("fSource"); // opsiyonel kaynak filtresi (app)
        if (fs) fs.addEventListener("change", render);
        document.getElementById("btnCsv").addEventListener("click", exportCsv);
        document.getElementById("btnPdf").addEventListener("click", exportPdf);
        supabase.auth.getSession().then(function (r) {
            if (r.data.session) { window._evUser = r.data.session.user; load(); }
            else { window.location.href = "giris-yap.html?next=events.html"; }
        });
        // dil değişince yeniden çiz
        var prev = tr();
        setInterval(function () { if (tr() !== prev) { prev = tr(); applyI18n(); allRows = mergedRows(); render(); } }, 600);
    }

    init();
})();
