// === MIA Müşteri Uygulaması — Kabuk (Faz 17) ===
// Ayrı uygulama deneyimi: sol menü + üst bar + oturum koruması + org seçici.
// Web sitesinden bağımsız görsel sistem; auth AYNI Supabase (web hesabı geçerli).
// Kullanım: body.mia-app data-app-page="dashboard" + <div id="appShell"></div>

(function () {
    var page = document.body.getAttribute("data-app-page");
    var root = document.getElementById("appShell");
    if (!page || !root) return;
    var esc = window.miaEsc || function (s) { return String(s == null ? "" : s); };

    // --- Oturum koruması: yoksa app girişine ---
    supabase.auth.getSession().then(function (r) {
        if (!r.data.session) {
            window.location.href = "/app/login?next=" + encodeURIComponent("/app/" + page);
            return;
        }
        boot(r.data.session.user);
    });

    var NAV = [
        ["dashboard", "/app/dashboard", "Dashboard", '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'],
        ["cameras", "/app/cameras", "Canlı Kameralar", '<path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>'],
        ["detections", "/app/detections", "AI Tespit", '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.2 2.2M16.9 16.9l2.2 2.2M19.1 4.9l-2.2 2.2M7.1 16.9l-2.2 2.2"/>'],
        ["events", "/app/events", "Olaylar", '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'],
        ["reports", "/app/reports", "Raporlar", '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>'],
        ["sites", "/app/sites", "Sahalar", '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/>'],
        ["team", "/app/team", "Takım", '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'],
        ["settings", "/app/settings", "Ayarlar", '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>']
    ];

    function icon(d) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + "</svg>";
    }

    function boot(user) {
        root.innerHTML =
            '<aside class="app-side">' +
              '<div class="brand"><img src="/images/logo-square.webp" alt="MIA" onerror="this.src=\'/images/logo-square.png\'">' +
              '<div><b style="font-size:1.05rem;letter-spacing:.14em;">MIA</b><small>AI Safety Intelligence</small></div></div>' +
              '<nav class="app-nav">' +
                '<div class="sec">Operasyon</div>' +
                NAV.slice(0, 5).map(navLink).join("") +
                '<div class="sec">Yönetim</div>' +
                NAV.slice(5).map(navLink).join("") +
              "</nav>" +
              '<div class="foot">v0.1.0-pilot · <span id="ashHealth">sistem durumu…</span></div>' +
            "</aside>" +
            '<div class="app-body"><header class="app-top">' +
              '<div class="orgbox"><b id="ashOrgName">—</b><span id="ashOrgRole"></span></div>' +
              '<select class="orgsel" id="ashOrgSel" style="display:none;"></select>' +
              '<div class="grow"></div>' +
              '<div class="sys" id="ashSys"><span class="dot unk"></span>Sistem</div>' +
              '<div class="clock"><span id="ashClock">--:--:--</span><small id="ashDate"></small></div>' +
              '<span class="uemail" id="userEmail"></span>' +
              '<button type="button" id="navLogout" class="btn btn-secondary btn-sm">Çıkış</button>' +
            '</header><main class="app-main" id="appMain"></main></div>';

        // sayfa içeriğini main'e taşı
        var tpl = document.getElementById("appContent");
        if (tpl) document.getElementById("appMain").appendChild(tpl), tpl.style.display = "";

        // e-posta + çıkış
        var em = document.getElementById("userEmail"); if (em) em.textContent = user.email || "";
        var lo = document.getElementById("navLogout");
        if (lo) lo.onclick = function () {
            supabase.auth.signOut().then(function () { window.location.href = "/app/login"; });
        };

        // saat
        function tick() {
            var d = new Date();
            document.getElementById("ashClock").textContent = d.toLocaleTimeString("tr-TR");
            document.getElementById("ashDate").textContent = d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });
        }
        tick(); setInterval(tick, 1000);

        // sistem durumu (gerçek /api/health — sahte "çevrimiçi" yok)
        fetch("/api/health").then(function (x) { return x.ok ? x.json() : null; }).then(function (h) {
            var ok = h && h.health === "healthy";
            var sys = document.getElementById("ashSys");
            sys.innerHTML = '<span class="dot ' + (ok ? "on" : h ? "deg" : "off") + '"></span>Sistem: ' + (ok ? "Çevrimiçi" : h ? "Sorunlu" : "Erişilemiyor");
            var w = h && h.checks && h.checks.realtime_worker === "connected";
            document.getElementById("ashHealth").textContent = w ? "worker bağlı" : "worker bağlı değil";
        }).catch(function () {
            document.getElementById("ashSys").innerHTML = '<span class="dot off"></span>Sistem: Erişilemiyor';
        });

        // org bağlamı + switcher (aynı MIAOrg)
        var go = function () {
            var ROLE = { owner: "Sahip", admin: "Yönetici", safety_manager: "İSG Uzmanı", viewer: "İzleyici" };
            var cur = window.MIAOrg && window.MIAOrg.current();
            document.getElementById("ashOrgName").textContent = cur ? cur.name : "Kişisel Alan";
            document.getElementById("ashOrgRole").textContent = ROLE[window.MIAOrg && window.MIAOrg.role()] || "";
            var orgs = (window.MIAOrg && window.MIAOrg.orgs()) || [];
            if (orgs.length > 1) {
                var sel = document.getElementById("ashOrgSel");
                sel.style.display = "";
                sel.innerHTML = orgs.map(function (o) {
                    return '<option value="' + o.org.id + '"' + (cur && o.org.id === cur.id ? " selected" : "") + ">" + esc(o.org.name) + "</option>";
                }).join("");
                sel.onchange = function () { window.MIAOrg.switchTo(sel.value); location.reload(); };
            }
            document.dispatchEvent(new CustomEvent("mia-app-ready", { detail: { user: user } }));
        };
        if (window.MIAOrg && window.MIAOrg.ready) window.MIAOrg.ready.then(go); else go();
    }

    function navLink(n) {
        return '<a href="' + n[1] + '"' + (n[0] === page ? ' class="on"' : "") + ">" + icon(n[3]) + "<span>" + n[2] + "</span></a>";
    }
})();
