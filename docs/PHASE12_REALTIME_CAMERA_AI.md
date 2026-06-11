# Faz 12 — Gerçek Zamanlı Kamera AI

## Mimari karar (net)
**Netlify Functions RTSP akışı TUTAMAZ** (10 sn yürütme limiti, kalıcı süreç yok). Doğru mimari:

```
MIA app (cameras.html) → Supabase cameras kaydı (meta, KİMLİK BİLGİSİZ)
Ayrı Python worker (VM/Fly/Render/yerel) → cameras.json (id→RTSP, yalnız worker host'unda)
  → OpenCV RTSP yakalama → kare örnekleme (vars. 5sn'de 1) → Roboflow rf-27 çıkarımı
  → dedup (kamera+tip 60sn pencere — kare başına spam yok) → camera_events (service_role)
  → heartbeat (camera_worker_sessions) + sağlık (camera_health_logs) + kamera durumu
App 15 sn'de bir poll eder → canlı panel + inceleme + CSV. Yüksek risk → Resend e-postası
(kamera+tip başına 5 dk'da 1, ALERT_EMAIL env'iyle opsiyonel).
```

**Dürüstlük:** Worker'dan 2 dk içinde heartbeat yoksa panel "Gerçek zamanlı worker bağlı değil —
hiçbir olay üretilmez" uyarısı gösterir. Sahte/mock tespit yoktur. Yüklenen-video analizi
(detector/analyses) tamamen ayrı ve değişmedi.

## Tablolar (RLS)
`cameras` (okuma: org üyeleri · yönetim: owner/admin) · `camera_events` (okuma: üyeler ·
inceleme/yok sayma: +safety_manager · INSERT yalnız service_role=worker) ·
`camera_health_logs`, `camera_worker_sessions` (okuma: üyeler · yazma: worker).
Kamu erişimi yok. RTSP URL kolonu YOK — yalnız `stream_url_masked` (görüntü).

## Plan kapısı
plans.js `cameras` alanı: free(1-demo)/giris(0) → modül KAPALI (panelde net mesaj);
kamera_ai(≤10) / pro(≤30) / kurumsal(sınırsız) → açık + kamera sayısı limiti ekleme anında uygulanır.
AI çağrı kotası: worker kendi anahtarını kullanır — kare maliyeti MIA tarafında; müşteri faturası
plan bedelidir (kamera sayısı + fps limitleriyle yönetilir).

## Güvenlik/Gizlilik
RTSP kimlik bilgileri: yalnız worker host'undaki cameras.json (repo'da .gitignore'lu); frontend
maskeli adres bile şifre desenini reddeder. Loglar URL'leri maskeler. Kareler kalıcı SAKLANMAZ
(snapshot depolama v2 — saklama politikası güncellenmeden açılmayacak). Olaylar org-RLS'li, kamuya kapalı.
Canlı video önizleme bilinçli olarak YOK (gizlilik+maliyet) — durum/olay kartları gösterilir.

## İzleme
/api/health → `realtime_worker: connected/not_connected` + `active_cameras`. Worker hataları
camera_health_logs'a; uygulama olayları system_events'e düşer. Ops paneli health üzerinden görür.

## Kalan sınırlar (dürüst)
Üretim worker'ı için ayrı sunucu gerekir (Fly.io ~$5-10/ay veya sahada mini PC) · müşteri ağı
RTSP erişimi/port açılımı isteyebilir · doğruluk hâlâ saha doğrulaması bekliyor (her olay
validation_status=pending taşır) · "7/24 izleme" TAAHHÜT EDİLMEZ (worker uptime/SLA planı yok —
satışta "yakın gerçek zamanlı, mesai saatleri pilotu" dili kullanın) · ilk kalibrasyona kadar FP
olabilir (dedup + %40 güven eşiği hafifletir) · gerçek çalışan görüntüsü kaydı öncesi hukuk onayı
ZORUNLU (Faz 4 kuralları aynen geçerli) · snapshot yok olduğundan olay kanıtı şimdilik metadata.

## Rollback
`git revert <commit>` — modül bağımsız; mevcut akışlara tek dokunuş sidebar linki + health alanı.
Tablolar zararsız kalır (drop sırası: camera_health_logs, camera_worker_sessions, camera_events, cameras).
