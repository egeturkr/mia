# MIA — Roboflow Adaptörü (Faz 15)
# Roboflow serverless API'sini çağırır, yanıtı normalize tespit şemasına çevirir.
# Çekirdek worker Roboflow'un yanıt biçimini BİLMEZ — yalnız bu adaptör bilir.
import base64
import json
import urllib.request

from detection_schema import make_detection

MIN_BOX_AREA = 0.0008  # js/postprocess.js ile aynı gürültü eşiği


class RoboflowAdapter:
    name = "roboflow"

    def __init__(self, api_key, model_id, confidence_threshold=0.45, timeout=30):
        if not api_key:
            raise ValueError("ROBOFLOW_API_KEY gerekli")
        self.api_key = api_key
        self.model_id = model_id                     # örn. construction-site-safety/27
        self.confidence = float(confidence_threshold)  # 0..1
        self.timeout = timeout

    def infer_jpeg(self, jpeg_bytes):
        """JPEG bayt → normalize tespit listesi. Hata fırlatır (çağıran loglar);
        ASLA uydurma sonuç dönmez."""
        b64 = base64.b64encode(jpeg_bytes)
        url = (f"https://serverless.roboflow.com/{self.model_id}"
               f"?api_key={self.api_key}&confidence={int(self.confidence * 100)}&overlap=30")
        req = urllib.request.Request(url, data=b64, method="POST",
                                     headers={"Content-Type": "application/x-www-form-urlencoded"})
        with urllib.request.urlopen(req, timeout=self.timeout) as r:
            j = json.loads(r.read())
        W = (j.get("image") or {}).get("width") or 1
        H = (j.get("image") or {}).get("height") or 1
        out = []
        for p in j.get("predictions", []):
            w, h = p["width"] / W, p["height"] / H
            if w * h < MIN_BOX_AREA:
                continue  # gürültü kutusu
            out.append(make_detection(
                raw_class=p.get("class"),
                confidence=p.get("confidence", 0),
                bbox=((p["x"] - p["width"] / 2) / W, (p["y"] - p["height"] / 2) / H, w, h),
                source_model=self.name,
            ))
        return out
