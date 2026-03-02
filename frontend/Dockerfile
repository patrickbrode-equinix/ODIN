# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
WORKDIR /app

# Vite bakes import.meta.env.* at BUILD TIME, so we must pass the API URL here.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Serve with express + proxy to backend
FROM node:20-alpine AS runner
WORKDIR /app
RUN npm init -y && npm install express@4 http-proxy-middleware@2
COPY --from=builder /app/dist ./dist
COPY server.js ./server.js
EXPOSE 8000
CMD ["node", "server.js"]
