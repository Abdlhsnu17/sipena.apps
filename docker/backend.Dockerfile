# ======================
# 1. Build Stage
# ======================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY packages/database/package.json packages/database/package.json

RUN npm ci

COPY apps/backend apps/backend
COPY packages/database packages/database

RUN npm run build --workspace=inventory-backend

# ======================
# 2. Production Stage
# ======================
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/package.json ./package.json

RUN npm install --omit=dev

RUN mkdir -p uploads/profiles uploads/reports

EXPOSE 4000

CMD ["node", "dist/index.js"]