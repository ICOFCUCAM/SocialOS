FROM node:22-bookworm-slim
ENV NODE_ENV=production TMPDIR=/tmp/socialos-media CLAMAV_DATABASE=/tmp/socialos-clamav
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg clamav clamav-freshclam ca-certificates \
    && rm -rf /var/lib/apt/lists/* && mkdir -p /app /tmp/socialos-media /tmp/socialos-clamav \
    && chown -R node:node /app /tmp/socialos-media /tmp/socialos-clamav
WORKDIR /app
COPY --chown=node:node package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY --chown=node:node src ./src
COPY --chown=node:node entrypoint.sh ./entrypoint.sh
COPY --chown=node:node test ./test
USER node
ENTRYPOINT ["sh", "./entrypoint.sh"]
