// === MIA — Hesap & Abonelik (Billing — Faz 5) ===
// Mevcut plan + bu ayki AI kullanımı/kotası gösterir; plan listesi + yükseltme.
// Ödeme sağlayıcısı henüz yok → yükseltme talebi satış akışına (demo-talep) yönlenir
// (sağlayıcı bağlanınca startCheckout adaptörü gerçek ödemeye geçer). Global supabase + MIAPlans.

(function () {
    if (!document.getElementById("planList")) return;

    var user = null, token = null;
    function $(id){ return document.getElementById(id); }

    function render(usage) {
        var P = window.MIAPlans;
        var curKey = (usage && usage.plan) || "free";
        var cur = P.get(curKey);
        $("curPlan").textContent = cur.name;

        var used = (usage && usage.used_monthly_ai != null) ? usage.used_monthly_ai : null;
        var quota = (usage && usage.quota_monthly_ai) || cur.monthly_ai;
        if (used == null) {
            $("usageText").textContent = "Kullanım bilgisi alınamadı.";
        } else {
            var pctv = quota ? Math.min(100, Math.round(used / quota * 100)) : 0;
            $("usageBar").style.width = pctv + "%";
            $("usageText").textContent = "Bu ay " + used + " / " + quota + " AI çağrısı (" + pctv + "%) — 1 video analizi ≈ 10 çağrı";
        }

        var order = Object.keys(P.PLANS).map(function(k){ return P.PLANS[k]; }).sort(function(a,b){ return a.order - b.order; });
        var html = "";
        order.forEach(function (pl) {
            if (pl.key === "free") return; // ücretsiz planı kart olarak gösterme
            var isCur = pl.key === curKey;
            var price = pl.price_try == null ? "Özel" : ("₺" + pl.price_try.toLocaleString("tr-TR") + "/ay");
            var cam = pl.cameras === -1 ? "Sınırsız kamera" : (pl.cameras === 0 ? "QR/RFID" : pl.cameras + " kameraya kadar");
            html += '<div class="acc-pl' + (isCur ? ' current' : '') + '">' +
                '<h3>' + pl.name + '</h3>' +
                '<div class="pr">' + price + '</div>' +
                '<div class="q">' + pl.monthly_ai.toLocaleString("tr-TR") + ' AI çağrısı/ay (≈' + Math.round(pl.monthly_ai / 10).toLocaleString("tr-TR") + ' analiz) · ' + cam + '</div>' +
                (isCur
                    ? '<button disabled>Mevcut plan</button>'
                    : '<button data-plan="' + pl.key + '">' + (pl.price_try == null ? "İletişime Geç" : "Yükselt") + '</button>') +
                '</div>';
        });
        $("planList").innerHTML = html;
        Array.prototype.forEach.call($("planList").querySelectorAll("button[data-plan]"), function (b) {
            b.addEventListener("click", function () { startCheckout(b.getAttribute("data-plan")); });
        });
    }

    // Ödeme adaptörü — sağlayıcı yokken satış akışına yönlendirir.
    function startCheckout(planKey) {
        // Sağlayıcı (iyzico/Stripe) bağlanınca: burada checkout oturumu açılır.
        // Şimdilik plan ön-seçimiyle demo-talep formuna yönlendir (manuel satış).
        window.location.href = "demo-talep.html?plan=" + encodeURIComponent(planKey);
    }

    function loadUsage() {
        fetch("/api/usage", { headers: { Authorization: "Bearer " + token } })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (u) { render(u || {}); })
            .catch(function () { render({}); });
    }

    supabase.auth.getSession().then(function (r) {
        if (!r.data.session) { window.location.href = "giris-yap.html?next=hesap.html"; return; }
        user = r.data.session.user;
        token = r.data.session.access_token;
        loadUsage();
    });
})();
