# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# --- Serve stage ---
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/generate-env.sh /docker-entrypoint.d/30-generate-env.sh
RUN chmod +x /docker-entrypoint.d/30-generate-env.sh

COPY --from=build /app/dist/fluxcomenzi-ui/browser /usr/share/nginx/html

EXPOSE 80
