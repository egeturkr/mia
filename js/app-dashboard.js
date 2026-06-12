// === MIA Uygulaması — Dashboard (Faz 17) ===
// Tüm sayılar GERÇEK kayıtlardan (cameras, camera_events, camera_worker_sessions,
// analyses). Veri yoksa "—" veya boş durum gösterilir — sahte gösterge yok.

(function () {
    if (!document.getElementById("dbStats")) return;
    var $ = function (id) { return document.getElementById(id); };
    var esc = window.miaEsc || function (s) { return String(s == null ? "" : s); };
    var ET = { no_helmet: "Baret Eksik", no_vest: "Yelek Eksik", no_mask: "Maske Eksik",
               ppe_violation: "KKD İhlali", camera_offline: "Kamera Çevrimdışı", worker_error: "Worker Hatası" };
    var fmtT = function (d) { return d ? new Date(d).toLocaleString("tr-TR") : "—"; };
    var ago = function (d) {
        if (!d) return "hiç";
        var s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
        return s < 60 ? s + " sn önce" : s < 3600 ? Math.floor(s / 60) + " dk önce"
             : s < 86400 ? Math.floor(s / 3600) + " sa önce" : Math.floor(s / 86400) + " gün önce";
    };

    document.addEventListener("mia-app-ready", function (ev) {
        var user = ev.detail.user;
        var oid = window.MIAOrg && window.MIAOrg.currentId();

        // --- Kameralar ---
        if (oid) supabase.from("cameras").select("*").eq("org_id", oid).neq("status", "archived")
            .then(function (r) {
                var cams = r.data || [];
                var on = cams.filter(function (c) { return c.health_status === "online"; }).length;
                $("dsCams").textContent = cams.length ? on + " / " + cams.length : "0";
                $("dsCams").className = "v " + (cams.length && on === cams.length ? "ok" : on ? "warn" : "");
                $("dsCamList").innerHTML = !cams.length
                    ? '<div class="empty">Henüz kamera yok — <a href="app-cameras.html" style="color:#E9C766;">eklemek için Canlı Kameralar</a></div>'
                    : '<table class="t"><thead><tr><th>Kamera</th><th>Konum</th><th>Durum</th><th>Son kare</th><th>Son tespit</th></tr></thead><tbody>' +
                      cams.slice(0, 8).map(function (c) {
                          var dot = c.health_status === "online" ? "on" : c.health_status === "offline" ? "off"
                                  : c.health_status === "degraded" ? "deg" : "unk";
                          return "<tr><td><span class='dot " + dot + "'></span><b>" + esc(c.name) + "</b></td><td>" +
                              esc(c.location_label || "—") + "</td><td>" + esc(c.status) + "</td><td>" +
                              ago(c.last_frame_at) + "</td><td>" + ago(c.last_detection_at) + "</td></tr>";
                      }).join("") + "</tbody></table>";
            });
        else { $("dsCams").textContent = "0"; $("dsCamList").innerHTML = '<div class="empty">Organizasyon bulunamadı.</div>'; }

        // --- Worker + AI durumu (dürüst) ---
        supabase.from("camera_worker_sessions").select("last_heartbeat_at,metadata")
            .order("last_heartbeat_at", { ascending: false }).limit(1).then(function (r) {
                var row = r.data && r.data[0];
                var fresh = row && row.last_heartbeat_at && (Date.now() - new Date(row.last_heartbeat_at).getTime()) < 120000;
                $("dsWorker").textContent = fresh ? "Bağlı" : "Bağlı değil";
                $("dsWorker").className = "v " + (fresh ? "ok" : "bad");
                var m = (row && row.metadata) || {};
                $("dsAiBox").innerHTML = "<b style='color:#ECECEC;'>AI durumu:</b> " +
                    (!fresh ? "worker bağlı değil — canlı tespit çalışmıyor."
                     : m.inference === false ? "çıkarım kapalı (API anahtarı tanımsız) — olay üretilmiyor."
                     : "aktif" + (m.model ? " · model " + esc(m.model) : "") +
                       (m.perf_ms ? " · son çıkarım " + m.perf_ms.infer_ms + " ms" : "")) +
                    (m.mode === "demo" && fresh ? " · <b>DEMO modu</b>" : "") +
                    "<br>Doğruluk: pilot saha doğrulaması bekliyor.";
            });

        // --- Olaylar + trend ---
        var since = new Date(Date.now() - 14 * 86400000).toISOString();
        var camEvP = oid
            ? supabase.from("camera_events").select("event_type,risk_level,status,frame_timestamp,created_at,cameras(name)")
                .eq("org_id", oid).gte("created_at", since).order("created_at", { ascending: false }).limit(500)
            : Promise.resolve({ data: [] });
        var anaQ = supabase.from("analyses").select("created_at,violations_count,safety_score");
        anaQ = oid ? anaQ.or("user_id.eq." + user.id + ",org_id.eq." + oid) : anaQ.eq("user_id", user.id);

        Promise.all([camEvP, anaQ]).then(function (res) {
            var evs = (res[0] && res[0].data) || [];
            var anas = (res[1] && res[1].data) || [];

            // stat: açık olay
            var open = evs.filter(function (e) { return e.status === "open"; }).length;
            $("dsOpen").textContent = open;
            // stat: analizler + skor
            $("dsAnalyses").textContent = anas.length;
            var scored = anas.filter(function (a) { return a.safety_score != null; });
            var avg = scored.length ? Math.round(scored.reduce(function (s, a) { return s + a.safety_score; }, 0) / scored.length) : null;
            $("dsScore").textContent = avg != null ? "%" + avg : "—";
            $("dsScore").className = "v " + (avg == null ? "" : avg >= 75 ? "ok" : avg >= 50 ? "warn" : "bad");

            // kritik olay listesi
            var crit = evs.filter(function (e) { return e.risk_level === "high" || e.risk_level === "critical"; }).slice(0, 6);
            $("dsAlerts").innerHTML = !crit.length
                ? '<div class="empty">Son 14 günde yüksek riskli canlı olay yok' +
                  (evs.length ? "." : " — worker bağlıysa olaylar burada görünür.") + "</div>"
                : crit.map(function (e) {
                    return '<div style="display:flex;justify-content:space-between;gap:.6rem;padding:.5rem 0;border-bottom:1px solid #1d1d1d;">' +
                        "<div><b style='font-size:.85rem;'>" + (ET[e.event_type] || e.event_type) + "</b>" +
                        "<div class='ca-muted'>" + esc(e.cameras && e.cameras.name || "—") + "</div></div>" +
                        '<div style="text-align:right;"><span class="b ' + (e.risk_level === "critical" ? "b-bad" : "b-warn") + '">' +
                        (e.risk_level === "critical" ? "KRİTİK" : "Yüksek") + "</span>" +
                        "<div class='ca-muted'>" + ago(e.frame_timestamp || e.created_at) + "</div></div></div>";
                }).join("");

            // 14 günlük trend: kamera ihlalleri + video analiz ihlal sayıları
            var days = [], counts = {};
            for (var i = 13; i >= 0; i--) {
                var d = new Date(Date.now() - i * 86400000);
                var k = d.toISOString().slice(0, 10);
                days.push(k); counts[k] = 0;
            }
            evs.forEach(function (e) {
                if (e.event_type && e.event_type.indexOf("no_") === 0) {
                    var k = (e.created_at || "").slice(0, 10);
                    if (k in counts) counts[k]++;
                }
            });
            anas.forEach(function (a) {
                var k = (a.created_at || "").slice(0, 10);
                if (k in counts) counts[k] += a.violations_count || 0;
            });
            var total = days.reduce(function (s, k) { return s + counts[k]; }, 0);
            $("dsTrendNote").textContent = total ? "Toplam " + total + " ihlal (14 gün)." : "Bu dönemde kayıtlı ihlal yok.";
            if (window.Chart) new Chart($("dsTrend"), {
                type: "line",
                data: { labels: days.map(function (k) { return k.slice(8) + "." + k.slice(5, 7); }),
                    datasets: [{ data: days.map(function (k) { return counts[k]; }),
                        borderColor: "#D4AF37", backgroundColor: "rgba(212,175,55,.12)",
                        fill: true, tension: .35, pointRadius: 2.5, pointBackgroundColor: "#E9C766" }] },
                options: { plugins: { legend: { display: false } },
                    scales: { x: { grid: { color: "#1a1a1a" }, ticks: { color: "#8a8a8a", font: { size: 10 } } },
                              y: { beginAtZero: true, grid: { color: "#1a1a1a" }, ticks: { color: "#8a8a8a", precision: 0 } } } }
            });
        });
    });
})();
