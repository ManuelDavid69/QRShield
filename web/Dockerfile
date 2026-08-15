FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Vite écrit ces valeurs dans le code à la compilation
ARG VITE_API_URL=http://127.0.0.1:8000
ARG VITE_DEMO_DATA=true
ENV VITE_API_URL=$VITE_API_URL VITE_DEMO_DATA=$VITE_DEMO_DATA
RUN npm run build

# Image finale sans Node ni sources : seulement les fichiers statiques
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
