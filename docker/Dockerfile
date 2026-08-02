FROM node:20-bookworm-slim

WORKDIR /app

ENV CI=true
ENV NEXT_TELEMETRY_DISABLED=1
ENV BACKEND_PORT=4000
ENV API_PROXY_TARGET=http://127.0.0.1:4000

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json

RUN npm install -g npm@11.7.0
RUN npm ci

COPY apps/backend apps/backend
COPY apps/frontend apps/frontend
COPY database database
COPY scripts scripts

RUN npm run build

ENV NODE_ENV=production

RUN mkdir -p /data/uploads/profiles /data/uploads/reports apps/backend/uploads/profiles apps/backend/uploads/reports

COPY scripts/start-production.sh scripts/start-production.sh
RUN chmod +x scripts/start-production.sh

EXPOSE 3000
EXPOSE 4000

CMD ["./scripts/start-production.sh"]
