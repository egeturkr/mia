# Faz 13 — Çapraz Platform Uygulama + Kurumsal Gerçek Zamanlı Kamera KKD Platformu

## Mimari (net karar)
```
TEK web uygulaması (Netlify, değişmedi — aynen deploy olur)
├── Masaüstü: Electron kabuk (apps/desktop) → miaissagligi.com'u güvenli pencerede açar
├── Mobil:    Capacitor kabuk (apps/mobile) → aynı siteyi WebView'da açar
└── RTSP işleme: AYRI Python worker (workers/realtime-camera-worker) — Netlify'da imkânsız
Supabase = tek veri merkezi: cameras, camera_events, ppe_detection_profiles, RLS.
```
Kabuk yaklaşımı bilinçli: ayrı native kod tabanı YOK; web'e atılan her deploy
tüm platformlara anında yansır. Native özellik (push, çevrimdışı) v2.

## KKD Profil Sistemi (Faz 13 çekirdeği)
- `ppe_detection_profiles`: org (ve istenirse saha) başına "ne taransın" seçimi.
- UI: cameras.html → "KKD Tarama Profili" paneli. Düzenleme: owner/admin/safety_manager.
- **Dürüstlük üç durumu** (js/ppe-registry.js + worker src/ppe_registry.py senkron):
  - *Destekleniyor*: baret, yelek (rf-27 NO-* sınıfı var)
  - *Deneysel*: maske (sınıf var, saha FP oranı ölçülmedi)
  - *Model eğitimi gerekir* (KİLİTLİ, etkinleştirilemez): eldiven, gözlük, emniyet
    kemeri, iş ayakkabısı, kulak koruyucu — rf-27 bu sınıfları İÇERMİYOR; sahte vaat yok.
- Worker yalnız profilde etkin + destekli ekipman için olay üretir; olaya
  required/detected/missing_equipment yazar. Profil değişikliği worker restart'ında etkinleşir.

## Kişi-KKD eşleştirme sınırı (dürüst)
rf-27 ihlali doğrudan sınıf olarak verir (NO-Hardhat). Kişi-bazlı eşleştirme
(person_track_id) kolonu hazır ama v1'de DOLDURULMAZ — güvenilir kutu-örtüşme
takibi doğrulanmadan kişi sayısı iddia edilmez. Olay = "karede ihlal görüldü".

## Raporlama
Canlı kamera olayları artık İhlal Raporu'nda (events.html) "· Canlı Kamera"
etiketiyle, CSV'de "Kaynak" kolonuyla görünür. Yok sayılan (dismissed) olaylar
rapora girmez. Yüklenen-video satırları değişmedi.

## Plan kapısı (plans.js cameras alanı — Faz 12'den)
free: 1 (demo) ve giris: 0 → modül kapalı · kamera_ai: ≤10 · pro: ≤30 · kurumsal: sınırsız.
Sınır ekleme anında uygulanır; sınırsız izleme hiçbir planda bedava değil.

## Güvenlik / Gizlilik
- RTSP kimlik bilgileri: yalnız worker host'undaki cameras.json (gitignore).
  DB/frontend/kabuk uygulamalarda ASLA. Kabuklar localStorage'a secret yazmaz.
- Electron: nodeIntegration kapalı, sandbox açık, yalnız miaissagligi.com'a gezinme.
- Kareler kalıcı saklanmaz (snapshot v2 — saklama politikası şartıyla).
- Gerçek çalışan görüntüsü kaydı öncesi: müşteri onayı + saha bildirimleri +
  çalışan aydınlatması + hukuk onayı ZORUNLU (Faz 4 kuralları geçerli).

## İzleme
/api/health: realtime_worker + active_cameras (Faz 12). Yeni olay:
ppe_profile_saved (monitor.js). Worker sağlığı camera_health_logs'ta.

## Dağıtım adımları
1. Supabase'de schema.sql çalıştır (Blok 16 eklendi — idempotent).
2. Web: normal git push (Netlify otomatik deploy — apps/ ve workers/ web'i etkilemez).
3. Worker: README'deki adımlar (ayrı sunucu) — profil değişince restart.
4. Masaüstü/mobil: docs/DESKTOP_MOBILE_APP_BUILD_GUIDE.md.

## Kalan riskler (dürüst)
Müşteri RTSP'si ağ/port erişimi ister · worker üretimi ücretli altyapı ister ·
baret/yelek dışı KKD eğitim verisi ister · iOS dağıtımı Apple Developer hesabı +
4.2 reddi riski · Android imzalama gerekir · çalışan kaydı öncesi hukuk onayı ·
7/24 izleme SLA'sız TAAHHÜT EDİLMEZ · doğruluk saha doğrulaması bekliyor.

## Rollback
`git revert <commit>` — web'e dokunuşlar: events.js (additive merge), cameras.html
(panel+2 script). apps/ ve workers/ web deploy'unu hiç etkilemez.
ppe_detection_profiles tablosu zararsız kalır (drop edilebilir).
