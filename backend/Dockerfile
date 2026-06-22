FROM node:20-alpine AS base

WORKDIR /app

COPY package*.json ./


# Desarrollo local con Docker Compose.
FROM base AS development

RUN npm ci

COPY . .

EXPOSE 4000

CMD ["npm", "run", "dev"]


# Producción en Railway.
FROM base AS production

ENV NODE_ENV=production

RUN npm ci --omit=dev

COPY . .

EXPOSE 4000

CMD ["npm", "start"]