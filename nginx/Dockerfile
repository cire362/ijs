# Build frontend
FROM node:18-alpine AS build
WORKDIR /app/frontend
COPY frontend/package*.json ./
# Кладём исходный index.html отдельно, чтобы в конце гарантированно восстановить
# его как *файл* (на случай, если в процессе копирования/установки появится директория).
COPY frontend/index.html /tmp/index.html
RUN npm ci
COPY frontend/ ./
# VITE_API_URL по умолчанию не нужен (axios уже использует /api),
# но можно переопределить при build: --build-arg VITE_API_URL=https://api.example.com
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN rm -rf /app/frontend/index.html \
	&& cp /tmp/index.html /app/frontend/index.html \
	&& echo "index.html after restore:" \
	&& ls -la /app/frontend/index.html \
	&& node -e "const fs=require('fs'); const s=fs.statSync('/app/frontend/index.html'); console.log('isFile:', s.isFile(), 'isDirectory:', s.isDirectory());" \
	&& npm run build

# Serve via nginx + reverse proxy
FROM nginx:1.27-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
