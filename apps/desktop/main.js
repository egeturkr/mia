// MIA AI Safety Intelligence — Masaüstü kabuk (Electron)
// Canlı web uygulamasını (miaissagligi.com) güvenli bir pencerede yükler.
// GÜVENLİK: nodeIntegration KAPALI, contextIsolation AÇIK, izin verilmeyen
// alan adlarına gezinme ENGELLİ (dış linkler sistem tarayıcısında açılır).
// RTSP kimlik bilgileri bu uygulamada SAKLANMAZ (worker mimarisi: docs/PHASE13...).

const { app, BrowserWindow, shell, Notification } = require("electron");

const APP_URL = process.env.MIA_APP_URL || "https://miaissagligi.com";
const ALLOWED_HOSTS = ["miaissagligi.com", "www.miaissagligi.com"];

function isAllowed(url) {
    try { return ALLOWED_HOSTS.includes(new URL(url).hostname); }
    catch (e) { return false; }
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1360, height: 860, minWidth: 980, minHeight: 640,
        title: "MIA AI Safety Intelligence",
        backgroundColor: "#050505",
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,        // web içeriği Node API'lerine ERİŞEMEZ
            contextIsolation: true,
            sandbox: true,
            spellcheck: false
        }
    });

    // Dış linkler (Supabase doğrulama mailleri vb.) sistem tarayıcısında açılır.
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (!isAllowed(url)) { shell.openExternal(url); return { action: "deny" }; }
        return { action: "allow" };
    });
    win.webContents.on("will-navigate", (e, url) => {
        if (!isAllowed(url)) { e.preventDefault(); shell.openExternal(url); }
    });

    win.loadURL(APP_URL).catch(() => {
        win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(
            "<body style='background:#050505;color:#eee;font-family:sans-serif;display:grid;place-items:center;height:100vh'>" +
            "<div><h2>MIA'ya bağlanılamadı</h2><p>İnternet bağlantınızı kontrol edip uygulamayı yeniden başlatın.</p></div></body>"));
    });
    return win;
}

app.whenReady().then(() => {
    createWindow();
    if (Notification.isSupported()) {
        // Bildirim altyapısı hazır — web tarafı Notification API kullanırsa çalışır.
    }
    app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
