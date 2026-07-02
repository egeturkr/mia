// === MIA AI Safety Intelligence — Masaüstü Uygulaması (v0.2.0) ===
// Faz 18: ince web kabuğundan TAM YERLİ müşteri uygulamasına geçiş.
// - Cihaz üstü AI: YOLOv8s KKD modeli (ONNX, renderer'da ort-web ile) — kareler
//   şantiyeden ÇIKMAZ; yalnız olay meta verisi buluta yazılır (KVKK dostu).
// - RTSP IP kameralar: ffmpeg (paketli) ana süreçte çözer, kareleri IPC ile iletir.
//   RTSP KİMLİK BİLGİLERİ YALNIZ BU CİHAZDA, safeStorage ile ŞİFRELİ saklanır.
// - Offline dayanıklılık: olay kuyruğu diskte; bağlantı gelince /api/camera-event'e boşaltılır.
// GÜVENLİK: nodeIntegration KAPALI, contextIsolation+sandbox AÇIK, CSP index.html'de.
// Ağ çağrıları (MIA API) ANA SÜREÇTEN yapılır — renderer'a API anahtarı taşınmaz.

const { app, BrowserWindow, ipcMain, shell, dialog, safeStorage, session, Notification, protocol, net } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const { spawn } = require("child_process");

const API_BASE = process.env.MIA_API_BASE || "https://miaissagligi.com";
const ALLOWED_EXTERNAL = /^https:\/\//;

// ---- mia:// protokolü --------------------------------------------------------
// file:// sayfalarda fetch() ÇALIŞMAZ → ort-web wasm'ı ve ONNX modeli yüklenemez.
// Çözüm: renderer 'mia://app/...' standart şemasından servis edilir (fetch, wasm,
// stream destekli). 'mia://video/<enc-path>' seçilen yerel videoyu güvenle akıtır
// (yalnız kullanıcının dosya diyaloğunda SEÇTİĞİ yollar — allowlist).
protocol.registerSchemesAsPrivileged([{
    scheme: "mia",
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
}]);
const allowedVideoPaths = new Set();

function registerMiaProtocol() {
    protocol.handle("mia", (req) => {
        const u = new URL(req.url);
        if (u.host === "app") {
            // Yol temizliği: .. kaçışı engellenir, kökler renderer/ + models/ ile sınırlı
            let p = decodeURIComponent(u.pathname).replace(/\\/g, "/");
            p = path.posix.normalize(p).replace(/^(\.\.(\/|$))+/, "");
            const root = p.startsWith("/models/") ? __dirname : path.join(__dirname, "renderer");
            const fp = path.join(root, p.startsWith("/models/") ? p : (p === "/" ? "/index.html" : p));
            if (!fp.startsWith(__dirname)) return new Response("forbidden", { status: 403 });
            return net.fetch(pathToFileURL(fp).toString());
        }
        if (u.host === "video") {
            const fp = decodeURIComponent(u.pathname.slice(1));
            if (!allowedVideoPaths.has(fp)) return new Response("forbidden", { status: 403 });
            return net.fetch(pathToFileURL(fp).toString(), { headers: req.headers }); // Range desteği
        }
        return new Response("not found", { status: 404 });
    });
}

// ---- ffmpeg yolu (paketliyse asar dışından) --------------------------------
function ffmpegPath() {
    try {
        let p = require("ffmpeg-static");
        if (app.isPackaged && p) p = p.replace("app.asar", "app.asar.unpacked");
        return p && fs.existsSync(p) ? p : null;
    } catch (e) { return null; }
}

// ---- Basit disk deposu (ayarlar + offline kuyruk) ---------------------------
// userData/mia-desktop-store.json — renderer store IPC'siyle okur/yazar.
// RTSP URL'leri gibi hassas değerler safeStorage ile şifrelenmiş base64 olarak girer.
const storeFile = () => path.join(app.getPath("userData"), "mia-desktop-store.json");
let storeCache = null;
function storeRead() {
    if (storeCache) return storeCache;
    try { storeCache = JSON.parse(fs.readFileSync(storeFile(), "utf8")); }
    catch (e) { storeCache = {}; }
    return storeCache;
}
function storeWrite() {
    try {
        const tmp = storeFile() + ".tmp";
        fs.writeFileSync(tmp, JSON.stringify(storeRead()), "utf8");
        fs.renameSync(tmp, storeFile()); // atomik — yarım yazma kuyruğu bozmasın
    } catch (e) { /* disk hatası uygulamayı düşürmesin */ }
}

// ---- RTSP boru hattı ---------------------------------------------------------
// Kamera başına bir ffmpeg süreci: RTSP → MJPEG (image2pipe). JPEG sınırları
// (FFD8...FFD9) ayrıştırılır, SON kare base64 data URL olarak renderer'a gider.
// Yeniden bağlanma: üstel geri çekilme, 6 denemeden sonra 'error' durumu.
const rtspProcs = new Map(); // id → { proc, buf, retries, stopped, url, fps }
const SOI = Buffer.from([0xFF, 0xD8]);
const EOI = Buffer.from([0xFF, 0xD9]);

function maskRtsp(url) {
    // rtsp://user:pass@host/... → rtsp://***:***@host/... (log ve bulut için)
    return String(url || "").replace(/\/\/[^@/]+@/, "//***:***@");
}

function startRtsp(win, opts) {
    const { id, url, fps } = opts;
    stopRtsp(id);
    const ff = ffmpegPath();
    if (!ff) {
        win.webContents.send("rtsp:status", { id, status: "error", message: "ffmpeg bulunamadı (paket hatası)" });
        return { ok: false, error: "ffmpeg missing" };
    }
    const entry = { proc: null, buf: Buffer.alloc(0), retries: 0, stopped: false, url, fps: fps || 0.5 };
    rtspProcs.set(id, entry);
    spawnRtsp(win, id, entry);
    return { ok: true };
}

function spawnRtsp(win, id, entry) {
    if (entry.stopped) return;
    const args = [
        "-nostdin", "-loglevel", "error",
        "-rtsp_transport", "tcp",
        "-timeout", "10000000",               // 10 sn soket zaman aşımı (µs)
        "-i", entry.url,
        "-vf", "fps=" + entry.fps + ",scale='min(1280,iw)':-2",
        "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "6", "pipe:1"
    ];
    const proc = spawn(ffmpegPath(), args, { stdio: ["ignore", "pipe", "pipe"] });
    entry.proc = proc;
    win.webContents.send("rtsp:status", { id, status: "connecting", message: maskRtsp(entry.url) });

    proc.stdout.on("data", (chunk) => {
        entry.buf = Buffer.concat([entry.buf, chunk]);
        if (entry.buf.length > 8 * 1024 * 1024) entry.buf = Buffer.alloc(0); // korkuluk
        // JPEG çerçevelerini ayıkla — yalnız SONUNCUYU gönder (gerçek zamanlılık > tamlık)
        let lastFrame = null, start;
        while ((start = entry.buf.indexOf(SOI)) !== -1) {
            const end = entry.buf.indexOf(EOI, start + 2);
            if (end === -1) { if (start > 0) entry.buf = entry.buf.subarray(start); break; }
            lastFrame = entry.buf.subarray(start, end + 2);
            entry.buf = entry.buf.subarray(end + 2);
        }
        if (lastFrame && !win.isDestroyed()) {
            entry.retries = 0;
            win.webContents.send("rtsp:frame", {
                id, ts: Date.now(),
                dataUrl: "data:image/jpeg;base64," + lastFrame.toString("base64")
            });
        }
    });
    let errBuf = "";
    proc.stderr.on("data", (d) => { errBuf = (errBuf + d.toString()).slice(-500); });
    proc.on("close", () => {
        if (entry.stopped || win.isDestroyed()) return;
        entry.retries++;
        if (entry.retries > 6) {
            win.webContents.send("rtsp:status", { id, status: "error", message: errBuf || "bağlantı koptu" });
            rtspProcs.delete(id);
            return;
        }
        const wait = Math.min(30000, 1000 * Math.pow(2, entry.retries));
        win.webContents.send("rtsp:status", { id, status: "reconnecting", message: "yeniden bağlanılıyor (" + entry.retries + ")" });
        setTimeout(() => spawnRtsp(win, id, entry), wait);
    });
}

function stopRtsp(id) {
    const e = rtspProcs.get(id);
    if (!e) return;
    e.stopped = true;
    try { e.proc && e.proc.kill("SIGKILL"); } catch (err) { /* zaten ölü */ }
    rtspProcs.delete(id);
}
function stopAllRtsp() { for (const id of [...rtspProcs.keys()]) stopRtsp(id); }

// ---- Pencere -----------------------------------------------------------------
let mainWin = null;
function createWindow() {
    mainWin = new BrowserWindow({
        width: 1440, height: 900, minWidth: 1080, minHeight: 700,
        title: "MIA AI Safety Intelligence",
        backgroundColor: "#050505",
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            spellcheck: false
        }
    });
    mainWin.loadURL("mia://app/index.html");
    mainWin.webContents.setWindowOpenHandler(({ url }) => {
        if (ALLOWED_EXTERNAL.test(url)) shell.openExternal(url);
        return { action: "deny" };
    });
    mainWin.webContents.on("will-navigate", (e, url) => {
        if (!url.startsWith("mia://")) { e.preventDefault(); if (ALLOWED_EXTERNAL.test(url)) shell.openExternal(url); }
    });
    mainWin.on("closed", () => { mainWin = null; stopAllRtsp(); });
    // Tanılama: MIA_DEBUG=1 ile renderer konsolu terminale akar (CI smoke testleri).
    if (process.env.MIA_DEBUG) {
        mainWin.webContents.on("console-message", (e, level, msg) => console.log("[renderer]", msg));
        mainWin.webContents.on("did-fail-load", (e, code, desc) => console.error("[load-fail]", code, desc));
    }
    return mainWin;
}

// ---- IPC ---------------------------------------------------------------------
function registerIpc() {
    ipcMain.handle("app:version", () => app.getVersion());
    ipcMain.handle("app:platform", () => process.platform);

    // Depo (ayarlar, oturum, kuyruk). Anahtar bazlı get/set — küçük veri için yeterli.
    ipcMain.handle("store:get", (e, key) => storeRead()[key]);
    ipcMain.handle("store:set", (e, key, value) => { storeRead()[key] = value; storeWrite(); return true; });

    // Hassas değer şifreleme (RTSP kimlik bilgileri) — macOS Keychain destekli.
    ipcMain.handle("secure:encrypt", (e, text) => {
        if (!safeStorage.isEncryptionAvailable()) return { ok: false, error: "encryption unavailable" };
        return { ok: true, value: safeStorage.encryptString(String(text)).toString("base64") };
    });
    ipcMain.handle("secure:decrypt", (e, b64) => {
        try { return { ok: true, value: safeStorage.decryptString(Buffer.from(String(b64), "base64")) }; }
        catch (err) { return { ok: false, error: "decrypt failed" }; }
    });

    // RTSP kontrolü
    ipcMain.handle("rtsp:start", (e, opts) => mainWin ? startRtsp(mainWin, opts) : { ok: false });
    ipcMain.handle("rtsp:stop", (e, id) => { stopRtsp(id); return { ok: true }; });
    ipcMain.handle("rtsp:mask", (e, url) => maskRtsp(url));
    ipcMain.handle("rtsp:available", () => !!ffmpegPath());

    // MIA API çağrıları — ANA SÜREÇTEN (origin başlığı yok; Bearer JWT ile kimlik).
    ipcMain.handle("api:fetch", async (e, { pathName, method, headers, body }) => {
        try {
            const r = await fetch(API_BASE + pathName, {
                method: method || "POST",
                headers: Object.assign({ "Content-Type": "application/json", "x-mia-client": "desktop/" + app.getVersion() }, headers || {}),
                body: body != null ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined
            });
            const text = await r.text();
            return { ok: true, status: r.status, body: text };
        } catch (err) {
            return { ok: false, status: 0, error: String(err && err.message || err) };
        }
    });

    // PDF rapor: renderer HTML gönderir → gizli pencerede yükle → printToPDF → kaydet.
    ipcMain.handle("report:pdf", async (e, { html, filename }) => {
        const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
        try {
            await w.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
            const pdf = await w.webContents.printToPDF({ printBackground: true, pageSize: "A4" });
            const { canceled, filePath } = await dialog.showSaveDialog(mainWin, {
                defaultPath: path.join(app.getPath("downloads"), filename || "mia-rapor.pdf"),
                filters: [{ name: "PDF", extensions: ["pdf"] }]
            });
            if (canceled || !filePath) return { ok: false, canceled: true };
            fs.writeFileSync(filePath, pdf);
            return { ok: true, path: filePath };
        } catch (err) {
            return { ok: false, error: String(err && err.message || err) };
        } finally { w.destroy(); }
    });

    // CSV / metin dışa aktarma
    ipcMain.handle("file:saveText", async (e, { filename, content, extension }) => {
        const { canceled, filePath } = await dialog.showSaveDialog(mainWin, {
            defaultPath: path.join(app.getPath("downloads"), filename),
            filters: [{ name: (extension || "csv").toUpperCase(), extensions: [extension || "csv"] }]
        });
        if (canceled || !filePath) return { ok: false, canceled: true };
        // Excel'in Türkçe karakterleri doğru açması için UTF-8 BOM.
        fs.writeFileSync(filePath, "﻿" + content, "utf8");
        return { ok: true, path: filePath };
    });

    // Video dosyası seçimi (kayıtlı şantiye görüntüsü analizi)
    ipcMain.handle("file:pickVideo", async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWin, {
            properties: ["openFile"],
            filters: [{ name: "Video", extensions: ["mp4", "mov", "m4v", "webm"] }]
        });
        if (canceled || !filePaths[0]) return { ok: false };
        allowedVideoPaths.add(filePaths[0]); // yalnız kullanıcının seçtiği dosya akıtılır
        return { ok: true, path: filePaths[0], url: "mia://video/" + encodeURIComponent(filePaths[0]) };
    });

    // ---- MIA saha veri seti (ml/ eğitim hattına girdi) --------------------------
    // Veri Toplama Modu açıkken kararsız/ihlalli kareler YOLO formatında yerelde
    // birikir: userData/mia-dataset/{images,labels}. Buluta HİÇBİR görüntü gitmez.
    const dsDir = () => path.join(app.getPath("userData"), "mia-dataset");
    ipcMain.handle("dataset:save", (e, { name, jpegDataUrl, labelText }) => {
        try {
            const safe = String(name).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60) || String(Date.now());
            const img = path.join(dsDir(), "images"), lbl = path.join(dsDir(), "labels");
            fs.mkdirSync(img, { recursive: true }); fs.mkdirSync(lbl, { recursive: true });
            const b64 = String(jpegDataUrl).split(",")[1] || "";
            fs.writeFileSync(path.join(img, safe + ".jpg"), Buffer.from(b64, "base64"));
            fs.writeFileSync(path.join(lbl, safe + ".txt"), String(labelText || ""), "utf8");
            return { ok: true };
        } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
    });
    ipcMain.handle("dataset:stats", () => {
        try {
            const img = path.join(dsDir(), "images");
            const n = fs.existsSync(img) ? fs.readdirSync(img).filter(f => f.endsWith(".jpg")).length : 0;
            return { ok: true, count: n, path: dsDir() };
        } catch (err) { return { ok: false, count: 0, path: dsDir() }; }
    });
    ipcMain.handle("dataset:open", () => {
        fs.mkdirSync(path.join(dsDir(), "images"), { recursive: true });
        shell.openPath(dsDir());
        return true;
    });

    ipcMain.handle("shell:openExternal", (e, url) => {
        if (ALLOWED_EXTERNAL.test(String(url))) { shell.openExternal(url); return true; }
        return false;
    });

    ipcMain.handle("notify", (e, opts) => {
        if (Notification.isSupported()) new Notification({ title: String(opts.title || "MIA"), body: String(opts.body || "") }).show();
        return true;
    });
}

// ---- Yaşam döngüsü -------------------------------------------------------------
app.whenReady().then(() => {
    registerMiaProtocol();
    // İzinler: yalnız kamera/mikrofon (webcam canlı izleme) + bildirim. Gerisi RET.
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
        callback(permission === "media" || permission === "notifications");
    });
    registerIpc();
    createWindow();
    app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { stopAllRtsp(); if (process.platform !== "darwin") app.quit(); });
app.on("before-quit", stopAllRtsp);
