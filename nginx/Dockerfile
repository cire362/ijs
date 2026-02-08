# Build frontend
FROM node:18-alpine AS build
WORKDIR /app/frontend
COPY frontend/package*.json ./
# Защита от ситуации, когда в процессе npm-установки (или по иной причине)
# появляется директория index.html. Vite ожидает файл.
RUN touch index.html
RUN npm ci
COPY frontend/ ./
# VITE_API_URL по умолчанию не нужен (axios уже использует /api),
# но можно переопределить при build: --build-arg VITE_API_URL=https://api.example.com
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Serve via nginx + reverse proxy
FROM nginx:1.27-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
