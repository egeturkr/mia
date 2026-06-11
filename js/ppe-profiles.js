// === MIA — KKD Tespit Profili UI (Faz 13) ===
// Firma "ne taransın?" seçer: baret/yelek/maske... Worker yalnız etkin ekipman
// ihlali üretir. requires_training ekipmanlar KİLİTLİDİR (model desteklemiyor —
// sahte vaat yok). Düzenleme: owner/admin/safety_manager; viewer salt okur.
// Tablo: ppe_detection_profiles (org varsayılan profili, is_default=true).

(function () {
    if (!document.getElementById("ppList") || !window.MIAPpeRegistry) return;
    var $ = function (id) { return document.getElementById(id); };
    var esc = window.miaEsc || function (s) { return String(s == null ? "" : s); };
    var profile = null;   // mevcut satır (varsa)
    var RISK_TR = { low: "Düşük", medium: "Orta", high: "Yüksek", critical: "Kritik" };

    function orgId() { return (window.MIAOrg && window.MIAOrg.currentId()) || null; }
    function canConfig() {
        var r = window.MIAOrg && window.MIAOrg.role();
        return r === "owner" || r === "admin" || r === "safety_manager";
    }

    function badge(status) {
        var cls = status === "supported" ? "ca-low" : status === "experimental" ? "ca-med" : "ca-high";
        return '<span class="ca-badge ' + cls + '">' + window.MIAPpeRegistry.statusLabel(status) + "</span>";
    }

    function render() {
        var req = (profile && profile.required_equipment) || { helmet: true, safety_vest: true, mask: false };
        var rules = (profile && profile.risk_rules) || {};
        var editable = canConfig();
        $("ppList").innerHTML = window.MIAPpeRegistry.all().map(function (it) {
            var locked = it.status === "requires_training";
            var on = !locked && !!req[it.key];
            var risk = rules[it.key] || it.default_risk;
            var riskSel = locked ? '<span class="ca-muted">—</span>'
                : '<select data-risk="' + it.key + '"' + (editable ? "" : " disabled") + ' style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:7px;padding:.25rem .4rem;color:var(--text-primary);font-size:.78rem;">' +
                  ["low", "medium", "high", "critical"].map(function (r) {
                      return '<option value="' + r + '"' + (r === risk ? " selected" : "") + ">" + RISK_TR[r] + "</option>";
                  }).join("") + "</select>";
            return '<tr' + (locked ? ' style="opacity:.55"' : "") + ">" +
                '<td><input type="checkbox" data-eq="' + it.key + '"' + (on ? " checked" : "") +
                ((locked || !editable) ? " disabled" : "") + "></td>" +
                "<td><b>" + esc(it.label_tr) + "</b><br><span class='ca-muted'>" + esc(it.note_tr) + "</span></td>" +
                "<td>" + badge(it.status) + "</td><td>" + riskSel + "</td></tr>";
        }).join("");
        $("ppSaveBtn").style.display = editable ? "inline-flex" : "none";
    }

    function load() {
        var oid = orgId(); if (!oid) return;
        supabase.from("ppe_detection_profiles").select("*").eq("org_id", oid)
            .eq("is_default", true).is("site_id", null).limit(1).then(function (r) {
                if (r.error) {  // tablo yok → şema hatırlatması
                    $("ppMsg").textContent = "Profil tablosu yok — supabase/schema.sql çalıştırılmalı (Blok 16).";
                } else profile = (r.data || [])[0] || null;
                render();
            });
    }

    $("ppSaveBtn").addEventListener("click", function () {
        var oid = orgId(); if (!oid || !canConfig()) return;
        var req = {}, rules = {}, enabledClasses = [];
        window.MIAPpeRegistry.all().forEach(function (it) {
            var cb = document.querySelector('[data-eq="' + it.key + '"]');
            var on = !!(cb && cb.checked && it.status !== "requires_training"); // kilitli ASLA kaydedilmez
            req[it.key] = on;
            if (on && it.violation_class) enabledClasses.push(it.violation_class);
            var rs = document.querySelector('[data-risk="' + it.key + '"]');
            if (rs) rules[it.key] = rs.value;
        });
        var row = { org_id: oid, is_default: true, site_id: null, name: "Varsayılan profil",
                    required_equipment: req, risk_rules: rules, enabled_classes: enabledClasses,
                    updated_at: new Date().toISOString() };
        var q = profile
            ? supabase.from("ppe_detection_profiles").update(row).eq("id", profile.id).select().single()
            : supabase.from("ppe_detection_profiles").insert(Object.assign({}, row, {
                  created_by: (window._ppUser && window._ppUser.id) || null })).select().single();
        q.then(function (r) {
            if (r.error) { $("ppMsg").textContent = " Kaydedilemedi: " + r.error.message; return; }
            profile = r.data;
            $("ppMsg").textContent = " ✓ Kaydedildi. Worker bir sonraki başlatmada yeni profili kullanır.";
            if (window.MIAMonitor) window.MIAMonitor.event("ppe_profile_saved", { enabled: enabledClasses.length });
        });
    });

    supabase.auth.getSession().then(function (r) {
        if (!r.data.session) return;
        window._ppUser = r.data.session.user;
        var go = function () { load(); };
        if (window.MIAOrg && window.MIAOrg.ready) window.MIAOrg.ready.then(go); else go();
    });
})();
