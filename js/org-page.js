// === MIA — Organizasyon Yönetim Sayfası (Faz 5) ===
// Üyeler, davetler, sahalar, org bilgileri. UI kısıtları MIAOrg.can() ile;
// gerçek yaptırım RLS'te (UI atlatılsa bile sunucu reddeder).

(function () {
    if (!document.getElementById("ogInfoCard")) return;
    var $ = function (id) { return document.getElementById(id); };
    var user = null;
    var ROLE_TR = { owner: "Owner", admin: "Admin", safety_manager: "İSG Uzmanı", viewer: "İzleyici" };
    var ROLE_CLS = { owner: "og-owner", admin: "og-admin", safety_manager: "og-sm", viewer: "og-viewer" };

    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function fmtDate(d) { return d ? new Date(d).toLocaleDateString("tr-TR") : "—"; }
    function orgId() { return window.MIAOrg.currentId(); }
    function myRole() { return window.MIAOrg.role(); }
    function isMgr() { return myRole() === "owner" || myRole() === "admin"; }

    // ---- Org bilgisi + switcher ----
    function renderInfo() {
        var o = window.MIAOrg.current();
        if (!o) { $("ogInfo").textContent = "Organizasyon bulunamadı — migration koşuldu mu?"; return; }
        $("ogInfo").innerHTML =
            "<b style='color:var(--text-primary);font-size:1.05rem;'>" + esc(o.name) + "</b><br>" +
            "Rolünüz: <b>" + (ROLE_TR[myRole()] || myRole()) + "</b> · Fatura: " + esc(o.billing_email || "—") +
            " · " + esc(o.city || "—") + " · Kuruluş: " + fmtDate(o.created_at);
        if (isMgr()) {
            $("ogEditRow").style.display = "flex";
            $("ogName").value = o.name || ""; $("ogBillingEmail").value = o.billing_email || ""; $("ogCity").value = o.city || "";
        }
        var orgs = window.MIAOrg.orgs();
        if (orgs.length > 1) {
            $("ogSwitch").style.display = "flex";
            $("ogSelect").innerHTML = orgs.map(function (m) {
                return '<option value="' + m.org.id + '"' + (m.org.id === o.id ? " selected" : "") + '>' + esc(m.org.name) + ' (' + (ROLE_TR[m.role]) + ')</option>';
            }).join("");
        }
        $("ogInviteCard").style.display = window.MIAOrg.can("invite") ? "block" : "none";
        $("ogSiteForm").style.display = isMgr() ? "flex" : "none";
        // Admin yalnızca owner ise admin davet edebilir
        if ($("ogInvAdminOpt")) $("ogInvAdminOpt").style.display = myRole() === "owner" ? "" : "none";
    }
    $("ogSelect") && $("ogSelect").addEventListener("change", function () {
        window.MIAOrg.switchTo($("ogSelect").value);
        renderInfo(); loadMembers(); loadInvites(); loadSites();
    });
    $("ogSaveBtn").addEventListener("click", function () {
        supabase.from("organizations").update({
            name: $("ogName").value.trim() || window.MIAOrg.current().name,
            billing_email: $("ogBillingEmail").value.trim() || null,
            city: $("ogCity").value.trim() || null,
            updated_at: new Date().toISOString()
        }).eq("id", orgId()).then(function (r) {
            if (r.error) { alert("Kaydedilemedi: " + r.error.message); return; }
            var o = window.MIAOrg.current();
            o.name = $("ogName").value.trim() || o.name;
            o.billing_email = $("ogBillingEmail").value.trim(); o.city = $("ogCity").value.trim();
            renderInfo();
        });
    });

    // ---- Üyeler ----
    function loadMembers() {
        supabase.from("organization_memberships").select("*").eq("org_id", orgId())
            .neq("status", "removed").order("created_at").then(function (r) {
                if (r.error) { $("ogMembers").textContent = "Üyeler yüklenemedi: " + r.error.message; return; }
                var rows = r.data || [];
                var owners = rows.filter(function (m) { return m.role === "owner" && m.status === "active"; }).length;
                var html = '<table class="og-tbl"><thead><tr><th>E-posta</th><th>Rol</th><th>Durum</th><th>Katılım</th>' + (isMgr() ? "<th></th>" : "") + '</tr></thead><tbody>';
                rows.forEach(function (m) {
                    var canEdit = isMgr() && m.user_id !== user.id &&
                        !(myRole() === "admin" && (m.role === "owner" || m.role === "admin")) &&
                        !(m.role === "owner" && owners <= 1);
                    var roleCell = canEdit
                        ? '<select data-role-for="' + m.id + '" style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:7px;padding:.25rem .4rem;color:var(--text-primary);font:inherit;font-size:.8rem;">' +
                          ["viewer","safety_manager","admin","owner"].map(function (rr) {
                              if (rr === "owner" && myRole() !== "owner") return "";
                              if (rr === "admin" && myRole() !== "owner") return "";
                              return '<option value="' + rr + '"' + (m.role === rr ? " selected" : "") + '>' + ROLE_TR[rr] + '</option>';
                          }).join("") + '</select>'
                        : '<span class="og-badge ' + ROLE_CLS[m.role] + '">' + ROLE_TR[m.role] + '</span>';
                    html += "<tr><td>" + esc(m.email || m.user_id.slice(0, 8)) + (m.user_id === user.id ? " <span class='og-muted'>(siz)</span>" : "") + "</td>" +
                        "<td>" + roleCell + "</td><td>" + (m.status === "active" ? "Aktif" : m.status) + "</td><td>" + fmtDate(m.joined_at || m.created_at) + "</td>" +
                        (isMgr() ? "<td>" + (canEdit ? '<button type="button" class="btn btn-danger btn-sm" data-remove="' + m.id + '">Çıkar</button>' : "") + "</td>" : "") + "</tr>";
                });
                $("ogMembers").innerHTML = html + "</tbody></table>";
                Array.prototype.forEach.call($("ogMembers").querySelectorAll("[data-role-for]"), function (sel) {
                    sel.addEventListener("change", function () {
                        supabase.from("organization_memberships").update({ role: sel.value, updated_at: new Date().toISOString() })
                            .eq("id", sel.getAttribute("data-role-for")).then(function (r2) {
                                if (r2.error) { alert("Rol değiştirilemedi: " + r2.error.message); }
                                loadMembers();
                            });
                    });
                });
                Array.prototype.forEach.call($("ogMembers").querySelectorAll("[data-remove]"), function (b) {
                    b.addEventListener("click", function () {
                        if (!confirm("Üye organizasyondan çıkarılsın mı?")) return;
                        supabase.from("organization_memberships").update({ status: "removed", updated_at: new Date().toISOString() })
                            .eq("id", b.getAttribute("data-remove")).then(function (r2) {
                                if (r2.error) alert("Çıkarılamadı: " + r2.error.message);
                                loadMembers();
                            });
                    });
                });
            });
    }

    // ---- Davetler ----
    function inviteLink(token) {
        return location.origin + location.pathname.replace(/[^/]*$/, "") + "accept-invite.html?token=" + token;
    }
    $("ogInvBtn").addEventListener("click", function () {
        var email = $("ogInvEmail").value.trim().toLowerCase();
        if (!email || email.indexOf("@") === -1) { $("ogInvMsg").textContent = "Geçerli bir e-posta gir."; return; }
        supabase.from("organization_invitations").insert({
            org_id: orgId(), email: email, role: $("ogInvRole").value, invited_by: user.id
        }).select().single().then(function (r) {
            if (r.error) { $("ogInvMsg").textContent = "Davet oluşturulamadı: " + r.error.message; return; }
            var link = inviteLink(r.data.token);
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link);
            $("ogInvMsg").innerHTML = "Davet oluşturuldu ve link panoya kopyalandı. " +
                '<a href="mailto:' + esc(email) + '?subject=MIA%20Ekip%20Daveti&body=' + encodeURIComponent("MIA ekibine davet edildiniz. Aynı e-posta ile giriş yaptıktan sonra şu linki açın: " + link) + '" style="color:#D4AF37;">E-posta ile gönder →</a>';
            $("ogInvEmail").value = "";
            loadInvites();
        });
    });
    function loadInvites() {
        if (!window.MIAOrg.can("invite")) return;
        supabase.from("organization_invitations").select("*").eq("org_id", orgId())
            .order("created_at", { ascending: false }).limit(20).then(function (r) {
                if (r.error || !(r.data || []).length) { $("ogInvites").innerHTML = ""; return; }
                var ST = { pending: "Bekliyor", accepted: "Kabul edildi", expired: "Süresi doldu", revoked: "İptal" };
                var html = '<table class="og-tbl"><thead><tr><th>E-posta</th><th>Rol</th><th>Durum</th><th>Son geçerlilik</th><th></th></tr></thead><tbody>';
                r.data.forEach(function (i) {
                    html += "<tr><td>" + esc(i.email) + "</td><td>" + (ROLE_TR[i.role] || i.role) + "</td><td>" + (ST[i.status] || i.status) + "</td><td>" + fmtDate(i.expires_at) + "</td><td>" +
                        (i.status === "pending"
                            ? '<button type="button" class="btn btn-secondary btn-sm" data-copy="' + i.token + '">Linki Kopyala</button> ' +
                              '<button type="button" class="btn btn-danger btn-sm" data-revoke="' + i.id + '">İptal</button>'
                            : "") + "</td></tr>";
                });
                $("ogInvites").innerHTML = html + "</tbody></table>";
                Array.prototype.forEach.call($("ogInvites").querySelectorAll("[data-copy]"), function (b) {
                    b.addEventListener("click", function () {
                        var link = inviteLink(b.getAttribute("data-copy"));
                        if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(link); b.textContent = "Kopyalandı ✓"; }
                        else window.prompt("Davet linki:", link);
                    });
                });
                Array.prototype.forEach.call($("ogInvites").querySelectorAll("[data-revoke]"), function (b) {
                    b.addEventListener("click", function () {
                        supabase.from("organization_invitations").update({ status: "revoked" })
                            .eq("id", b.getAttribute("data-revoke")).then(loadInvites);
                    });
                });
            });
    }

    // ---- Sahalar ----
    function loadSites() {
        supabase.from("organization_sites").select("*").eq("org_id", orgId()).order("created_at").then(function (r) {
            if (r.error) { $("ogSites").textContent = "Sahalar yüklenemedi."; return; }
            var rows = r.data || [];
            if (!rows.length) { $("ogSites").innerHTML = '<span class="og-muted">Henüz saha tanımlanmadı.</span>'; return; }
            var html = '<table class="og-tbl"><thead><tr><th>Saha</th><th>Konum</th><th>Durum</th>' + (isMgr() ? "<th></th>" : "") + '</tr></thead><tbody>';
            rows.forEach(function (s) {
                html += "<tr><td><b>" + esc(s.name) + "</b></td><td>" + esc(s.location || "—") + "</td><td>" + (s.status === "active" ? "Aktif" : "Arşiv") + "</td>" +
                    (isMgr() ? "<td>" + (s.status === "active" ? '<button type="button" class="btn btn-secondary btn-sm" data-archive="' + s.id + '">Arşivle</button>' : "") + "</td>" : "") + "</tr>";
            });
            $("ogSites").innerHTML = html + "</tbody></table>";
            Array.prototype.forEach.call($("ogSites").querySelectorAll("[data-archive]"), function (b) {
                b.addEventListener("click", function () {
                    supabase.from("organization_sites").update({ status: "archived", updated_at: new Date().toISOString() })
                        .eq("id", b.getAttribute("data-archive")).then(loadSites);
                });
            });
        });
    }
    $("ogSiteBtn").addEventListener("click", function () {
        var name = $("ogSiteName").value.trim();
        if (!name) return;
        supabase.from("organization_sites").insert({ org_id: orgId(), name: name, location: $("ogSiteLoc").value.trim() || null })
            .then(function (r) {
                if (r.error) { alert("Saha eklenemedi: " + r.error.message); return; }
                $("ogSiteName").value = ""; $("ogSiteLoc").value = "";
                loadSites();
            });
    });

    // ---- Init ----
    supabase.auth.getSession().then(function (r) {
        if (!r.data.session) { window.location.href = "giris-yap.html?next=organization.html"; return; }
        user = r.data.session.user;
        window.MIAOrg.ready.then(function () {
            if (!window.MIAOrg.isAvailable()) {
                $("ogInfo").textContent = "Organizasyon tabloları bulunamadı — supabase/schema.sql çalıştırılmalı.";
                return;
            }
            renderInfo(); loadMembers(); loadInvites(); loadSites();
        });
    });
})();
