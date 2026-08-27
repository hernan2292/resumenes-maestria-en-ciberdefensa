# VITE_API_BASE_URL se hornea en el bundle en tiempo de BUILD (Vite lee
# import.meta.env.VITE_API_BASE_URL) — no es una variable de entorno que se
# pueda cambiar en runtime del contenedor nginx sin reconstruir la imagen.
# Por defecto apunta a donde docker-compose.yml publica el puerto de la API
# en el HOST (no al hostname interno de la red de Docker: quien resuelve
# esta URL es el navegador del usuario, no el contenedor).
FROM node:20-bookworm AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL=http://localhost:8080
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /src/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
