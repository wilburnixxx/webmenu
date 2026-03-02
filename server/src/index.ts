// @ts-nocheck
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const prisma = new PrismaClient();

// 1. Бронебойный CORS
app.use(cors({ origin: '*', methods: '*', allowedHeaders: '*' }));
app.use(express.json());

// 2. Логирование запросов
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

// 3. Health Checks
app.get('/', (req, res) => res.send('OK v2.0.1'));
app.get('/health', async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'ok', db: 'up' });
    } catch (e) { res.status(500).json({ status: 'error', db: 'down', err: e.message }); }
});

// --- API МАРШРУТЫ ---

// Категории
app.get(['/categories', '/api/categories'], async (req, res) => {
    try { res.json(await (prisma as any).category.findMany()); } catch (e) { res.json([]); }
});

app.post(['/categories', '/api/categories'], async (req, res) => {
    try {
        const item = await (prisma as any).category.upsert({
            where: { name: req.body.name },
            update: {},
            create: { name: req.body.name }
        });
        res.status(201).json(item);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete(['/categories/:id', '/api/categories/:id'], async (req, res) => {
    try { await (prisma as any).category.delete({ where: { id: req.params.id } }); res.sendStatus(204); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// Блюда (Меню)
app.get(['/menu', '/api/menu', '/api/admin/menu'], async (req, res) => {
    try { res.json(await prisma.dish.findMany()); } catch (e) { res.json([]); }
});

app.post(['/dishes', '/api/dishes'], async (req, res) => {
    try {
        const data = { ...req.body, price: parseFloat(req.body.price) || 0 };
        res.status(201).json(await prisma.dish.create({ data }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put(['/dishes/:id', '/api/dishes/:id'], async (req, res) => {
    try {
        const data = { ...req.body, price: parseFloat(req.body.price) || 0 };
        res.json(await prisma.dish.update({ where: { id: req.params.id }, data }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete(['/dishes/:id', '/api/dishes/:id'], async (req, res) => {
    try { await prisma.dish.delete({ where: { id: req.params.id } }); res.sendStatus(204); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// Заказы
app.get(['/orders', '/api/orders'], async (req, res) => {
    try { res.json(await prisma.order.findMany({ include: { items: { include: { dish: true } } }, orderBy: { createdAt: 'desc' } })); }
    catch (e) { res.json([]); }
});

app.post(['/orders', '/api/orders'], async (req, res) => {
    try {
        const { tableNumber, items, totalPrice, comments } = req.body;
        const order = await prisma.order.create({
            data: {
                tableNumber,
                totalPrice: parseFloat(totalPrice) || 0,
                comments,
                items: { create: items.map(it => ({ dishId: it.dishId, quantity: it.quantity, price: it.price })) }
            }
        });
        res.status(201).json(order);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Запуск
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 СУПЕР-СЕРВЕР ГОТОВ НА ПОРТУ ${PORT}`));
