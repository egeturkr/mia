// Serverless proxy → Roboflow Hosted Inference.
// Runs server-side so (1) no browser CORS, (2) API key stays secret in env.
// Set ROBOFLOW_API_KEY in Vercel → Project → Settings → Environment Variables.

export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.status(405).json({ error: "POST only" });
        return;
    }

    const apiKey = process.env.ROBOFLOW_API_KEY;
    if (!apiKey) {
        res.status(500).json({ error: "ROBOFLOW_API_KEY env var not configured" });
        return;
    }

    // Allowlist params; default to the construction-site-safety model.
    const model = (req.query.model || "construction-site-safety/27").toString();
    const confidence = (req.query.confidence || "35").toString();
    const overlap = (req.query.overlap || "30").toString();

    // Client sends { image: "<base64 jpeg, no data: prefix>" }
    const image = req.body && req.body.image;
    if (!image) {
        res.status(400).json({ error: "missing 'image' in body" });
        return;
    }

    const url = "https://detect.roboflow.com/" + model +
        "?api_key=" + encodeURIComponent(apiKey) +
        "&confidence=" + encodeURIComponent(confidence) +
        "&overlap=" + encodeURIComponent(overlap);

    try {
        const rf = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: image
        });
        const text = await rf.text();
        res.status(rf.status);
        res.setHeader("Content-Type", "application/json");
        res.send(text);
    } catch (err) {
        res.status(502).json({ error: "Roboflow upstream failed: " + (err && err.message || err) });
    }
}
