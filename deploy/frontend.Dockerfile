# ---- Stage 1: Build SolidJS cu Vite ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copiază doar package files mai întâi (cache layer pentru npm ci)
COPY frontend/package*.json ./
RUN npm ci

# Copiază tot restul și build
COPY frontend/ .

# VITE_BASE_PATH controlează base URL-ul aplicației (ex: /berlinstar/)
ARG VITE_BASE_PATH=/berlinstar/
ENV VITE_BASE_PATH=$VITE_BASE_PATH

RUN npm run build

# ---- Stage 2: Serve cu nginx ----
FROM nginx:alpine

# Copiază build-ul static în subfolderul corespunzător base path-ului
ARG VITE_BASE_PATH=/berlinstar/
COPY --from=builder /app/dist /usr/share/nginx/html${VITE_BASE_PATH}

# Configurare nginx pentru SPA + proxy API
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
