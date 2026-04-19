FROM node:20-bookworm-slim

WORKDIR /app

ENV CI=true

COPY package.json ./
COPY packages/backend/package.json packages/backend/package.json
COPY packages/frontend/package.json packages/frontend/package.json

RUN npm install

COPY packages/backend packages/backend
COPY packages/database packages/db

RUN npm run build --workspace=inventory-backend

WORKDIR /app/packages/backend

RUN mkdir -p uploads/profiles uploads/reports

EXPOSE 4000

CMD ["npm", "run", "start"]
