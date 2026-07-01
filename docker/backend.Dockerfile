FROM node:20-bookworm-slim

WORKDIR /app

ENV CI=true

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json

RUN npm install -g npm@11.7.0
RUN npm ci

COPY tsconfig.json tsconfig.json
COPY apps/backend apps/backend
COPY packages/database packages/database

RUN npm run build --workspace=inventory-backend

ENV NODE_ENV=production

WORKDIR /app/apps/backend

RUN mkdir -p uploads/profiles uploads/reports

EXPOSE 4000

CMD ["npm", "run", "start"]
