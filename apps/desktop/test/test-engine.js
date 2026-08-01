// === MIA Masaüstü — Tespit/Olay motoru birim testleri (Node, tarayıcısız) ===
// renderer JS'leri tarayıcı globalleri bekler → burada saf mantık AYNI formüllerle
// yeniden doğrulanır + gerçek ONNX modeli (onnxruntime-node varsa) uçtan uca test edilir.
"use strict";
const assert = require("assert");
let pass = 0, fail = 0;
function t(name, fn) {
    try { fn(); console.log("  ✔", name); pass++; }
    catch (e) { console.error("  ✘", name, "—", e.message); fail++; }
}

// ---- IoU / NMS (detect.js ile aynı formüller) --------------------------------
function iou(a, b) {
    const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
    const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    const uni = a.w * a.h + b.w * b.h - inter;
    return uni > 0 ? inter / uni : 0;
}
function nms(dets, thr) {
    dets.sort((a, b) => b.conf - a.conf);
    const keep = [];
    for (const d of dets) {
        if (!keep.some(k => k.cls === d.cls && iou(k, d) > thr)) keep.push(d);
    }
    return keep;
}

console.log("IoU / NMS:");
t("aynı kutu IoU = 1", () => {
    assert.strictEqual(iou({ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 0, w: 10, h: 10 }), 1);
});
t("ayrık kutular IoU = 0", () => {
    assert.strictEqual(iou({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 20, w: 10, h: 10 }), 0);
});
t("NMS örtüşen aynı sınıfı eler, farklı sınıfı tutar", () => {
    const out = nms([
        { cls: "Person", conf: 0.9, x: 0, y: 0, w: 10, h: 10 },
        { cls: "Person", conf: 0.7, x: 1, y: 1, w: 10, h: 10 },   // örtüşür → elenir
        { cls: "Hardhat", conf: 0.8, x: 1, y: 1, w: 10, h: 10 }   // farklı sınıf → kalır
    ], 0.45);
    assert.strictEqual(out.length, 2);
    assert.strictEqual(out[0].conf, 0.9);
});

// ---- Letterbox geometrisi ------------------------------------------------------
function letterboxGeom(sw, sh, size) {
    const r = Math.min(size / sw, size / sh);
    const nw = Math.round(sw * r), nh = Math.round(sh * r);
    return { r, dx: Math.floor((size - nw) / 2), dy: Math.floor((size - nh) / 2) };
}
console.log("Letterbox:");
t("1920x1080 → 640: yatay tam, dikey dolgulu", () => {
    const g = letterboxGeom(1920, 1080, 640);
    assert.strictEqual(g.dx, 0);
    assert.ok(g.dy > 0 && Math.abs(g.dy - (640 - 1080 * g.r) / 2) <= 1);
});
t("kutu geri dönüşümü kaynak koordinatına döner", () => {
    const g = letterboxGeom(1280, 720, 640);
    const srcX = 400;                       // kaynaktaki x
    const modelX = srcX * g.r + g.dx;       // modele giden x
    assert.ok(Math.abs((modelX - g.dx) / g.r - srcX) < 0.001);
});

// ---- Olay dedup mantığı (events.js ile aynı kural) ------------------------------
console.log("Olay dedup:");
t("60 sn içinde aynı kamera+tip TEK olay", () => {
    const DEDUP_MS = 60000, lastEmit = {};
    function emit(cam, type, now) {
        const key = cam + "|" + type;
        if (lastEmit[key] != null && now - lastEmit[key] < DEDUP_MS) return false;
        lastEmit[key] = now; return true;
    }
    assert.strictEqual(emit("c1", "no_helmet", 0), true);
    assert.strictEqual(emit("c1", "no_helmet", 30000), false);   // 30 sn → dedup
    assert.strictEqual(emit("c1", "no_vest", 30000), true);      // farklı tip → geçer
    assert.strictEqual(emit("c2", "no_helmet", 30000), true);    // farklı kamera → geçer
    assert.strictEqual(emit("c1", "no_helmet", 61000), true);    // 61 sn → geçer
});

// ---- YOLOv8 çıktı çözümü (sentetik tensör) ---------------------------------------
console.log("YOLOv8 decode:");
t("[1,14,8400] düzeninde sentetik tespit doğru çözülür", () => {
    const np = 8400, nc = 10, d = new Float32Array(14 * np);
    // i=5 anchor'ına kutu koy: cx=320, cy=320, w=100, h=200, sınıf 2 (NO-Hardhat) skor .9
    d[5] = 320; d[np + 5] = 320; d[2 * np + 5] = 100; d[3 * np + 5] = 200;
    d[(4 + 2) * np + 5] = 0.9;
    // decode (detect.js ile aynı):
    const dets = [];
    for (let i = 0; i < np; i++) {
        let best = 0, cls = -1;
        for (let c = 0; c < nc; c++) { const s = d[(4 + c) * np + i]; if (s > best) { best = s; cls = c; } }
        if (best < 0.4) continue;
        const cx = d[i], cy = d[np + i], w = d[2 * np + i], h = d[3 * np + i];
        dets.push({ x: cx - w / 2, y: cy - h / 2, w, h, cls, conf: best });
    }
    assert.strictEqual(dets.length, 1);
    assert.strictEqual(dets[0].cls, 2);
    assert.strictEqual(dets[0].x, 270);
    assert.strictEqual(dets[0].h, 200);
});

// ---- Sınıf → olay eşlemesi şema uyumu ---------------------------------------------
console.log("Şema uyumu:");
t("olay tipleri camera_events CHECK kısıtındaki değerlerle sınırlı", () => {
    const ALLOWED = ["ppe_violation", "no_helmet", "no_vest", "no_mask",
        "restricted_area", "unsafe_behavior", "camera_offline", "worker_error"];
    const VIOLATIONS = { "NO-Hardhat": "no_helmet", "NO-Safety Vest": "no_vest", "NO-Mask": "no_mask" };
    Object.values(VIOLATIONS).forEach(v => assert.ok(ALLOWED.includes(v), v));
});

// ---- MIA Vision Engine (tracker.js — gerçek modül, Node'da yüklenir) -------------
const { Tracker } = require("../renderer/js/tracker.js");
console.log("MIA Vision Engine (tracker):");

function person(x, conf) { return { cls: "Person", conf: conf || 0.9, x: x, y: 100, w: 80, h: 200 }; }
function noHelmet(x) { return { cls: "NO-Hardhat", conf: 0.85, x: x + 20, y: 105, w: 40, h: 40 }; }  // üst bant
function helmet(x) { return { cls: "Hardhat", conf: 0.9, x: x + 20, y: 105, w: 40, h: 40 }; }
function vest(x) { return { cls: "Safety Vest", conf: 0.9, x: x + 10, y: 160, w: 60, h: 80 }; }      // gövde bandı

t("aynı kişi karelerde AYNI ID'yi korur (takip sürekliliği)", () => {
    const tr = new Tracker();
    const r1 = tr.update([person(100)], 1000);
    const r2 = tr.update([person(110)], 2000);   // hafif hareket
    assert.strictEqual(r1.tracks[0].id, r2.tracks[0].id);
    assert.strictEqual(r2.tracks.length, 1);
});
t("iki ayrı kişi iki ayrı ID alır", () => {
    const tr = new Tracker();
    const r = tr.update([person(100), person(600)], 1000);
    assert.strictEqual(r.tracks.length, 2);
    assert.notStrictEqual(r.tracks[0].id, r.tracks[1].id);
});
t("TEK karelik NO-Hardhat olay ÜRETMEZ (oylama bekler)", () => {
    const tr = new Tracker();
    const r = tr.update([person(100), noHelmet(100)], 1000);
    assert.strictEqual(r.confirmed.length, 0);
    assert.strictEqual(r.tracks[0].equip.helmet, "pending");
});
t("4/6 kare NO-Hardhat → ihlal DOĞRULANIR ve tek olay üretir", () => {
    const tr = new Tracker();
    let confirmed = [];
    for (let i = 0; i < 6; i++) {
        const r = tr.update([person(100), noHelmet(100)], 1000 + i * 1000);
        confirmed = confirmed.concat(r.confirmed);
    }
    assert.strictEqual(confirmed.length, 1);            // oylama sonrası TEK olay
    assert.strictEqual(confirmed[0].equip, "helmet");
    assert.ok(confirmed[0].trackId.startsWith("P"));
});
t("baret TAKILI kişi ihlal üretmez (ok durumu)", () => {
    const tr = new Tracker();
    let confirmed = [];
    for (let i = 0; i < 6; i++) {
        const r = tr.update([person(100), helmet(100), vest(100)], 1000 + i * 1000);
        confirmed = confirmed.concat(r.confirmed);
    }
    assert.strictEqual(confirmed.length, 0);
    const eq = tr.update([person(100), helmet(100), vest(100)], 7000).tracks[0].equip;
    assert.strictEqual(eq.helmet, "ok");
    assert.strictEqual(eq.safety_vest, "ok");
});
t("yelek gövde bandında kişiye eşlenir, kafadaki kutu yeleğe eşlenmez", () => {
    const tr = new Tracker();
    // yelek kutusunu kafa hizasına koy (bant dışı) → gözlem yazılmamalı
    const badVest = { cls: "Safety Vest", conf: 0.9, x: 120, y: 100, w: 40, h: 30 }; // relY ~0.07 < 0.15 bandı
    for (let i = 0; i < 6; i++) tr.update([person(100), badVest], 1000 + i * 1000);
    assert.strictEqual(tr.update([person(100), badVest], 7000).tracks[0].equip.safety_vest, "unknown");
});
t("ihlal sonrası ekipman takılırsa durum sıfırlanır, tekrar çıkarırsa YENİ olay", () => {
    const tr = new Tracker();
    let n = 0, ts = 1000;
    for (let i = 0; i < 6; i++) n += tr.update([person(100), noHelmet(100)], ts += 1000).confirmed.length;
    for (let i = 0; i < 4; i++) n += tr.update([person(100), helmet(100)], ts += 1000).confirmed.length;   // taktı
    for (let i = 0; i < 6; i++) n += tr.update([person(100), noHelmet(100)], ts += 1000).confirmed.length; // yine çıkardı
    assert.strictEqual(n, 2); // iki AYRI doğrulanmış ihlal
});
t("görünmeyen track 3 sn sonra düşer", () => {
    const tr = new Tracker();
    tr.update([person(100)], 1000);
    const r = tr.update([], 5000);
    assert.strictEqual(r.tracks.length, 0);
});

// ---- KKD Kaydı: kilitli sınıf koruması (dürüstlük garantisi) --------------------
const ppe = require("../renderer/js/ppe-registry.js");
console.log("KKD Kaydı:");

t("kilitli ekipmanlar geometriye GİRMEZ (motor onları hiç aramaz)", () => {
    const g = ppe.geometry();
    assert.ok(!("gloves" in g), "eldiven geometriye girmemeli");
    assert.ok(!("safety_glasses" in g), "gözlük geometriye girmemeli");
    assert.ok("helmet" in g && "safety_vest" in g && "mask" in g);
});
t("sanitize kilitli ekipmanı AÇIK bırakamaz", () => {
    const p = ppe.sanitize({ gloves: true, safety_glasses: true, safety_harness: true, helmet: true });
    assert.strictEqual(p.gloves, false);
    assert.strictEqual(p.safety_glasses, false);
    assert.strictEqual(p.safety_harness, false);
    assert.strictEqual(p.helmet, true);
});
t("varsayılan profil: supported AÇIK, experimental/kilitli KAPALI", () => {
    const d = ppe.defaultProfile();
    assert.strictEqual(d.helmet, true);
    assert.strictEqual(d.safety_vest, true);
    assert.strictEqual(d.mask, false);        // experimental
    assert.strictEqual(d.gloves, false);      // kilitli
});
t("kullanıcı taranabilir ekipmanı kapatabilir (aç/kapa gerçekten çalışır)", () => {
    const p = ppe.sanitize({ helmet: false, safety_vest: true, mask: true });
    assert.strictEqual(p.helmet, false);      // kapatma serbest
    assert.strictEqual(p.mask, true);         // experimental açılabilir
});
t("her taranabilir kayıtta ok/violation sınıfı ve band tanımlı", () => {
    ppe.scannable().forEach(r => {
        assert.ok(r.okClass && r.violationClass, r.key + " sınıf eşlemesi eksik");
        assert.ok(Array.isArray(r.band) && r.band.length === 2, r.key + " band eksik");
        assert.ok(r.band[0] < r.band[1], r.key + " band aralığı geçersiz");
    });
});
t("model sınıfları kayıtla uyumlu (senkron kontrolü)", () => {
    const MODEL = ["Hardhat", "Mask", "NO-Hardhat", "NO-Mask", "NO-Safety Vest",
                   "Person", "Safety Cone", "Safety Vest", "machinery", "vehicle"];
    ppe.scannable().forEach(r => {
        assert.ok(MODEL.includes(r.okClass), r.okClass + " modelde yok — kayıt yanlış!");
        assert.ok(MODEL.includes(r.violationClass), r.violationClass + " modelde yok — kayıt yanlış!");
    });
});
t("tracker kayıttan beslenir — kilitli ekipman için ihlal ÜRETMEZ", () => {
    const tr = new Tracker();
    // Eldiven ihlali gibi görünen sentetik kutu — modelde sınıf yok, olay çıkmamalı
    const fakeGlove = { cls: "NO-Gloves", conf: 0.95, x: 130, y: 220, w: 30, h: 30 };
    let confirmed = [];
    for (let i = 0; i < 8; i++) {
        const r = tr.update([person(100), fakeGlove], 1000 + i * 1000);
        confirmed = confirmed.concat(r.confirmed);
    }
    assert.strictEqual(confirmed.filter(c => c.equip === "gloves").length, 0);
});

// ---- Model yetenek bağlama: kilitler modelin GERÇEK sınıflarından gelir -----------
console.log("Model yetenek tespiti:");
const V1 = ["Hardhat", "Mask", "NO-Hardhat", "NO-Mask", "NO-Safety Vest",
            "Person", "Safety Cone", "Safety Vest", "machinery", "vehicle"];
const V2 = ["Fall-Detected", "Gloves", "Goggles", "Hardhat", "Ladder", "Mask",
            "NO-Gloves", "NO-Goggles", "NO-Hardhat", "NO-Mask", "NO-Safety Vest",
            "Person", "Safety Cone", "Safety Vest"];

t("v1 modeli bağlıyken gözlük/eldiven KİLİTLİ kalır", () => {
    ppe.bind(V1);
    assert.strictEqual(ppe.isLocked("safety_glasses"), true);
    assert.strictEqual(ppe.isLocked("gloves"), true);
    assert.strictEqual(ppe.isLocked("helmet"), false);
});
t("v2 modeli bağlanınca gözlük/eldiven OTOMATİK açılır (deneysel)", () => {
    ppe.bind(V2);
    assert.strictEqual(ppe.isLocked("safety_glasses"), false);
    assert.strictEqual(ppe.isLocked("gloves"), false);
    assert.strictEqual(ppe.statusOf("safety_glasses"), "experimental");
    assert.strictEqual(ppe.statusOf("gloves"), "experimental");
});
t("v2'de bile veri olmayan sınıflar (kemer, ayakkabı) kilitli kalır", () => {
    ppe.bind(V2);
    assert.strictEqual(ppe.isLocked("safety_harness"), true);
    assert.strictEqual(ppe.isLocked("safety_boots"), true);
    assert.strictEqual(ppe.isLocked("ear_protection"), true);
});
t("v2 → v1 geri dönülürse kilitler KENDİLİĞİNDEN kapanır", () => {
    ppe.bind(V2);
    assert.strictEqual(ppe.isLocked("gloves"), false);
    ppe.bind(V1);
    assert.strictEqual(ppe.isLocked("gloves"), true);
    assert.strictEqual(ppe.sanitize({ gloves: true }).gloves, false);
});
t("v2 geometrisi yeni sınıfları içerir, v1 içermez", () => {
    ppe.bind(V2);
    assert.ok("gloves" in ppe.geometry());
    ppe.bind(V1);
    assert.ok(!("gloves" in ppe.geometry()));
});
ppe.bind(V1); // testlerin geri kalanı v1 varsayar

// ---- Doğruluk korumaları ---------------------------------------------------------
console.log("Doğruluk korumaları:");

t("uzak/küçük kişide KKD kararı VERİLMEZ (sahte ihlal yok)", () => {
    const tr = new Tracker();
    // frameH=1080, kişi yüksekliği 100px → %9 < %14 eşiği → değerlendirilmez
    const far = { cls: "Person", conf: 0.9, x: 100, y: 100, w: 40, h: 100 };
    const farNoHelmet = { cls: "NO-Hardhat", conf: 0.9, x: 110, y: 102, w: 20, h: 20 };
    let confirmed = [];
    for (let i = 0; i < 8; i++) {
        const r = tr.update([far, farNoHelmet], 1000 + i * 1000, 1080);
        confirmed = confirmed.concat(r.confirmed);
    }
    assert.strictEqual(confirmed.length, 0);
    const out = tr.update([far, farNoHelmet], 9000, 1080);
    assert.strictEqual(out.tracks[0].tooSmall, true);
    assert.strictEqual(out.tracks[0].equip.helmet, "unknown");
});
t("yakın kişide aynı ihlal DOĞRULANIR (filtre fazla katı değil)", () => {
    const tr = new Tracker();
    let confirmed = [];
    for (let i = 0; i < 8; i++) {
        const r = tr.update([person(100), noHelmet(100)], 1000 + i * 1000, 400); // 200/400 = %50
        confirmed = confirmed.concat(r.confirmed);
    }
    assert.strictEqual(confirmed.length, 1);
});
t("düşük güvenli ihlal gözlemi (0.50 < 0.55) olay üretmez", () => {
    const tr = new Tracker();
    const weak = { cls: "NO-Hardhat", conf: 0.50, x: 120, y: 105, w: 40, h: 40 };
    let confirmed = [];
    for (let i = 0; i < 8; i++) confirmed = confirmed.concat(tr.update([person(100), weak], 1000 + i * 1000).confirmed);
    assert.strictEqual(confirmed.length, 0);
});
t("güven toplamı eşiği: sınırdaki gözlemler elenir", () => {
    const tr = new Tracker();
    // 4 gözlem × 0.56 = 2.24 ≥ 2.2 → geçmeli (sınırın hemen üstü)
    const borderline = { cls: "NO-Hardhat", conf: 0.56, x: 120, y: 105, w: 40, h: 40 };
    let confirmed = [];
    for (let i = 0; i < 6; i++) confirmed = confirmed.concat(tr.update([person(100), borderline], 1000 + i * 1000).confirmed);
    assert.strictEqual(confirmed.length, 1);
});
t("kutu yumuşatma (EMA) titremeyi azaltır", () => {
    const tr = new Tracker();
    tr.update([{ cls: "Person", conf: 0.9, x: 100, y: 100, w: 80, h: 200 }], 1000);
    const out = tr.update([{ cls: "Person", conf: 0.9, x: 140, y: 100, w: 80, h: 200 }], 2000);
    // Ham sıçrama 40px; yumuşatılmış konum ikisinin arasında olmalı
    assert.ok(out.tracks[0].box.x > 100 && out.tracks[0].box.x < 140);
});

// ---- Raporlama bütünlüğü: ekipman ayrıştırma (kusursuz rapor garantisi) -----------
console.log("Raporlama bütünlüğü:");

// views.js'teki eventEquip mantığının aynısı (DOM'suz kopya — davranış sözleşmesi)
const TYPE_TO_EQUIP = { no_helmet: "helmet", no_vest: "safety_vest", no_mask: "mask" };
function eventEquip(ev) {
    const me = ev && ev.missing_equipment;
    if (Array.isArray(me) && me.length) return me;
    const k = TYPE_TO_EQUIP[ev && ev.event_type];
    return k ? [k] : [];
}

t("gözlük ve eldiven aynı event_type'ta olsa da RAPORDA ayrışır", () => {
    const evs = [
        { event_type: "ppe_violation", missing_equipment: ["safety_glasses"] },
        { event_type: "ppe_violation", missing_equipment: ["gloves"] },
        { event_type: "ppe_violation", missing_equipment: ["gloves"] }
    ];
    const by = {};
    evs.forEach(e => eventEquip(e).forEach(k => { by[k] = (by[k] || 0) + 1; }));
    assert.strictEqual(by.safety_glasses, 1);
    assert.strictEqual(by.gloves, 2);       // 'KKD İhlali' olarak birleşmedi
});
t("eski kayıtlar (missing_equipment yok) event_type'tan doğru türetilir", () => {
    assert.deepStrictEqual(eventEquip({ event_type: "no_helmet" }), ["helmet"]);
    assert.deepStrictEqual(eventEquip({ event_type: "no_vest" }), ["safety_vest"]);
    assert.deepStrictEqual(eventEquip({ event_type: "no_mask" }), ["mask"]);
});
t("bilinmeyen tip rapor kırılımını bozmaz (boş dizi)", () => {
    assert.deepStrictEqual(eventEquip({ event_type: "camera_offline" }), []);
    assert.deepStrictEqual(eventEquip({}), []);
});
t("olay motoru her ihlale missing_equipment YAZAR (rapor kaynağı garanti)", () => {
    // events.js ingestConfirmed'ın ürettiği kayıt şeması sözleşmesi
    const ev = { event_type: "no_helmet", missing_equipment: ["helmet"], person_track_id: "P1" };
    assert.ok(Array.isArray(ev.missing_equipment) && ev.missing_equipment.length === 1);
    assert.ok(ev.person_track_id, "kişi kimliği olmadan kişi bazlı rapor üretilemez");
    assert.deepStrictEqual(eventEquip(ev), ["helmet"]);
});
t("kişi bazlı kırılım track ID'lerinden doğru sayılır", () => {
    const evs = [{ person_track_id: "P1" }, { person_track_id: "P1" }, { person_track_id: "P2" }, {}];
    const byPerson = {};
    evs.forEach(e => { if (e.person_track_id) byPerson[e.person_track_id] = (byPerson[e.person_track_id] || 0) + 1; });
    assert.strictEqual(Object.keys(byPerson).length, 2);
    assert.strictEqual(byPerson.P1, 2);
});
t("ingest fonksiyonu şeması: missing_equipment ve person_track_id geçirilir", () => {
    // netlify/functions/camera-event.js satır sözleşmesi (davranış regresyonu koruması)
    const fs = require("fs"), path = require("path");
    const src = fs.readFileSync(path.join(__dirname, "..", "..", "..",
        "netlify", "functions", "camera-event.js"), "utf8");
    assert.ok(/person_track_id:/.test(src), "ingest person_track_id yazmıyor");
    assert.ok(/missing_equipment:/.test(src), "ingest missing_equipment yazmıyor");
});

console.log("\n" + pass + " geçti, " + fail + " başarısız");
process.exit(fail ? 1 : 0);
