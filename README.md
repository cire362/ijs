# ИЖС Hub (demo, JS)

Минимальный стенд: Express + Sequelize/PostgreSQL + JWT + Socket.io, фронт на Vue 3 (Vite).

## Запуск (Docker)

1. Скопируйте окружение для compose: `cp .env.example .env` и при необходимости поправьте секреты.
2. `docker-compose up --build` — поднимет `db` (Postgres) и `api` на 4000.
3. API хелсчек: `GET http://localhost:4000/health`.

## Деплой на VPS (Docker, prod)

Ниже схема: один домен, Nginx раздаёт фронт и проксирует API/Socket.IO в контейнер `api`.

### 1) Подготовка сервера

1. Создайте VPS (Ubuntu/Debian), привяжите домен (A-запись на IP сервера).
2. Откройте порты: `22`, `80` (и `443`, если будете включать HTTPS).
3. Установите Docker:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exit
```

Зайдите по SSH снова.

### 2) Заливка проекта

Скопируйте проект на сервер (git clone или scp/zip) и перейдите в корень, где лежит `docker-compose.prod.yml`.

### 3) Настройка переменных окружения

```bash
cp .env.example .env
```

Обязательно замените как минимум:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `CORS_ALLOWED_ORIGINS` (например: `https://example.com,https://www.example.com`)
- `APP_ORIGIN` (например: `https://example.com`)

### 4) Запуск

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Если вы запускаете проект на обычном HTTP (без HTTPS) и у вас не сохраняются auth-cookie,
используйте override:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.http.yml up -d --build
```

Проверка:

- сайт: `http://<ваш-домен>/`
- API health: `http://<ваш-домен>/api/health`

### 4.1) HTTPS (рекомендуется для production)

В репозитории есть шаблон `nginx/default.https.conf.example`.
Для включения TLS:

1. Подготовьте сертификаты (`fullchain.pem`, `privkey.pem`) и смонтируйте их в контейнер nginx.
2. Замените `nginx/default.conf` на конфиг из шаблона (подставьте ваш домен и пути к сертификатам).
3. Откройте порт `443` на сервере.

### 5) (Опционально) сиды

```bash
docker compose -f docker-compose.prod.yml exec api npm run seed
```

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
