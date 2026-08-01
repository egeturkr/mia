// === MIA Vision Engine v1 — Takip + Kişi-KKD Eşleme + Kare Oylama ===
// MIA'NIN KENDİ YAZILIM KATMANI. Ham model tespitleri (hangi modelden gelirse
// gelsin: mia-ppe ONNX / rf-27) buradan geçmeden OLAY ÜRETEMEZ.
//
// Neden: tek karelik ham çıktı gürültülüdür (titreyen kutular, anlık yanlış
// pozitifler). Bu katman:
//   1) TAKİP     — IoU eşlemeli hafif çoklu-nesne takibi, kalıcı kişi ID'leri (P1, P2…)
//   2) EŞLEME    — baret/yelek/maske kutularını GEOMETRİK olarak kişiye bağlar
//                  (baret üst %45, maske üst %40, yelek orta gövde bandı)
//   3) OYLAMA    — ekipman durumu son N karede oylanır; ihlal ancak K/N kare
//                  üst üste görülürse DOĞRULANIR → yanlış pozitif düşer
//   4) RAPOR     — doğrulanmış ihlal, track ID'siyle (person_track_id) olaylaşır
//
// Saf mantık — DOM yok → Node'da birim test edilir (test-engine.js).
(function () {
    "use strict";

    var CFG = {
        iouMatch: 0.25,        // kişi-track eşleme eşiği
        trackTtlMs: 3000,      // bu süre görünmeyen track düşer
        voteWindow: 6,         // oylama penceresi (kare)
        voteConfirm: 4,        // ihlal onayı için pencerede asgari ihlal karesi
        voteMinSamples: 3,     // karar için asgari örnek
        reconfirmOkFrames: 3   // ihlal sonrası bu kadar 'ok' karesi gelirse durum sıfırlanır
    };

    // Ekipman eşleme geometrisi: KKD kutusunun MERKEZİ, kişi kutusunun hangi
    // dikey bandında aranır (üstten oran).
    // KAYNAK: ppe-registry.js — yeni sınıf eklemek KOD DEĞİL kayıt işidir.
    // Kayıt yüklenemezse (test ortamı) güvenli varsayılana düşer.
    function loadGeom() {
        var reg = (typeof window !== "undefined" && window.miaPpe) ||
                  (typeof require === "function" && (function () {
                      try { return require("./ppe-registry.js"); } catch (e) { return null; }
                  })());
        if (reg && reg.geometry) return reg.geometry();
        return {
            helmet:      { okCls: "Hardhat",     noCls: "NO-Hardhat",     band: [0.0, 0.45] },
            mask:        { okCls: "Mask",        noCls: "NO-Mask",        band: [0.0, 0.40] },
            safety_vest: { okCls: "Safety Vest", noCls: "NO-Safety Vest", band: [0.15, 0.75] }
        };
    }
    var GEOM = loadGeom();
    var EQUIP_KEYS = Object.keys(GEOM);

    function iou(a, b) {
        var x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
        var x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
        var inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
        var uni = a.w * a.h + b.w * b.h - inter;
        return uni > 0 ? inter / uni : 0;
    }
    function centerInBand(equipBox, personBox, band) {
        var cx = equipBox.x + equipBox.w / 2, cy = equipBox.y + equipBox.h / 2;
        if (cx < personBox.x - equipBox.w * 0.25 || cx > personBox.x + personBox.w + equipBox.w * 0.25) return false;
        var relY = (cy - personBox.y) / Math.max(1, personBox.h);
        return relY >= band[0] - 0.05 && relY <= band[1] + 0.05;
    }

    function Tracker(opts) {
        this.cfg = Object.assign({}, CFG, opts || {});
        this.tracks = [];      // { id, box, lastTs, hits, conf, equip: {key: {history:[], state, firedViolation}} }
        this.seq = 0;
    }

    // dets: [{cls, conf, x, y, w, h}] — kaynak koordinatlarında. ts: ms.
    // Dönüş: { tracks: [...görsel katman için...], confirmed: [{trackId, equip, conf}] }
    Tracker.prototype.update = function (dets, ts) {
        var self = this, cfg = this.cfg;
        var persons = dets.filter(function (d) { return d.cls === "Person"; });
        var equipment = dets.filter(function (d) { return d.cls !== "Person"; });

        // --- 1) Kişi-track eşleme (greedy, IoU azalan) --------------------------
        var pairs = [];
        this.tracks.forEach(function (tr, ti) {
            persons.forEach(function (p, pi) {
                var v = iou(tr.box, p);
                if (v >= cfg.iouMatch) pairs.push({ ti: ti, pi: pi, v: v });
            });
        });
        pairs.sort(function (a, b) { return b.v - a.v; });
        var usedT = {}, usedP = {};
        pairs.forEach(function (pr) {
            if (usedT[pr.ti] || usedP[pr.pi]) return;
            usedT[pr.ti] = true; usedP[pr.pi] = true;
            var tr = self.tracks[pr.ti], p = persons[pr.pi];
            tr.box = p; tr.lastTs = ts; tr.hits++; tr.conf = p.conf;
        });
        persons.forEach(function (p, pi) {
            if (usedP[pi]) return;
            self.seq++;
            var equip = {};
            EQUIP_KEYS.forEach(function (k) { equip[k] = { history: [], state: "unknown", firedViolation: false, okStreak: 0 }; });
            self.tracks.push({ id: "P" + self.seq, box: p, lastTs: ts, hits: 1, conf: p.conf, equip: equip });
        });
        // Süresi dolan track'ler düşer
        this.tracks = this.tracks.filter(function (tr) { return ts - tr.lastTs <= cfg.trackTtlMs; });

        // --- 2) KKD kutularını kişilere bağla + bu karenin gözlemi ---------------
        var confirmed = [];
        this.tracks.forEach(function (tr) {
            if (tr.lastTs !== ts) return; // bu karede görülmeyen kişiye gözlem yazılmaz
            EQUIP_KEYS.forEach(function (key) {
                var g = GEOM[key];
                var obs = null, obsConf = 0; // 'ok' | 'violation' | null(kararsız)
                equipment.forEach(function (e) {
                    if (e.cls !== g.okCls && e.cls !== g.noCls) return;
                    if (!centerInBand(e, tr.box, g.band)) return;
                    if (e.conf > obsConf) { obsConf = e.conf; obs = (e.cls === g.noCls) ? "violation" : "ok"; }
                });
                var st = tr.equip[key];
                st.history.push({ obs: obs, conf: obsConf });
                if (st.history.length > cfg.voteWindow) st.history.shift();

                // Ardışık 'ok' GÖZLEMİ sayacı (oylamadan bağımsız tutulur —
                // ihlal penceresi dolu diye ekipmanın takıldığı gerçeği silinmez)
                if (obs === "ok") st.okStreak++;
                else if (obs === "violation") st.okStreak = 0;
                if (st.okStreak >= cfg.reconfirmOkFrames) {
                    st.state = "ok";
                    st.firedViolation = false; // ekipman takıldı → yeniden ihlal olursa YENİ olay
                }

                // --- 3) Oylama ---------------------------------------------------
                var votes = st.history.filter(function (h) { return h.obs; });
                var vio = votes.filter(function (h) { return h.obs === "violation"; });
                if (votes.length >= cfg.voteMinSamples && vio.length >= cfg.voteConfirm &&
                    st.okStreak < cfg.reconfirmOkFrames) {
                    st.state = "violation";
                    if (!st.firedViolation) {
                        st.firedViolation = true;
                        var avg = vio.reduce(function (s, h) { return s + h.conf; }, 0) / vio.length;
                        confirmed.push({ trackId: tr.id, equip: key, conf: Math.round(avg * 100) / 100 });
                    }
                } else if (obs === "ok" && st.state !== "violation") {
                    st.state = "ok";
                } else if (obs === "violation" && st.state !== "violation") {
                    st.state = "pending"; // görüldü ama henüz doğrulanmadı
                }
            });
        });

        return {
            tracks: this.tracks.map(function (tr) {
                var equip = {};
                EQUIP_KEYS.forEach(function (k) { equip[k] = tr.equip[k].state; });
                return { id: tr.id, box: tr.box, conf: tr.conf, hits: tr.hits, fresh: tr.lastTs === ts, equip: equip };
            }),
            confirmed: confirmed
        };
    };

    Tracker.prototype.reset = function () { this.tracks = []; };

    var api = { Tracker: Tracker, GEOM: GEOM, CFG: CFG, _iou: iou, _centerInBand: centerInBand };
    if (typeof window !== "undefined") window.miaTracker = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api; // Node birim testleri
})();
