// === MIA — Birleşik Panel: Geçiş Taramaları (Sprint 6) ===
// Dashboard'a kamera analizlerinin yanında QR/RFID tarama uyumluluğunu getirir.
// Tek ekranda hem AI analizleri (analysesList) hem geçiş taramaları görünür.
// Global `supabase`, `currentLang` js/app.js'ten gelir.

(function () {
    if (!document.getElementById("scanSection")) return;

    function tr() { return (typeof currentLang === "undefined" ? "tr" : currentLang) === "tr"; }
    var L = {
        tr: { title: "Geçiş Taramaları (RFID/QR)", cta: "Tarama Yap", total: "Toplam Geçiş",
              ok: "Uyumlu", bad: "Eksik KKD", rate: "Uyum Oranı", empty: "Henüz geçiş taraması yok.",
              missing: "Eksik", names: { helmet: "Baret", vest: "Yelek", mask: "Maske" } },
        en: { title: "Checkpoint Scans (RFID/QR)", cta: "Start Scan", total: "Total Passes",
              ok: "Compliant", bad: "Missing PPE", rate: "Compliance", empty: "No checkpoint scans yet.",
              missing: "Missing", names: { helmet: "Hardhat", vest: "Vest", mask: "Mask" } }
    };
    function l() { return L[tr() ? "tr" : "en"]; }
    function setText(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }

    function applyLabels() {
        var t = l();
        setText("scanTitle", t.title); setText("scanCta", t.cta);
        setText("scLblTotal", t.total); setText("scLblOk", t.ok);
        setText("scLblBad", t.bad); setText("scLblRate", t.rate);
    }

    function render(scans) {
        var t = l();
        var total = scans.length;
        var ok = scans.filter(function (s) { return s.compliant; }).length;
        var bad = total - ok;
        setText("scTotal", total);
        setText("scOk", ok);
        setText("scBad", bad);
        setText("scRate", total ? Math.round(ok / total * 100) + "%" : "-");

        var list = document.getElementById("scanList");
        if (!total) { list.innerHTML = '<div style="color:#8a8a8a;padding:1rem;">' + t.empty + "</div>"; return; }
        var html = "";
        scans.slice(0, 12).forEach(function (s) {
            var dt = new Date(s.created_at).toLocaleString(tr() ? "tr-TR" : "en-US");
            var miss = (s.missing || []).map(function (m) { return t.names[m] || m; }).join(", ");
            var badge = s.compliant
                ? '<span class="analysis-stat-value score" style="color:#22c55e;">✓</span>'
                : '<span class="analysis-stat-value violations">' + t.missing + ": " + miss + "</span>";
            html += '<div class="analysis-card"><div class="analysis-info"><h3>' +
                (s.worker_name || s.worker_code || "—") + '</h3><p>' + dt + "</p></div>" +
                '<div class="analysis-stats"><div class="analysis-stat">' + badge + "</div></div></div>";
        });
        list.innerHTML = html;
    }

    function load(user) {
        supabase.from("scans").select("*").eq("user_id", user.id)
            .order("created_at", { ascending: false }).limit(200).then(function (r) {
                var scans = r.data || [];
                document.getElementById("scanSection").style.display = scans.length ? "block" : "block";
                window._scans = scans;
                render(scans);
            });
    }

    function init() {
        applyLabels();
        // dashboard auth zaten app.js'te yapılıyor; biz de session bekleyip yükleriz
        supabase.auth.getSession().then(function (r) {
            if (!r.data.session) return; // app.js zaten yönlendirir
            load(r.data.session.user);
        });
        var prev = tr();
        setInterval(function () { if (tr() !== prev) { prev = tr(); applyLabels(); if (window._scans) render(window._scans); } }, 600);
    }

    init();
})();
