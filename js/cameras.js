// === MIA — Canlı Kamera AI Yönetimi (Faz 12) ===
// Kamera CRUD + canlı olay akışı + worker sağlık durumu. DÜRÜSTLÜK KURALLARI:
//  * Worker heartbeat'i yoksa "bağlı değil" gösterilir — sahte tespit yok.
//  * RTSP kimlik bilgileri asla buradan girilmez/saklanmaz (yalnız maskeli etiket).
//  * Plan kapısı: free/giris planları canlı kamera kullanamaz (plans.js cameras alanı).
// RLS gerçek yaptırım: ekleme owner/admin; inceleme +safety_manager; viewer salt okuma.

(function () {
    if (!document.getElementById("caGrid")) return;
    var $ = function (id) { return document.getElementById(id); };
    var esc = window.miaEsc || function (s) { return String(s == null ? "" : s); };
    var user = null, cams = [], planKey = "free";
    var ET = { no_helmet: "Baretsiz çalışan", no_vest: "Yeleksiz çalışan", no_mask: "Maskesiz çalışan",
               ppe_violation: "KKD ihlali", restricted_area: "Yasak alan", unsafe_behavior: "Güvensiz davranış",
               camera_offline: "Kamera çevrimdışı", worker_error: "Worker hatası" };
    var RK = { low: ["ca-low", "Düşük"], medium: ["ca-med", "Orta"], high: ["ca-high", "Yüksek"], critical: ["ca-high", "KRİTİK"] };
    var ST = { open: "Açık", reviewed: "İncelendi", dismissed: "Yok sayıldı", resolved: "Çözüldü" };

    function orgId() { return (window.MIAOrg && window.MIAOrg.currentId()) || null; }
    function canManage() { var r = window.MIAOrg && window.MIAOrg.role(); return r === "owner" || r === "admin"; }
    function canReview() { var r = window.MIAOrg && window.MIAOrg.role(); return canManage() || r === "safety_manager"; }
    function fmtT(d) { return d ? new Date(d).toLocaleString("tr-TR") : "—"; }
    function ago(d) {
        if (!d) return "hiç";
        var s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
        return s < 60 ? s + " sn önce" : s < 3600 ? Math.floor(s / 60) + " dk önce" : Math.floor(s / 3600) + " sa önce";
    }

    // ---- Plan kapısı: plans.js cameras alanı (free=1 demo, giris=0, kamera_ai=10...) ----
    function checkPlan(cb) {
        supabase.auth.getSession().then(function (r) {
            var tok = r.data.session && r.data.session.access_token;
            var h = { Authorization: "Bearer " + tok };
            var oid = orgId(); if (oid) h["x-mia-org"] = oid;
            fetch("/api/usage", { headers: h }).then(function (x) { return x.ok ? x.json() : null; })
                .then(function (u) {
                    planKey = (u && u.plan) || "free";
                    var camLimit = window.MIAPlans ? window.MIAPlans.get(planKey).cameras : 0;
                    // kamera_ai ve üzeri (cameras >= 10) canlı modül kullanabilir
                    var allowed = camLimit >= 10 || camLimit === -1;
                    $("caPlanBlock").style.display = allowed ? "none" : "block";
                    cb(allowed, camLimit);
                }).catch(function () { cb(false, 0); });
        });
    }

    // ---- Worker durumu (dürüst): son 2 dk içinde heartbeat var mı ----
    function checkWorker() {
        supabase.from("camera_worker_sessions").select("last_heartbeat_at,status")
            .order("last_heartbeat_at", { ascending: false }).limit(1).then(function (r) {
                var hb = r.data && r.data[0] && r.data[0].last_heartbeat_at;
                var fresh = hb && (Date.now() - new Date(hb).getTime()) < 120000;
                $("caWorkerWarn").style.display = fresh ? "none" : "block";
                $("caLastHb").textContent = hb ? fmtT(hb) + " (" + ago(hb) + ")" : "hiç";
            });
    }

    // ---- Kameralar ----
    function loadCams() {
        var oid = orgId();
        if (!oid) { $("caEmpty").style.display = "block"; $("caEmpty").textContent = "Organizasyon bulunamadı."; return; }
        supabase.from("cameras").select("*").eq("org_id", oid).neq("status", "archived")
            .order("created_at").then(function (r) {
                if (r.error) { $("caEmpty").style.display = "block"; $("caEmpty").textContent = "Kamera tabloları yok — supabase/schema.sql çalıştırılmalı."; return; }
                cams = r.data || [];
                $("caCount").textContent = "— " + cams.length + " kamera";
                if (!cams.length) { $("caEmpty").style.display = "block"; $("caGrid").innerHTML = ""; return; }
                $("caEmpty").style.display = "none";
                $("caGrid").innerHTML = cams.map(function (c) {
                    var dot = c.health_status === "online" ? "ca-on" : c.health_status === "offline" ? "ca-off"
                        : c.health_status === "degraded" ? "ca-deg" : "ca-unk";
                    return '<div class="ca-cam"><h3><span class="ca-dot ' + dot + '"></span>' + esc(c.name) + '</h3>' +
                        '<div class="ca-meta">' + esc(c.location_label || "—") + ' · ' + esc(c.camera_type) +
                        (c.stream_url_masked ? '<br>' + esc(c.stream_url_masked) : '') + '</div>' +
                        '<div class="ca-meta">Durum: <b>' + esc(c.status) + '</b> / ' + esc(c.health_status) +
                        '<br>Son kare: ' + ago(c.last_frame_at) + ' · Son tespit: ' + ago(c.last_detection_at) + '</div>' +
                        (canManage()
                            ? '<div style="display:flex;gap:.4rem;margin-top:.5rem;">' +
                              '<button type="button" class="btn btn-secondary btn-sm" data-toggle="' + c.id + '">' +
                              (c.status === "paused" ? "Devam Et" : "Duraklat") + '</button>' +
                              '<button type="button" class="btn btn-danger btn-sm" data-arch="' + c.id + '">Arşivle</button></div>'
                            : '') + '</div>';
                }).join("");
                Array.prototype.forEach.call($("caGrid").querySelectorAll("[data-toggle]"), function (b) {
                    b.addEventListener("click", function () {
                        var c = cams.filter(function (x) { return x.id === b.getAttribute("data-toggle"); })[0];
                        supabase.from("cameras").update({ status: c.status === "paused" ? "active" : "paused",
                            updated_at: new Date().toISOString() }).eq("id", c.id).then(loadCams);
                    });
                });
                Array.prototype.forEach.call($("caGrid").querySelectorAll("[data-arch]"), function (b) {
                    b.addEventListener("click", function () {
                        if (!confirm("Kamera arşivlensin mi? (Olay geçmişi silinmez)")) return;
                        supabase.from("cameras").update({ status: "archived", updated_at: new Date().toISOString() })
                            .eq("id", b.getAttribute("data-arch")).then(loadCams);
                    });
                });
            });
    }

    // ---- Kamera ekleme ----
    $("caNewBtn").addEventListener("click", function () {
        $("caAddPanel").style.display = $("caAddPanel").style.display === "none" ? "block" : "none";
    });
    $("cnCancelBtn").addEventListener("click", function () { $("caAddPanel").style.display = "none"; });
    $("cnSaveBtn").addEventListener("click", function () {
        var name = $("cnName").value.trim();
        if (!name) { $("cnMsg").textContent = " Kamera adı zorunlu."; return; }
        var masked = $("cnMasked").value.trim();
        if (/:[^@\/]*@/.test(masked) && masked.indexOf("***") === -1) {
            $("cnMsg").textContent = " Adres şifre içeriyor gibi görünüyor — kimlik bilgilerini *** ile maskeleyin.";
            return;
        }
        var camLimit = window.MIAPlans ? window.MIAPlans.get(planKey).cameras : 0;
        if (camLimit !== -1 && cams.length >= camLimit) {
            $("cnMsg").textContent = " Plan limiti: en çok " + camLimit + " kamera. Yükseltme için hesap sayfası.";
            return;
        }
        supabase.from("cameras").insert({
            org_id: orgId(), name: name, location_label: $("cnLoc").value.trim() || null,
            camera_type: $("cnType").value, site_id: $("cnSite").value || null,
            stream_url_masked: masked || null, created_by: user.id
        }).select().single().then(function (r) {
            if (r.error) { $("cnMsg").textContent = " Eklenemedi: " + r.error.message; return; }
            $("cnMsg").innerHTML = " ✓ Eklendi. Worker eşlemesi için kamera ID: <code>" + r.data.id + "</code> (cameras.json'a yaz)";
            $("cnName").value = ""; $("cnLoc").value = ""; $("cnMasked").value = "";
            if (window.MIAMonitor) window.MIAMonitor.event("camera_created", { type: r.data.camera_type });
            loadCams();
        });
    });

    // ---- Canlı olaylar ----
    function loadEvents() {
        var oid = orgId(); if (!oid) return;
        supabase.from("camera_events").select("*, cameras(name)").eq("org_id", oid)
            .order("created_at", { ascending: false }).limit(30).then(function (r) {
                if (r.error) { $("caEvents").textContent = "—"; return; }
                var rows = r.data || [];
                if (!rows.length) {
                    $("caEvents").innerHTML = '<div class="ca-empty">Henüz canlı olay yok' +
                        ($("caWorkerWarn").style.display !== "none" ? " — worker bağlı değil, olay üretilemez." : ".") + '</div>';
                    return;
                }
                var html = '<table class="ca-tbl"><thead><tr><th>Zaman</th><th>Kamera</th><th>Olay</th><th>Risk</th><th>Güven</th><th>Durum</th>' +
                    (canReview() ? "<th></th>" : "") + '</tr></thead><tbody>';
                rows.forEach(function (e) {
                    var rk = RK[e.risk_level] || RK.medium;
                    html += "<tr><td>" + fmtT(e.frame_timestamp) + "</td><td>" + esc(e.cameras && e.cameras.name || "—") + "</td>" +
                        "<td><b>" + (ET[e.event_type] || e.event_type) + "</b> <span class='ca-muted'>(Canlı Kamera · " + esc(e.model_version || "") + ")</span></td>" +
                        '<td><span class="ca-badge ' + rk[0] + '">' + rk[1] + '</span></td>' +
                        "<td>" + (e.confidence != null ? "%" + e.confidence : "—") + "</td><td>" + (ST[e.status] || e.status) + "</td>" +
                        (canReview() ? "<td>" + (e.status === "open"
                            ? '<button type="button" class="btn btn-secondary btn-sm" data-rev="' + e.id + '">İncelendi</button> ' +
                              '<button type="button" class="btn btn-secondary btn-sm" data-dis="' + e.id + '">Yok say</button>'
                            : "") + "</td>" : "") + "</tr>";
                });
                $("caEvents").innerHTML = html + "</tbody></table>";
                function bind(attr, status) {
                    Array.prototype.forEach.call($("caEvents").querySelectorAll("[" + attr + "]"), function (b) {
                        b.addEventListener("click", function () {
                            supabase.from("camera_events").update({ status: status, reviewed_by: user.id,
                                reviewed_at: new Date().toISOString() }).eq("id", b.getAttribute(attr)).then(loadEvents);
                        });
                    });
                }
                bind("data-rev", "reviewed"); bind("data-dis", "dismissed");
            });
    }

    // CSV (kaynak etiketi: Canlı Kamera)
    $("caCsvBtn").addEventListener("click", function () {
        var oid = orgId(); if (!oid) return;
        supabase.from("camera_events").select("*, cameras(name)").eq("org_id", oid)
            .order("created_at", { ascending: false }).limit(500).then(function (r) {
                var rows = r.data || [];
                var lines = ["Zaman,Kamera,Olay,Risk,Güven,Durum,Model,Kaynak"];
                rows.forEach(function (e) {
                    lines.push([fmtT(e.frame_timestamp), (e.cameras && e.cameras.name) || "", ET[e.event_type] || e.event_type,
                        e.risk_level, e.confidence != null ? e.confidence + "%" : "", ST[e.status] || e.status,
                        e.model_version || "", "Canlı Kamera"].map(function (c) {
                            return '"' + String(c).replace(/"/g, '""') + '"';
                        }).join(","));
                });
                var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
                var a = document.createElement("a");
                a.href = URL.createObjectURL(blob); a.download = "mia-kamera-olaylari-" + Date.now() + ".csv";
                document.body.appendChild(a); a.click();
                setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 200);
                if (window.MIAReport) window.MIAReport.logExport(null, null, "csv", { source: "camera_events", rows: rows.length });
            });
    });

    // ---- Init ----
    supabase.auth.getSession().then(function (r) {
        if (!r.data.session) { window.location.href = "giris-yap.html?next=cameras.html"; return; }
        user = r.data.session.user;
        var go = function () {
            checkPlan(function (allowed) {
                if (canManage() && allowed) $("caNewBtn").style.display = "inline-flex";
                // saha listesi
                if (orgId()) supabase.from("organization_sites").select("id,name").eq("org_id", orgId())
                    .eq("status", "active").then(function (s) {
                        $("cnSite").innerHTML = '<option value="">Saha seç…</option>' + ((s.data || []).map(function (x) {
                            return '<option value="' + x.id + '">' + esc(x.name) + '</option>'; }).join(""));
                    });
                checkWorker(); loadCams(); loadEvents();
                setInterval(function () { checkWorker(); loadCams(); loadEvents(); }, 15000);
            });
        };
        if (window.MIAOrg && window.MIAOrg.ready) window.MIAOrg.ready.then(go); else go();
    });
})();
