// === TRANSLATIONS ===
var translations = {
    tr: {
        nav_home: "Ana Sayfa", nav_company: "Şirket", nav_contact: "İletişim", nav_login: "Giriş Yap", nav_signup: "Kayıt Ol", nav_analysis: "Analiz", nav_logout: "Çıkış",
        home_badge: "Yapay Zeka Destekli Güvenlik", home_title: "İnşaat Güvenliğinin<br>Geleceği", home_subtitle: "MIA, yapay zeka ile inşaat şantiyelerinde gerçek zamanlı PPE tespiti yaparak iş kazalarını önler.", home_cta: "Hemen Başla", home_learn: "Daha Fazla",
        stat_accuracy: "Tespit Doğruluğu", stat_monitoring: "Kesintisiz İzleme", stat_sec: "sn", stat_alert: "Anlık Uyarı",
        login_title: "Giriş Yap", login_subtitle: "Hesabınıza giriş yapın", login_btn: "Giriş Yap", login_footer: "Hesabınız yok mu?", login_link: "Kayıt olun",
        signup_title: "Kayıt Ol", signup_subtitle: "Ücretsiz hesap oluşturun", signup_btn: "Kayıt Ol", signup_footer: "Zaten hesabınız var mı?", signup_link: "Giriş yapın",
        label_email: "E-posta", label_password: "Şifre", label_password_confirm: "Şifre Tekrar", placeholder_email: "ornek@email.com", placeholder_password: "En az 6 karakter",
        new_analysis: "Yeni Analiz", dash_total: "Toplam Analiz", dash_avg: "Ortalama Skor", dash_violations: "Toplam İhlal", dash_month: "Bu Ay", dash_history: "Analiz Geçmişi",
        demo_title: "Güvenlik Analizi", demo_subtitle: "Video yükleyin ve yapay zeka destekli analizi deneyimleyin", upload_text: "Video yükleyin veya sürükleyin", upload_hint: "MP4, MOV, AVI (Maks. 100MB)", processing: "İşleniyor...", results_title: "Sonuçlar", new_btn: "Yeni",
        label_safety: "Güvenlik", label_frames: "Kare", label_violations: "İhlal", label_compliant: "Uyumlu", detections: "Tespitler",
        company_title: "Şirketimiz", company_subtitle: "İş güvenliğini yapay zeka ile dönüştürüyoruz", about_title: "MIA Nedir?", about_p1: "MIA, inşaat sektöründe iş kazalarını önlemek için geliştirilen yapay zeka platformudur.", about_p2: "YOLOv8 tabanlı teknoloji ile baret, yelek ve diğer PPE kullanımını tespit eder.",
        why_mia: "Neden MIA?", value1_title: "Gerçek Zamanlı", value1_desc: "7/24 kesintisiz izleme", value2_title: "Yüksek Doğruluk", value2_desc: "%99+ tespit doğruluğu", value3_title: "PDF Raporlar", value3_desc: "Otomatik raporlama",
        // Problem
        problem_label: "Problem", problem_title: "İnşaat sektöründe her yıl binlerce<br>önlenebilir iş kazası yaşanıyor.", problem_stat1_val: "1,800+", problem_stat1_label: "Yıllık ölümlü iş kazası", problem_stat1_sub: "Türkiye, 2023", problem_stat2_val: "₺50M+", problem_stat2_label: "Yıllık ceza maliyeti", problem_stat2_sub: "Sektör geneli", problem_stat3_val: "%85", problem_stat3_label: "Önlenebilir kaza oranı", problem_stat3_sub: "Araştırma verisi", problem_desc: "Geleneksel denetim yöntemleri yetersiz: sürekli gözlem yapılamıyor, büyük alanlarda takip imkansız, raporlama manuel ve zaman alıcı.",
        // Solution
        solution_label: "Çözüm", solution_title: "Yapay zeka destekli güvenlik platformu.", sol1_title: "Gerçek Zamanlı İzleme", sol1_desc: "7/24 kamera analizi", sol2_title: "AI Tespit", sol2_desc: "Baret, yelek, kemer ihlalleri", sol3_title: "Anlık Uyarılar", sol3_desc: "SMS ve e-posta bildirimi", sol4_title: "Detaylı Raporlar", sol4_desc: "Günlük güvenlik analitiği", solution_cta: "Tek platformda tüm şantiyelerinizi yönetin.", solution_cta_sub: "Mevcut kamera sistemlerinize entegre olur, ek donanım gerektirmez.",
        // How it works
        how_label: "Nasıl Çalışır", how_title: "Üç adımda güvenlik dönüşümü.", how1_title: "Bağlan", how1_desc: "Mevcut CCTV sistemini entegre et", how2_title: "Analiz Et", how2_desc: "AI görüntüleri gerçek zamanlı işler", how3_title: "Aksiyon Al", how3_desc: "Uyarı al ve rapor oluştur", how_tech: "Teknoloji: YOLOv8 • NVIDIA GPU • React • FastAPI • PostgreSQL",
        // Pricing
        nav_pricing: "Çözümler", pricing_title: "Çözümler", pricing_subtitle: "SaaS abonelik modeli", plan1_name: "Başlangıç", plan1_price: "₺5,000", plan1_period: "/ay", plan1_f1: "5 kamera", plan1_f2: "Temel raporlama", plan1_f3: "E-posta bildirimleri", plan1_cta: "Başla", plan2_name: "Profesyonel", plan2_price: "₺15,000", plan2_period: "/ay", plan2_f1: "25 kamera", plan2_f2: "Gelişmiş analitik", plan2_f3: "7/24 destek", plan2_f4: "SMS + E-posta uyarıları", plan2_cta: "Başla", plan2_badge: "Popüler", plan3_name: "Kurumsal", plan3_price: "Özel Teklif", plan3_period: "", plan3_f1: "Sınırsız kamera", plan3_f2: "Özel entegrasyon", plan3_f3: "Dedike destek ekibi", plan3_f4: "SLA garantisi", plan3_cta: "İletişime Geç",
        // Market
        market_label: "Pazar Fırsatı", market_title: "Büyüyen pazarda erken hamle avantajı.", market1_val: "₺2.5T", market1_label: "Türkiye İnşaat Sektörü", market1_sub: "Yıllık Pazar Büyüklüğü", market2_val: "$12B", market2_label: "Global AI Safety Pazarı", market2_sub: "2028 Tahmini (CAGR %18)", market_target: "Hedef: Büyük inşaat firmaları, altyapı projeleri, sanayi tesisleri, enerji sektörü",
        // Traction
        traction_label: "Mevcut Durum", traction_title: "Güçlü temeller, net hedefler.", trac1: "Çalışan MVP ürünü", trac2: "GPU-hızlandırılmış altyapı", trac3: "2,100+ görüntü ile eğitilmiş AI", trac4: "Canlı web platformu", roadmap_title: "2026 Yol Haritası", road_q1: "Pilot müşteriler", road_q2: "Mobil uygulama", road_q3: "10 aktif müşteri", road_q4: "Uluslararası genişleme", invest_title: "Yatırım Hedefi: ₺2.000.000 Seed Round", invest_desc: "Ürün geliştirme %40 • Satış & pazarlama %35 • Operasyon %25",
        // Founder details
        deniz_desc: "Boston University, Bilgisayar Müh.<br>HP & Trio Mobil AI Intern", ege_desc: "İş Geliştirme<br>Stratejik Ortaklıklar", gokberk_desc: "AS Teknolojik<br>Teknik Operasyonlar",
        contact_title: "İletişim", contact_subtitle: "Bizimle iletişime geçin", founders_title: "Kurucularımız", general_contact: "Genel İletişim", contact_cta: "Sorularınız için bize ulaşın",
        // Demo request
        nav_demo_request: "Demo Talep Et", demo_req_title: "Uzmanlarımızla Görüşme Planlayın", demo_req_subtitle: "Uzmanlarımız sorularınızı yanıtlayacak ve canlı bir demo anlatımı ile platform hakkında daha fazla bilgi verecekler. Formu doldurun, size hemen ulaşalım.", demo_req_badge: "Ücretsiz Demo",
        form_name: "Ad Soyad", form_company: "Şirket Adı", form_email: "E-Posta", form_phone: "Telefon", form_message: "Mesajınız", form_message_placeholder: "Projeniz hakkında kısaca bilgi verin...", form_submit: "Gönder", form_success: "Talebiniz alındı! En kısa sürede sizinle iletişime geçeceğiz.", form_required: "Bu alan zorunludur",
        // Chat
        chat_name: "MIA Asistan", chat_status: "Çevrimiçi", chat_welcome: "Merhaba! Size nasıl yardımcı olabilirim?", chat_placeholder: "Mesajınızı yazın...", chat_q1: "Çözümleriniz neler?", chat_q2: "Demo talep et", chat_q3: "Fiyatlandırma", chat_q4: "İletişim",
        chat_a1: "MIA, yapay zeka ile inşaat şantiyelerinde baret, yelek ve kemer gibi PPE kullanımını gerçek zamanlı tespit eder. 7/24 kamera analizi, anlık SMS/e-posta uyarıları ve detaylı PDF raporlar sunar.", chat_a2: "Harika! Demo talep formuna yönlendiriyorum.", chat_a3: "3 paketimiz var: Başlangıç (₺5,000/ay, 5 kamera), Profesyonel (₺15,000/ay, 25 kamera, 7/24 destek) ve Kurumsal (özel teklif, sınırsız kamera). Detaylar için Çözümler sayfamızı ziyaret edin.", chat_a4: "Bize dennizoge@gmail.com adresinden veya İletişim sayfamızdan ulaşabilirsiniz.", chat_default: "Teşekkürler! Mesajınız kaydedildi. Ekibimiz en kısa sürede sizinle iletişime geçecek.",
        footer: "© 2026 MIA - Tüm hakları saklıdır.",
        no_analyses: "Henüz analiz yok", no_analyses_desc: "Yeni Analiz butonuna tıklayın", no_violations: "İhlal Yok", passwords_not_match: "Şifreler eşleşmiyor", reading_video: "Video okunuyor...", sending_gpu: "GPU'ya gönderiliyor...", error: "Hata"
    },
    en: {
        nav_home: "Home", nav_company: "Company", nav_contact: "Contact", nav_login: "Login", nav_signup: "Sign Up", nav_analysis: "Analysis", nav_logout: "Logout",
        home_badge: "AI-Powered Safety", home_title: "The Future of<br>Construction Safety", home_subtitle: "MIA uses AI to detect PPE violations in real-time at construction sites, preventing workplace accidents.", home_cta: "Get Started", home_learn: "Learn More",
        stat_accuracy: "Detection Accuracy", stat_monitoring: "24/7 Monitoring", stat_sec: "s", stat_alert: "Instant Alert",
        login_title: "Login", login_subtitle: "Sign in to your account", login_btn: "Login", login_footer: "Don't have an account?", login_link: "Sign up",
        signup_title: "Sign Up", signup_subtitle: "Create a free account", signup_btn: "Sign Up", signup_footer: "Already have an account?", signup_link: "Login",
        label_email: "Email", label_password: "Password", label_password_confirm: "Confirm Password", placeholder_email: "example@email.com", placeholder_password: "At least 6 characters",
        new_analysis: "New Analysis", dash_total: "Total Analyses", dash_avg: "Average Score", dash_violations: "Total Violations", dash_month: "This Month", dash_history: "Analysis History",
        demo_title: "Safety Analysis", demo_subtitle: "Upload a video and experience AI-powered safety analysis", upload_text: "Upload or drag video", upload_hint: "MP4, MOV, AVI (Max 100MB)", processing: "Processing...", results_title: "Results", new_btn: "New",
        label_safety: "Safety", label_frames: "Frames", label_violations: "Violations", label_compliant: "Compliant", detections: "Detections",
        company_title: "Our Company", company_subtitle: "Transforming workplace safety with AI", about_title: "What is MIA?", about_p1: "MIA is an AI platform developed to prevent workplace accidents in the construction industry.", about_p2: "Using YOLOv8 technology, it detects helmets, vests, and other PPE usage.",
        why_mia: "Why MIA?", value1_title: "Real-Time", value1_desc: "24/7 continuous monitoring", value2_title: "High Accuracy", value2_desc: "99%+ detection accuracy", value3_title: "PDF Reports", value3_desc: "Automatic reporting",
        // Problem
        problem_label: "Problem", problem_title: "Thousands of preventable workplace<br>accidents occur every year in construction.", problem_stat1_val: "1,800+", problem_stat1_label: "Annual fatal accidents", problem_stat1_sub: "Turkey, 2023", problem_stat2_val: "₺50M+", problem_stat2_label: "Annual penalty costs", problem_stat2_sub: "Industry-wide", problem_stat3_val: "85%", problem_stat3_label: "Preventable accident rate", problem_stat3_sub: "Research data", problem_desc: "Traditional inspection methods are inadequate: continuous observation is impossible, large areas can't be monitored, reporting is manual and time-consuming.",
        // Solution
        solution_label: "Solution", solution_title: "AI-powered safety platform.", sol1_title: "Real-Time Monitoring", sol1_desc: "24/7 camera analysis", sol2_title: "AI Detection", sol2_desc: "Helmet, vest, harness violations", sol3_title: "Instant Alerts", sol3_desc: "SMS and email notifications", sol4_title: "Detailed Reports", sol4_desc: "Daily safety analytics", solution_cta: "Manage all your construction sites in one platform.", solution_cta_sub: "Integrates with your existing camera systems, no additional hardware required.",
        // How it works
        how_label: "How It Works", how_title: "Safety transformation in three steps.", how1_title: "Connect", how1_desc: "Integrate your existing CCTV system", how2_title: "Analyze", how2_desc: "AI processes footage in real-time", how3_title: "Take Action", how3_desc: "Get alerts and generate reports", how_tech: "Technology: YOLOv8 • NVIDIA GPU • React • FastAPI • PostgreSQL",
        // Pricing
        nav_pricing: "Solutions", pricing_title: "Solutions", pricing_subtitle: "SaaS subscription model", plan1_name: "Starter", plan1_price: "₺5,000", plan1_period: "/mo", plan1_f1: "5 cameras", plan1_f2: "Basic reporting", plan1_f3: "Email notifications", plan1_cta: "Get Started", plan2_name: "Professional", plan2_price: "₺15,000", plan2_period: "/mo", plan2_f1: "25 cameras", plan2_f2: "Advanced analytics", plan2_f3: "24/7 support", plan2_f4: "SMS + Email alerts", plan2_cta: "Get Started", plan2_badge: "Popular", plan3_name: "Enterprise", plan3_price: "Custom", plan3_period: "", plan3_f1: "Unlimited cameras", plan3_f2: "Custom integration", plan3_f3: "Dedicated support team", plan3_f4: "SLA guarantee", plan3_cta: "Contact Us",
        // Market
        market_label: "Market Opportunity", market_title: "First-mover advantage in a growing market.", market1_val: "₺2.5T", market1_label: "Turkey Construction Sector", market1_sub: "Annual Market Size", market2_val: "$12B", market2_label: "Global AI Safety Market", market2_sub: "2028 Forecast (CAGR 18%)", market_target: "Target: Large construction firms, infrastructure projects, industrial facilities, energy sector",
        // Traction
        traction_label: "Current Status", traction_title: "Strong foundations, clear goals.", trac1: "Working MVP product", trac2: "GPU-accelerated infrastructure", trac3: "AI trained on 2,100+ images", trac4: "Live web platform", roadmap_title: "2026 Roadmap", road_q1: "Pilot customers", road_q2: "Mobile app", road_q3: "10 active customers", road_q4: "International expansion", invest_title: "Investment Target: ₺2,000,000 Seed Round", invest_desc: "Product development 40% • Sales & marketing 35% • Operations 25%",
        // Founder details
        deniz_desc: "Boston University, Computer Engineering<br>HP & Trio Mobil AI Intern", ege_desc: "Business Development<br>Strategic Partnerships", gokberk_desc: "AS Teknolojik<br>Technical Operations",
        contact_title: "Contact", contact_subtitle: "Get in touch with us", founders_title: "Our Founders", general_contact: "General Contact", contact_cta: "Reach out for questions",
        // Demo request
        nav_demo_request: "Request Demo", demo_req_title: "Schedule a Meeting with Our Experts", demo_req_subtitle: "Our experts will answer your questions and provide a live demo walkthrough of the platform. Fill out the form and we'll get back to you right away.", demo_req_badge: "Free Demo",
        form_name: "Full Name", form_company: "Company Name", form_email: "Email", form_phone: "Phone", form_message: "Your Message", form_message_placeholder: "Tell us briefly about your project...", form_submit: "Submit", form_success: "Your request has been received! We will contact you shortly.", form_required: "This field is required",
        // Chat
        chat_name: "MIA Assistant", chat_status: "Online", chat_welcome: "Hello! How can I help you?", chat_placeholder: "Type your message...", chat_q1: "What are your solutions?", chat_q2: "Request a demo", chat_q3: "Pricing", chat_q4: "Contact",
        chat_a1: "MIA uses AI to detect PPE usage like helmets, vests, and harnesses at construction sites in real-time. We offer 24/7 camera analysis, instant SMS/email alerts, and detailed PDF reports.", chat_a2: "Great! Redirecting you to the demo request form.", chat_a3: "We have 3 plans: Starter (₺5,000/mo, 5 cameras), Professional (₺15,000/mo, 25 cameras, 24/7 support) and Enterprise (custom pricing, unlimited cameras). Visit our Solutions page for details.", chat_a4: "You can reach us at dennizoge@gmail.com or through our Contact page.", chat_default: "Thank you! Your message has been saved. Our team will get back to you shortly.",
        footer: "© 2026 MIA - All rights reserved.",
        no_analyses: "No analyses yet", no_analyses_desc: "Click New Analysis to start", no_violations: "No Violations", passwords_not_match: "Passwords do not match", reading_video: "Reading video...", sending_gpu: "Sending to GPU...", error: "Error"
    }
};

// === LANGUAGE ===
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

    if (typeof window.updateChatLang === 'function') window.updateChatLang();
}

document.getElementById('langTR').onclick = function() { setLanguage('tr'); };
document.getElementById('langEN').onclick = function() { setLanguage('en'); };

// === THEME ===
var sunIcon = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
var moonIcon = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mia_theme', theme);
    var icon = document.getElementById('themeIcon');
    if (icon) icon.innerHTML = theme === 'light' ? moonIcon : sunIcon;
}

var savedTheme = localStorage.getItem('mia_theme') || 'dark';
setTheme(savedTheme);

document.getElementById('themeToggle').onclick = function() {
    var current = document.documentElement.getAttribute('data-theme') || 'dark';
    setTheme(current === 'dark' ? 'light' : 'dark');
};

// === SUPABASE ===
var SUPABASE_URL = 'https://djjyyaumwhrwzjohymad.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqanl5YXVtd2hyd3pqb2h5bWFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzODkzMTksImV4cCI6MjA4NTk2NTMxOX0.-_czi4fQUalt-HGIqWnNmmCnkwv_pKmLOTMvk_UnB0k';
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
var currentUser = null;

// === AUTH ===
function updateAuthUI() {
    var loggedOut = document.getElementById('loggedOutNav');
    var loggedIn = document.getElementById('loggedInNav');
    var emailEl = document.getElementById('userEmail');
    if (currentUser) {
        loggedOut.style.display = 'none';
        loggedIn.style.display = 'flex';
        emailEl.textContent = currentUser.email;
    } else {
        loggedOut.style.display = 'flex';
        loggedIn.style.display = 'none';
    }
}

supabase.auth.getSession().then(function(r) {
    if (r.data.session) { currentUser = r.data.session.user; updateAuthUI(); }
});
supabase.auth.onAuthStateChange(function(e, s) {
    currentUser = s ? s.user : null; updateAuthUI();
});

document.getElementById('navLogout').onclick = function() {
    supabase.auth.signOut().then(function() { currentUser = null; updateAuthUI(); window.location.href = 'index.html'; });
};

// === LOGIN PAGE ===
var loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.onsubmit = function(e) {
        e.preventDefault();
        var email = document.getElementById('loginEmail').value;
        var pw = document.getElementById('loginPassword').value;
        var err = document.getElementById('loginError');
        var btn = document.getElementById('loginBtn');
        btn.disabled = true; btn.textContent = '...'; err.className = 'auth-error';
        supabase.auth.signInWithPassword({ email: email, password: pw }).then(function(r) {
            btn.disabled = false; btn.textContent = translations[currentLang].login_btn;
            if (r.error) { err.textContent = r.error.message; err.className = 'auth-error show'; }
            else { window.location.href = 'dashboard.html'; }
        });
    };
}

// === SIGNUP PAGE ===
var signupForm = document.getElementById('signupForm');
if (signupForm) {
    signupForm.onsubmit = function(e) {
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
            else { window.location.href = 'dashboard.html'; }
        });
    };
}

// === DASHBOARD PAGE ===
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

if (document.getElementById('totalAnalyses')) {
    supabase.auth.getSession().then(function(r) {
        if (r.data.session) { currentUser = r.data.session.user; loadDashboard(); }
        else { window.location.href = 'login.html'; }
    });
}

window.delA = function(id) { if (!confirm('Delete?')) return; supabase.from('analyses').delete().eq('id', id).then(function() { loadDashboard(); }); };
window.dlPdf = function(id) { supabase.from('analyses').select('pdf_base64,video_name').eq('id', id).single().then(function(r) { if (r.data && r.data.pdf_base64) { var b = atob(r.data.pdf_base64), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); var bl = new Blob([u], { type: 'application/pdf' }), a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = (r.data.video_name || 'report') + '.pdf'; a.click(); } }); };

// === DEMO PAGE ===
var uploadArea = document.getElementById('uploadArea');
if (uploadArea) {
    var currentVideoBlob = null;
    var currentPdfBase64 = null;
    var currentVideoName = '';
    var API_URL = 'https://dnizoge--mia-safety-detector-detect-video.modal.run';

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

    uploadArea.addEventListener('dragover', function(e) { e.preventDefault(); uploadArea.style.borderColor = 'var(--accent)'; uploadArea.style.background = 'rgba(245,158,11,0.05)'; });
    uploadArea.addEventListener('dragleave', function(e) { e.preventDefault(); uploadArea.style.borderColor = ''; uploadArea.style.background = ''; });
    uploadArea.addEventListener('drop', function(e) { e.preventDefault(); uploadArea.style.borderColor = ''; uploadArea.style.background = ''; if (e.dataTransfer.files[0] && e.dataTransfer.files[0].type.startsWith('video/')) { processVideo(e.dataTransfer.files[0]); } });
}

// === DEMO REQUEST FORM ===
var demoRequestForm = document.getElementById('demoRequestForm');
if (demoRequestForm) {
    demoRequestForm.onsubmit = function(e) {
        e.preventDefault();
        var btn = document.getElementById('demoSubmitBtn');
        var data = {
            name: document.getElementById('reqName').value,
            company: document.getElementById('reqCompany').value,
            email: document.getElementById('reqEmail').value,
            phone: document.getElementById('reqPhone').value,
            message: document.getElementById('reqMessage').value,
            created_at: new Date().toISOString()
        };
        btn.disabled = true; btn.textContent = '...';
        supabase.from('demo_requests').insert(data).then(function(r) {
            btn.disabled = false; btn.textContent = translations[currentLang].form_submit;
            if (r.error) { alert(translations[currentLang].error + ': ' + r.error.message); return; }
            demoRequestForm.style.display = 'none';
            document.getElementById('formSuccess').className = 'demo-form-success show';
        });
    };
}

// === CHAT WIDGET ===
(function() {
    var chatHTML = '<button class="chat-fab" id="chatFab"><svg viewBox="0 0 24 24" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>' +
        '<div class="chat-panel" id="chatPanel">' +
        '<div class="chat-header"><div class="chat-header-info"><div class="chat-header-avatar"><svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div><div><div class="chat-header-name" id="chatName">MIA Asistan</div><div class="chat-header-status" id="chatStatus">Çevrimiçi</div></div></div><button class="chat-close" id="chatClose"><svg viewBox="0 0 24 24" fill="none" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>' +
        '<div class="chat-messages" id="chatMessages"></div>' +
        '<div class="chat-quick-actions" id="chatQuickActions"></div>' +
        '<div class="chat-input-area"><input class="chat-input" id="chatInput" type="text"><button class="chat-send" id="chatSend"><svg viewBox="0 0 24 24" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button></div>' +
        '</div>';

    var chatContainer = document.createElement('div');
    chatContainer.innerHTML = chatHTML;
    document.body.appendChild(chatContainer);

    var fab = document.getElementById('chatFab');
    var panel = document.getElementById('chatPanel');
    var closeBtn = document.getElementById('chatClose');
    var messagesEl = document.getElementById('chatMessages');
    var quickEl = document.getElementById('chatQuickActions');
    var inputEl = document.getElementById('chatInput');
    var sendBtn = document.getElementById('chatSend');
    var chatOpened = false;

    function t(key) { return translations[currentLang][key] || key; }

    function addMsg(text, type) {
        var div = document.createElement('div');
        div.className = 'chat-msg ' + type;
        div.textContent = text;
        messagesEl.appendChild(div);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function showTyping() {
        var div = document.createElement('div');
        div.className = 'chat-typing';
        div.id = 'chatTypingIndicator';
        div.innerHTML = '<span></span><span></span><span></span>';
        messagesEl.appendChild(div);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function hideTyping() {
        var el = document.getElementById('chatTypingIndicator');
        if (el) el.remove();
    }

    function botReply(text, delay) {
        showTyping();
        setTimeout(function() { hideTyping(); addMsg(text, 'bot'); }, delay || 800);
    }

    function showQuickActions() {
        quickEl.innerHTML = '';
        var actions = [
            { key: 'chat_q1', answer: 'chat_a1' },
            { key: 'chat_q2', answer: 'chat_a2', action: 'demo' },
            { key: 'chat_q3', answer: 'chat_a3' },
            { key: 'chat_q4', answer: 'chat_a4' }
        ];
        for (var i = 0; i < actions.length; i++) {
            (function(a) {
                var btn = document.createElement('button');
                btn.className = 'chat-quick-btn';
                btn.textContent = t(a.key);
                btn.onclick = function() {
                    addMsg(t(a.key), 'user');
                    quickEl.innerHTML = '';
                    botReply(t(a.answer), 800);
                    if (a.action === 'demo') {
                        setTimeout(function() { window.location.href = 'demo-talep.html'; }, 2000);
                    } else {
                        setTimeout(showQuickActions, 1200);
                    }
                };
                quickEl.appendChild(btn);
            })(actions[i]);
        }
    }

    function initChat() {
        messagesEl.innerHTML = '';
        document.getElementById('chatName').textContent = t('chat_name');
        document.getElementById('chatStatus').textContent = t('chat_status');
        inputEl.placeholder = t('chat_placeholder');
        addMsg(t('chat_welcome'), 'bot');
        showQuickActions();
    }

    function handleSend() {
        var msg = inputEl.value.trim();
        if (!msg) return;
        addMsg(msg, 'user');
        inputEl.value = '';
        quickEl.innerHTML = '';

        // Save to Supabase
        supabase.from('chat_messages').insert({ message: msg, lang: currentLang, page: window.location.pathname, created_at: new Date().toISOString() });

        botReply(t('chat_default'), 1000);
        setTimeout(showQuickActions, 2200);
    }

    window.updateChatLang = function() {
        document.getElementById('chatName').textContent = t('chat_name');
        document.getElementById('chatStatus').textContent = t('chat_status');
        inputEl.placeholder = t('chat_placeholder');
        if (chatOpened) showQuickActions();
    };

    fab.onclick = function() {
        panel.classList.toggle('open');
        if (!chatOpened) { initChat(); chatOpened = true; }
    };
    closeBtn.onclick = function() { panel.classList.remove('open'); };
    sendBtn.onclick = handleSend;
    inputEl.onkeydown = function(e) { if (e.key === 'Enter') handleSend(); };
})();

// === INIT ===
setLanguage(currentLang);
