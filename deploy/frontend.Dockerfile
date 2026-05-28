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

# Layout docroot unic:
#   /                → site de marketing static (Site/)
#   /berlinstar/     → SolidJS SPA (build-ul Vite, base=/berlinstar/)
# Hetzner e acum edge-ul public unic; prefixul /berlinstar ajunge intact la nginx.
COPY --from=builder /app/dist /usr/share/nginx/html/berlinstar
COPY Site/ /usr/share/nginx/html/

# Scoate fisiere specifice RockHost / irelevante din docroot
RUN rm -f /usr/share/nginx/html/htaccess /usr/share/nginx/html/images/README.md

# Configurare nginx pentru site static + SPA + proxy API
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
