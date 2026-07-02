// === MIA Masaüstü — Uygulama Kabuğu / Yönlendirici (Faz 23 görsel yenileme) ===
// DAVRANIŞ AYNI: aynı görünümler, aynı oturum/nav akışı. Yalnız sunum değişti:
// gruplu kenar çubuğu + premium üst bar (org, motor durumu, saat, kullanıcı).
(function () {
    "use strict";
    var t = function (k) { return window.miaI18n.t(k); };
    var esc = function (s) { return window.miaCore.esc(s); };

    // Gruplu navigasyon — route'lar birebir eski view adları.
    var NAV_GROUPS = [
        { label: "nav_g_overview", items: [["dashboard", "nav_dashboard", "▦"]] },
        { label: "nav_g_ops", items: [
            ["live", "nav_live", "◉"], ["detection", "nav_detection", "◈"],
            ["events", "nav_events", "⚠"], ["reports", "nav_reports", "▥"]
        ] },
        { label: "nav_g_field", items: [["cameras", "nav_cameras", "▤"]] },
        { label: "nav_g_admin", items: [["settings", "nav_settings", "⚙"]] }
    ];
    var current = "dashboard";
    var clockTimer = null;

    function renderChrome() {
        var st = window.miaCore.state;

        // ---- Kenar çubuğu -----------------------------------------------------
        var side = document.getElementById("sidebar");
        side.innerHTML =
            '<div class="brand"><img src="images/logo-horizontal-trim.png" alt="MIA" class="brand-img" ' +
            'onerror="this.outerHTML=\'<span class=brand-mark>M I A</span>\'"></div>' +
            '<nav>' + NAV_GROUPS.map(function (g) {
                return '<div class="nav-group">' + esc(t(g.label)) + "</div>" +
                    g.items.map(function (n) {
                        return '<a href="#" data-nav="' + n[0] + '" class="' + (n[0] === current ? "active" : "") + '">' +
                            "<i>" + n[2] + "</i>" + esc(t(n[1])) + "</a>";
                    }).join("");
            }).join("") + "</nav>" +
            '<div class="side-foot">' +
            '<div class="sys"><span class="dot" id="sideSysDot"></span><span id="sideSysTxt">' + esc(t("sys_operational")) + "</span></div>" +
            '<div class="ver" id="sideVer">MIA Desktop</div>' +
            '<div id="netState" class="small" style="color:var(--orange)"></div></div>';
        side.querySelectorAll("[data-nav]").forEach(function (a) {
            a.addEventListener("click", function (e) { e.preventDefault(); nav(a.getAttribute("data-nav")); });
        });
        window.mia.version().then(function (v) {
            var el = document.getElementById("sideVer");
            if (el) el.textContent = "MIA Desktop v" + v;
        });

        // ---- Üst bar ------------------------------------------------------------
        var top = document.getElementById("topbar");
        top.style.display = "";
        top.innerHTML =
            '<div class="tb-org">' +
            (st.orgs.length > 1
                ? '<select id="orgSel" style="max-width:220px">' + st.orgs.map(function (o) {
                    return '<option value="' + esc(o.id) + '"' + (st.org && o.id === st.org.id ? " selected" : "") + ">" +
                        esc(o.name) + "</option>";
                }).join("") + "</select>"
                : "<b>" + esc(st.org ? st.org.name : "") + "</b>") +
            (st.role ? '<span class="tb-role">' + esc(st.role) + "</span>" : "") +
            "</div>" +
            '<span class="tb-pill" id="tbEngine"><span class="dot"></span><span>' + esc(t("engine_loading")) + "</span></span>" +
            '<span class="tb-spacer"></span>' +
            '<div class="tb-clock"><b id="tbTime">--:--:--</b><span id="tbDate"></span></div>' +
            '<div class="tb-user">' +
            '<span class="tb-avatar">' + esc((st.user && st.user.email || "?").slice(0, 2).toUpperCase()) + "</span>" +
            '<span class="mail">' + esc(st.user ? st.user.email : "") + "</span>" +
            '<a href="#" class="tb-logout" id="logout">' + esc(t("logout")) + "</a></div>";

        var orgSel = document.getElementById("orgSel");
        if (orgSel) orgSel.addEventListener("change", function () {
            window.miaCore.setOrg(orgSel.value); nav(current);
        });
        document.getElementById("logout").addEventListener("click", async function (e) {
            e.preventDefault();
            window.miaSources.stopAll();
            await window.miaCore.client.auth.signOut();
            showLogin();
        });

        // Saat (yalnız sunum)
        clearInterval(clockTimer);
        var tick = function () {
            var d = new Date(), lang = window.miaI18n.getLang() === "tr" ? "tr-TR" : "en-GB";
            var te = document.getElementById("tbTime"), de = document.getElementById("tbDate");
            if (te) te.textContent = d.toLocaleTimeString(lang);
            if (de) de.textContent = d.toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric", weekday: "long" });
        };
        clockTimer = setInterval(tick, 1000); tick();

        // Motor durumu rozeti (gerçek durum — miaDetect.init sonucu)
        window.miaDetect.init().then(function (info) {
            var el = document.getElementById("tbEngine");
            if (!el) return;
            if (info.ready) {
                el.className = "tb-pill ok";
                el.innerHTML = '<span class="dot"></span><span>' + esc(t("engine_ready")) + " · " + esc(info.backend) + "</span>";
            } else {
                el.className = "tb-pill warn";
                el.title = info.error || "";
                el.innerHTML = '<span class="dot"></span><span>' + esc(t("engine_error")) + "</span>";
                var sd = document.getElementById("sideSysDot"), sx = document.getElementById("sideSysTxt");
                if (sd) sd.className = "dot warn";
                if (sx) sx.textContent = t("sys_degraded");
            }
        });
        updateNet();
    }

    function updateNet() {
        var el = document.getElementById("netState");
        if (el) el.textContent = navigator.onLine ? "" : t("offline_note");
    }
    window.addEventListener("online", updateNet);
    window.addEventListener("offline", updateNet);

    function nav(view) {
        // Canlı izlemeden ayrılırken kaynaklar durdurulur (DOM'suz tile karmaşası önlenir).
        if (view !== "live" && window.miaSources.count() > 0 && current === "live") {
            window.miaSources.stopAll();
        }
        current = view;
        document.querySelectorAll("#sidebar [data-nav]").forEach(function (a) {
            a.className = a.getAttribute("data-nav") === view ? "active" : "";
        });
        var main = document.getElementById("main");
        main.innerHTML = "";
        var fn = window.miaViews[view];
        if (fn) Promise.resolve(fn(main)).catch(function (e) {
            main.innerHTML = '<p class="muted">' + esc(String(e && e.message || e)) + "</p>";
        });
    }

    function showLogin() {
        clearInterval(clockTimer);
        document.getElementById("sidebar").innerHTML = "";
        document.getElementById("sidebar").style.display = "none";
        document.getElementById("topbar").style.display = "none";
        window.miaViews.login(document.getElementById("main"));
    }

    async function onAuthed() {
        var st = window.miaCore.state;
        var s = await window.miaCore.getSession();
        if (!s) { showLogin(); return; }
        st.user = s.user;
        await window.miaCore.resolveOrgs();
        if (!st.org) {
            document.getElementById("main").innerHTML =
                '<div class="login-wrap"><div class="login-card"><h2>MIA</h2><p class="login-hint">' + esc(t("login_no_org")) + "</p>" +
                '<button class="btn" onclick="location.reload()">↻</button></div></div>';
            return;
        }
        document.getElementById("sidebar").style.display = "";
        renderChrome();
        // Olay kuyruğu boşaltıcıyı başlat + AI modelini arkada ısıt
        window.miaEvents.startFlusher(window.miaCore.authHeaders);
        window.miaDetect.init();
        nav("dashboard");
    }

    async function boot() {
        await window.miaCore.loadSettings();
        var s = await window.miaCore.getSession();
        if (s) onAuthed(); else showLogin();
    }

    window.miaApp = { nav: nav, onAuthed: onAuthed, renderChrome: renderChrome };
    document.addEventListener("DOMContentLoaded", boot);
})();
