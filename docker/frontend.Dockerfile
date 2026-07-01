FROM node:20-bookworm-slim

WORKDIR /app

ENV CI=true
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json

RUN npm install -g npm@11.7.0
RUN npm ci

COPY tsconfig.json tsconfig.json
COPY apps/frontend apps/frontend

RUN npm run build --workspace=inventory-frontend

ENV NODE_ENV=production

WORKDIR /app/apps/frontend

EXPOSE 3000

CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
