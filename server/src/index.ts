// @ts-nocheck
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

console.log('🏁 Запуск сервера v2.0.7 - AI & Logs Fix...');
const app = express();
const PORT = process.env.PORT || 5000;

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

app.use(cors({ origin: '*', methods: '*', allowedHeaders: '*' }));
app.use(express.json());

app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

const logAction = async (action, details, staffName = 'Система') => {
    try {
        await prisma.actionLog.create({ data: { action, details, staffName } });
    } catch (e) { console.error('⚠️ Ошибка лога:', e.message); }
};

app.get('/', (req, res) => res.send('<h1>QR Menu Server v2.0.7</h1>'));

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

// --- КАТЕГОРИИ ---
app.get(['/categories', '/api/categories'], (req, res) => safeQuery(res, () => prisma.category.findMany()));
app.post(['/categories', '/api/categories'], async (req, res) => {
    const result = await prisma.category.upsert({
        where: { name: req.body.name },
        update: {},
        create: { name: req.body.name }
    });
    await logAction('СОЗДАНИЕ КАТЕГОРИИ', `Добавлена: ${req.body.name}`);
    res.json(result);
});
app.delete(['/categories/:id', '/api/categories/:id'], async (req, res) => {
    const result = await prisma.category.delete({ where: { id: req.params.id } });
    await logAction('УДАЛЕНИЕ КАТЕГОРИИ', `Удалена: ${req.params.id}`);
    res.json(result);
});

// --- МЕНЮ ---
app.get(['/menu', '/api/menu', '/api/admin/menu'], (req, res) => safeQuery(res, () => prisma.dish.findMany({ orderBy: { category: 'asc' } })));
app.post(['/dishes', '/api/dishes'], async (req, res) => {
    const data = { ...req.body, price: parseFloat(req.body.price) || 0 };
    const result = await prisma.dish.create({ data });
    await logAction('СОЗДАНИЕ БЛЮДА', `Текст: ${data.name}`);
    res.json(result);
});
app.put(['/dishes/:id', '/api/dishes/:id'], async (req, res) => {
    const data = { ...req.body, price: parseFloat(req.body.price) || 0 };
    const result = await prisma.dish.update({ where: { id: req.params.id }, data });
    res.json(result);
});
app.delete(['/dishes/:id', '/api/dishes/:id'], async (req, res) => {
    const result = await prisma.dish.delete({ where: { id: req.params.id } });
    res.json(result);
});

// --- ЗАКАЗЫ ---
app.get(['/orders', '/api/orders'], (req, res) => safeQuery(res, () => prisma.order.findMany({
    include: { items: { include: { dish: true } } },
    orderBy: { createdAt: 'desc' }
})));
app.get(['/orders/:id', '/api/orders/:id'], (req, res) => {
    safeQuery(res, () => prisma.order.findUnique({
        where: { id: req.params.id },
        include: { items: { include: { dish: true } } }
    }));
});
app.post(['/orders', '/api/orders'], async (req, res) => {
    const { tableNumber, items, totalPrice, comments } = req.body;
    const result = await prisma.order.create({
        data: {
            tableNumber,
            totalPrice: parseFloat(totalPrice) || 0,
            comments,
            status: 'PENDING',
            items: { create: items.map(it => ({ dishId: it.dishId, quantity: it.quantity, price: parseFloat(it.price) || 0 })) }
        }
    });
    await logAction('НОВЫЙ ЗАКАЗ', `Стол ${tableNumber}, сумма: ${totalPrice}₽`);
    res.json(result);
});
app.patch(['/orders/:id', '/api/orders/:id'], async (req, res) => {
    const result = await prisma.order.update({
        where: { id: req.params.id },
        data: { status: req.body.status }
    });
    res.json(result);
});

// --- AI CHAT ---
app.post(['/ai/chat', '/api/ai/chat'], async (req, res) => {
    try {
        const { messages } = req.body;
        const dishes = await prisma.dish.findMany({ where: { isAvailable: true } });
        const menuContext = dishes.map(d => `${d.name} (${d.price}₽) - ${d.description}`).join('\n');

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Ты - Алекс, виртуальный шеф-повар и сомелье ресторана. 
        Вот меню ресторана:
        ${menuContext}
        
        Отвечай гостю вежливо, кратко и помогай выбрать блюдо. 
        История переписки: ${JSON.stringify(messages)}`;

        const result = await model.generateContent(prompt);
        res.json({ text: result.response.text() });
    } catch (e) {
        console.error('❌ AI Ошибка:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// --- ЖУРНАЛ И МЕТРИКИ ---
app.get(['/logs', '/api/logs'], (req, res) => safeQuery(res, () => prisma.actionLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })));
app.get(['/metrics', '/api/metrics'], async (req, res) => {
    try {
        const orders = await prisma.order.findMany({ where: { status: { not: 'CANCELLED' } } });
        res.json({
            totalOrders: orders.length,
            totalRevenue: orders.reduce((sum, o) => sum + o.totalPrice, 0),
            totalDishes: await prisma.dish.count(),
            topDishes: []
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 СЕРВЕР ЗАПУЩЕН НА ПОРТУ ${PORT}`));
