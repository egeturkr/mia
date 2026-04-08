// === TRANSLATIONS ===
var translations = {
    tr: {
        nav_home: "Ana Sayfa", nav_company: "Şirket", nav_contact: "İletişim", nav_login: "Giriş Yap", nav_signup: "Kayıt Ol", nav_analysis: "Analiz", nav_logout: "Çıkış",
        home_badge: "🛡️ Yapay Zeka Destekli Güvenlik", home_title: "İnşaat Güvenliğinin<br>Geleceği", home_subtitle: "MIA, yapay zeka ile inşaat şantiyelerinde gerçek zamanlı PPE tespiti yaparak iş kazalarını önler.", home_cta: "Hemen Başla", home_learn: "Daha Fazla",
        stat_accuracy: "Tespit Doğruluğu", stat_monitoring: "Kesintisiz İzleme", stat_sec: "sn", stat_alert: "Anlık Uyarı",
        login_title: "Giriş Yap", login_subtitle: "Hesabınıza giriş yapın", login_btn: "Giriş Yap", login_footer: "Hesabınız yok mu?", login_link: "Kayıt olun",
        signup_title: "Kayıt Ol", signup_subtitle: "Ücretsiz hesap oluşturun", signup_btn: "Kayıt Ol", signup_footer: "Zaten hesabınız var mı?", signup_link: "Giriş yapın",
        label_email: "E-posta", label_password: "Şifre", label_password_confirm: "Şifre Tekrar", placeholder_email: "ornek@email.com", placeholder_password: "En az 6 karakter",
        new_analysis: "Yeni Analiz", dash_total: "Toplam Analiz", dash_avg: "Ortalama Skor", dash_violations: "Toplam İhlal", dash_month: "Bu Ay", dash_history: "Analiz Geçmişi",
        demo_title: "Güvenlik Analizi", demo_subtitle: "Video yükleyin ve yapay zeka destekli analizi deneyimleyin", upload_text: "Video yükleyin veya sürükleyin", upload_hint: "MP4, MOV, AVI (Maks. 100MB)", processing: "İşleniyor...", results_title: "Sonuçlar", new_btn: "Yeni",
        label_safety: "Güvenlik", label_frames: "Kare", label_violations: "İhlal", label_compliant: "Uyumlu", detections: "Tespitler",
        company_title: "Şirketimiz", company_subtitle: "İş güvenliğini yapay zeka ile dönüştürüyoruz", about_title: "MIA Nedir?", about_p1: "MIA, inşaat sektöründe iş kazalarını önlemek için geliştirilen yapay zeka platformudur.", about_p2: "YOLOv8 tabanlı teknoloji ile baret, yelek ve diğer PPE kullanımını tespit eder.",
        why_mia: "Neden MIA?", value1_title: "Gerçek Zamanlı", value1_desc: "7/24 kesintisiz izleme", value2_title: "Yüksek Doğruluk", value2_desc: "%99+ tespit doğruluğu", value3_title: "PDF Raporlar", value3_desc: "Otomatik raporlama",
        contact_title: "İletişim", contact_subtitle: "Bizimle iletişime geçin", founders_title: "Kurucularımız", general_contact: "Genel İletişim", contact_cta: "Sorularınız için bize ulaşın",
        footer: "© 2026 MIA - Tüm hakları saklıdır.",
        no_analyses: "Henüz analiz yok", no_analyses_desc: "Yeni Analiz butonuna tıklayın", no_violations: "İhlal Yok", passwords_not_match: "Şifreler eşleşmiyor", reading_video: "Video okunuyor...", sending_gpu: "GPU'ya gönderiliyor...", error: "Hata"
    },
    en: {
        nav_home: "Home", nav_company: "Company", nav_contact: "Contact", nav_login: "Login", nav_signup: "Sign Up", nav_analysis: "Analysis", nav_logout: "Logout",
        home_badge: "🛡️ AI-Powered Safety", home_title: "The Future of<br>Construction Safety", home_subtitle: "MIA uses AI to detect PPE violations in real-time at construction sites, preventing workplace accidents.", home_cta: "Get Started", home_learn: "Learn More",
        stat_accuracy: "Detection Accuracy", stat_monitoring: "24/7 Monitoring", stat_sec: "s", stat_alert: "Instant Alert",
        login_title: "Login", login_subtitle: "Sign in to your account", login_btn: "Login", login_footer: "Don't have an account?", login_link: "Sign up",
        signup_title: "Sign Up", signup_subtitle: "Create a free account", signup_btn: "Sign Up", signup_footer: "Already have an account?", signup_link: "Login",
        label_email: "Email", label_password: "Password", label_password_confirm: "Confirm Password", placeholder_email: "example@email.com", placeholder_password: "At least 6 characters",
        new_analysis: "New Analysis", dash_total: "Total Analyses", dash_avg: "Average Score", dash_violations: "Total Violations", dash_month: "This Month", dash_history: "Analysis History",
        demo_title: "Safety Analysis", demo_subtitle: "Upload a video and experience AI-powered safety analysis", upload_text: "Upload or drag video", upload_hint: "MP4, MOV, AVI (Max 100MB)", processing: "Processing...", results_title: "Results", new_btn: "New",
        label_safety: "Safety", label_frames: "Frames", label_violations: "Violations", label_compliant: "Compliant", detections: "Detections",
        company_title: "Our Company", company_subtitle: "Transforming workplace safety with AI", about_title: "What is MIA?", about_p1: "MIA is an AI platform developed to prevent workplace accidents in the construction industry.", about_p2: "Using YOLOv8 technology, it detects helmets, vests, and other PPE usage.",
        why_mia: "Why MIA?", value1_title: "Real-Time", value1_desc: "24/7 continuous monitoring", value2_title: "High Accuracy", value2_desc: "99%+ detection accuracy", value3_title: "PDF Reports", value3_desc: "Automatic reporting",
        contact_title: "Contact", contact_subtitle: "Get in touch with us", founders_title: "Our Founders", general_contact: "General Contact", contact_cta: "Reach out for questions",
        footer: "© 2026 MIA - All rights reserved.",
        no_analyses: "No analyses yet", no_analyses_desc: "Click New Analysis to start", no_violations: "No Violations", passwords_not_match: "Passwords do not match", reading_video: "Reading video...", sending_gpu: "Sending to GPU...", error: "Error"
    }
};

var currentLang = localStorage.getItem('mia_lang') || 'tr';

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('mia_lang', lang);
    document.getElementById('langTR').className = lang === 'tr' ? 'lang-btn active' : 'lang-btn';
    document.getElementById('langEN').className = lang === 'en' ? 'lang-btn active' : 'lang-btn';
    document.documentElement.lang = lang;

    var elements = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < elements.length; i++) {
        var key = elements[i].getAttribute('data-i18n');
        if (translations[lang][key]) {
            elements[i].innerHTML = translations[lang][key];
        }
    }

    var placeholders = document.querySelectorAll('[data-i18n-placeholder]');
    for (var j = 0; j < placeholders.length; j++) {
        var pkey = placeholders[j].getAttribute('data-i18n-placeholder');
        if (translations[lang][pkey]) {
            placeholders[j].placeholder = translations[lang][pkey];
        }
    }
}

document.getElementById('langTR').onclick = function() { setLanguage('tr'); };
document.getElementById('langEN').onclick = function() { setLanguage('en'); };

// === SUPABASE ===
var SUPABASE_URL = 'https://djjyyaumwhrwzjohymad.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqanl5YXVtd2hyd3pqb2h5bWFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzODkzMTksImV4cCI6MjA4NTk2NTMxOX0.-_czi4fQUalt-HGIqWnNmmCnkwv_pKmLOTMvk_UnB0k';
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
var currentUser = null;
var currentVideoBlob = null;
var currentPdfBase64 = null;
var currentVideoName = '';
var API_URL = 'https://dnizoge--mia-safety-detector-detect-video.modal.run';

// === NAVIGATION ===
function goToPage(pageId) {
    var pages = ['home','login','signup','dashboard','demo','sirket','iletisim'];
    for (var i = 0; i < pages.length; i++) { document.getElementById(pages[i]).className = 'page'; }
    document.getElementById(pageId).className = 'page active';
    var btns = ['navHome','navSirket','navIletisim','navDashboard','navDemo'];
    for (var j = 0; j < btns.length; j++) { var b = document.getElementById(btns[j]); if(b) b.className = b.className.replace(' active',''); }
    if (pageId === 'home') document.getElementById('navHome').className += ' active';
    if (pageId === 'sirket') document.getElementById('navSirket').className += ' active';
    if (pageId === 'iletisim') document.getElementById('navIletisim').className += ' active';
    if (pageId === 'dashboard' && document.getElementById('navDashboard')) document.getElementById('navDashboard').className += ' active';
    if (pageId === 'demo' && document.getElementById('navDemo')) document.getElementById('navDemo').className += ' active';
    window.scrollTo(0, 0);
}

// === AUTH ===
function updateAuthUI() {
    if (currentUser) {
        document.getElementById('loggedOutNav').style.display = 'none';
        document.getElementById('loggedInNav').style.display = 'flex';
        document.getElementById('userEmail').textContent = currentUser.email;
    } else {
        document.getElementById('loggedOutNav').style.display = 'flex';
        document.getElementById('loggedInNav').style.display = 'none';
    }
}

supabase.auth.getSession().then(function(r) { if (r.data.session) { currentUser = r.data.session.user; updateAuthUI(); } });
supabase.auth.onAuthStateChange(function(e, s) { currentUser = s ? s.user : null; updateAuthUI(); });

// === EVENT LISTENERS ===
document.getElementById('logoBtn').onclick = function() { goToPage('home'); };
document.getElementById('navHome').onclick = function() { goToPage('home'); };
document.getElementById('navSirket').onclick = function() { goToPage('sirket'); };
document.getElementById('navIletisim').onclick = function() { goToPage('iletisim'); };
document.getElementById('navLogin').onclick = function() { goToPage('login'); };
document.getElementById('navSignup').onclick = function() { goToPage('signup'); };
document.getElementById('navDashboard').onclick = function() { loadDashboard(); goToPage('dashboard'); };
document.getElementById('navDemo').onclick = function() { goToPage('demo'); };
document.getElementById('goToSignup').onclick = function() { goToPage('signup'); };
document.getElementById('goToLogin').onclick = function() { goToPage('login'); };
document.getElementById('heroStartBtn').onclick = function() { goToPage(currentUser ? 'demo' : 'signup'); };
document.getElementById('heroSirketBtn').onclick = function() { goToPage('sirket'); };
document.getElementById('newAnalysisFromDash').onclick = function() { goToPage('demo'); };
document.getElementById('navLogout').onclick = function() { supabase.auth.signOut().then(function() { currentUser = null; updateAuthUI(); goToPage('home'); }); };

// === LOGIN ===
document.getElementById('loginForm').onsubmit = function(e) {
    e.preventDefault();
    var email = document.getElementById('loginEmail').value;
    var pw = document.getElementById('loginPassword').value;
    var err = document.getElementById('loginError');
    var btn = document.getElementById('loginBtn');
    btn.disabled = true; btn.textContent = '...'; err.className = 'auth-error';
    supabase.auth.signInWithPassword({ email: email, password: pw }).then(function(r) {
        btn.disabled = false; btn.textContent = translations[currentLang].login_btn;
        if (r.error) { err.textContent = r.error.message; err.className = 'auth-error show'; }
        else { currentUser = r.data.user; updateAuthUI(); loadDashboard(); goToPage('dashboard'); }
    });
};

// === SIGNUP ===
document.getElementById('signupForm').onsubmit = function(e) {
    e.preventDefault();
    var email = document.getElementById('signupEmail').value;
    var pw = document.getElementById('signupPassword').value;
    var pw2 = document.getElementById('signupPasswordConfirm').value;
    var err = document.getElementById('signupError');
    var btn = document.getElementById('signupBtn');
    if (pw !== pw2) { err.textContent = translations[currentLang].passwords_not_match; err.className = 'auth-error show'; return; }
    btn.disabled = true; btn.textContent = '...'; err.className = 'auth-error';
    supabase.auth.signUp({ email: email, password: pw }).then(function(r) {
        btn.disabled = false; btn.textContent = translations[currentLang].signup_btn;
        if (r.error) { err.textContent = r.error.message; err.className = 'auth-error show'; }
        else { currentUser = r.data.user; updateAuthUI(); loadDashboard(); goToPage('dashboard'); }
    });
};

// === DASHBOARD ===
function loadDashboard() {
    if (!currentUser) return;
    supabase.from('analyses').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }).then(function(r) {
        var a = r.data || [];
        document.getElementById('totalAnalyses').textContent = a.length;
        var tv = 0, ts = 0, tm = 0, now = new Date();
        for (var i = 0; i < a.length; i++) { tv += a[i].violations_count || 0; ts += a[i].safety_score || 0; var d = new Date(a[i].created_at); if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) tm++; }
        document.getElementById('totalViolations').textContent = tv;
        document.getElementById('thisMonth').textContent = tm;
        document.getElementById('avgScore').textContent = a.length > 0 ? Math.round(ts / a.length) + '%' : '-';
        var html = '';
        if (a.length === 0) { html = '<div class="no-analyses"><svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><h3>' + translations[currentLang].no_analyses + '</h3><p>' + translations[currentLang].no_analyses_desc + '</p></div>'; }
        else { for (var j = 0; j < a.length; j++) { var x = a[j]; var dt = new Date(x.created_at).toLocaleDateString(currentLang === 'tr' ? 'tr-TR' : 'en-US'); html += '<div class="analysis-card"><div class="analysis-info"><h3>' + (x.video_name || 'Video') + '</h3><p>' + dt + '</p></div><div class="analysis-stats"><div class="analysis-stat"><div class="analysis-stat-value score">' + Math.round(x.safety_score || 0) + '%</div><div class="analysis-stat-label">' + translations[currentLang].label_safety + '</div></div><div class="analysis-stat"><div class="analysis-stat-value violations">' + (x.violations_count || 0) + '</div><div class="analysis-stat-label">' + translations[currentLang].label_violations + '</div></div></div><div class="analysis-actions">' + (x.pdf_base64 ? '<button class="btn btn-success btn-sm" onclick="dlPdf(\'' + x.id + '\')">PDF</button>' : '') + '<button class="btn btn-danger btn-sm" onclick="delA(\'' + x.id + '\')">×</button></div></div>'; } }
        document.getElementById('analysesList').innerHTML = html;
    });
}

window.delA = function(id) { if (!confirm('Delete?')) return; supabase.from('analyses').delete().eq('id', id).then(function() { loadDashboard(); }); };
window.dlPdf = function(id) { supabase.from('analyses').select('pdf_base64,video_name').eq('id', id).single().then(function(r) { if (r.data && r.data.pdf_base64) { var b = atob(r.data.pdf_base64), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); var bl = new Blob([u], { type: 'application/pdf' }), a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = (r.data.video_name || 'report') + '.pdf'; a.click(); } }); };

// === VIDEO UPLOAD & ANALYSIS ===
var uploadArea = document.getElementById('uploadArea');
var fileInput = document.getElementById('fileInput');
var progressContainer = document.getElementById('progressContainer');
var progressFill = document.getElementById('progressFill');
var progressText = document.getElementById('progressText');
var resultsSection = document.getElementById('resultsSection');
var resultVideo = document.getElementById('resultVideo');

uploadArea.onclick = function() { fileInput.click(); };
fileInput.onchange = function() { if (fileInput.files[0]) processVideo(fileInput.files[0]); };

function processVideo(file) {
    currentVideoName = file.name;
    uploadArea.style.display = 'none';
    progressContainer.style.display = 'block';
    resultsSection.style.display = 'none';
    progressFill.style.width = '10%';
    progressText.textContent = translations[currentLang].reading_video;
    var reader = new FileReader();
    reader.onload = function() {
        var base64 = reader.result.split(',')[1];
        progressFill.style.width = '30%'; progressText.textContent = translations[currentLang].sending_gpu;
        fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ video: base64, confidence: 0.25, generate_report: true }) })
        .then(function(res) { return res.json(); })
        .then(function(result) {
            progressFill.style.width = '100%';
            if (result.error) { alert(translations[currentLang].error + ': ' + result.error); resetDemo(); return; }
            showResults(result);
            if (currentUser) saveAnalysis(result);
        }).catch(function(err) { alert(translations[currentLang].error + ': ' + err.message); resetDemo(); });
    };
    reader.readAsDataURL(file);
}

function saveAnalysis(result) {
    var s = result.summary || {};
    supabase.from('analyses').insert({ user_id: currentUser.id, video_name: currentVideoName, safety_score: s.safety_score || 100, violations_count: s.total_violations || 0, safe_count: s.total_safe_detections || 0, frames_processed: s.processed_frames || 0, processing_time: s.processing_time_seconds || 0, pdf_base64: result.pdf_base64 || null });
}

// === RESULTS ===
function showResults(result) {
    progressContainer.style.display = 'none';
    resultsSection.style.display = 'block';
    var bin = atob(result.video_base64), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    currentVideoBlob = new Blob([u], { type: 'video/mp4' });
    resultVideo.src = URL.createObjectURL(currentVideoBlob);
    if (result.pdf_base64) { currentPdfBase64 = result.pdf_base64; document.getElementById('downloadReportBtn').style.display = 'inline-flex'; }
    var s = result.summary || {};
    document.getElementById('safetyScore').textContent = (s.safety_score || 100).toFixed(0) + '%';
    document.getElementById('framesAnalyzed').textContent = s.processed_frames || 0;
    document.getElementById('violationsCount').textContent = s.total_violations || 0;
    document.getElementById('safeCount').textContent = s.total_safe_detections || 0;
    document.getElementById('processingTime').textContent = (s.processing_time_seconds || 0).toFixed(1) + 's';
    var v = result.violations || [], h = '';
    if (v.length === 0) h = '<div class="no-detections"><svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><p>' + translations[currentLang].no_violations + '</p></div>';
    else { for (var j = 0; j < Math.min(v.length, 50); j++) h += '<div class="detection-item"><div class="detection-class">⚠️ ' + v[j].class_name + '</div><div class="detection-meta">' + (v[j].timestamp_formatted || '') + '</div></div>'; }
    document.getElementById('detectionsList').innerHTML = h;
}

function resetDemo() {
    uploadArea.style.display = 'block'; progressContainer.style.display = 'none'; resultsSection.style.display = 'none';
    fileInput.value = ''; currentVideoBlob = null; currentPdfBase64 = null;
    document.getElementById('downloadReportBtn').style.display = 'none';
}

document.getElementById('downloadBtn').onclick = function() { if (currentVideoBlob) { var a = document.createElement('a'); a.href = URL.createObjectURL(currentVideoBlob); a.download = currentVideoName.replace(/\.[^.]+$/, '') + '_analyzed.mp4'; a.click(); } };

document.getElementById('downloadReportBtn').onclick = function() { if (currentPdfBase64) { var b = atob(currentPdfBase64), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); var bl = new Blob([u], { type: 'application/pdf' }), a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = currentVideoName.replace(/\.[^.]+$/, '') + '_report.pdf'; a.click(); } };

document.getElementById('newAnalysisBtn').onclick = function() { resetDemo(); };

// === DRAG & DROP ===
uploadArea.addEventListener('dragover', function(e) { e.preventDefault(); uploadArea.style.borderColor = 'var(--accent)'; uploadArea.style.background = 'rgba(245,158,11,0.05)'; });
uploadArea.addEventListener('dragleave', function(e) { e.preventDefault(); uploadArea.style.borderColor = ''; uploadArea.style.background = ''; });
uploadArea.addEventListener('drop', function(e) { e.preventDefault(); uploadArea.style.borderColor = ''; uploadArea.style.background = ''; if (e.dataTransfer.files[0] && e.dataTransfer.files[0].type.startsWith('video/')) { processVideo(e.dataTransfer.files[0]); } });

// === INIT ===
setLanguage(currentLang);
