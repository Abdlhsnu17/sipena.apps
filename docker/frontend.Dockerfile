# ======================
# 1. Build Stage
# ======================
FROM node:20-alpine AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY apps/frontend/package.json apps/frontend/package.json

RUN npm ci

COPY apps/frontend apps/frontend

RUN npm run build --workspace=inventory-frontend

# ======================
# 2. Production Stage
# ======================
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Docker sets HOSTNAME to the container ID; without this override, Next's
# standalone server binds to that address instead of 0.0.0.0, so nothing
# can reach it via 127.0.0.1 or the compose service name.
ENV HOSTNAME=0.0.0.0

# pakai standalone (WAJIB)
# npm workspaces monorepo: standalone output nests under apps/frontend
COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public

EXPOSE 3000

CMD ["node", "apps/frontend/server.js"]