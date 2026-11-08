FROM node:22-bookworm-slim
ENV NODE_ENV=production TMPDIR=/tmp/socialos-media
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/* && mkdir -p /app /tmp/socialos-media \
    && chown -R node:node /app /tmp/socialos-media
WORKDIR /app
COPY --chown=node:node package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY --chown=node:node src ./src
USER node
CMD ["node", "src/worker.mjs"]
