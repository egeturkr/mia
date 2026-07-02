// === MIA Masaüstü — Preload Köprüsü ===
// Renderer'a YALNIZ bu daraltılmış API açılır (contextBridge). Node erişimi yok.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mia", {
    version: () => ipcRenderer.invoke("app:version"),
    platform: () => ipcRenderer.invoke("app:platform"),

    // Depo (ayarlar, oturum, offline kuyruk)
    storeGet: (key) => ipcRenderer.invoke("store:get", key),
    storeSet: (key, value) => ipcRenderer.invoke("store:set", key, value),

    // Hassas değer şifreleme (RTSP kimlik bilgileri)
    secureEncrypt: (text) => ipcRenderer.invoke("secure:encrypt", text),
    secureDecrypt: (b64) => ipcRenderer.invoke("secure:decrypt", b64),

    // RTSP
    rtspStart: (opts) => ipcRenderer.invoke("rtsp:start", opts),
    rtspStop: (id) => ipcRenderer.invoke("rtsp:stop", id),
    rtspMask: (url) => ipcRenderer.invoke("rtsp:mask", url),
    rtspAvailable: () => ipcRenderer.invoke("rtsp:available"),
    onRtspFrame: (cb) => { ipcRenderer.on("rtsp:frame", (e, data) => cb(data)); },
    onRtspStatus: (cb) => { ipcRenderer.on("rtsp:status", (e, data) => cb(data)); },

    // MIA API (ana süreç üzerinden — origin'siz, Bearer JWT ile)
    apiFetch: (opts) => ipcRenderer.invoke("api:fetch", opts),

    // Dışa aktarma
    reportPdf: (opts) => ipcRenderer.invoke("report:pdf", opts),
    saveText: (opts) => ipcRenderer.invoke("file:saveText", opts),
    pickVideo: () => ipcRenderer.invoke("file:pickVideo"),

    // MIA saha veri seti (ml/ eğitim hattı girdisi — yalnız yerel disk)
    datasetSave: (opts) => ipcRenderer.invoke("dataset:save", opts),
    datasetStats: () => ipcRenderer.invoke("dataset:stats"),
    datasetOpen: () => ipcRenderer.invoke("dataset:open"),

    openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
    notify: (title, body) => ipcRenderer.invoke("notify", { title, body })
});
