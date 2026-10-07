# Site-ul public de programari al unui garaj. Aceeasi imagine pentru orice
# garaj si orice domeniu; tot ce e specific vine din variabile de mediu:
#   BERLINSTAR_URL      unde e Berlin Star (ex. http://backend:8000, https://professorprime.ro)
#   BERLINSTAR_API_KEY  cheia API a locatiei (Configurari › Programari online)
#   SITE_NAME           optional; altfel numele configurat in Berlin Star
#   REAL_IP_FROM        reteaua proxy-ului din fata (Caddy), din care credem X-Forwarded-For

# ---- Stage 1: build SolidJS cu Vite ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY public-calendar/package*.json ./
RUN npm ci
COPY public-calendar/ .
RUN npm run build

# ---- Stage 2: nginx — fisiere statice + proxy catre Berlin Star ----
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Imaginea oficiala nginx trece fisierele din templates/ prin envsubst la
# pornire (doar variabilele definite), rezultatul ajunge in conf.d/.
COPY deploy/public-calendar.nginx.conf.template /etc/nginx/templates/default.conf.template
ENV BERLINSTAR_URL=http://backend:8000 \
    BERLINSTAR_API_KEY="" \
    SITE_NAME="" \
    REAL_IP_FROM=172.16.0.0/12
EXPOSE 80
