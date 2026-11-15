# The service has no npm dependencies and Node 22.18+ runs TypeScript directly,
# so the image is just Node, ffmpeg (needed by the video engine) and the code.
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
ENV NODE_ENV=production \
    DB_PATH=/data/app.db \
    DATA_DIR=/data
# /data must be a persistent volume: it holds the database, uploads and finished videos.
CMD ["node", "--disable-warning=ExperimentalWarning", "app/server.ts"]
