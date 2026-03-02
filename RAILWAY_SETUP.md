# 🚄 Инструкция по запуску Backend на Railway (PostgreSQL)

Этот гайд поможет вам развернуть ваш Node.js сервер с PostgreSQL.

---

## 🏗 Настройка проекта в Railway
1. **GitHub**: Подключите свой репозиторий.
2. **Root Directory**: Укажите `server`.
3. **Build Command**: `npx prisma generate && npm run build`
4. **Start Command**: `npm start`

---

## 💾 База Данных (PostgreSQL)

1. В интерфейсе Railway нажмите **`Add Service`** -> **`Database`** -> **`Add PostgreSQL`**.
2. Railway автоматически создаст базу и добавит переменную `DATABASE_URL` в ваш проект.
3. Система сама подхватит настройки из `schema.prisma`.

---

## 🔑 Переменные окружения (Variables)
Добавьте эти ключи в разделе **Settings -> Variables** на Railway:
*   `GEMINI_API_KEY`: Ваш ключ от Google AI
*   `DATABASE_URL`: (уже добавлена Railway)
*   `NODE_ENV`: `production`

---

## 🌐 Настройка Frontend (на Vercel)
1. Откройте ваш проект на Vercel -> **Settings -> Environment Variables**.
2. Обновите/добавьте `VITE_API_URL`.
3. Значение: `https://ваша-ссылка-на-railway.app/api`.
4. Пересоберите фронтенд (Redeploy).
