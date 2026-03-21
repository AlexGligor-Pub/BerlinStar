# ---- Stage 1: Build SolidJS cu Vite ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copiază doar package files mai întâi (cache layer pentru npm ci)
COPY frontend/package*.json ./
RUN npm ci

# Copiază tot restul și build
COPY frontend/ .
RUN npm run build

# ---- Stage 2: Serve cu nginx ----
FROM nginx:alpine

# Copiază build-ul static
COPY --from=builder /app/dist /usr/share/nginx/html

# Configurare nginx pentru SPA + cache headers
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
