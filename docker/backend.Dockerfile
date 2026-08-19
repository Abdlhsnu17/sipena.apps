# ======================
# 1. Build Stage
# ======================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json

RUN npm ci

COPY apps/backend apps/backend
COPY database database

RUN npm run build --workspace=inventory-backend
RUN npm prune --omit=dev

# ======================
# 2. Production Stage
# ======================
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/dist ./dist
COPY apps/backend/scripts ./scripts
COPY --from=builder /app/database/migrations /database/migrations

RUN mkdir -p uploads/profiles uploads/reports

EXPOSE 4000

CMD ["node", "dist/index.js"]
