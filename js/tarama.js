// === MIA — KKD Tarama (Sprint 4) ===
// Telefon kamerasıyla sürekli QR okur; okunan kodu hesabın işçi/ekipman
// kayıtlarına göre otomatik sınıflar, baret+yelek uyumluluğunu canlı gösterir
// ve scans tablosuna yazar. Global `supabase` js/app.js'ten gelir.

(function () {
    if (!document.getElementById("reader")) return;

    var REQUIRED = { helmet: true, vest: true }; // pilot: baret + yelek
    var user = null;
    var workersByCode = {};     // code -> {id, full_name}
    var equipmentByCode = {};   // code -> {type, assigned_worker_id}
    var current = { worker: null, code: null, present: {} };
    var lastDecode = { code: "", t: 0 };
    var scanner = null;

    function $(id) { return document.getElementById(id); }
    function toast(msg) {
        var el = $("toast"); el.textContent = msg; el.classList.add("show");
        clearTimeout(toast._t); toast._t = setTimeout(function () { el.classList.remove("show"); }, 1600);
    }
    function beep(ok) {
        try { if (navigator.vibrate) navigator.vibrate(ok ? 60 : [40, 40, 40]); } catch (e) {}
    }

    function loadRefData() {
        return Promise.all([
            supabase.from("workers").select("id,full_name,code").eq("user_id", user.id).eq("active", true),
            supabase.from("equipment").select("type,code,assigned_worker_id").eq("user_id", user.id).eq("active", true),
            supabase.from("checkpoints").select("id,name,site").eq("user_id", user.id).order("name")
        ]).then(function (res) {
            (res[0].data || []).forEach(function (w) { workersByCode[w.code] = w; });
            (res[1].data || []).forEach(function (e) { equipmentByCode[e.code] = e; });
            var sel = $("checkpoint");
            (res[2].data || []).forEach(function (c) {
                var o = document.createElement("option");
                o.value = c.id; o.textContent = c.name + (c.site ? " — " + c.site : "");
                sel.appendChild(o);
            });
        });
    }

    function renderChip(id, type) {
        var el = $(id);
        el.className = "ppe-chip" + (current.present[type] ? " on" : (current.worker ? " miss" : ""));
    }

    function missing() {
        return Object.keys(REQUIRED).filter(function (k) { return REQUIRED[k] && !current.present[k]; });
    }

    function render() {
        var wn = $("workerName");
        if (current.worker) { wn.textContent = current.worker.full_name; wn.className = "scan-worker"; }
        else if (current.code) { wn.textContent = "Bilinmeyen rozet: " + current.code; wn.className = "scan-worker unknown"; }
        else { wn.textContent = "İşçi okutulmadı"; wn.className = "scan-worker unknown"; }

        renderChip("chipHelmet", "helmet");
        renderChip("chipVest", "vest");

        var v = $("verdict");
        if (!current.worker) { v.className = "verdict idle"; v.textContent = "İşçi rozetini okutun"; $("btnSave").disabled = true; return; }
        var miss = missing();
        if (miss.length === 0) { v.className = "verdict ok"; v.textContent = "✓ UYUMLU"; }
        else {
            var names = { helmet: "Baret", vest: "Yelek" };
            v.className = "verdict bad"; v.textContent = "✗ EKSİK: " + miss.map(function (m) { return names[m] || m; }).join(", ");
        }
        $("btnSave").disabled = false;
    }

    function onDecode(text) {
        var now = Date.now();
        if (text === lastDecode.code && now - lastDecode.t < 2000) return; // aynı kodu tekrar okuma
        lastDecode = { code: text, t: now };

        if (workersByCode[text]) {
            current = { worker: workersByCode[text], code: text, present: {} }; // yeni işçi → KKD sıfırla
            beep(true); toast("İşçi: " + current.worker.full_name);
        } else if (equipmentByCode[text]) {
            var eq = equipmentByCode[text];
            if (eq.assigned_worker_id && current.worker && eq.assigned_worker_id !== current.worker.id) {
                beep(false); toast("Bu KKD başka işçiye atanmış");
            } else {
                current.present[eq.type] = true;
                beep(true); toast(({ helmet: "Baret", vest: "Yelek", mask: "Maske" }[eq.type] || eq.type) + " okundu");
            }
        } else {
            beep(false); toast("Bilinmeyen kod");
            if (!current.worker) current.code = text;
        }
        render();
    }

    function save() {
        if (!current.worker) return;
        var miss = missing();
        var row = {
            user_id: user.id,
            checkpoint_id: $("checkpoint").value || null,
            worker_id: current.worker.id,
            worker_code: current.worker.code,
            worker_name: current.worker.full_name,
            ppe_present: current.present,
            required: REQUIRED,
            missing: miss,
            compliant: miss.length === 0,
            source: "qr"
        };
        $("btnSave").disabled = true;
        supabase.from("scans").insert(row).then(function (r) {
            if (r.error) { toast("Kayıt hatası: " + r.error.message); $("btnSave").disabled = false; }
            else { toast(row.compliant ? "✓ Kaydedildi (uyumlu)" : "Kaydedildi (eksik KKD)"); reset(); }
        });
    }

    function reset() {
        current = { worker: null, code: null, present: {} };
        lastDecode = { code: "", t: 0 };
        render();
    }

    function startScanner() {
        scanner = new Html5Qrcode("reader");
        var config = { fps: 10, qrbox: { width: 220, height: 220 } };
        scanner.start({ facingMode: "environment" }, config, onDecode, function () {})
            .catch(function (e) {
                $("scanHint").textContent = "Kamera başlatılamadı: " + (e && e.message || e) + " — kamera izni verin.";
            });
    }

    function init() {
        $("btnSave").addEventListener("click", save);
        $("btnReset").addEventListener("click", reset);
        supabase.auth.getSession().then(function (r) {
            if (!r.data.session) { window.location.href = "giris-yap.html?next=tarama.html"; return; }
            user = r.data.session.user;
            loadRefData().then(function () { render(); startScanner(); });
        });
    }

    init();
})();
