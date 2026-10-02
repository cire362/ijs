# ИЖС Hub (demo, JS)

Платформа объектов ИЖС и заявок: Express + Sequelize/PostgreSQL + JWT + Socket.IO, фронт на Vue 3 (Vite). Инструкция по backend, бизнес-правилам и проверкам: [backend/README.md](backend/README.md).

## Запуск (Docker)

1. Скопируйте окружение для compose: `cp .env.example .env` и при необходимости поправьте секреты.
2. `docker-compose up --build` — поднимет `db` (Postgres) и `api` на 4000.
3. API хелсчек: `GET http://localhost:4000/health`.

## Production

Инструкция по запуску, миграциям, резервным копиям, восстановлению и мониторингу: [backend/PRODUCTION.md](backend/PRODUCTION.md).

Production-конфигурация рассчитана на один процесс API за Caddy с HTTPS, PostgreSQL 15, отдельную роль базы без административных прав, постоянное хранилище загрузок, зашифрованные копии базы вместе с файлами и независимое хранилище копий. Небезопасные секреты и настройки останавливают запуск.

Создайте конфигурацию со случайными независимыми секретами; команда не перезаписывает существующий файл:

```sh
cd backend
npm ci
npm run ops:configure -- <ваш-домен> /mnt/ijshub-backups
cd ..
docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build --wait
```

До запуска подготовьте DNS, порты 80/443, подключённое независимое хранилище `/mnt/ijshub-backups` с правами UID 1000 и доставку уведомлений мониторинга. Подробности и команды проверки приведены в инструкции. Для существующей базы сначала выполните обновление на её копии по инструкции; скрипт создания роли работает только при первом запуске пустого volume PostgreSQL.

Проверка изолированного production-стенда:

```sh
cd backend
npm run ops:rehearse
```

Проверка создаёт собственные контейнеры и базы, проверяет нагрузку, восстановление, миграции, недоступность базы и завершение API, затем удаляет только созданный стенд. HTTP overrides предназначены для локальной разработки и переводят API в development; публичный production требует HTTPS. Demo-сиды в production запрещены.

## Локальный запуск без Docker

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

В `.env` задайте `DATABASE_URL` вида `postgres://user:pass@localhost:5432/ijshub`.

Фронт (Vite) проксирует `/api` на `http://localhost:4000` — можно не задавать `VITE_API_URL`. Если нужен прямой URL, укажите `VITE_API_URL` в `frontend/.env`.

Фронт:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Откройте `http://localhost:5173`.

## Минимальные эндпоинты

- `POST /auth/register` — создание пользователя (roles: agent/individual/developer).
- `POST /auth/login` — JWT.
- `GET /properties` — каталог.
- `POST /properties` — создать объект (developer/admin, JWT).
- `PATCH /properties/:id` — правка (developer владеющий или admin).
- `POST /applications` — создать заявку (agent/individual).
- `GET /applications/mine` — заявки агента.
- `PATCH /applications/:id/status` — смена статуса (developer/admin, уведомление агенту).
- `GET /notifications` — уведомления пользователя, `POST /notifications/:id/read` — прочитать.

## Структура

- backend: Express, Sequelize модели (`users`, `properties`, `applications`, `notifications`, `property_images`, `status_history`), JWT middleware, Socket.io пуши уведомлений.
- frontend: Vue 3 + Router + Pinia + Axios; простые представления каталог/заявки/логин.

## Тесты (API)

- Требуется доступный Postgres (docker-compose db или локальный). При необходимости задайте `TEST_DATABASE_URL`.
- Запуск: `cd backend && npm test`
