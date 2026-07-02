// === MIA Masaüstü — Çekirdek: Supabase istemcisi + oturum + org bağlamı ===
// URL/anon key js/app-core.js (web) ile SENKRON — anon key istemci-güvenlidir.
// Oturum, tarayıcı localStorage yerine ana süreç deposunda saklanır (IPC adaptör)
// → uygulama yeniden açılınca oturum kalıcıdır.
(function () {
    "use strict";

    var SUPABASE_URL = "https://qojtokomfcporcglrsdy.supabase.co";
    var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvanRva29tZmNwb3JjZ2xyc2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5ODM2MDQsImV4cCI6MjA5NTU1OTYwNH0.nQarNqVxI5JPInisVPvNZXOQmAWr5Nt0tRMHqKRXiwM";

    // IPC destekli senkron-görünümlü storage adaptörü: supabase-js async storage kabul eder.
    var ipcStorage = {
        getItem: function (k) { return window.mia.storeGet("sb:" + k).then(function (v) { return v == null ? null : v; }); },
        setItem: function (k, v) { return window.mia.storeSet("sb:" + k, v); },
        removeItem: function (k) { return window.mia.storeSet("sb:" + k, null); }
    };

    var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false,
                storageKey: "mia.desktop.auth", storage: ipcStorage }
    });

    var state = { user: null, org: null, orgs: [], role: null, settings: null };

    var DEFAULT_SETTINGS = {
        lang: "tr", engine: "hybrid",   // MIA cihaz üstü BİRİNCİL; motor açılamazsa bulut devreye girer (kesintisiz tespit)
        confidence: 0.4, intervalSec: 1,   // adaptif döngü üst sınırı — donanım hızlıysa daha sık
        dataCollect: false,             // saha veri toplama (KVKK: varsayılan KAPALI)
        profile: { helmet: true, safety_vest: true, mask: false }
    };

    async function loadSettings() {
        var s = (await window.mia.storeGet("settings")) || {};
        state.settings = Object.assign({}, DEFAULT_SETTINGS, s,
            { profile: Object.assign({}, DEFAULT_SETTINGS.profile, s.profile || {}) });
        window.miaI18n.setLang(state.settings.lang);
        return state.settings;
    }
    function saveSettings() { return window.mia.storeSet("settings", state.settings); }

    async function getSession() {
        var r = await client.auth.getSession();
        return r.data ? r.data.session : null;
    }

    // MIA API çağrıları için kimlik başlıkları (Bearer + org bağlamı)
    async function authHeaders() {
        var s = await getSession();
        if (!s) return null;
        var h = { Authorization: "Bearer " + s.access_token };
        if (state.org) h["x-mia-org"] = state.org.id;
        return h;
    }

    // Org üyeliklerini çöz — web'deki organization_memberships şemasıyla aynı.
    async function resolveOrgs() {
        var u = state.user;
        if (!u) return [];
        var r = await client.from("organization_memberships")
            .select("org_id, role, status, organizations(id, name)")
            .eq("user_id", u.id).eq("status", "active");
        if (r.error) return [];
        state.orgs = (r.data || []).filter(function (m) { return m.organizations; }).map(function (m) {
            return { id: m.org_id, name: m.organizations.name, role: m.role };
        });
        // Son seçilen org'u hatırla
        var savedOrg = await window.mia.storeGet("selectedOrg");
        state.org = state.orgs.find(function (o) { return o.id === savedOrg; }) || state.orgs[0] || null;
        state.role = state.org ? state.org.role : null;
        return state.orgs;
    }

    function setOrg(id) {
        state.org = state.orgs.find(function (o) { return o.id === id; }) || state.org;
        state.role = state.org ? state.org.role : null;
        window.mia.storeSet("selectedOrg", id);
    }

    // HTML kaçışı (XSS koruması — dinamik içerik HER ZAMAN bundan geçer)
    function esc(s) {
        return String(s == null ? "" : s).replace(/[<>&"']/g, function (c) {
            return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    // Toast bildirimi
    var toastTimer = null;
    function toast(msg, kind) {
        var el = document.getElementById("toast");
        if (!el) return;
        el.textContent = msg;
        el.className = "toast show " + (kind || "info");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { el.className = "toast"; }, 3500);
    }

    window.miaCore = {
        client: client, state: state,
        loadSettings: loadSettings, saveSettings: saveSettings,
        getSession: getSession, authHeaders: authHeaders,
        resolveOrgs: resolveOrgs, setOrg: setOrg,
        esc: esc, toast: toast
    };
})();
