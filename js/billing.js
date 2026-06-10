// === MIA — Faturalandırma Görünümü (Faz 6) ===
// Hesap sayfasında: abonelik durumu, ödeme kayıtları, faturalar, plan seçim niyeti.
// KURAL: burada hiçbir ödeme "tamamlandı" YAPILMAZ — durumlar sunucudan okunur;
// plan seçimi yalnızca pending niyet kaydı açar (/api/create-checkout).

(function () {
    if (!document.getElementById("bilCard")) return;
    var $ = function (id) { return document.getElementById(id); };
    var user = null, token = null;
    var SUB_TR = { active: "Aktif", trialing: "Deneme", past_due: "Ödeme gecikti", canceled: "İptal",
                   unpaid: "Ödeme bekleniyor", manual_active: "Aktif (manuel ödeme)", pilot_active: "Aktif (pilot)" };
    var PAY_TR = { pending: "Bekliyor", paid: "Ödendi", failed: "Başarısız", refunded: "İade", manual_confirmed: "Havale alındı (manuel)" };
    var INV_TR = { draft: "Taslak", issued: "Kesildi", paid: "Ödendi", void: "İptal" };

    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function fmtD(d) { return d ? new Date(d).toLocaleDateString("tr-TR") : "—"; }
    function fmtA(a, c) { return "₺" + Number(a || 0).toLocaleString("tr-TR"); }
    function orgId() { return (window.MIAOrg && window.MIAOrg.currentId()) || null; }
    function canManage() {
        if (!window.MIAOrg || !orgId()) return true; // kişisel alan
        var r = window.MIAOrg.role();
        return r === "owner" || r === "admin";
    }

    function load() {
        var oid = orgId();
        $("bilOrg").textContent = (window.MIAOrg && window.MIAOrg.current())
            ? "Organizasyon: " + window.MIAOrg.current().name + " · Rolünüz: " + (window.MIAOrg.role() || "—")
            : "Kişisel çalışma alanı";
        $("bilActions").style.display = canManage() ? "block" : "none";

        // Abonelik durumu
        var q = supabase.from("subscriptions").select("plan,status,current_period_end,org_id");
        q = oid ? q.eq("org_id", oid) : q.is("org_id", null).eq("user_id", user.id);
        q.limit(1).then(function (r) {
            if (r.error) { $("bilSub").textContent = "Abonelik bilgisi alınamadı (migration?)"; return; }
            var s = r.data && r.data[0];
            if (!s) { $("bilSub").innerHTML = "Abonelik yok — <b>Ücretsiz/Deneme</b> kotası geçerli."; return; }
            var P = window.MIAPlans ? window.MIAPlans.get(s.plan) : { name: s.plan };
            $("bilSub").innerHTML = "Plan: <b>" + esc(P.name) + "</b> · Durum: <b>" + (SUB_TR[s.status] || s.status) + "</b>" +
                (s.current_period_end ? " · Dönem sonu: " + fmtD(s.current_period_end) : "");
        });

        // Ödeme kayıtları
        var pq = supabase.from("payment_records").select("*").order("created_at", { ascending: false }).limit(10);
        pq = oid ? pq.or("user_id.eq." + user.id + ",org_id.eq." + oid) : pq.eq("user_id", user.id);
        pq.then(function (r) {
            if (r.error || !(r.data || []).length) { $("bilPayments").innerHTML = '<span class="acc-muted">Ödeme kaydı yok.</span>'; return; }
            var html = '<div class="acc-muted" style="margin-bottom:.3rem;"><b>Ödeme Kayıtları</b></div>';
            r.data.forEach(function (p) {
                html += '<div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);padding:.45rem 0;font-size:.85rem;">' +
                    "<span>" + fmtA(p.amount) + " · " + esc((p.metadata && p.metadata.plan) || (p.pilot_id ? "Pilot" : "—")) + "</span>" +
                    '<span class="acc-muted">' + fmtD(p.created_at) + " · <b>" + (PAY_TR[p.status] || p.status) + "</b></span></div>";
            });
            $("bilPayments").innerHTML = html;
        });

        // Faturalar
        var iq = supabase.from("invoices").select("*").order("created_at", { ascending: false }).limit(10);
        iq = oid ? iq.or("user_id.eq." + user.id + ",org_id.eq." + oid) : iq.eq("user_id", user.id);
        iq.then(function (r) {
            if (r.error || !(r.data || []).length) { $("bilInvoices").innerHTML = ""; return; }
            var html = '<div class="acc-muted" style="margin-bottom:.3rem;"><b>Faturalar</b></div>';
            r.data.forEach(function (i) {
                html += '<div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);padding:.45rem 0;font-size:.85rem;">' +
                    "<span>" + esc(i.invoice_number || "—") + " · " + fmtA(i.amount) + "</span>" +
                    '<span class="acc-muted">' + (INV_TR[i.status] || i.status) +
                    (i.invoice_url ? ' · <a href="' + esc(i.invoice_url) + '" target="_blank" style="color:#D4AF37;">Görüntüle</a>' : "") + "</span></div>";
            });
            $("bilInvoices").innerHTML = html;
        });
    }

    // Plan seçimi → sunucuda pending niyet (sahte başarı yok)
    $("bilIntentBtn").addEventListener("click", function () {
        $("bilMsg").textContent = "Oluşturuluyor…";
        var h = { "Content-Type": "application/json", Authorization: "Bearer " + token };
        var oid = orgId(); if (oid) h["x-mia-org"] = oid;
        fetch("/api/create-checkout", { method: "POST", headers: h, body: JSON.stringify({ plan: $("bilPlan").value }) })
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
            .then(function (res) {
                if (!res.ok || !res.j.ok) { $("bilMsg").textContent = (res.j && (res.j.message || res.j.error)) || "Başlatılamadı."; return; }
                $("bilMsg").textContent = "Niyet kaydı oluşturuldu — satış ekibi havale bilgilerini iletecek.";
                load();
            })
            .catch(function () { $("bilMsg").textContent = "Bağlantı hatası."; });
    });

    supabase.auth.getSession().then(function (r) {
        if (!r.data.session) return; // hesap.js yönlendirir
        user = r.data.session.user;
        token = r.data.session.access_token;
        if (window.MIAOrg && window.MIAOrg.ready) window.MIAOrg.ready.then(load);
        else load();
    });
})();
