# 🚀 Руководство по деплою QR Menu

Ваше приложение состоит из двух частей: **Frontend** (React + Vite) и **Backend** (Node.js + SQLite). Поскольку используется SQLite, серверу требуется поддержка *персистентного хранения данных* (чтобы база данных не стиралась при перезагрузке).

---

## Вариант 1: Railway.app (Самый быстрый и надежный)

Railway — отличный сервис, который автоматически подхватит ваш репозиторий с GitHub.

### Шаги:
1. Зарегистрируйтесь на [Railway.app](https://railway.app/) через GitHub.
2. Нажмите **"New Project"** -> **"Deploy from GitHub repo"**.
3. Выберите ваш репозиторий `webmenu`.
4. В настройках сервиса (Variables) добавьте переменные из вашего `.env`:
   - `GEMINI_API_KEY` (ваш ключ от Google)
   - `PORT=5000` (для сервера)
5. **Важно (Persistence):** В настройках сервера добавьте **Mount Volume**. Укажите путь `/app/server/qrmenu.db`, чтобы база данных сохранялась.

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
