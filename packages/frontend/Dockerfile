FROM node:20-bookworm-slim

WORKDIR /app

ENV CI=true
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY packages/backend/package.json packages/backend/package.json
COPY packages/frontend/package.json packages/frontend/package.json

RUN npm install -g npm@11.7.0
RUN npm ci

COPY tsconfig.json tsconfig.json
COPY packages/frontend packages/frontend

RUN npm run build --workspace=inventory-frontend

ENV NODE_ENV=production

WORKDIR /app/packages/frontend

EXPOSE 3000

CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
