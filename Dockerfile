# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
RUN npm prune --omit=dev
# Каталог под том вложений создаём заранее и отдаём пользователю node.
# Иначе Docker монтирует именованный том от root, процесс под node туда не
# пишет, и любая загрузка файла падает с EACCES. На проде так и было: ни
# вложения к заявке, ни файлы в чате не сохранялись.
#
# Важно: Docker копирует эти права только в НОВЫЙ пустой том. Уже созданный
# том так не исправить — его владельца меняют один раз руками (см. README).
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
EXPOSE 4000
USER node
CMD ["node", "dist/main"]

# Development target: sources are bind-mounted by docker-compose.
FROM node:22-bookworm-slim AS development
ENV NODE_ENV=development
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 4000
CMD ["npm", "run", "start:dev"]
