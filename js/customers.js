// === MIA — Müşteri Operasyonları / İç CRM (Faz 8) ===
// Hedef firma → keşif → demo → ücretli pilot → müşteri hattı. İç araç; sahte veri yok.
// Yazma yetkisi: kayıt sahibi veya org owner/admin (RLS'te zorlanır; UI yalnız UX).

(function () {
    if (!document.getElementById("cuList")) return;
    var $ = function (id) { return document.getElementById(id); };
    var esc = window.miaEsc || function (s) { return String(s == null ? "" : s); };
    var user = null, customers = [], current = null, onlyOverdue = false;

    var STATUS = [
        ["target", "Hedef", "#9a9a9a"], ["contacted", "İletişim kuruldu", "#60a5fa"],
        ["discovery_scheduled", "Keşif planlandı", "#60a5fa"], ["discovery_completed", "Keşif yapıldı", "#a78bfa"],
        ["demo_sent", "Demo gönderildi", "#a78bfa"], ["pilot_proposed", "Pilot teklif edildi", "#D4AF37"],
        ["pilot_active", "Pilot aktif", "#D4AF37"], ["customer", "MÜŞTERİ", "#22c55e"], ["lost", "Kaybedildi", "#ef4444"]
    ];
    var ST = {}; STATUS.forEach(function (s) { ST[s[0]] = { label: s[1], color: s[2] }; });
    var SEG = { construction: "İnşaat", contractor: "Müteahhit", infrastructure: "Altyapı",
                industrial: "Sanayi", logistics: "Lojistik", osgb: "OSGB", other: "Diğer" };
    var SRC = { founder_network: "Kurucu ağı", mostar_referral: "Mostar ref.", linkedin: "LinkedIn",
                osgb: "OSGB", inbound: "Gelen talep", event: "Etkinlik", cold_outreach: "Soğuk", other: "Diğer" };
    var PRI = { high: "Yüksek", medium: "Orta", low: "Düşük" };
    var OPST = { lead: "Aday", discovery: "Keşif", demo: "Demo", pilot_proposed: "Pilot teklif",
                 paid_pilot: "Ücretli pilot", negotiation: "Pazarlık", won: "Kazanıldı", lost: "Kaybedildi" };
    var INT = { call: "Telefon", email: "E-posta", meeting: "Toplantı", demo: "Demo",
                site_visit: "Saha", whatsapp: "WhatsApp", note: "Not" };
    var ROLE = { champion: "Şampiyon", budget_owner: "Bütçe", decision_maker: "Karar verici",
                 influencer: "Etkileyici", procurement: "Satınalma", legal: "Hukuk", technical: "Teknik", other: "Diğer" };

    function fmtD(d) { return d ? new Date(d).toLocaleDateString("tr-TR") : "—"; }
    function badge(txt, color) { return '<span class="cu-badge" style="background:' + color + '22;color:' + color + ';">' + esc(txt) + '</span>'; }
    function canEdit() {
        if (!window.MIAOrg || !window.MIAOrg.currentId()) return true;
        var r = window.MIAOrg.role(); return r === "owner" || r === "admin";
    }
    function canNote() {
        if (canEdit()) return true;
        return window.MIAOrg && window.MIAOrg.role() === "safety_manager";
    }

    // ---- Pipeline özeti + liste ----
    function loadAll() {
        supabase.from("customer_accounts").select("*").order("updated_at", { ascending: false }).then(function (r) {
            if (r.error) {
                $("cuStats").innerHTML = '<div class="cu-muted">CRM tabloları bulunamadı — supabase/schema.sql çalıştırılmalı. (' + esc(r.error.message) + ')</div>';
                return;
            }
            customers = r.data || [];
            renderStats(); renderList();
        });
        loadTasks(); loadInbound();
    }

    function renderStats() {
        var c = function (st) { return customers.filter(function (x) { return x.status === st; }).length; };
        var cards = [
            ["Hedef firma", customers.length], ["İletişim", c("contacted") + c("discovery_scheduled")],
            ["Keşif yapıldı", c("discovery_completed")], ["Demo gönderildi", c("demo_sent")],
            ["Pilot (teklif+aktif)", c("pilot_proposed") + c("pilot_active")],
            ["Müşteri", c("customer")], ["Kayıp", c("lost")]
        ];
        $("cuStats").innerHTML = cards.map(function (x) {
            return '<div class="cu-stat"><div class="v">' + x[1] + '</div><div class="l">' + x[0] + '</div></div>';
        }).join("");
    }

    function renderList() {
        if (!customers.length) { $("cuEmpty").style.display = "block"; $("cuListPanel").style.display = "none"; return; }
        $("cuEmpty").style.display = "none"; $("cuListPanel").style.display = "block";
        $("cuList").innerHTML = customers.map(function (x) {
            var st = ST[x.status] || { label: x.status, color: "#9a9a9a" };
            return '<tr data-id="' + x.id + '"><td><b>' + esc(x.company_name) + '</b></td>' +
                '<td>' + (SEG[x.segment] || "—") + '</td><td>' + esc(x.city || "—") + '</td>' +
                '<td>' + badge(st.label, st.color) + '</td><td>' + (PRI[x.priority] || "—") + '</td>' +
                '<td>' + (SRC[x.source] || "—") + '</td><td>' + fmtD(x.next_follow_up) + '</td></tr>';
        }).join("");
        Array.prototype.forEach.call($("cuList").querySelectorAll("tr"), function (tr) {
            tr.addEventListener("click", function () { openCustomer(tr.getAttribute("data-id")); });
        });
    }

    // ---- Firma ekleme ----
    $("cuNewBtn").addEventListener("click", function () {
        if (!canEdit()) { alert("Bu işlem için owner/admin rolü gerekli."); return; }
        $("cuCreatePanel").style.display = $("cuCreatePanel").style.display === "none" ? "block" : "none";
    });
    $("cfCancelBtn").addEventListener("click", function () { $("cuCreatePanel").style.display = "none"; });
    $("cfSaveBtn").addEventListener("click", function () {
        var name = $("cfName").value.trim();
        if (!name) { $("cfMsg").textContent = "Firma adı zorunlu."; return; }
        supabase.from("customer_accounts").insert({
            owner_user_id: user.id,
            org_id: (window.MIAOrg && window.MIAOrg.currentId()) || null,
            company_name: name, segment: $("cfSegment").value, city: $("cfCity").value.trim() || null,
            source: $("cfSource").value, priority: $("cfPriority").value, notes: $("cfNotes").value.trim() || null
        }).then(function (r) {
            if (r.error) { $("cfMsg").textContent = "Hata: " + r.error.message; return; }
            ["cfName", "cfCity", "cfNotes"].forEach(function (i) { $(i).value = ""; });
            $("cuCreatePanel").style.display = "none"; $("cfMsg").textContent = "";
            loadAll();
        });
    });

    // ---- Detay ----
    function openCustomer(id) {
        current = customers.filter(function (x) { return x.id === id; })[0];
        if (!current) return;
        $("cuListView").style.display = "none"; $("cuDetailView").style.display = "block";
        $("cuBackBtn").style.display = "inline-flex"; $("cuCreatePanel").style.display = "none";
        $("cdName").textContent = current.company_name;
        $("cdMeta").textContent = (SEG[current.segment] || "") + " · " + (current.city || "—") + " · Kaynak: " +
            (SRC[current.source] || "—") + (current.notes ? " · " + current.notes.slice(0, 100) : "");
        $("cdStatus").innerHTML = STATUS.map(function (s) {
            return '<option value="' + s[0] + '"' + (current.status === s[0] ? " selected" : "") + '>' + s[1] + '</option>';
        }).join("");
        $("cdPriority").value = current.priority || "medium";
        loadContacts(); loadOpps(); loadInteractions(); loadCustTasks(); loadCase(); loadPilotLink();
    }
    $("cuBackBtn").addEventListener("click", function () {
        current = null; $("cuDetailView").style.display = "none"; $("cuListView").style.display = "block";
        $("cuBackBtn").style.display = "none"; loadAll();
    });
    $("cdStatus").addEventListener("change", function () {
        supabase.from("customer_accounts").update({ status: $("cdStatus").value, updated_at: new Date().toISOString() })
            .eq("id", current.id).then(function (r) { if (!r.error) current.status = $("cdStatus").value; });
    });
    $("cdPriority").addEventListener("change", function () {
        supabase.from("customer_accounts").update({ priority: $("cdPriority").value, updated_at: new Date().toISOString() }).eq("id", current.id);
    });
    $("cdDeleteBtn").addEventListener("click", function () {
        if (!confirm("Firma ve tüm CRM kayıtları (kişiler, fırsatlar, görüşmeler) silinecek. Emin misin?")) return;
        supabase.from("customer_accounts").delete().eq("id", current.id).then(function (r) {
            if (r.error) { alert("Silinemedi: " + r.error.message); return; }
            $("cuBackBtn").click();
        });
    });

    // ---- Pilot bağlantısı ----
    function loadPilotLink() {
        supabase.from("pilot_projects").select("id,company_name,status,payment_status").then(function (r) {
            var pilots = r.data || [];
            $("cdPilotSelect").innerHTML = '<option value="">Pilota bağla…</option>' + pilots.map(function (p) {
                return '<option value="' + p.id + '">' + esc(p.company_name) + ' (' + p.status + ')</option>';
            }).join("");
            var linked = pilots.filter(function (p) { return p.id === current.linked_pilot_id; })[0];
            $("cdPilotInfo").innerHTML = linked
                ? 'Bağlı pilot: <b>' + esc(linked.company_name) + '</b> · durum: ' + esc(linked.status) +
                  ' · ödeme: ' + esc(linked.payment_status || "—") + ' · <a href="pilot.html" style="color:#D4AF37;">Pilot sayfası →</a>'
                : "Bağlı pilot yok.";
        });
    }
    $("cdPilotBtn").addEventListener("click", function () {
        var pid = $("cdPilotSelect").value || null;
        supabase.from("customer_accounts").update({ linked_pilot_id: pid, updated_at: new Date().toISOString() })
            .eq("id", current.id).then(function (r) {
                if (r.error) { alert("Bağlanamadı: " + r.error.message); return; }
                current.linked_pilot_id = pid; loadPilotLink();
            });
    });

    // ---- Kişiler ----
    function loadContacts() {
        supabase.from("customer_contacts").select("*").eq("customer_id", current.id).order("created_at").then(function (r) {
            var rows = r.data || [];
            $("cdContacts").innerHTML = rows.length ? rows.map(function (c) {
                return '<div style="display:flex;justify-content:space-between;gap:.6rem;border-top:1px solid var(--border);padding:.45rem 0;font-size:.86rem;flex-wrap:wrap;">' +
                    '<span><b>' + esc(c.full_name) + '</b> <span class="cu-muted">' + esc(c.role_title || "") + ' · ' + (ROLE[c.decision_role] || "") + '</span></span>' +
                    '<span class="cu-muted">' + esc(c.email || "") + (c.phone ? " · " + esc(c.phone) : "") + '</span></div>';
            }).join("") : '<span class="cu-muted">Henüz kişi eklenmedi — İSG müdürüyle başla (şampiyonun).</span>';
        });
    }
    $("ctAddBtn").addEventListener("click", function () {
        var name = $("ctName").value.trim(); if (!name) return;
        supabase.from("customer_contacts").insert({
            customer_id: current.id, owner_user_id: user.id, org_id: current.org_id || null,
            full_name: name, role_title: $("ctTitle").value.trim() || null,
            email: $("ctEmail").value.trim() || null, phone: $("ctPhone").value.trim() || null,
            decision_role: $("ctRole").value
        }).then(function (r) {
            if (r.error) { alert("Eklenemedi: " + r.error.message); return; }
            ["ctName", "ctTitle", "ctEmail", "ctPhone"].forEach(function (i) { $(i).value = ""; });
            loadContacts();
        });
    });

    // ---- Fırsatlar ----
    function loadOpps() {
        supabase.from("sales_opportunities").select("*").eq("customer_id", current.id).order("created_at").then(function (r) {
            var rows = r.data || [];
            $("cdOpps").innerHTML = rows.length ? rows.map(function (o) {
                return '<div style="display:flex;justify-content:space-between;gap:.6rem;border-top:1px solid var(--border);padding:.45rem 0;font-size:.86rem;flex-wrap:wrap;">' +
                    '<span><b>' + esc(o.opportunity_name) + '</b> · ' + (OPST[o.stage] || o.stage) +
                    (o.probability != null ? " · %" + o.probability : "") + '</span>' +
                    '<span class="cu-muted">₺' + Number(o.expected_value || 0).toLocaleString("tr-TR") +
                    ' · kapanış: ' + fmtD(o.expected_close_date) + '</span></div>';
            }).join("") : '<span class="cu-muted">Fırsat yok — keşif sonrası ₺25.000 pilot fırsatı aç.</span>';
        });
    }
    $("opAddBtn").addEventListener("click", function () {
        var name = $("opName").value.trim(); if (!name) return;
        supabase.from("sales_opportunities").insert({
            customer_id: current.id, owner_user_id: user.id, org_id: current.org_id || null,
            opportunity_name: name, stage: $("opStage").value,
            expected_value: parseFloat($("opValue").value) || null,
            expected_close_date: $("opClose").value || null,
            probability: $("opProb").value === "" ? null : parseInt($("opProb").value, 10),
            linked_pilot_id: current.linked_pilot_id || null
        }).then(function (r) {
            if (r.error) { alert("Eklenemedi: " + r.error.message); return; }
            $("opName").value = ""; loadOpps();
        });
    });

    // ---- Görüşmeler ----
    function loadInteractions() {
        supabase.from("customer_interactions").select("*").eq("customer_id", current.id)
            .order("interaction_date", { ascending: false }).limit(30).then(function (r) {
                var rows = r.data || [];
                $("cdInteractions").innerHTML = rows.length ? rows.map(function (i) {
                    return '<div style="border-top:1px solid var(--border);padding:.45rem 0;font-size:.86rem;">' +
                        '<b>' + (INT[i.interaction_type] || "") + '</b> · ' + fmtD(i.interaction_date) + ' — ' + esc(i.summary || "") +
                        (i.next_action ? ' <span class="cu-muted">→ ' + esc(i.next_action) +
                        (i.next_follow_up_date ? " (" + fmtD(i.next_follow_up_date) + ")" : "") + '</span>' : "") + '</div>';
                }).join("") : '<span class="cu-muted">Görüşme kaydı yok.</span>';
            });
    }
    $("inAddBtn").addEventListener("click", function () {
        var sum = $("inSummary").value.trim(); if (!sum) return;
        if (!canNote()) { alert("Bu işlem için yetkiniz yok."); return; }
        supabase.from("customer_interactions").insert({
            customer_id: current.id, owner_user_id: user.id, org_id: current.org_id || null,
            interaction_type: $("inType").value, summary: sum,
            next_action: $("inNext").value.trim() || null,
            next_follow_up_date: $("inFollow").value || null
        }).then(function (r) {
            if (r.error) { alert("Kaydedilemedi: " + r.error.message); return; }
            ["inSummary", "inNext", "inFollow"].forEach(function (i) { $(i).value = ""; });
            loadInteractions();
            // Takip tarihi girildiyse otomatik görev aç
            if ($("inFollow").value) return;
        });
    });

    // ---- Görevler (firma bazlı + genel) ----
    function taskRow(t, reload) {
        var overdue = t.status === "open" && t.due_date && new Date(t.due_date) < new Date();
        var div = document.createElement("div");
        div.style.cssText = "display:flex;justify-content:space-between;gap:.6rem;border-top:1px solid var(--border);padding:.45rem 0;font-size:.86rem;align-items:center;flex-wrap:wrap;";
        div.innerHTML = '<span class="' + (t.status !== "open" ? "cu-task-done" : "") + '">' + esc(t.title) +
            (t.customer_name ? ' <span class="cu-muted">(' + esc(t.customer_name) + ')</span>' : "") + '</span>' +
            '<span><span class="' + (overdue ? "cu-overdue" : "cu-muted") + '">' + fmtD(t.due_date) + (overdue ? " · GECİKTİ" : "") + '</span> ' +
            (t.status === "open" ? '<button type="button" class="btn btn-secondary btn-sm" data-done="' + t.id + '">Tamamla</button>' : "") + '</span>';
        var btn = div.querySelector("[data-done]");
        if (btn) btn.addEventListener("click", function () {
            supabase.from("sales_tasks").update({ status: "completed", updated_at: new Date().toISOString() })
                .eq("id", t.id).then(reload);
        });
        return div;
    }
    function loadCustTasks() {
        supabase.from("sales_tasks").select("*").eq("customer_id", current.id).order("due_date").then(function (r) {
            var el = $("cdTasks"); el.innerHTML = "";
            var rows = r.data || [];
            if (!rows.length) { el.innerHTML = '<span class="cu-muted">Görev yok.</span>'; return; }
            rows.forEach(function (t) { el.appendChild(taskRow(t, loadCustTasks)); });
        });
    }
    $("tkAddBtn").addEventListener("click", function () {
        var title = $("tkTitle").value.trim(); if (!title) return;
        supabase.from("sales_tasks").insert({
            customer_id: current.id, owner_user_id: user.id, org_id: current.org_id || null,
            title: title, due_date: $("tkDue").value || null, priority: $("tkPriority").value
        }).then(function (r) {
            if (r.error) { alert("Eklenemedi: " + r.error.message); return; }
            $("tkTitle").value = ""; loadCustTasks(); loadTasks();
        });
    });
    function loadTasks() {
        supabase.from("sales_tasks").select("*, customer_accounts(company_name)").eq("status", "open")
            .order("due_date").limit(20).then(function (r) {
                var el = $("cuTasks"); el.innerHTML = "";
                if (r.error) { el.innerHTML = '<span class="cu-muted">—</span>'; return; }
                var rows = (r.data || []).map(function (t) {
                    t.customer_name = t.customer_accounts && t.customer_accounts.company_name;
                    return t;
                });
                if (onlyOverdue) rows = rows.filter(function (t) { return t.due_date && new Date(t.due_date) < new Date(); });
                if (!rows.length) { el.innerHTML = '<span class="cu-muted">' + (onlyOverdue ? "Geciken görev yok 🎉" : "Açık takip yok.") + '</span>'; return; }
                rows.forEach(function (t) { el.appendChild(taskRow(t, loadTasks)); });
            });
    }
    $("cuTaskFilterBtn").addEventListener("click", function () {
        onlyOverdue = !onlyOverdue;
        $("cuTaskFilterBtn").textContent = onlyOverdue ? "Tümünü göster" : "Yalnız gecikenler";
        loadTasks();
    });

    // ---- Vaka çalışması ----
    function loadCase() {
        supabase.from("case_study_candidates").select("*").eq("customer_id", current.id).limit(1).then(function (r) {
            var c = r.data && r.data[0];
            $("csStatus").value = c ? c.status : "not_started";
            $("csHeadline").value = (c && c.headline) || "";
            $("csMetrics").value = (c && c.key_metrics) || "";
            $("csSaveBtn").setAttribute("data-id", c ? c.id : "");
        });
    }
    $("csSaveBtn").addEventListener("click", function () {
        var id = $("csSaveBtn").getAttribute("data-id");
        var row = { customer_id: current.id, owner_user_id: user.id, org_id: current.org_id || null,
                    pilot_id: current.linked_pilot_id || null, status: $("csStatus").value,
                    headline: $("csHeadline").value.trim() || null, key_metrics: $("csMetrics").value.trim() || null,
                    updated_at: new Date().toISOString() };
        var q = id ? supabase.from("case_study_candidates").update(row).eq("id", id)
                   : supabase.from("case_study_candidates").insert(row);
        q.then(function (r) { if (r.error) alert("Kaydedilemedi: " + r.error.message); else loadCase(); });
    });

    // ---- Gelen demo talepleri (yalnız crm_admins okuyabilir — RLS) ----
    function loadInbound() {
        supabase.from("demo_requests").select("*").order("created_at", { ascending: false }).limit(15).then(function (r) {
            if (r.error || !(r.data || []).length) return; // admin değil veya talep yok → panel gizli kalır
            $("cuInboundPanel").style.display = "block";
            $("cuInbound").innerHTML = r.data.map(function (d) {
                return '<div style="display:flex;justify-content:space-between;gap:.6rem;border-top:1px solid var(--border);padding:.45rem 0;font-size:.86rem;flex-wrap:wrap;align-items:center;">' +
                    '<span><b>' + esc(d.company || d.name || "—") + '</b> <span class="cu-muted">' + esc(d.name || "") + ' · ' + esc(d.email || "") + (d.phone ? " · " + esc(d.phone) : "") + '</span></span>' +
                    '<span><span class="cu-muted">' + fmtD(d.created_at) + '</span> <button type="button" class="btn btn-secondary btn-sm" data-conv="' + d.id + '">Firmaya Dönüştür</button></span></div>';
            }).join("");
            Array.prototype.forEach.call($("cuInbound").querySelectorAll("[data-conv]"), function (b) {
                b.addEventListener("click", function () {
                    var d = r.data.filter(function (x) { return x.id === b.getAttribute("data-conv"); })[0];
                    if (!d) return;
                    supabase.from("customer_accounts").insert({
                        owner_user_id: user.id, org_id: (window.MIAOrg && window.MIAOrg.currentId()) || null,
                        company_name: d.company || d.name || "Bilinmeyen Firma",
                        source: "inbound", status: "contacted", priority: "high",
                        notes: "Demo talebi: " + (d.message || "").slice(0, 300),
                        metadata: { demo_request_id: d.id, contact_name: d.name, contact_email: d.email, contact_phone: d.phone }
                    }).select().single().then(function (r2) {
                        if (r2.error) { alert("Dönüştürülemedi: " + r2.error.message); return; }
                        if (d.name) {
                            supabase.from("customer_contacts").insert({
                                customer_id: r2.data.id, owner_user_id: user.id,
                                full_name: d.name, email: d.email || null, phone: d.phone || null,
                                decision_role: "champion"
                            }).then(function () {});
                        }
                        b.textContent = "Dönüştürüldü ✓"; b.disabled = true;
                        loadAll(); // orijinal demo_request SİLİNMEZ
                    });
                });
            });
        });
    }

    // ---- Init ----
    supabase.auth.getSession().then(function (r) {
        if (!r.data.session) { window.location.href = "giris-yap.html?next=customers.html"; return; }
        user = r.data.session.user;
        var go = function () {
            if (window.MIAOrg && window.MIAOrg.currentId() && !canNote()) {
                // viewer: salt okuma — ekleme alanlarını kilitle
                ["cuNewBtn","cfSaveBtn","ctAddBtn","opAddBtn","inAddBtn","tkAddBtn","csSaveBtn","cdDeleteBtn","cdPilotBtn"].forEach(function (i) {
                    var el = $(i); if (el) { el.disabled = true; el.title = "İzleyici rolü düzenleme yapamaz."; }
                });
            }
            loadAll();
        };
        if (window.MIAOrg && window.MIAOrg.ready) window.MIAOrg.ready.then(go); else go();
    });
})();
