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

# pakai standalone (WAJIB)
# npm workspaces monorepo: standalone output nests under apps/frontend
COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public

EXPOSE 3000

CMD ["node", "apps/frontend/server.js"]