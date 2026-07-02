// === Vendor kopyalama (postinstall) ===
// CDN YOK — offline saha koşulu. supabase-js UMD + onnxruntime-web (wasm dahil)
// node_modules'ten renderer/vendor'a kopyalanır; uygulama yalnız yerel dosya yükler.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const vendor = path.join(root, "renderer", "vendor");
fs.mkdirSync(vendor, { recursive: true });

function cp(src, dst) {
    fs.copyFileSync(src, path.join(vendor, dst));
    console.log("vendor ←", dst);
}

// supabase-js UMD
cp(path.join(root, "node_modules", "@supabase", "supabase-js", "dist", "umd", "supabase.js"), "supabase.js");

// onnxruntime-web: 'all' paketi (webgpu + wasm EP) → ort.min.js adıyla.
// Çalışma zamanı wasm/mjs dosyaları da yanına — ort.env.wasm.wasmPaths="vendor/".
const ortDist = path.join(root, "node_modules", "onnxruntime-web", "dist");
cp(path.join(ortDist, "ort.all.min.js"), "ort.min.js");
for (const f of fs.readdirSync(ortDist)) {
    if (/^ort-wasm.*\.(wasm|mjs)$/.test(f) && !/asyncify|jspi/.test(f)) cp(path.join(ortDist, f), f);
}
console.log("vendor hazır:", vendor);
