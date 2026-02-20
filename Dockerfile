FROM node:20-alpine

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/ ./src/

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROMIUM_PATH=/usr/bin/chromium-browser
ENV DATA_DIR=/data
ENV PREVIEW_PORT=3100
ENV MCP_TRANSPORT=stdio

EXPOSE 3100

VOLUME ["/data"]

ENTRYPOINT ["node", "src/index.js"]
