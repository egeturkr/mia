// Netlify Function mirror of /api/detect (Vercel).
// netlify.toml redirects /api/detect → /.netlify/functions/detect so the
// frontend uses one URL regardless of host. Runs server-side: no browser CORS,
// API key stays secret. Set ROBOFLOW_API_KEY in Netlify → Site → Environment variables.

exports.handler = async function (event) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: JSON.stringify({ error: "POST only" }) };
    }

    const apiKey = process.env.ROBOFLOW_API_KEY;
    if (!apiKey) {
        return { statusCode: 500, body: JSON.stringify({ error: "ROBOFLOW_API_KEY env var not configured" }) };
    }

    const q = event.queryStringParameters || {};
    const model = (q.model || "construction-site-safety/27").toString();
    const confidence = (q.confidence || "35").toString();
    const overlap = (q.overlap || "30").toString();

    let image;
    try {
        image = JSON.parse(event.body || "{}").image;
    } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: "invalid JSON body" }) };
    }
    if (!image) {
        return { statusCode: 400, body: JSON.stringify({ error: "missing 'image' in body" }) };
    }

    const url = "https://serverless.roboflow.com/" + model +
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
        return {
            statusCode: rf.status,
            headers: { "Content-Type": "application/json" },
            body: text
        };
    } catch (err) {
        return { statusCode: 502, body: JSON.stringify({ error: "Roboflow upstream failed: " + (err && err.message || err) }) };
    }
};
