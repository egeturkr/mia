// === MIA Masaüstü — Görünümler (login / panel / canlı / kameralar / olaylar / raporlar / ayarlar) ===
// Vanilla JS — repo genelindeki yaklaşımla aynı. Dinamik içerik DAİMA esc()'ten geçer.
(function () {
    "use strict";
    var t = function (k) { return window.miaI18n.t(k); };
    var esc = function (s) { return window.miaCore.esc(s); };
    var $ = function (sel, root) { return (root || document).querySelector(sel); };
    var sb = function () { return window.miaCore.client; };
    var st = function () { return window.miaCore.state; };

    var RISK_TR = { high: "risk_high", medium: "risk_medium", low: "risk_low", critical: "risk_critical" };
    var TYPE_KEY = { no_helmet: "type_no_helmet", no_vest: "type_no_vest", no_mask: "type_no_mask",
                     ppe_violation: "type_ppe_violation", camera_offline: "type_camera_offline" };
    function riskBadge(r) { return '<span class="badge risk-' + esc(r) + '">' + esc(t(RISK_TR[r] || r)) + "</span>"; }
    function typeLabel(ty) { return t(TYPE_KEY[ty] || ty); }
    function fmtTime(iso) { return iso ? new Date(iso).toLocaleString(window.miaI18n.getLang() === "tr" ? "tr-TR" : "en-GB") : "—"; }

    // ================= ORTAK: boş durum ==========================================
    function emptyState(icon, title, desc, ctaHtml) {
        return '<div class="empty"><div class="e-ico">' + icon + '</div>' +
            '<div class="e-title">' + esc(title) + '</div>' +
            '<div class="e-desc">' + esc(desc) + "</div>" + (ctaHtml || "") + "</div>";
    }

    // ================= LOGIN ====================================================
    function renderLogin(root) {
        root.innerHTML =
            '<div class="login-wrap"><div class="login-card">' +
            '<img src="images/logo-primary.webp" alt="MIA — AI Safety Intelligence" class="login-logo-img" ' +
            'onerror="this.outerHTML=\'<div class=login-logo>M I A</div>\'">' +
            '<div class="login-sub">AI SAFETY INTELLIGENCE</div>' +
            '<h2>' + esc(t("login_title")) + "</h2>" +
            '<p class="login-hint">miaissagligi.com hesabınızla giriş yapın</p>' +
            '<label>' + esc(t("login_email")) + '</label><input id="loginEmail" type="email" autocomplete="username">' +
            '<label>' + esc(t("login_password")) + '</label><input id="loginPass" type="password" autocomplete="current-password">' +
            '<button id="loginBtn" class="btn btn-primary">' + esc(t("login_btn")) + "</button>" +
            '<div id="loginErr" class="login-err"></div>' +
            "</div></div>";
        var doLogin = async function () {
            var btn = $("#loginBtn"); btn.disabled = true;
            var r = await sb().auth.signInWithPassword({
                email: $("#loginEmail").value.trim(), password: $("#loginPass").value
            });
            btn.disabled = false;
            if (r.error) { $("#loginErr").textContent = t("login_err"); return; }
            window.miaApp.onAuthed();
        };
        $("#loginBtn").addEventListener("click", doLogin);
        root.addEventListener("keydown", function (e) { if (e.key === "Enter") doLogin(); });
    }

    // ================= DASHBOARD — Komuta Merkezi (Faz 23) ========================
    // AYNI Supabase sorguları — yalnız sunum yenilendi. Sahte veri YOK; veri yoksa
    // premium boş durumlar gösterilir.
    async function renderDashboard(root) {
        root.innerHTML =
            '<h1>' + esc(t("dash_title")) + '</h1>' +
            '<p class="page-sub">' + esc(t("dash_sub")) + "</p>" +
            '<div class="grid stats" id="statGrid">' +
            '<div class="card stat"><div class="skeleton" style="height:28px;width:60px"></div><div class="skeleton" style="height:10px;margin-top:8px"></div></div>'.repeat(5) +
            "</div>" +
            '<div class="grid ops">' +
            '<div class="card"><h3>' + esc(t("dash_live_section")) +
            ' <span class="h3-gold">●</span></h3><div id="dashLive"></div></div>' +
            '<div class="card"><h3>' + esc(t("dash_critical")) + "</h3><div id=\"dashCritical\"></div>" +
            '<a href="#" id="dashAllEvents" class="btn btn-sm" style="margin-top:12px">' + esc(t("dash_critical_all")) + " →</a></div>" +
            "</div>" +
            '<div class="grid three">' +
            '<div class="card"><h3>' + esc(t("dash_trend")) + '</h3><div id="dashTrend"></div></div>' +
            '<div class="card"><h3>' + esc(t("dash_dist")) + '</h3><div id="dashDist"></div></div>' +
            '<div class="card"><h3>' + esc(t("dash_ai_status")) + '</h3><div id="dashAi"></div></div>' +
            "</div>" +
            '<div class="card"><h3>' + esc(t("dash_quick")) + '</h3><div class="quick" id="dashQuick"></div></div>';

        $("#dashAllEvents").addEventListener("click", function (e) { e.preventDefault(); window.miaApp.nav("events"); });
        $("#dashQuick").innerHTML = [
            ["cameras", "▤", t("qa_add_camera")], ["reports", "▥", t("qa_report")],
            ["events", "⚠", t("qa_events")], ["settings", "⚙", t("qa_settings")]
        ].map(function (q) {
            return '<a href="#" data-q="' + q[0] + '"><i>' + q[1] + "</i>" + esc(q[2]) + "</a>";
        }).join("");
        $("#dashQuick").querySelectorAll("[data-q]").forEach(function (a) {
            a.addEventListener("click", function (e) { e.preventDefault(); window.miaApp.nav(a.getAttribute("data-q")); });
        });

        var org = st().org; if (!org) return;

        // --- Veri (değişmedi: camera_events 7g + cameras) --------------------------
        var since7 = new Date(Date.now() - 7 * 864e5).toISOString();
        var since1 = new Date(); since1.setHours(0, 0, 0, 0);
        var ev = await sb().from("camera_events")
            .select("id, event_type, risk_level, created_at, confidence, status, cameras(name)")
            .eq("org_id", org.id).gte("created_at", since7)
            .order("created_at", { ascending: false }).limit(500);
        var rows = ev.data || [];
        var today = rows.filter(function (r) { return new Date(r.created_at) >= since1; });
        var cams = await sb().from("cameras")
            .select("id,name,status,camera_type,location_label,last_frame_at")
            .eq("org_id", org.id).neq("status", "archived");
        var camRows = cams.data || [];
        var activeCams = camRows.filter(function (c) { return c.status === "active"; }).length;
        var high = rows.filter(function (r) { return r.risk_level === "high" || r.risk_level === "critical"; }).length;
        var score = Math.max(0, 100 - high * 3 - (rows.length - high));
        var q = window.miaEvents.stats();

        // --- KPI şeridi -------------------------------------------------------------
        $("#statGrid").innerHTML =
            statCard(activeCams + " / " + camRows.length, t("dash_active_cams"), "") +
            statCard(today.length, t("dash_today"), today.length ? "bad" : "good") +
            statCard(rows.length, t("dash_week"), rows.length > 20 ? "bad" : "") +
            statCard(score + "%", t("dash_compliance"), score >= 80 ? "good" : score >= 50 ? "" : "bad") +
            statCard(q.pending, t("dash_queue"), q.pending > 50 ? "bad" : "good");

        // --- Canlı kamera izleme (merkez) ---------------------------------------------
        $("#dashLive").innerHTML = camRows.length
            ? camRows.slice(0, 6).map(function (c) {
                var on = c.status === "active";
                return '<div class="cam-row"><span class="c-dot ' + (on ? "on" : "") + '"></span>' +
                    "<b>" + esc(c.name) + "</b>" +
                    '<span class="c-meta">' + esc(c.camera_type) + (c.location_label ? " · " + esc(c.location_label) : "") + "</span>" +
                    '<span class="spacer"></span>' +
                    '<span class="c-meta">' + (c.last_frame_at ? esc(fmtTime(c.last_frame_at)) : "—") + "</span></div>";
            }).join("") +
              '<button class="btn btn-primary btn-sm" id="dashOpenLive" style="margin-top:14px">◉ ' + esc(t("dash_live_open")) + "</button>"
            : emptyState("▤", t("dash_live_empty_t"), t("dash_live_empty_d"),
                '<button class="btn btn-primary btn-sm" id="dashOpenLive">◉ ' + esc(t("dash_live_open")) + "</button>");
        var openLive = $("#dashOpenLive");
        if (openLive) openLive.addEventListener("click", function () { window.miaApp.nav("live"); });

        // --- Kritik olaylar paneli ------------------------------------------------------
        var critical = rows.filter(function (r) { return r.risk_level === "high" || r.risk_level === "critical"; }).slice(0, 6);
        $("#dashCritical").innerHTML = critical.length
            ? critical.map(function (r) {
                return '<div class="ev-row">' + riskBadge(r.risk_level) +
                    '<div style="min-width:0"><div class="ev-title">' + esc(typeLabel(r.event_type)) + "</div>" +
                    '<div class="muted small">' + esc(r.cameras ? r.cameras.name : "—") + " · " + esc(fmtTime(r.created_at)) +
                    (r.confidence != null ? " · %" + Math.round(r.confidence * 100) : "") + "</div></div></div>";
            }).join("")
            : emptyState("✓", t("dash_no_critical_t"), t("dash_no_critical_d"));

        // --- Trend (7 gün, gerçek byDay) --------------------------------------------------
        var byDay = {};
        for (var d = 6; d >= 0; d--) {
            var day = new Date(Date.now() - d * 864e5);
            byDay[day.toISOString().slice(0, 10)] = 0;
        }
        rows.forEach(function (r) {
            var k = r.created_at.slice(0, 10);
            if (byDay[k] != null) byDay[k]++;
        });
        var days = Object.keys(byDay).sort();
        var maxDay = Math.max.apply(null, [1].concat(days.map(function (k) { return byDay[k]; })));
        $("#dashTrend").innerHTML = rows.length
            ? '<div class="trend">' + days.map(function (k) {
                var n = byDay[k];
                var hPct = Math.round(n / maxDay * 100);
                return '<div class="t-col"><span class="t-n">' + (n || "") + "</span>" +
                    '<div class="t-bar ' + (n ? "" : "zero") + '" style="height:' + Math.max(3, hPct) + '%"></div>' +
                    '<span class="t-lbl">' + esc(k.slice(8, 10) + "." + k.slice(5, 7)) + "</span></div>";
            }).join("") + "</div>"
            : emptyState("▁", t("dash_empty"), t("dash_no_critical_d"));

        // --- Dağılım (donut — gerçek byType) -------------------------------------------------
        var byType = {};
        rows.forEach(function (r) { byType[r.event_type] = (byType[r.event_type] || 0) + 1; });
        var typeKeys = Object.keys(byType).sort(function (a, b) { return byType[b] - byType[a]; });
        if (typeKeys.length) {
            var palette = ["#E5484D", "#D4AF37", "#E8963C", "#46C476", "#8A8A8A"];
            var total = rows.length, acc = 0, segs = [];
            typeKeys.forEach(function (k, i) {
                var from = acc / total * 360; acc += byType[k];
                segs.push(palette[i % palette.length] + " " + from + "deg " + (acc / total * 360) + "deg");
            });
            $("#dashDist").innerHTML =
                '<div class="donut-wrap"><div class="donut" style="background:conic-gradient(' + segs.join(",") + ')">' +
                '<div class="donut-center"><b>' + total + "</b><span>" + esc(t("rep_total_events")) + "</span></div></div>" +
                '<div class="legend">' + typeKeys.map(function (k, i) {
                    return '<div class="lg"><span class="sw" style="background:' + palette[i % palette.length] + '"></span>' +
                        esc(typeLabel(k)) + " <b>" + byType[k] + "</b> (%" + Math.round(byType[k] / total * 100) + ")</div>";
                }).join("") + "</div></div>";
        } else {
            $("#dashDist").innerHTML = emptyState("◔", t("dash_empty"), t("dash_no_critical_d"));
        }

        // --- AI sistem durumu (gerçek motor bilgisi) --------------------------------------------
        var info = window.miaDetect.info();
        var s = st().settings;
        $("#dashAi").innerHTML =
            '<div class="kv"><span class="k">' + esc(t("det_ve")) + '</span><span class="v ok">' + esc(t("det_ready")) + "</span></div>" +
            '<div class="kv"><span class="k">' + esc(t("det_model")) + '</span><span class="v">mia-ppe-yolov8s</span></div>' +
            '<div class="kv"><span class="k">' + esc(t("det_backend")) + '</span><span class="v ' + (info.ready ? "ok" : "warn") + '">' +
            (info.ready ? esc(info.backend) : esc(t("engine_error"))) + "</span></div>" +
            '<div class="kv"><span class="k">' + esc(t("det_conf")) + '</span><span class="v">%' + Math.round(s.confidence * 100) + "</span></div>" +
            '<div class="kv"><span class="k">' + esc(t("set_profile")) + '</span><span class="v">' +
            [s.profile.helmet && t("ppe_helmet"), s.profile.safety_vest && t("ppe_vest"), s.profile.mask && t("ppe_mask")]
                .filter(Boolean).map(esc).join(" · ") + "</span></div>";
    }
    function statCard(v, label, mood) {
        return '<div class="card stat ' + (mood || "") + '"><div class="stat-v">' + v + '</div><div class="stat-l">' + esc(label) + "</div></div>";
    }

    // ================= AI TESPİT — durum sayfası (Faz 23, salt sunum) ==============
    // Mevcut GERÇEK yapılandırmayı gösterir: motor durumu (miaDetect.info),
    // ayarlar ve KKD sınıf kaydı (ppe-registry ile aynı dürüst durumlar).
    // Hiçbir tespit/iş mantığı içermez.
    var PPE_REGISTRY_VIEW = [
        { key: "ppe_helmet", status: "supported" },
        { key: "ppe_vest", status: "supported" },
        { key: "ppe_mask", status: "experimental" },
        { key: "ppe_gloves", status: "locked" },
        { key: "ppe_glasses", status: "locked" },
        { key: "ppe_harness", status: "locked" },
        { key: "ppe_boots", status: "locked" }
    ];
    async function renderDetection(root) {
        var s = st().settings;
        root.innerHTML =
            '<h1>' + esc(t("det_title")) + '</h1><p class="page-sub">' + esc(t("det_sub")) + "</p>" +
            '<div class="grid three">' +
            '<div class="card"><h3>' + esc(t("det_engine")) + '</h3><div id="detEngine">' +
            '<div class="skeleton" style="height:14px;margin:8px 0"></div>'.repeat(3) + "</div></div>" +
            '<div class="card"><h3>' + esc(t("det_model")) + '</h3>' +
            '<div class="kv"><span class="k">' + esc(t("det_model")) + '</span><span class="v">mia-ppe-yolov8s</span></div>' +
            '<div class="kv"><span class="k">Sınıf</span><span class="v">10</span></div>' +
            '<div class="kv"><span class="k">' + esc(t("det_conf")) + '</span><span class="v">%' + Math.round(s.confidence * 100) + "</span></div>" +
            '<div class="kv"><span class="k">' + esc(t("det_interval")) + '</span><span class="v">' + esc(String(s.intervalSec)) + " sn</span></div></div>" +
            '<div class="card"><h3>' + esc(t("det_ve")) + '</h3><p class="muted small" style="margin-bottom:10px">' + esc(t("det_ve_desc")) + "</p>" +
            '<div class="kv"><span class="k">' + esc(t("set_profile")) + '</span><span class="v">' +
            [s.profile.helmet && t("ppe_helmet"), s.profile.safety_vest && t("ppe_vest"), s.profile.mask && t("ppe_mask")]
                .filter(Boolean).map(esc).join(" · ") + "</span></div></div>" +
            "</div>" +
            '<div class="card"><h3>' + esc(t("det_registry")) + '</h3><table class="tbl"><tbody>' +
            PPE_REGISTRY_VIEW.map(function (p) {
                return "<tr><td><b>" + esc(t(p.key)) + "</b></td><td style=\"text-align:right\">" +
                    '<span class="badge st-' + p.status + '">' + esc(t("st_" + p.status)) + "</span></td></tr>";
            }).join("") + "</tbody></table>" +
            '<p class="muted small" style="margin-top:12px">' + esc(t("set_profile_note")) + "</p></div>";

        window.miaDetect.init().then(function (info) {
            var el = $("#detEngine");
            if (!el) return;
            el.innerHTML =
                '<div class="kv"><span class="k">' + esc(t("ev_status")) + '</span><span class="v ' + (info.ready ? "ok" : "warn") + '">' +
                esc(info.ready ? t("det_ready") : t("det_error")) + "</span></div>" +
                '<div class="kv"><span class="k">' + esc(t("det_backend")) + '</span><span class="v">' + esc(info.backend || "—") + "</span></div>" +
                '<div class="kv"><span class="k">' + esc(t("set_engine")) + '</span><span class="v">' + esc(s.engine) + "</span></div>" +
                (info.error ? '<p class="muted small" style="margin-top:10px;word-break:break-all">' + esc(info.error.slice(0, 200)) + "</p>" : "");
        });
    }

    // ================= CANLI İZLEME =============================================
    var liveSeq = 0;
    async function renderLive(root) {
        root.innerHTML = '<h1>' + esc(t("nav_live")) +
            ' <span id="engineState" class="badge engine">' + esc(t("engine_loading")) + "</span>" +
            ' <span id="liveSummary" class="live-summary"></span></h1>' +
            '<div class="toolbar">' +
            '<button id="addWebcam" class="btn">' + esc(t("live_add_webcam")) + "</button>" +
            '<button id="addVideo" class="btn">' + esc(t("live_add_video")) + "</button>" +
            '<span class="spacer"></span>' +
            '<span class="muted small">' + esc(t("live_engine")) + ": " + esc(st().settings.engine) +
            " · " + esc(t("live_conf")) + ": " + Math.round(st().settings.confidence * 100) + "%" +
            " · " + esc(t("live_interval")) + ": " + esc(String(st().settings.intervalSec)) + "s</span></div>" +
            '<div id="liveGrid" class="live-grid"></div>' +
            '<div id="liveEmpty" class="card">' +
            emptyState("◉", t("dash_live_empty_t"), t("live_no_cams")) + "</div>";

        window.miaDetect.init().then(function (info) {
            var el = $("#engineState");
            if (!el) return;
            if (info.ready) { el.textContent = t("engine_ready") + " (" + info.backend + ")"; el.classList.add("ok"); }
            else {
                var mode = st().settings.engine;
                el.textContent = mode === "onnx"
                    ? "Cihaz üstü AI başlatılamadı — Ayarlar'dan Hibrit'e geçin"
                    : t("engine_error");
                el.classList.add("warn");
                el.title = info.error || ""; // fareyle üzerine gel → teknik ayrıntı
                console.error("[MIA] motor durumu:", info.error);
            }
        });

        $("#addWebcam").addEventListener("click", function () { addWebcamTile().catch(errToast); });
        $("#addVideo").addEventListener("click", function () { addVideoTile().catch(errToast); });

        // Kayıtlı RTSP kameraları listele → tek tıkla izleme
        var org = st().org;
        if (org) {
            var cams = await sb().from("cameras").select("id,name,camera_type,site_id,location_label")
                .eq("org_id", org.id).neq("status", "archived");
            (cams.data || []).forEach(function (c) {
                if (c.camera_type !== "rtsp" && c.camera_type !== "onvif") return;
                var b = document.createElement("button");
                b.className = "btn"; b.textContent = "📹 " + c.name;
                b.addEventListener("click", function () { addRtspTile(c).catch(errToast); });
                $(".toolbar").insertBefore(b, $(".spacer"));
            });
        }
    }
    function errToast(e) { window.miaCore.toast(String(e && e.message || e).slice(0, 120), "err"); }

    function tileDom(id, name, kind) {
        var grid = $("#liveGrid"); $("#liveEmpty").style.display = "none";
        var div = document.createElement("div");
        div.className = "tile"; div.id = "tile-" + id;
        div.innerHTML =
            '<div class="tile-head"><b>' + esc(name) + '</b><span class="tile-status" data-r="status"></span>' +
            '<span class="badge engine" data-r="engine"></span>' +
            '<button class="btn btn-sm" data-r="stop">' + esc(t("live_stop")) + "</button></div>" +
            '<div class="tile-body" data-r="wrap">' +
            (kind === "rtsp" ? '<canvas class="tile-video" data-r="preview"></canvas>'
                             : '<video class="tile-video" muted playsinline' + (kind === "video" ? " controls loop" : "") + " data-r=\"video\"></video>") +
            '<canvas class="tile-overlay" data-r="overlay"></canvas>' +
            '<div class="tile-alert" data-r="alert"></div></div>' +
            '<div class="tile-foot muted small" data-r="foot"></div>';
        grid.appendChild(div);
        var els = {};
        div.querySelectorAll("[data-r]").forEach(function (el) { els[el.getAttribute("data-r")] = el; });
        els.stop.addEventListener("click", function () {
            window.miaSources.stop(id); div.remove();
            if (window.miaSources.count() === 0 && $("#liveEmpty")) $("#liveEmpty").style.display = "";
        });
        return els;
    }
    function footUpdater(els) {
        return function (res, produced, engineOut) {
            var persons = 0, vios = 0;
            var profile = st().settings.profile;
            (engineOut ? engineOut.tracks : []).forEach(function (tr) {
                if (!tr.fresh) return;
                persons++;
                Object.keys(tr.equip).forEach(function (k) {
                    if (profile[k] && tr.equip[k] === "violation") vios++;
                });
            });
            els.foot.textContent = "👷 " + persons + " kişi · " +
                (vios ? "✗ " + vios + " aktif ihlal" : "✓ ihlal yok") +
                (res.ms != null ? " · " + res.ms + " ms" : "");
            els.foot.style.color = vios ? "var(--red)" : "";
            els.engine.textContent = res.engine;
            updateLiveSummary();
        };
    }
    var liveSumTimer = null;
    function updateLiveSummary() {
        var el = $("#liveSummary");
        if (!el) return;
        var s = window.miaSources.summary();
        el.innerHTML = s.sources
            ? "👷 <b>" + s.persons + "</b> kişi izleniyor · " +
              (s.violations ? '<b style="color:var(--red)">' + s.violations + " aktif ihlal</b>"
                            : '<b style="color:var(--green)">ihlal yok</b>')
            : "";
    }

    // Webcam/video için cameras satırı bul/oluştur (olaylar kamera kaydına bağlanmalı).
    // Plan kamera limitine takılırsa: yeni kayıt AÇMAZ, mevcut bir kamera kaydını
    // yeniden kullanır (tespit DURMAZ — olaylar o kayda yazılır, kullanıcı bilgilendirilir).
    async function ensureCameraRow(name, type) {
        var org = st().org;
        var q = await sb().from("cameras").select("id,site_id").eq("org_id", org.id)
            .eq("camera_type", type).eq("name", name).neq("status", "archived").limit(1);
        if (q.data && q.data[0]) return q.data[0];
        var ins = await sb().from("cameras").insert({
            org_id: org.id, name: name, camera_type: type, status: "active",
            created_by: st().user.id
        }).select("id,site_id").single();
        if (!ins.error) return ins.data;
        if (/camera_limit|limit/i.test(ins.error.message || "")) {
            var any = await sb().from("cameras").select("id,site_id,name").eq("org_id", org.id)
                .neq("status", "archived").order("created_at").limit(1);
            if (any.data && any.data[0]) {
                window.miaCore.toast("Plan kamera limiti doldu — olaylar '" + any.data[0].name + "' kaydına yazılacak", "info");
                return any.data[0];
            }
        }
        throw new Error(ins.error.message);
    }

    async function addWebcamTile() {
        var name = t("webcam_name");
        var row = await ensureCameraRow(name, "browser_webcam");
        var id = "w" + (++liveSeq);
        var els = tileDom(id, name, "webcam");
        await window.miaSources.start({ id: id, cameraRowId: row.id, siteId: row.site_id, name: name,
            kind: "webcam", els: els, onFrame: footUpdater(els) });
    }
    async function addVideoTile() {
        var pick = await window.mia.pickVideo();
        if (!pick.ok) return;
        var name = t("video_name");
        var row = await ensureCameraRow(name, "test_stream");
        var id = "v" + (++liveSeq);
        var els = tileDom(id, name + " — " + pick.path.split("/").pop(), "video");
        await window.miaSources.start({ id: id, cameraRowId: row.id, siteId: row.site_id, name: name,
            kind: "video", videoUrl: pick.url, els: els, onFrame: footUpdater(els) });
    }
    async function addRtspTile(cam) {
        var enc = await window.mia.storeGet("rtsp:" + cam.id);
        if (!enc) { window.miaCore.toast(t("cam_rtsp_note"), "err"); window.miaApp.nav("cameras"); return; }
        var dec = await window.mia.secureDecrypt(enc);
        if (!dec.ok) { window.miaCore.toast("RTSP çözülemedi", "err"); return; }
        var id = "r-" + cam.id;
        if (window.miaSources.get(id)) return; // zaten açık
        var els = tileDom(id, cam.name, "rtsp");
        await window.miaSources.start({ id: id, cameraRowId: cam.id, siteId: cam.site_id, name: cam.name,
            kind: "rtsp", rtspUrl: dec.value, els: els, onFrame: footUpdater(els) });
        sb().from("cameras").update({ status: "active", last_frame_at: new Date().toISOString() }).eq("id", cam.id)
            .then(function () { /* en iyi çaba */ });
    }

    // ================= KAMERALAR ================================================
    async function renderCameras(root) {
        root.innerHTML = '<h1>' + esc(t("cam_title")) + '</h1>' +
            '<div class="toolbar"><button id="camAdd" class="btn btn-primary">' + esc(t("cam_add")) + "</button></div>" +
            '<div id="camForm" class="card" style="display:none"></div><div id="camList"></div>';
        $("#camAdd").addEventListener("click", function () { camForm(); });
        await camList();
    }
    async function camList() {
        var org = st().org, box = $("#camList");
        if (!org || !box) return;
        var r = await sb().from("cameras")
            .select("id,name,camera_type,location_label,status,stream_url_masked,last_frame_at")
            .eq("org_id", org.id).neq("status", "archived").order("created_at");
        var rows = r.data || [];
        box.innerHTML = rows.length ? '<div class="card"><table class="tbl"><thead><tr><th>' +
            [t("cam_name"), t("cam_type"), t("cam_location"), "RTSP", t("ev_status"), ""].map(esc).join("</th><th>") +
            "</th></tr></thead><tbody>" + rows.map(function (c) {
                return "<tr><td><b>" + esc(c.name) + "</b></td><td>" + esc(c.camera_type) + "</td><td>" +
                    esc(c.location_label || "—") + "</td><td class=\"small muted\">" + esc(c.stream_url_masked || "—") + "</td><td>" +
                    esc(c.status) + "</td><td>" +
                    '<button class="btn btn-sm" data-mon="' + esc(c.id) + '">' + esc(t("cam_monitor")) + "</button> " +
                    '<button class="btn btn-sm danger" data-del="' + esc(c.id) + '">' + esc(t("cam_delete")) + "</button></td></tr>";
            }).join("") + "</tbody></table></div>" :
            '<div class="card">' + emptyState("▤", t("cam_none"), t("dash_live_empty_d")) + "</div>";
        box.querySelectorAll("[data-del]").forEach(function (b) {
            b.addEventListener("click", async function () {
                if (!confirm(t("confirm_delete"))) return;
                await sb().from("cameras").update({ status: "archived" }).eq("id", b.getAttribute("data-del"));
                window.mia.storeSet("rtsp:" + b.getAttribute("data-del"), null);
                camList();
            });
        });
        box.querySelectorAll("[data-mon]").forEach(function (b) {
            b.addEventListener("click", function () { window.miaApp.nav("live"); });
        });
    }
    function camForm() {
        var f = $("#camForm"); f.style.display = "";
        f.innerHTML = "<h3>" + esc(t("cam_add")) + "</h3>" +
            "<label>" + esc(t("cam_name")) + '</label><input id="cfName">' +
            "<label>" + esc(t("cam_location")) + '</label><input id="cfLoc">' +
            "<label>" + esc(t("cam_rtsp_url")) + '</label><input id="cfUrl" placeholder="rtsp://">' +
            '<p class="muted small">' + esc(t("cam_rtsp_note")) + "</p>" +
            '<button id="cfSave" class="btn btn-primary">' + esc(t("cam_save")) + "</button> " +
            '<button id="cfCancel" class="btn">' + esc(t("cam_cancel")) + "</button>";
        $("#cfCancel").addEventListener("click", function () { f.style.display = "none"; });
        $("#cfSave").addEventListener("click", async function () {
            var name = $("#cfName").value.trim(), url = $("#cfUrl").value.trim();
            if (!name || !/^rtsps?:\/\//.test(url)) { window.miaCore.toast(t("error_generic"), "err"); return; }
            var masked = await window.mia.rtspMask(url);
            var ins = await sb().from("cameras").insert({
                org_id: st().org.id, name: name, camera_type: "rtsp", status: "inactive",
                location_label: $("#cfLoc").value.trim() || null,
                stream_url_masked: masked, created_by: st().user.id
            }).select("id").single();
            if (ins.error) { window.miaCore.toast(ins.error.message, "err"); return; }
            var enc = await window.mia.secureEncrypt(url);
            if (enc.ok) await window.mia.storeSet("rtsp:" + ins.data.id, enc.value);
            f.style.display = "none";
            window.miaCore.toast(t("saved"), "ok");
            camList();
        });
    }

    // ================= OLAYLAR ==================================================
    async function renderEvents(root) {
        root.innerHTML = '<h1>' + esc(t("ev_title")) + '</h1>' +
            '<div class="toolbar">' +
            sel("fType", [["", t("ev_all")], ["no_helmet", typeLabel("no_helmet")], ["no_vest", typeLabel("no_vest")], ["no_mask", typeLabel("no_mask")]]) +
            sel("fRisk", [["", t("ev_all")], ["critical", t("risk_critical")], ["high", t("risk_high")], ["medium", t("risk_medium")], ["low", t("risk_low")]]) +
            sel("fStatus", [["", t("ev_all")], ["open", t("ev_open")], ["reviewed", t("ev_reviewed")], ["dismissed", t("ev_dismissed")]]) +
            '<span class="spacer"></span><button id="evCsv" class="btn">' + esc(t("ev_export")) + "</button></div>" +
            '<div id="evList"></div>';
        ["fType", "fRisk", "fStatus"].forEach(function (id) { $("#" + id).addEventListener("change", evList); });
        $("#evCsv").addEventListener("click", evCsv);
        await evList();
    }
    function sel(id, opts) {
        return '<select id="' + id + '">' + opts.map(function (o) {
            return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + "</option>";
        }).join("") + "</select>";
    }
    var evCache = [];
    async function evList() {
        var org = st().org, box = $("#evList");
        if (!org || !box) return;
        var q = sb().from("camera_events")
            .select("id,event_type,risk_level,confidence,created_at,status,model_name,cameras(name)")
            .eq("org_id", org.id).order("created_at", { ascending: false }).limit(300);
        var ft = $("#fType").value, fr = $("#fRisk").value, fs = $("#fStatus").value;
        if (ft) q = q.eq("event_type", ft);
        if (fr) q = q.eq("risk_level", fr);
        if (fs) q = q.eq("status", fs);
        var r = await q;
        evCache = r.data || [];
        var canReview = ["owner", "admin", "safety_manager"].indexOf(st().role) !== -1;
        box.innerHTML = evCache.length ? '<div class="card"><table class="tbl"><thead><tr><th>' +
            [t("ev_time"), t("ev_type"), t("ev_risk"), t("ev_camera"), t("ev_conf"), t("ev_status"), ""].map(esc).join("</th><th>") +
            "</th></tr></thead><tbody>" + evCache.map(function (e) {
                return "<tr><td class=\"small\">" + esc(fmtTime(e.created_at)) + "</td><td><b>" + esc(typeLabel(e.event_type)) +
                    "</b></td><td>" + riskBadge(e.risk_level) + "</td><td>" + esc(e.cameras ? e.cameras.name : "—") +
                    "</td><td>" + (e.confidence != null ? Math.round(e.confidence * 100) + "%" : "—") +
                    "</td><td>" + esc(t("ev_" + e.status) || e.status) + "</td><td>" +
                    (canReview && e.status === "open"
                        ? '<button class="btn btn-sm" data-rev="' + esc(e.id) + '">' + esc(t("ev_review")) + "</button> " +
                          '<button class="btn btn-sm" data-dis="' + esc(e.id) + '">' + esc(t("ev_dismiss")) + "</button>"
                        : "") + "</td></tr>";
            }).join("") + "</tbody></table></div>" :
            '<div class="card">' + emptyState("⚠", t("ev_none"), t("dash_no_critical_d")) + "</div>";
        box.querySelectorAll("[data-rev]").forEach(function (b) { b.addEventListener("click", function () { evMark(b.getAttribute("data-rev"), "reviewed"); }); });
        box.querySelectorAll("[data-dis]").forEach(function (b) { b.addEventListener("click", function () { evMark(b.getAttribute("data-dis"), "dismissed"); }); });
    }
    async function evMark(id, status) {
        await sb().from("camera_events").update({
            status: status, reviewed_by: st().user.id, reviewed_at: new Date().toISOString()
        }).eq("id", id);
        evList();
    }
    async function evCsv() {
        var head = ["time", "event_type", "risk", "camera", "confidence", "status", "model"];
        var lines = [head.join(";")].concat(evCache.map(function (e) {
            return [e.created_at, e.event_type, e.risk_level, (e.cameras ? e.cameras.name : ""),
                    e.confidence != null ? e.confidence : "", e.status, e.model_name || ""].map(function (v) {
                return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
            }).join(";");
        }));
        var r = await window.mia.saveText({ filename: "mia-olaylar-" + new Date().toISOString().slice(0, 10) + ".csv",
            content: lines.join("\n"), extension: "csv" });
        if (r.ok) window.miaCore.toast(t("exported"), "ok");
    }

    // ================= RAPORLAR =================================================
    async function renderReports(root) {
        root.innerHTML = '<h1>' + esc(t("rep_title")) + '</h1>' +
            '<div class="toolbar"><label>' + esc(t("rep_period")) + "</label>" +
            sel("repDays", [["7", t("rep_7")], ["30", t("rep_30")], ["90", t("rep_90")]]) +
            '<span class="spacer"></span><button id="repPdf" class="btn btn-primary">' + esc(t("rep_generate")) + "</button></div>" +
            '<div id="repBody"></div>';
        $("#repDays").addEventListener("change", repBody);
        $("#repPdf").addEventListener("click", repPdf);
        await repBody();
    }
    async function repAggregate() {
        var days = parseInt($("#repDays").value, 10) || 7;
        var since = new Date(Date.now() - days * 864e5).toISOString();
        var r = await sb().from("camera_events")
            .select("event_type,risk_level,created_at,cameras(name)")
            .eq("org_id", st().org.id).gte("created_at", since).limit(5000);
        var rows = r.data || [];
        var byType = {}, byCam = {}, byDay = {};
        rows.forEach(function (e) {
            byType[e.event_type] = (byType[e.event_type] || 0) + 1;
            var cn = e.cameras ? e.cameras.name : "—";
            byCam[cn] = (byCam[cn] || 0) + 1;
            var d = e.created_at.slice(0, 10);
            byDay[d] = (byDay[d] || 0) + 1;
        });
        var high = rows.filter(function (e) { return e.risk_level === "high" || e.risk_level === "critical"; }).length;
        return { days: days, total: rows.length, high: high, byType: byType, byCam: byCam, byDay: byDay };
    }
    async function repBody() {
        var a = await repAggregate();
        $("#repBody").innerHTML =
            '<div class="grid stats">' +
            statCard(a.total, t("rep_total_events"), a.total ? "" : "good") +
            statCard(a.high, t("rep_high"), a.high ? "bad" : "good") +
            statCard(Math.max(0, 100 - a.high * 3 - (a.total - a.high)) + "%", t("dash_compliance"), "") + "</div>" +
            '<div class="grid two">' +
            '<div class="card"><h3>' + esc(t("dash_by_type")) + "</h3>" + barTable(a.byType) + "</div>" +
            '<div class="card"><h3>' + esc(t("rep_by_cam")) + "</h3>" + barTable(a.byCam) + "</div></div>" +
            '<div class="card"><h3>' + esc(t("rep_by_day")) + "</h3>" + barTable(a.byDay, true) + "</div>";
    }
    function barTable(map, sortKey) {
        var keys = Object.keys(map);
        if (!keys.length) return '<p class="muted">' + esc(t("dash_empty")) + "</p>";
        keys.sort(sortKey ? undefined : function (x, y) { return map[y] - map[x]; });
        var maxN = Math.max.apply(null, keys.map(function (k) { return map[k]; }));
        return keys.map(function (k) {
            var label = TYPE_KEY[k] ? typeLabel(k) : k;
            return '<div class="bar-row"><span class="bar-label">' + esc(label) + "</span>" +
                '<div class="bar"><div class="bar-fill" style="width:' + (map[k] / maxN * 100) + '%"></div></div>' +
                '<span class="bar-n">' + map[k] + "</span></div>";
        }).join("");
    }
    async function repPdf() {
        var a = await repAggregate();
        var lang = window.miaI18n.getLang();
        var org = st().org;
        var rowsHtml = function (map) {
            return Object.keys(map).sort(function (x, y) { return map[y] - map[x]; }).map(function (k) {
                var label = TYPE_KEY[k] ? typeLabel(k) : k;
                return "<tr><td>" + esc(label) + "</td><td style='text-align:right'>" + map[k] + "</td></tr>";
            }).join("");
        };
        var html = "<!doctype html><html><head><meta charset='utf-8'><style>" +
            "body{font-family:-apple-system,Helvetica,sans-serif;color:#111;margin:40px}" +
            "h1{font-size:20px;border-bottom:3px solid #F5A300;padding-bottom:8px}" +
            "h2{font-size:14px;margin-top:24px}table{width:100%;border-collapse:collapse;font-size:12px}" +
            "td,th{border:1px solid #ddd;padding:6px 8px;text-align:left}" +
            ".meta{color:#666;font-size:11px}.kpi{display:inline-block;margin-right:28px;font-size:13px}" +
            ".kpi b{font-size:22px;display:block}</style></head><body>" +
            "<h1>MIA — " + esc(t("rep_title")) + "</h1>" +
            "<p class='meta'>" + esc(org ? org.name : "") + " · " + esc(t("rep_period")) + ": " + a.days +
            (lang === "tr" ? " gün" : " days") + " · " + esc(new Date().toLocaleString(lang === "tr" ? "tr-TR" : "en-GB")) +
            " · MIA AI Safety Intelligence v0.2.0</p>" +
            "<div><span class='kpi'><b>" + a.total + "</b>" + esc(t("rep_total_events")) + "</span>" +
            "<span class='kpi'><b>" + a.high + "</b>" + esc(t("rep_high")) + "</span>" +
            "<span class='kpi'><b>" + Math.max(0, 100 - a.high * 3 - (a.total - a.high)) + "%</b>" + esc(t("dash_compliance")) + "</span></div>" +
            "<p class='meta'>" + esc(t("rep_compliance_note")) + "</p>" +
            "<h2>" + esc(t("dash_by_type")) + "</h2><table>" + (rowsHtml(a.byType) || "") + "</table>" +
            "<h2>" + esc(t("rep_by_cam")) + "</h2><table>" + (rowsHtml(a.byCam) || "") + "</table>" +
            "<h2>" + esc(t("rep_by_day")) + "</h2><table>" +
            Object.keys(a.byDay).sort().map(function (d) {
                return "<tr><td>" + esc(d) + "</td><td style='text-align:right'>" + a.byDay[d] + "</td></tr>";
            }).join("") + "</table>" +
            "<p class='meta'>" + esc(t("set_privacy")) + "</p></body></html>";
        var r = await window.mia.reportPdf({ html: html,
            filename: "mia-rapor-" + new Date().toISOString().slice(0, 10) + ".pdf" });
        if (r.ok) window.miaCore.toast(t("exported"), "ok");
        else if (!r.canceled) window.miaCore.toast(r.error || t("error_generic"), "err");
    }

    // ================= AYARLAR ==================================================
    async function renderSettings(root) {
        var s = st().settings;
        root.innerHTML = '<h1>' + esc(t("set_title")) + '</h1><div class="card" style="max-width:620px">' +
            "<label>" + esc(t("set_lang")) + "</label>" +
            sel("setLang", [["tr", "Türkçe"], ["en", "English"]]) +
            "<label>" + esc(t("set_engine")) + "</label>" +
            sel("setEngine", [["onnx", t("set_engine_onnx")], ["hybrid", t("set_engine_hybrid")], ["cloud", t("set_engine_cloud")]]) +
            '<p class="muted small">' + esc(t("set_engine_note")) + "</p>" +
            "<label>" + esc(t("set_conf")) + ': <b id="confVal">' + Math.round(s.confidence * 100) + '%</b></label>' +
            '<input id="setConf" type="range" min="20" max="80" value="' + Math.round(s.confidence * 100) + '">' +
            "<label>" + esc(t("set_interval")) + "</label>" +
            sel("setInterval", [["0.5", "0.5 (hızlı)"], ["1", "1"], ["2", "2"], ["5", "5"], ["10", "10"]]) +
            "<h3>" + esc(t("set_profile")) + "</h3>" +
            chk("pHelmet", t("set_helmet"), s.profile.helmet) +
            chk("pVest", t("set_vest"), s.profile.safety_vest) +
            chk("pMask", t("set_mask") + " (experimental)", s.profile.mask) +
            '<p class="muted small">' + esc(t("set_profile_note")) + "</p>" +
            "<h3>" + esc(t("set_collect")) + "</h3>" +
            chk("pCollect", t("set_collect"), s.dataCollect) +
            '<p class="muted small">' + esc(t("set_collect_note")) + "</p>" +
            '<p class="muted small"><span id="dsCount">—</span> ' +
            '<button id="dsOpen" class="btn btn-sm">' + esc(t("set_collect_open")) + "</button></p>" +
            '<p class="muted small">🔒 ' + esc(t("set_privacy")) + "</p>" +
            '<button id="setSave" class="btn btn-primary">' + esc(t("cam_save")) + "</button>" +
            '<h3>' + esc(t("set_about")) + '</h3><p class="muted small" id="aboutBox"></p></div>';
        $("#setLang").value = s.lang;
        $("#setEngine").value = s.engine;
        $("#setInterval").value = String(s.intervalSec);
        $("#setConf").addEventListener("input", function () { $("#confVal").textContent = this.value + "%"; });
        window.mia.datasetStats().then(function (r) {
            $("#dsCount").textContent = t("set_collect_count") + ": " + (r.count || 0);
        });
        $("#dsOpen").addEventListener("click", function () { window.mia.datasetOpen(); });
        window.mia.version().then(function (v) {
            var info = window.miaDetect.info();
            $("#aboutBox").textContent = "MIA AI Safety Intelligence v" + v +
                " · model: mia-ppe-yolov8s (10 sınıf) · " + (info.ready ? "backend: " + info.backend : "");
        });
        $("#setSave").addEventListener("click", async function () {
            s.lang = $("#setLang").value;
            s.engine = $("#setEngine").value;
            s.confidence = parseInt($("#setConf").value, 10) / 100;
            s.intervalSec = parseFloat($("#setInterval").value) || 1;
            s.profile.helmet = $("#pHelmet").checked;
            s.profile.safety_vest = $("#pVest").checked;
            s.profile.mask = $("#pMask").checked;
            s.dataCollect = $("#pCollect").checked;
            await window.miaCore.saveSettings();
            window.miaI18n.setLang(s.lang);
            window.miaApp.renderChrome();
            window.miaCore.toast(t("saved"), "ok");
            window.miaApp.nav("settings");
        });
    }
    function chk(id, label, on) {
        return '<label class="chk"><input type="checkbox" id="' + id + '"' + (on ? " checked" : "") + "> " + esc(label) + "</label>";
    }

    window.miaViews = {
        login: renderLogin, dashboard: renderDashboard, live: renderLive,
        detection: renderDetection,
        cameras: renderCameras, events: renderEvents, reports: renderReports, settings: renderSettings
    };
})();
