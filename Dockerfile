FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY worker ./worker
COPY web ./web
COPY scripts ./scripts
ENV HOST=0.0.0.0 PORT=4178 MONITOR_DATA_DIR=/data
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
EXPOSE 4178
USER node
CMD ["node", "scripts/serve.mjs"]
