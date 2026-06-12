// === MIA Uygulaması — Giriş/Kayıt (Faz 17) ===
// AYNI Supabase auth: web hesabı bu uygulamada aynen geçerlidir.
// Sahte SSO yok — yalnız gerçekten desteklenen yöntemler gösterilir.

(function () {
    if (!document.getElementById("loginForm")) return;
    var $ = function (id) { return document.getElementById(id); };
    var mode = "login";

    function next() {
        var m = (location.search.match(/[?&]next=([^&]+)/) || [])[1];
        var n = m ? decodeURIComponent(m) : "/app/dashboard";
        return /^\/app\/[a-z]+$/.test(n) ? n : "/app/dashboard"; // yalnız app rotaları (open redirect yok)
    }
    function msg(t, ok) { $("lgMsg").textContent = t; $("lgMsg").style.color = ok ? "#22c55e" : "#ef4444"; }

    // Oturum zaten varsa direkt panele
    supabase.auth.getSession().then(function (r) {
        if (r.data.session) window.location.href = next();
    });

    function setMode(m) {
        mode = m;
        $("tabLogin").className = m === "login" ? "on" : "";
        $("tabRegister").className = m === "register" ? "on" : "";
        $("lgBtn").textContent = m === "login" ? "Giriş Yap" : "Kayıt Ol";
        $("lgExtras").style.display = m === "login" ? "" : "none";
        $("rgNote").style.display = m === "register" ? "" : "none";
        $("lgPass").autocomplete = m === "login" ? "current-password" : "new-password";
        msg("");
    }
    $("tabLogin").onclick = function () { setMode("login"); };
    $("tabRegister").onclick = function () { setMode("register"); };

    $("lgForgot").onclick = function (e) {
        e.preventDefault();
        var email = $("lgEmail").value.trim();
        if (!email) { msg("Önce e-posta adresinizi yazın."); return; }
        supabase.auth.resetPasswordForEmail(email, {
            redirectTo: "https://miaissagligi.com/sifre-sifirla.html"
        }).then(function (r) {
            msg(r.error ? "Gönderilemedi: " + r.error.message : "Şifre sıfırlama bağlantısı e-postanıza gönderildi.", !r.error);
        });
    };

    $("loginForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var email = $("lgEmail").value.trim(), pass = $("lgPass").value;
        if (!email || !pass) return;
        $("lgBtn").disabled = true; msg(mode === "login" ? "Giriş yapılıyor…" : "Kayıt oluşturuluyor…", true);
        var p = mode === "login"
            ? supabase.auth.signInWithPassword({ email: email, password: pass })
            : supabase.auth.signUp({ email: email, password: pass });
        p.then(function (r) {
            $("lgBtn").disabled = false;
            if (r.error) { msg(r.error.message === "Invalid login credentials" ? "E-posta veya şifre hatalı." : r.error.message); return; }
            if (mode === "register" && r.data && !r.data.session) {
                msg("Kayıt alındı — e-postanıza gelen doğrulama bağlantısını onaylayıp giriş yapın.", true);
                setMode("login");
                return;
            }
            window.location.href = next();
        });
    });
})();
