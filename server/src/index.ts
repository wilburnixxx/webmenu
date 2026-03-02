// @ts-nocheck
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

console.log('🏁 Запуск сервера v2.0.4 - Fix Delete...');
const app = express();
const PORT = process.env.PORT || 5000;

let prisma;
try {
    prisma = new PrismaClient();
    console.log('💎 Prisma Client инициализирован');
} catch (e) {
    console.error('❌ Ошибка инициализации Prisma:', e.message);
}

app.use(cors({ origin: '*', methods: '*', allowedHeaders: '*' }));
app.use(express.json());

app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

app.get('/', (req, res) => res.send('<h1>QR Menu Server v2.0.4</h1>'));

app.get('/health', async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'ok', db: 'up' });
    } catch (e) { res.status(500).json({ status: 'error', db: 'down', err: e.message }); }
});

const safeQuery = async (res, fn) => {
    try { res.json(await fn()); }
    catch (e) {
        console.error('❌ Ошибка:', e.message);
        res.status(500).json({ error: e.message });
    }
};

// --- МАРШРУТЫ КАТЕГОРИЙ ---
app.get(['/categories', '/api/categories'], (req, res) => safeQuery(res, () => (prisma as any).category.findMany()));
app.post(['/categories', '/api/categories'], (req, res) => safeQuery(res, () => (prisma as any).category.upsert({
    where: { name: req.body.name },
    update: {},
    create: { name: req.body.name }
})));
app.delete(['/categories/:id', '/api/categories/:id'], (req, res) => safeQuery(res, () => (prisma as any).category.delete({ where: { id: req.params.id } })));

// --- МАРШРУТЫ БЛЮД ---
app.get(['/menu', '/api/menu', '/api/admin/menu'], (req, res) => safeQuery(res, () => prisma.dish.findMany()));
app.post(['/dishes', '/api/dishes'], (req, res) => {
    const data = { ...req.body, price: parseFloat(req.body.price) || 0 };
    safeQuery(res, () => prisma.dish.create({ data }));
});
app.put(['/dishes/:id', '/api/dishes/:id'], (req, res) => {
    const data = { ...req.body, price: parseFloat(req.body.price) || 0 };
    safeQuery(res, () => prisma.dish.update({ where: { id: req.params.id }, data }));
});

// ИСПРАВЛЕННЫЙ МАРШРУТ УДАЛЕНИЯ (БЕЗ /api ПРЕФИКСА ПРИ НЕОБХОДИМОСТИ)
app.delete(['/dishes/:id', '/api/dishes/:id'], (req, res) => {
    console.log(`🗑️ Удаление блюда с ID: ${req.params.id}`);
    safeQuery(res, () => prisma.dish.delete({ where: { id: req.params.id } }));
});

// --- МАРШРУТЫ ЗАКАЗОВ ---
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
            status: 'PENDING',
            items: { create: items.map(it => ({ dishId: it.dishId, quantity: it.quantity, price: it.price })) }
        }
    }));
});

app.patch(['/orders/:id', '/api/orders/:id'], (req, res) => {
    const { status } = req.body;
    safeQuery(res, () => prisma.order.update({
        where: { id: req.params.id },
        data: { status }
    }));
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 СЕРВЕР ЗАПУЩЕН НА ПОРТУ ${PORT}`));
