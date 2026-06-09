// === MIA — Plan Kayıt Defteri (Billing — Faz 5) ===
// Tek doğru kaynak: plan anahtarları, aylık AI analiz kotası, kamera limiti, fiyat.
// İstemci (hesap.html) buradan okur. Sunucu (guard.js) aynı kota haritasını
// bağımsız tutar (cross-dir bundling'i önlemek için) — değiştirirken İKİSİNİ de güncelle.
// Ödeme sağlayıcısı bağımsız: fiyat gösterim amaçlı; tahsilat sonra entegre edilir.

(function (root, factory) {
    var api = factory();
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    if (root) root.MIAPlans = api;
})(typeof window !== "undefined" ? window : null, function () {
    var PLANS = {
        free:      { key: "free",      name: "Ücretsiz / Deneme", monthly_ai: 10,    cameras: 1,   price_try: 0,     order: 0 },
        giris:     { key: "giris",     name: "Giriş — QR Pasif Takip", monthly_ai: 30,   cameras: 0,  price_try: 4000,  order: 1 },
        kamera_ai: { key: "kamera_ai", name: "Kamera AI",         monthly_ai: 300,   cameras: 10,  price_try: 12000, order: 2 },
        pro:       { key: "pro",       name: "Pro Füzyon",        monthly_ai: 1000,  cameras: 30,  price_try: 25000, order: 3 },
        kurumsal:  { key: "kurumsal",  name: "Kurumsal",          monthly_ai: 100000, cameras: -1, price_try: null,  order: 4 },
    };
    function get(key) { return PLANS[key] || PLANS.free; }
    function quota(key) { return get(key).monthly_ai; }
    return { PLANS: PLANS, get: get, quota: quota };
});
