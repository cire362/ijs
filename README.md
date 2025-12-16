# ИЖС Hub (demo, JS)

Минимальный стенд: Express + Sequelize/PostgreSQL + JWT + Socket.io, фронт на Vue 3 (Vite).

## Запуск (Docker)

1. Скопируйте окружение: `cp backend/.env.example backend/.env` и при необходимости поправьте секреты.
2. `docker-compose up --build` — поднимет `db` (Postgres) и `api` на 4000.
3. API хелсчек: `GET http://localhost:4000/health`.

Тесты (бек):

```bash
cd backend
npm test
```

В тестах используется SQLite in-memory (NODE_ENV=test).

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

- `POST /auth/register` — создание пользователя (roles: agent/developer/admin).
- `POST /auth/login` — JWT.
- `GET /properties` — каталог.
- `POST /properties` — создать объект (developer/admin, JWT).
- `PATCH /properties/:id` — правка (developer владеющий или admin).
- `POST /applications` — создать заявку (agent).
- `GET /applications/mine` — заявки агента.
- `PATCH /applications/:id/status` — смена статуса (developer/admin, уведомление агенту).
- `GET /notifications` — уведомления пользователя, `POST /notifications/:id/read` — прочитать.

## Структура

- backend: Express, Sequelize модели (`users`, `properties`, `applications`, `notifications`, `property_images`, `status_history`), JWT middleware, Socket.io пуши уведомлений.
- frontend: Vue 3 + Router + Pinia + Axios; простые представления каталог/заявки/логин.

## Дальшие шаги

- Добавить валидацию (zod/celebrate), пагинацию, фильтры по каталогу.
- Расширить роли (админ-панель), e2e тесты, сборку фронта в контейнер.
- Включить миграции/seed через Sequelize CLI.

## Тесты (API)

- Требуется доступный Postgres (docker-compose db или локальный). При необходимости задайте `TEST_DATABASE_URL`.
- Запуск: `cd backend && npm test`
