// === MIA — Organizasyon Bağlamı (Faz 5) ===
// Kullanıcının org üyeliklerini yükler, seçili org'u yönetir (localStorage),
// üyeliği yoksa otomatik kişisel organizasyon açar. Sayfa scriptleri
// window.MIAOrg.ready (Promise) ile bekleyip currentId()/role() kullanır.
// org.js YOKSA veya migration koşulmadıysa her şey eski user_id akışıyla çalışır.

(function () {
    var O = (window.MIAOrg = window.MIAOrg || {});
    var state = { orgs: [], current: null, role: null, user: null, available: true };

    function lsGet() { try { return localStorage.getItem("mia_org"); } catch (e) { return null; } }
    function lsSet(v) { try { v ? localStorage.setItem("mia_org", v) : localStorage.removeItem("mia_org"); } catch (e) {} }

    O.currentId = function () { return state.current ? state.current.id : null; };
    O.current = function () { return state.current; };
    O.orgs = function () { return state.orgs; };
    O.role = function () { return state.role; };
    O.isAvailable = function () { return state.available; };
    O.can = function (action) {
        // UI rehberi (gerçek yaptırım RLS'te): roles → izinler
        var r = state.role || "owner"; // org yoksa kişisel alan = tam yetki (legacy)
        var P = {
            owner:          { upload: 1, del: 1, invite: 1, manage_org: 1, pilot: 1, weekly: 1 },
            admin:          { upload: 1, del: 1, invite: 1, manage_org: 1, pilot: 1, weekly: 1 },
            safety_manager: { upload: 1, del: 0, invite: 0, manage_org: 0, pilot: 0, weekly: 1 },
            viewer:         { upload: 0, del: 0, invite: 0, manage_org: 0, pilot: 0, weekly: 0 }
        };
        return !!(P[r] && P[r][action]);
    };
    O.switchTo = function (orgId) {
        var m = state.orgs.filter(function (o) { return o.org.id === orgId; })[0];
        if (!m) return false;
        state.current = m.org; state.role = m.role; lsSet(orgId);
        return true;
    };

    function defaultOrgName(user) {
        var meta = user.user_metadata || {};
        var base = meta.full_name || (user.email || "").split("@")[0] || "Çalışma Alanı";
        return base + " — Kişisel Alan";
    }

    // Üyelik yoksa kişisel org oluştur (mevcut kullanıcılar için sessiz geçiş).
    function ensurePersonalOrg(user) {
        var org = { name: defaultOrgName(user), owner_user_id: user.id };
        return supabase.from("organizations").insert(org).select().single().then(function (r) {
            if (r.error) { console.warn("[MIA] Kişisel org oluşturulamadı:", r.error.message); return null; }
            return supabase.from("organization_memberships").insert({
                org_id: r.data.id, user_id: user.id, email: user.email,
                role: "owner", status: "active", joined_at: new Date().toISOString()
            }).then(function (r2) {
                if (r2.error) { console.warn("[MIA] Owner üyeliği açılamadı:", r2.error.message); return null; }
                console.log("[MIA] Kişisel organizasyon oluşturuldu:", r.data.name);
                return { org: r.data, role: "owner" };
            });
        });
    }

    function load(user) {
        state.user = user;
        return supabase.from("organization_memberships")
            .select("role,status,org_id,organizations(id,name,slug,owner_user_id,billing_email,country,city,created_at)")
            .eq("user_id", user.id).eq("status", "active")
            .then(function (r) {
                if (r.error) {
                    // Migration henüz koşulmadı → org özelliği yok say, legacy akış sürsün.
                    console.warn("[MIA] Org tabloları yok (migration?) — user_id modunda devam:", r.error.message);
                    state.available = false;
                    return;
                }
                var rows = (r.data || []).filter(function (m) { return m.organizations; });
                state.orgs = rows.map(function (m) { return { org: m.organizations, role: m.role }; });
                if (!state.orgs.length) {
                    return ensurePersonalOrg(user).then(function (m) {
                        if (m) { state.orgs = [m]; state.current = m.org; state.role = m.role; lsSet(m.org.id); }
                    });
                }
                var saved = lsGet();
                var pick = state.orgs.filter(function (o) { return o.org.id === saved; })[0] || state.orgs[0];
                state.current = pick.org; state.role = pick.role; lsSet(pick.org.id);
            });
    }

    // ready: oturum varsa org bağlamı çözülünce; yoksa hemen.
    O.ready = (window.supabase && supabase.auth)
        ? supabase.auth.getSession().then(function (r) {
            var s = r && r.data && r.data.session;
            if (!s) return;
            return load(s.user);
        }).catch(function (e) { console.warn("[MIA] Org bağlamı hata:", e); })
        : Promise.resolve();
})();
