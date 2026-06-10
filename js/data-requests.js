// === MIA — Veri Sahibi Talepleri (Faz 4) ===
// KVKK m.11 hakları için manuel inceleme akışı: kullanıcı talep açar,
// data_subject_requests tablosuna yazılır (RLS: yalnız kendi kayıtları),
// durum güncellemesi yalnızca service_role (ekip) tarafından yapılır.
// Otomatik silme YOKTUR — bu fazda bilinçli olarak manuel inceleme.

(function () {
    if (!document.getElementById("dsrCard")) return;

    var $ = function (id) { return document.getElementById(id); };
    var TYPE_TR = {
        personal_data_deletion: "Kişisel veri silme",
        account_deletion: "Hesap silme",
        analysis_deletion: "Analiz silme",
        report_deletion: "Rapor silme",
        consent_export: "Rıza kayıtları dışa aktarımı"
    };
    var STATUS_TR = { submitted: "İletildi", under_review: "İncelemede", completed: "Tamamlandı", rejected: "Reddedildi" };
    var user = null;

    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

    function loadRequests() {
        supabase.from("data_subject_requests").select("*").order("created_at", { ascending: false }).then(function (r) {
            if (r.error) {
                console.warn("[MIA] Veri talepleri okunamadı (migration koşuldu mu?):", r.error.message);
                $("dsrList").innerHTML = '<span class="acc-muted">Talep listesi yüklenemedi.</span>';
                return;
            }
            var rows = r.data || [];
            if (!rows.length) { $("dsrList").innerHTML = '<span class="acc-muted">Henüz veri talebiniz yok.</span>'; return; }
            var html = "";
            rows.forEach(function (q) {
                html += '<div style="display:flex;justify-content:space-between;gap:.8rem;align-items:center;border-top:1px solid var(--border);padding:.55rem 0;font-size:.86rem;">' +
                    '<span>' + esc(TYPE_TR[q.request_type] || q.request_type) +
                    (q.request_details ? ' <span class="acc-muted">— ' + esc(q.request_details.slice(0, 80)) + '</span>' : '') + '</span>' +
                    '<span class="acc-muted" style="white-space:nowrap;">' + new Date(q.created_at).toLocaleDateString("tr-TR") +
                    ' · <b>' + esc(STATUS_TR[q.status] || q.status) + '</b></span></div>';
            });
            $("dsrList").innerHTML = html;
        });
    }

    function submitRequest() {
        var type = $("dsrType").value;
        $("dsrMsg").textContent = "Gönderiliyor…";
        // consent_export: rıza kayıtlarını anında JSON olarak da indir (kendi verisi, RLS izinli)
        var row = { user_id: user.id, request_type: type, request_details: $("dsrDetails").value.trim() || null };
        supabase.from("data_subject_requests").insert(row).then(function (r) {
            if (r.error) { $("dsrMsg").textContent = "Hata: " + r.error.message; return; }
            $("dsrMsg").textContent = "Talebiniz iletildi.";
            $("dsrDetails").value = "";
            if (type === "consent_export") exportConsents();
            loadRequests();
        });
    }

    // Rıza kayıtlarını JSON dosyası olarak indir (KVKK veri taşınabilirliği desteği).
    function exportConsents() {
        supabase.from("consents").select("document_key,version,accepted_at,page,user_agent").then(function (r) {
            if (r.error || !r.data) return;
            var blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), user_email: user.email, consents: r.data }, null, 2)], { type: "application/json" });
            var a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "mia-riza-kayitlari-" + Date.now() + ".json";
            document.body.appendChild(a); a.click();
            setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 200);
        });
    }

    $("dsrSubmitBtn").addEventListener("click", submitRequest);

    supabase.auth.getSession().then(function (r) {
        if (!r.data.session) return; // hesap.js zaten yönlendirir
        user = r.data.session.user;
        loadRequests();
    });
})();
