# MIA Gerçek Zamanlı Kamera Worker — Fly.io/Render/VM için
# build: docker build -t mia-camera-worker .
# run:   docker run --env-file .env -v $(pwd)/cameras.json:/app/cameras.json mia-camera-worker
# NOT: cameras.json (RTSP kimlik bilgileri) imaja GÖMÜLMEZ — volume/secret olarak verilir.
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
COPY src/ src/
CMD ["python", "main.py"]
