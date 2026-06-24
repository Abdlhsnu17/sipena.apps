FROM node:20-bookworm-slim

WORKDIR /app

ENV CI=true
ENV NEXT_TELEMETRY_DISABLED=1
ENV BACKEND_PORT=4000
ENV API_PROXY_TARGET=http://127.0.0.1:4000

COPY package.json package-lock.json ./
COPY packages/backend/package.json packages/backend/package.json
COPY packages/frontend/package.json packages/frontend/package.json

RUN npm install -g npm@11.7.0
RUN npm ci

COPY packages/backend packages/backend
COPY packages/frontend packages/frontend
COPY packages/database packages/database
COPY scripts scripts
COPY tsconfig.json tsconfig.json

RUN npm run build

ENV NODE_ENV=production

RUN mkdir -p /data/uploads/profiles /data/uploads/reports packages/backend/uploads/profiles packages/backend/uploads/reports

COPY scripts/start-production.sh scripts/start-production.sh
RUN chmod +x scripts/start-production.sh

EXPOSE 3000
EXPOSE 4000

CMD ["./scripts/start-production.sh"]
