# syntax=docker/dockerfile:1

# ---- Stage 1: build the static assets (Vite) ----
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# The production build targets a relative "/api" base, which Nginx proxies to the
# backend container at runtime. It is set explicitly (and stays overridable via
# --build-arg) rather than relying on the code fallback, so the value is
# intentional regardless of any .env file present in the build context.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- Stage 2: serve the static build via Nginx (non-root image) ----
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runner

# Replace the default server block (SPA fallback + /api reverse proxy)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static build output
COPY --from=builder /app/dist /usr/share/nginx/html

# The unprivileged image already runs as the non-root "nginx" user on port 8080
EXPOSE 8080
