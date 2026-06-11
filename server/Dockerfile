# syntax=docker/dockerfile:1

# ---- Stage 1: build (TypeScript -> JavaScript) ----
FROM node:22-alpine AS builder
WORKDIR /app

# OpenSSL is required by the Prisma engine on Alpine
RUN apk add --no-cache openssl

# Install all dependencies (incl. dev) using the lockfile for reproducibility
COPY package*.json ./
RUN npm ci

# Generate the Prisma client (needed for the TypeScript build to type-check)
COPY prisma ./prisma
RUN npx prisma generate

# Compile the application
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Stage 2: runtime (minimal, non-root) ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    DATABASE_URL=file:/app/data/prod.db

RUN apk add --no-cache openssl

# Production dependencies only. The Prisma CLI is kept (it is a runtime
# dependency here) to run `migrate deploy` at container startup.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Generate the Prisma client for the runtime platform
COPY prisma ./prisma
RUN npx prisma generate

# Compiled application and startup script
COPY --from=builder /app/dist ./dist
COPY docker-entrypoint.sh ./

# Writable data directory for the SQLite database, owned by the non-root user
RUN chmod +x docker-entrypoint.sh \
    && mkdir -p /app/data \
    && chown -R node:node /app

USER node
EXPOSE 8080

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
