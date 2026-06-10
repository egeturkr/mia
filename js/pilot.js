// === MIA — Ücretli Pilot Modu (Faz 3) ===
// Mevcut analiz sistemine DOKUNMAYAN operasyon katmanı: pilot projeleri,
// onboarding kontrol listesi, analiz bağlama, haftalık raporlar, durum takibi.
// Global `supabase`, `currentUser` js/app.js'ten gelir. Tüm veri RLS ile sahibine kilitli.

(function () {
    if (!document.getElementById("piGrid")) return;

    var $ = function (id) { return document.getElementById(id); };
    var user = null;
    var pilots = [];
    var current = null;          // açık pilot projesi
    var myAnalyses = [];         // kullanıcının tüm analizleri (bağlama için)
    var linkedIds = [];          // current pilota bağlı analysis_id'ler

    // Onboarding kontrol listesi — pilot oluşturulunca otomatik açılır.
    var CHECKLIST = [
        { key: "agreement",        label: "Pilot sözleşmesi hazırlandı" },
        { key: "kvkk_notice",      label: "KVKK aydınlatma metni hazırlandı" },
        { key: "site_notice",      label: "Saha bilgilendirme afişi asıldı" },
        { key: "employer_approval", label: "İşveren veri işleme onayı alındı" },
        { key: "video_protocol",   label: "Video çekim protokolü anlatıldı" },
        { key: "site_contact",     label: "Saha sorumlusu atandı" },
        { key: "weekly_schedule",  label: "Haftalık rapor takvimi onaylandı" },
        { key: "ai_validation",    label: "AI doğrulama akışı hazırlandı" },
        { key: "closing_meeting",  label: "Kapanış ROI toplantısı planlandı" }
    ];
    var STATUS_TR = { draft: "Taslak", proposed: "Teklif Verildi", active: "Aktif",
                      completed: "Tamamlandı", converted: "Aboneliğe Dönüştü", lost: "Kaybedildi" };

    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function fmtDate(d) { return d ? new Date(d).toLocaleDateString("tr-TR") : "—"; }
    function fmtPrice(p, c) { return p != null ? "₺" + Number(p).toLocaleString("tr-TR") : "—"; }

    // ---- Liste ----
    function loadPilots() {
        return supabase.from("pilot_projects").select("*").order("created_at", { ascending: false })
            .then(function (r) {
                if (r.error) { console.error("[MIA] Pilot listesi yüklenemedi:", r.error.message); pilots = []; }
                else pilots = r.data || [];
                // İlerleme için tüm checklist'leri tek sorguda çek
                return supabase.from("pilot_checklists").select("pilot_id,completed");
            })
            .then(function (r) {
                var byPilot = {};
                ((r && r.data) || []).forEach(function (c) {
                    var b = byPilot[c.pilot_id] = byPilot[c.pilot_id] || { done: 0, total: 0 };
                    b.total++; if (c.completed) b.done++;
                });
                renderList(byPilot);
            });
    }

    function renderList(progressMap) {
        var grid = $("piGrid"), empty = $("piEmpty");
        if (!pilots.length) { empty.style.display = "block"; grid.innerHTML = ""; return; }
        empty.style.display = "none";
        var html = "";
        pilots.forEach(function (p) {
            var pr = progressMap[p.id] || { done: 0, total: CHECKLIST.length };
            var pct = pr.total ? Math.round(pr.done / pr.total * 100) : 0;
            var next = pct >= 100
                ? (p.status === "active" ? "Haftalık rapor gir" : "Durumu güncelle")
                : "Kontrol listesi: " + pr.done + "/" + pr.total;
            html += '<div class="pi-card" data-id="' + p.id + '">' +
                '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;">' +
                '<h3>' + esc(p.company_name) + '</h3>' +
                '<span class="pi-status pi-st-' + esc(p.status) + '">' + (STATUS_TR[p.status] || p.status) + '</span></div>' +
                '<div class="pi-site">' + esc(p.site_name || "Saha belirtilmedi") + '</div>' +
                '<div class="pi-row"><span>Dönem</span><span>' + fmtDate(p.start_date) + ' → ' + fmtDate(p.end_date) + '</span></div>' +
                '<div class="pi-row"><span>Bedel</span><span>' + fmtPrice(p.pilot_price, p.currency) + '</span></div>' +
                '<div class="pi-progress"><span style="width:' + pct + '%"></span></div>' +
                '<div class="pi-next">Sonraki: ' + esc(next) + ' · %' + pct + '</div>' +
                '</div>';
        });
        grid.innerHTML = html;
        Array.prototype.forEach.call(grid.querySelectorAll(".pi-card"), function (c) {
            c.addEventListener("click", function () { openPilot(c.getAttribute("data-id")); });
        });
    }

    // ---- Oluşturma ----
    function createPilot() {
        var company = $("pcCompany").value.trim();
        if (!company) { $("pcMsg").textContent = "Firma adı zorunlu."; return; }
        $("pcMsg").textContent = "Kaydediliyor…";
        var row = {
            user_id: user.id,
            company_name: company,
            site_name: $("pcSite").value.trim() || null,
            contact_name: $("pcContact").value.trim() || null,
            contact_email: $("pcEmail").value.trim() || null,
            contact_phone: $("pcPhone").value.trim() || null,
            start_date: $("pcStart").value || null,
            end_date: $("pcEnd").value || null,
            pilot_price: parseFloat($("pcPrice").value) || 25000,
            notes: $("pcNotes").value.trim() || null
        };
        supabase.from("pilot_projects").insert(row).select().single().then(function (r) {
            if (r.error) { $("pcMsg").textContent = "Hata: " + r.error.message; return; }
            var pilot = r.data;
            // Kontrol listesini tohumla
            var items = CHECKLIST.map(function (c) {
                return { user_id: user.id, pilot_id: pilot.id, checklist_key: c.key, checklist_label: c.label };
            });
            supabase.from("pilot_checklists").insert(items).then(function (r2) {
                if (r2.error) console.warn("[MIA] Checklist tohumlanamadı:", r2.error.message);
                $("pcMsg").textContent = "";
                $("piCreatePanel").style.display = "none";
                ["pcCompany","pcSite","pcContact","pcEmail","pcPhone","pcStart","pcEnd","pcNotes"].forEach(function (id) { $(id).value = ""; });
                $("pcPrice").value = "25000";
                loadPilots().then(function () { openPilot(pilot.id); });
            });
        });
    }

    // ---- Detay ----
    function openPilot(id) {
        current = pilots.filter(function (p) { return p.id === id; })[0];
        if (!current) return;
        $("piListView").style.display = "none";
        $("piCreatePanel").style.display = "none";
        $("piDetailView").style.display = "block";
        $("piBackBtn").style.display = "inline-flex";
        $("pdCompany").textContent = current.company_name;
        $("pdMeta").textContent = (current.site_name || "Saha belirtilmedi") + " · " +
            fmtDate(current.start_date) + " → " + fmtDate(current.end_date) + " · " + fmtPrice(current.pilot_price) +
            (current.contact_name ? " · " + current.contact_name : "");
        $("pdStatus").value = current.status;
        loadChecklist();
        loadLinksAndAnalyses();
        loadWeekly();
    }

    function backToList() {
        current = null;
        $("piDetailView").style.display = "none";
        $("piListView").style.display = "block";
        $("piBackBtn").style.display = "none";
        loadPilots();
    }

    // ---- Kontrol listesi ----
    function loadChecklist() {
        supabase.from("pilot_checklists").select("*").eq("pilot_id", current.id).then(function (r) {
            var items = r.data || [];
            // Eski pilotlarda eksik kalem varsa tamamla (idempotent)
            var have = {}; items.forEach(function (i) { have[i.checklist_key] = 1; });
            var missing = CHECKLIST.filter(function (c) { return !have[c.key]; });
            if (missing.length) {
                var rows = missing.map(function (c) { return { user_id: user.id, pilot_id: current.id, checklist_key: c.key, checklist_label: c.label }; });
                supabase.from("pilot_checklists").insert(rows).then(loadChecklist);
                return;
            }
            items.sort(function (a, b) {
                var ka = CHECKLIST.findIndex(function (c) { return c.key === a.checklist_key; });
                var kb = CHECKLIST.findIndex(function (c) { return c.key === b.checklist_key; });
                return ka - kb;
            });
            var done = items.filter(function (i) { return i.completed; }).length;
            $("pclProgress").textContent = "— " + done + "/" + items.length + " tamam";
            var html = "";
            items.forEach(function (i) {
                html += '<label class="pi-check' + (i.completed ? " done" : "") + '">' +
                    '<input type="checkbox" data-id="' + i.id + '"' + (i.completed ? " checked" : "") + '>' +
                    '<span>' + esc(i.checklist_label) + '</span>' +
                    (i.completed_at ? '<span class="pi-when">' + fmtDate(i.completed_at) + '</span>' : '') +
                    '</label>';
            });
            $("pdChecklist").innerHTML = html || '<div class="pi-muted">Kontrol listesi boş.</div>';
            Array.prototype.forEach.call($("pdChecklist").querySelectorAll("input[type=checkbox]"), function (cb) {
                cb.addEventListener("change", function () {
                    supabase.from("pilot_checklists").update({
                        completed: cb.checked,
                        completed_at: cb.checked ? new Date().toISOString() : null
                    }).eq("id", cb.getAttribute("data-id")).then(function (r2) {
                        if (r2.error) { console.error("[MIA] Checklist güncellenemedi:", r2.error.message); cb.checked = !cb.checked; }
                        else loadChecklist();
                    });
                });
            });
        });
    }

    // ---- Analiz bağlama + metrikler ----
    function loadLinksAndAnalyses() {
        Promise.all([
            supabase.from("pilot_analysis_links").select("*").eq("pilot_id", current.id),
            supabase.from("analyses").select("id,video_name,safety_score,violations_count,detections_json,created_at").order("created_at", { ascending: false })
        ]).then(function (rs) {
            var links = (rs[0].data || []);
            myAnalyses = (rs[1].data || []);
            linkedIds = links.map(function (l) { return l.analysis_id; });
            // Seçim listesi: henüz bağlı olmayanlar
            var sel = $("plAnalysisSelect");
            var opts = '<option value="">Analiz seç…</option>';
            myAnalyses.forEach(function (a) {
                if (linkedIds.indexOf(a.id) !== -1) return;
                opts += '<option value="' + a.id + '">' + esc(a.video_name || "Video") + " · " +
                    fmtDate(a.created_at) + " · skor " + Math.round(a.safety_score || 0) + "%</option>";
            });
            sel.innerHTML = opts;
            renderLinked(links);
            renderMetrics();
        });
    }

    function renderLinked(links) {
        var linked = myAnalyses.filter(function (a) { return linkedIds.indexOf(a.id) !== -1; });
        if (!linked.length) { $("pdLinkedList").innerHTML = '<span class="pi-muted">Bu pilota bağlı analiz yok.</span>'; return; }
        var html = '<table class="pi-tbl"><thead><tr><th>Video</th><th>Tarih</th><th>Skor</th><th>İhlal</th><th></th></tr></thead><tbody>';
        linked.forEach(function (a) {
            html += '<tr><td>' + esc(a.video_name || "Video") + '</td><td>' + fmtDate(a.created_at) + '</td>' +
                '<td>' + Math.round(a.safety_score || 0) + '%</td><td>' + (a.violations_count || 0) + '</td>' +
                '<td><button type="button" class="btn btn-secondary btn-sm" data-unlink="' + a.id + '">Çöz</button></td></tr>';
        });
        html += "</tbody></table>";
        $("pdLinkedList").innerHTML = html;
        Array.prototype.forEach.call($("pdLinkedList").querySelectorAll("[data-unlink]"), function (b) {
            b.addEventListener("click", function () {
                supabase.from("pilot_analysis_links").delete()
                    .eq("pilot_id", current.id).eq("analysis_id", b.getAttribute("data-unlink"))
                    .then(loadLinksAndAnalyses);
            });
        });
    }

    function linkedAnalyses() { return myAnalyses.filter(function (a) { return linkedIds.indexOf(a.id) !== -1; }); }

    function countHighRisk(a) {
        if (!a.detections_json) return 0;
        try {
            return (JSON.parse(a.detections_json) || []).filter(function (e) { return e.risk_level === "Yüksek"; }).length;
        } catch (e) { return 0; }
    }

    function renderMetrics() {
        var linked = linkedAnalyses();
        $("pmVideos").textContent = linked.length;
        var tv = 0, th = 0, ts = 0;
        linked.forEach(function (a) { tv += a.violations_count || 0; th += countHighRisk(a); ts += a.safety_score || 0; });
        $("pmViolations").textContent = tv;
        $("pmHigh").textContent = th;
        $("pmScore").textContent = linked.length ? Math.round(ts / linked.length) + "%" : "—";
    }

    // ---- Haftalık raporlar ----
    function weekRange(weekNo) {
        // Hafta N = start_date + 7*(N-1) … +7 gün. start_date yoksa null (autofill tüm bağlıları alır).
        if (!current.start_date) return null;
        var s = new Date(current.start_date);
        s.setDate(s.getDate() + 7 * (weekNo - 1));
        var e = new Date(s); e.setDate(e.getDate() + 7);
        return { from: s, to: e };
    }

    function autofillWeek() {
        var w = parseInt($("wrWeek").value, 10) || 1;
        var range = weekRange(w);
        var linked = linkedAnalyses().filter(function (a) {
            if (!range) return true;
            var d = new Date(a.created_at);
            return d >= range.from && d < range.to;
        });
        var tv = 0, th = 0, ts = 0;
        linked.forEach(function (a) { tv += a.violations_count || 0; th += countHighRisk(a); ts += a.safety_score || 0; });
        $("wrVideos").value = linked.length;
        $("wrViolations").value = tv;
        $("wrHigh").value = th;
        $("wrScore").value = linked.length ? Math.round(ts / linked.length) : "";
        $("wrMsg").textContent = range
            ? "Hafta " + w + " (" + fmtDate(range.from) + " – " + fmtDate(range.to) + ") aralığındaki " + linked.length + " bağlı analizden dolduruldu."
            : "Pilot başlangıç tarihi yok — tüm bağlı analizlerden dolduruldu (" + linked.length + ").";
    }

    function saveWeekly() {
        var w = parseInt($("wrWeek").value, 10);
        if (!w || w < 1) { $("wrMsg").textContent = "Geçerli bir hafta numarası gir."; return; }
        var row = {
            user_id: user.id, pilot_id: current.id, week_number: w,
            report_date: new Date().toISOString().slice(0, 10),
            uploaded_video_count: parseInt($("wrVideos").value, 10) || 0,
            total_violations: parseInt($("wrViolations").value, 10) || 0,
            high_risk_violations: parseInt($("wrHigh").value, 10) || 0,
            average_safety_score: $("wrScore").value === "" ? null : parseFloat($("wrScore").value),
            manual_review_notes: $("wrReview").value.trim() || null,
            customer_feedback: $("wrFeedback").value.trim() || null,
            next_actions: $("wrNext").value.trim() || null
        };
        $("wrMsg").textContent = "Kaydediliyor…";
        supabase.from("pilot_weekly_reports").upsert(row, { onConflict: "pilot_id,week_number" }).then(function (r) {
            if (r.error) { $("wrMsg").textContent = "Hata: " + r.error.message; return; }
            $("wrMsg").textContent = "Hafta " + w + " raporu kaydedildi.";
            ["wrReview","wrFeedback","wrNext"].forEach(function (id) { $(id).value = ""; });
            loadWeekly();
        });
    }

    function loadWeekly() {
        supabase.from("pilot_weekly_reports").select("*").eq("pilot_id", current.id)
            .order("week_number").then(function (r) {
                var reps = r.data || [];
                if (!reps.length) { $("pdWeeklyList").innerHTML = '<div class="pi-muted">Henüz haftalık rapor yok. İlk haftanın sonunda "Bağlı analizlerden doldur" ile başla.</div>'; return; }
                var html = '<table class="pi-tbl"><thead><tr><th>Hafta</th><th>Tarih</th><th>Video</th><th>İhlal</th><th>Yüksek</th><th>Skor</th><th>Notlar</th><th></th></tr></thead><tbody>';
                reps.forEach(function (w) {
                    var notes = [w.manual_review_notes, w.customer_feedback, w.next_actions].filter(Boolean).join(" · ");
                    html += '<tr><td><b>' + w.week_number + '</b></td><td>' + fmtDate(w.report_date) + '</td>' +
                        '<td>' + (w.uploaded_video_count || 0) + '</td><td>' + (w.total_violations || 0) + '</td>' +
                        '<td>' + (w.high_risk_violations || 0) + '</td>' +
                        '<td>' + (w.average_safety_score != null ? Math.round(w.average_safety_score) + "%" : "—") + '</td>' +
                        '<td class="pi-muted" style="max-width:260px;">' + esc(notes ? notes.slice(0, 120) : "—") + '</td>' +
                        '<td><button type="button" class="btn btn-secondary btn-sm" data-copy="' + w.week_number + '">Raporu Kopyala</button></td></tr>';
                });
                html += "</tbody></table>";
                $("pdWeeklyList").innerHTML = html;
                Array.prototype.forEach.call($("pdWeeklyList").querySelectorAll("[data-copy]"), function (b) {
                    b.addEventListener("click", function () {
                        var w = reps.filter(function (x) { return String(x.week_number) === b.getAttribute("data-copy"); })[0];
                        copyWeeklyReport(w);
                    });
                });
            });
    }

    // Haftalık rapor metnini (şablon: docs/PILOT_REPORT_TEMPLATE.md) panoya kopyala —
    // e-posta/WhatsApp ile müşteriye gönderilmek üzere.
    function copyWeeklyReport(w) {
        var p = current;
        var txt = [
            "MIA — Haftalık Pilot Güvenlik Raporu",
            "=====================================",
            "Firma: " + p.company_name,
            "Saha: " + (p.site_name || "—"),
            "Pilot haftası: " + w.week_number + " / 4   (" + fmtDate(w.report_date) + ")",
            "",
            "ÖZET",
            "- Analiz edilen video: " + (w.uploaded_video_count || 0),
            "- Tespit edilen toplam ihlal: " + (w.total_violations || 0),
            "- Yüksek riskli ihlal: " + (w.high_risk_violations || 0),
            "- Ortalama güvenlik skoru: " + (w.average_safety_score != null ? Math.round(w.average_safety_score) + "%" : "ölçülmedi"),
            "",
            "MANUEL İNCELEME NOTLARI",
            (w.manual_review_notes || "—"),
            "",
            "MÜŞTERİ GERİ BİLDİRİMİ",
            (w.customer_feedback || "—"),
            "",
            "ÖNERİLEN AKSİYONLAR",
            (w.next_actions || "—"),
            "",
            "—",
            "Bu rapor MIA AI destekli güvenlik analizi ile hazırlanmıştır; sertifikalı İSG denetiminin,",
            "yasal uygunluk kontrollerinin veya profesyonel insan değerlendirmesinin yerine geçmez.",
            "MIA — miaissagligi.com"
        ].join("\n");
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(txt).then(function () { $("wrMsg").textContent = "Hafta " + w.week_number + " raporu panoya kopyalandı."; });
        } else { window.prompt("Rapor metni:", txt); }
    }

    // ---- Durum & silme ----
    $("pdStatus").addEventListener("change", function () {
        supabase.from("pilot_projects").update({ status: $("pdStatus").value, updated_at: new Date().toISOString() })
            .eq("id", current.id).then(function (r) {
                if (r.error) console.error("[MIA] Durum güncellenemedi:", r.error.message);
                else { current.status = $("pdStatus").value; }
            });
    });
    $("pdDeleteBtn").addEventListener("click", function () {
        if (!confirm("Bu pilot projesi ve tüm kontrol listesi/raporları silinecek. Emin misin?")) return;
        supabase.from("pilot_projects").delete().eq("id", current.id).then(function (r) {
            if (r.error) alert("Silinemedi: " + r.error.message);
            else backToList();
        });
    });

    // ---- Eventler ----
    $("piNewBtn").addEventListener("click", function () {
        $("piCreatePanel").style.display = $("piCreatePanel").style.display === "none" ? "block" : "none";
        $("piDetailView").style.display = "none";
        $("piListView").style.display = "block";
        $("piBackBtn").style.display = "none";
    });
    $("pcSaveBtn").addEventListener("click", createPilot);
    $("pcCancelBtn").addEventListener("click", function () { $("piCreatePanel").style.display = "none"; });
    $("piBackBtn").addEventListener("click", backToList);
    $("plLinkBtn").addEventListener("click", function () {
        var aid = $("plAnalysisSelect").value;
        if (!aid) return;
        supabase.from("pilot_analysis_links").insert({ user_id: user.id, pilot_id: current.id, analysis_id: aid })
            .then(function (r) {
                if (r.error) console.error("[MIA] Analiz bağlanamadı:", r.error.message);
                loadLinksAndAnalyses();
            });
    });
    $("wrAutofillBtn").addEventListener("click", autofillWeek);
    $("wrSaveBtn").addEventListener("click", saveWeekly);

    // ---- Init: giriş zorunlu ----
    supabase.auth.getSession().then(function (r) {
        if (!r.data.session) { window.location.href = "giris-yap.html?next=pilot.html"; return; }
        user = r.data.session.user;
        loadPilots();
    });
})();
