// === MIA — QR Üret & Eşleştir (Sprint 4) ===
// İşçi rozeti ve KKD etiketi kayıtları oluşturur, her biri için yazdırılabilir
// QR kodu üretir. Kod tag-agnostik bir string'tir (RFID'e geçişte UID ile
// değiştirilebilir). Global `supabase` js/app.js'ten gelir.

(function () {
    if (!document.getElementById("qrItems")) return;

    var user = null;
    var tab = "workers";
    var TYPE_TR = { helmet: "Baret", vest: "Yelek", mask: "Maske" };

    function $(id) { return document.getElementById(id); }

    function shortId() {
        var a = new Uint8Array(5);
        (window.crypto || {}).getRandomValues ? window.crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.floor(Math.random() * 256); });
        return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    }

    function loadWorkersIntoSelect() {
        return supabase.from("workers").select("id,full_name").eq("user_id", user.id).eq("active", true).order("full_name").then(function (r) {
            var sel = $("eWorker");
            sel.innerHTML = '<option value="">— Atama yok —</option>';
            (r.data || []).forEach(function (w) {
                var o = document.createElement("option"); o.value = w.id; o.textContent = w.full_name; sel.appendChild(o);
            });
        });
    }

    function renderQR(container, text) {
        container.innerHTML = "";
        new QRCode(container, { text: text, width: 128, height: 128, correctLevel: QRCode.CorrectLevel.M });
    }

    function makeItem(opts) {
        // opts: {name, meta, code}
        var div = document.createElement("div");
        div.className = "qr-item";
        var box = document.createElement("div"); box.className = "qrbox";
        div.appendChild(box);
        var name = document.createElement("div"); name.className = "qr-name"; name.textContent = opts.name; div.appendChild(name);
        if (opts.meta) { var m = document.createElement("div"); m.className = "qr-meta"; m.textContent = opts.meta; div.appendChild(m); }
        var code = document.createElement("div"); code.className = "qr-code"; code.textContent = opts.code; div.appendChild(code);
        renderQR(box, opts.code);
        return div;
    }

    function renderList() {
        var wrap = $("qrItems"); wrap.innerHTML = "Yükleniyor…";
        if (tab === "workers") {
            supabase.from("workers").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).then(function (r) {
                wrap.innerHTML = "";
                if (!r.data || !r.data.length) { wrap.innerHTML = '<p style="color:#8a8a8a;">Henüz işçi yok.</p>'; return; }
                r.data.forEach(function (w) { wrap.appendChild(makeItem({ name: w.full_name, meta: w.site || "", code: w.code })); });
            });
        } else {
            supabase.from("equipment").select("*,workers(full_name)").eq("user_id", user.id).order("created_at", { ascending: false }).then(function (r) {
                wrap.innerHTML = "";
                if (!r.data || !r.data.length) { wrap.innerHTML = '<p style="color:#8a8a8a;">Henüz KKD yok.</p>'; return; }
                r.data.forEach(function (e) {
                    var assigned = e.workers && e.workers.full_name ? "→ " + e.workers.full_name : "atanmamış";
                    wrap.appendChild(makeItem({ name: TYPE_TR[e.type] || e.type, meta: assigned, code: e.code }));
                });
            });
        }
    }

    function addWorker() {
        var name = $("wName").value.trim();
        if (!name) { alert("Ad Soyad gerekli."); return; }
        var code = "MIA-W-" + shortId();
        $("addWorker").disabled = true;
        supabase.from("workers").insert({ user_id: user.id, full_name: name, site: $("wSite").value.trim() || null, code: code }).then(function (r) {
            $("addWorker").disabled = false;
            if (r.error) { alert("Hata: " + r.error.message); return; }
            $("wName").value = ""; $("wSite").value = "";
            loadWorkersIntoSelect();
            tab = "workers"; syncTabs(); renderList();
        });
    }

    function addEquip() {
        var type = $("eType").value;
        var code = "MIA-E-" + type + "-" + shortId();
        $("addEquip").disabled = true;
        supabase.from("equipment").insert({ user_id: user.id, type: type, code: code, assigned_worker_id: $("eWorker").value || null }).then(function (r) {
            $("addEquip").disabled = false;
            if (r.error) { alert("Hata: " + r.error.message); return; }
            tab = "equipment"; syncTabs(); renderList();
        });
    }

    function syncTabs() {
        document.querySelectorAll(".qr-tab").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-tab") === tab); });
    }

    function init() {
        $("addWorker").addEventListener("click", addWorker);
        $("addEquip").addEventListener("click", addEquip);
        document.querySelectorAll(".qr-tab").forEach(function (b) {
            b.addEventListener("click", function () { tab = b.getAttribute("data-tab"); syncTabs(); renderList(); });
        });
        supabase.auth.getSession().then(function (r) {
            if (!r.data.session) { window.location.href = "giris-yap.html?next=qr-uret.html"; return; }
            user = r.data.session.user;
            loadWorkersIntoSelect();
            renderList();
        });
    }

    init();
})();
