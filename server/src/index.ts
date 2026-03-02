// @ts-nocheck
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

console.log('🏁 Запуск сервера...');
console.log('📌 Порт:', process.env.PORT || 5000);

const app = express();
const PORT = process.env.PORT || 5000;
const DB_STATUS = process.env.DATABASE_URL ? 'PRESENT' : 'MISSING';
console.log('🔗 DATABASE_URL:', DB_STATUS);

let prisma;

try {
    prisma = new PrismaClient();
    console.log('💎 Prisma Client инициализирован');
} catch (e) {
    console.error('❌ Ошибка инициализации Prisma:', e.message);
}

// 1. Максимально открытый CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());

// 2. Логирование запросов (для Railway Logs)
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

// 3. Health Checks
app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send('<h1>QR Menu Server v2.0.2</h1><p>Статус: Работает</p>');
});

app.get('/health', async (req, res) => {
    try {
        if (!prisma) throw new Error('Prisma не инициализирована');
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'ok', db: 'up', time: new Date().toISOString() });
    } catch (e) {
        console.error('❌ Health check failed:', e.message);
        res.status(500).json({ status: 'error', db: 'down', err: e.message });
    }
});

// --- API МАРШРУТЫ ---

const safeQuery = async (res, fn) => {
    try {
        const data = await fn();
        res.json(data);
    } catch (e) {
        console.error('❌ Ошибка запроса:', e.message);
        res.status(500).json({ error: e.message });
    }
};

// Категории
app.get(['/categories', '/api/categories'], (req, res) => safeQuery(res, () => (prisma as any).category.findMany()));
app.post(['/categories', '/api/categories'], (req, res) => safeQuery(res, () => (prisma as any).category.upsert({
    where: { name: req.body.name },
    update: {},
    create: { name: req.body.name }
})));

// Блюда (Меню)
app.get(['/menu', '/api/menu', '/api/admin/menu'], (req, res) => safeQuery(res, () => prisma.dish.findMany()));
app.post(['/dishes', '/api/dishes'], (req, res) => {
    const data = { ...req.body, price: parseFloat(req.body.price) || 0 };
    safeQuery(res, () => prisma.dish.create({ data }));
});

// Заказы
app.get(['/orders', '/api/orders'], (req, res) => safeQuery(res, () => prisma.order.findMany({
    include: { items: { include: { dish: true } } },
    orderBy: { createdAt: 'desc' }
})));

app.post(['/orders', '/api/orders'], (req, res) => {
    const { tableNumber, items, totalPrice, comments } = req.body;
    safeQuery(res, () => prisma.order.create({
        data: {
            tableNumber,
            totalPrice: parseFloat(totalPrice) || 0,
            comments,
            items: { create: items.map(it => ({ dishId: it.dishId, quantity: it.quantity, price: it.price })) }
        }
    }));
});

// 4. Глобальный обработчик ошибок
app.use((err, req, res, next) => {
    console.error('🔥 КРИТИЧЕСКАЯ ОШИБКА СЕРВЕРА:', err);
    res.status(500).send('Internal Server Error');
});

// 5. Запуск (Слушаем на всех интерфейсах)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    ✅===========================================
    🚀 СЕРВЕР ЗАПУЩЕН И ГОТОВ К РАБОТЕ!
    📍 Порт: ${PORT}
    📡 Доступен на: 0.0.0.0 (Railway Required)
    =============================================
    `);
});
