// === MIA Masaüstü — Uygulama Kabuğu / Yönlendirici ===
(function () {
    "use strict";
    var t = function (k) { return window.miaI18n.t(k); };
    var esc = function (s) { return window.miaCore.esc(s); };

    var NAV = [
        ["dashboard", "nav_dashboard", "▦"], ["live", "nav_live", "◉"], ["cameras", "nav_cameras", "▤"],
        ["events", "nav_events", "⚠"], ["reports", "nav_reports", "▥"], ["settings", "nav_settings", "⚙"]
    ];
    var current = "dashboard";

    function renderChrome() {
        var st = window.miaCore.state;
        var side = document.getElementById("sidebar");
        side.innerHTML =
            '<div class="brand">M I A<span>AI SAFETY INTELLIGENCE</span></div>' +
            '<nav>' + NAV.map(function (n) {
                return '<a href="#" data-nav="' + n[0] + '" class="' + (n[0] === current ? "active" : "") + '">' +
                    '<i>' + n[2] + "</i>" + esc(t(n[1])) + "</a>";
            }).join("") + "</nav>" +
            '<div class="side-foot">' +
            (st.orgs.length > 1
                ? '<select id="orgSel">' + st.orgs.map(function (o) {
                    return '<option value="' + esc(o.id) + '"' + (st.org && o.id === st.org.id ? " selected" : "") + ">" +
                        esc(o.name) + "</option>";
                }).join("") + "</select>"
                : '<div class="org-name">' + esc(st.org ? st.org.name : "") + "</div>") +
            '<div class="muted small">' + esc(st.user ? st.user.email : "") + "</div>" +
            '<a href="#" id="logout" class="muted small">' + esc(t("logout")) + "</a>" +
            '<div id="netState" class="muted small"></div></div>';
        side.querySelectorAll("[data-nav]").forEach(function (a) {
            a.addEventListener("click", function (e) { e.preventDefault(); nav(a.getAttribute("data-nav")); });
        });
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
        updateNet();
    }

    function updateNet() {
        var el = document.getElementById("netState");
        if (el) el.textContent = navigator.onLine ? "" : t("offline_note");
    }
    window.addEventListener("online", updateNet);
    window.addEventListener("offline", updateNet);

    function nav(view) {
        // Canlı izlemeden ayrılırken kaynaklar ÇALIŞMAYA DEVAM EDER (arka plan izleme);
        // yalnız kullanıcı Durdur derse veya çıkış yaparsa durur.
        if (view !== "live" && window.miaSources.count() > 0 && current === "live") {
            window.miaSources.stopAll(); // v1: görünüm dışı izleme kapalı — DOM'suz tile karmaşası önlenir
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
        document.getElementById("sidebar").innerHTML = "";
        document.getElementById("sidebar").style.display = "none";
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
                '<div class="login-wrap"><div class="login-card"><h2>MIA</h2><p>' + esc(t("login_no_org")) + "</p>" +
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
