# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
WORKDIR /app

# Vite bakes import.meta.env.* at BUILD TIME.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package*.json ./
RUN npm ci --no-audit --no-fund --loglevel error

COPY . .
RUN npm run build

# Serve with express + proxy to backend
FROM node:20-alpine AS runner
WORKDIR /app

# Install production server dependencies once
RUN npm init -y && \
    npm install --no-audit --no-fund --loglevel error express@4 http-proxy-middleware@2

COPY --from=builder /app/dist ./dist
COPY server.js ./server.js

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:8000/api/health || exit 1

CMD ["node", "server.js"]
