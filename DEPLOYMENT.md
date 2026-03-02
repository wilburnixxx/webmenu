# 🚀 Руководство по деплою QR Menu

Ваше приложение состоит из двух частей: **Frontend** (React + Vite) и **Backend** (Node.js + SQLite). Поскольку используется SQLite, серверу требуется поддержка *персистентного хранения данных* (чтобы база данных не стиралась при перезагрузке).

---

## Вариант 1: Vercel (Только Frontend) + Railway (Backend)

Это самый современный и производительный способ.

### Часть 1: Frontend на Vercel
1. Подключите ваш GitHub к [Vercel](https://vercel.com/).
2. Выберите репозиторий `webmenu`.
3. **Root Directory**: установите `client`.
4. **Build Command**: `npm run build`.
5. **Output Directory**: `dist`.
6. **Environment Variables**: Добавьте `VITE_API_URL` (здесь должен быть URL вашего бэкенда на Railway).

### Часть 2: Backend на Railway
1. Создайте проект на [Railway](https://railway.app/).
2. Выберите папку `server` как корневую для деплоя (или весь репо, но укажите старт из `server`).
3. Добавьте **Volume** (Mount Disk) для файла `qrmenu.db`.
4. Перенесите `GEMINI_API_KEY` в переменные.

---

## Вариант 2: VPS (Свой сервер - Ubuntu + Docker)

Если вы арендовали виртуальный сервер (например, Timeweb, Selectel, DigitalOcean).

### Шаги:
1. Установите Docker на сервер: `curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh`
2. Клонируйте репозиторий: `git clone https://github.com/wilburnixxx/webmenu.git`
3. Создайте `.env` файл на сервере в папке `server/`.
4. Запустите проект (удобнее всего через Docker Compose).

---

## Вариант 3: Amvera / Render

Если у вас нет зарубежной карты, **Amvera (Cloud.amvera.ru)** — хороший российский аналог с поддержкой Docker и дисков для SQLite.

### Особенности деплоя:
*   **Frontend:** Собирается командой `npm run build` в папке `/client`. Полученную папку `dist` можно раздавать как статику.
*   **Backend:** Должен запускаться из папки `/server` командой `npm start`.

---

## 🛠 Полезные команды перед деплоем

Собрать клиент локально:
```bash
cd client
npm install
npm run build
```

Запустить сервер в режиме продакшн:
```bash
cd server
npm install
npm run build
npm start
```

> [!TIP]
> Для серьезного проекта рекомендуется заменить SQLite на **PostgreSQL** (Railway предоставляет его в один клик), тогда вам не придется возиться с дисками и данными.
