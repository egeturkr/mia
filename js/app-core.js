// === MIA Uygulaması — Çekirdek (Faz 17 hotfix) ===
// App sayfaları pazarlama js/app.js'ini YÜKLEMEZ (chat widget'ı, i18n, nav
// mantığı app deneyimini bozuyordu). Bu dosya yalnız ortak çekirdeği sağlar:
// Supabase istemcisi (js/app.js ile AYNI yapılandırma — storageKey 'mia.auth'
// sayesinde web ve app OTURUMU PAYLAŞIR) + miaEsc.
// NOT: URL/anon key js/app.js ile senkron tutulmalıdır (anon key istemci-güvenlidir).

var SUPABASE_URL = window.MIA_SUPABASE_URL || 'https://qojtokomfcporcglrsdy.supabase.co';
var SUPABASE_KEY = window.MIA_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvanRva29tZmNwb3JjZ2xyc2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5ODM2MDQsImV4cCI6MjA5NTU1OTYwNH0.nQarNqVxI5JPInisVPvNZXOQmAWr5Nt0tRMHqKRXiwM';

var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'mia.auth' }
});

window.miaEsc = window.miaEsc || function (s) {
    return String(s == null ? '' : s).replace(/[<>&"']/g, function (c) {
        return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c];
    });
};
