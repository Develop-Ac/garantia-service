# syntax=docker/dockerfile:1

FROM node:20-slim AS build
WORKDIR /app

# ODBC bindings need compilation headers/libs
RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential python3 make g++ unixodbc-dev \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma

# Installs deps and runs prisma generate via postinstall
RUN npm ci

COPY nest-cli.json tsconfig*.json ./
COPY src ./src

RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Runtime packages required by mssql/odbc
RUN apt-get update \
  && apt-get install -y --no-install-recommends unixodbc ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY form_templates ./form_templates

EXPOSE 3000
CMD ["node", "dist/main.js"]
