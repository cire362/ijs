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
RUN set -eux \
	&& rm -rf /app/frontend/index.html \
	&& cp /tmp/index.html /app/frontend/index.html \
	&& echo "index.html before vite:" \
	&& ls -la /app/frontend/index.html \
	&& node -e "const fs=require('fs'); const p='/app/frontend/index.html'; const s=fs.statSync(p); console.log('stat before vite => isFile:', s.isFile(), 'isDirectory:', s.isDirectory()); console.log('read before vite (first 40):', JSON.stringify(fs.readFileSync(p,'utf8').slice(0,40)));" \
	&& (npm run build || (echo "vite failed; inspecting index.html:" \
			&& ls -la /app/frontend/index.html || true) \
			&& node -e "const fs=require('fs'); const p='/app/frontend/index.html'; try { const s=fs.statSync(p); console.log('stat after vite => isFile:', s.isFile(), 'isDirectory:', s.isDirectory()); } catch(e){ console.error('stat after vite error:', e); } try { console.log('read after vite (first 40):', JSON.stringify(fs.readFileSync(p,'utf8').slice(0,40))); } catch(e){ console.error('read after vite error:', e); }" \
			&& exit 1))

# Serve via nginx + reverse proxy
FROM nginx:1.27-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
