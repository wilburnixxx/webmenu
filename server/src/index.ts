// @ts-nocheck
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

console.log('🏁 Запуск сервера v2.1.1 - AI Quota & Deletion Logic...');
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

app.get('/', (req, res) => res.send('<h1>QR Menu Server v2.1.1</h1>'));

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
    try {
        const result = await prisma.category.upsert({
            where: { name: req.body.name },
            update: {},
            create: { name: req.body.name }
        });
        await logAction('СОЗДАНИЕ КАТЕГОРИИ', `Добавлена: ${req.body.name}`);
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete(['/categories/:id', '/api/categories/:id'], async (req, res) => {
    try {
        const id = req.params.id;
        const result = await prisma.category.delete({ where: { id } });
        await logAction('УДАЛЕНИЕ КАТЕГОРИИ', `Удалена: ${result.name}`);
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- МЕНЮ ---
app.get(['/menu', '/api/menu', '/api/admin/menu'], (req, res) => safeQuery(res, () => prisma.dish.findMany({ orderBy: { category: 'asc' } })));

app.post(['/dishes', '/api/dishes'], async (req, res) => {
    try {
        const data = { ...req.body, price: parseFloat(req.body.price) || 0 };
        const result = await prisma.dish.create({ data });
        await logAction('СОЗДАНИЕ БЛЮДА', `Текст: ${data.name}`);
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put(['/dishes/:id', '/api/dishes/:id'], async (req, res) => {
    try {
        const data = { ...req.body, price: parseFloat(req.body.price) || 0 };
        const id = req.params.id;
        delete data.id; // Чистим ID из тела
        const result = await prisma.dish.update({ where: { id }, data });
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete(['/dishes/:id', '/api/dishes/:id'], async (req, res) => {
    try {
        const dishId = req.params.id;
        console.log(`🗑️ Каскадное удаление: ${dishId}`);

        // Используем транзакцию для 100% гарантии
        const result = await prisma.$transaction(async (tx) => {
            // Удаляем айтемы
            await tx.orderItem.deleteMany({ where: { dishId } });
            // Удаляем блюдо
            return await tx.dish.delete({ where: { id: dishId } });
        });

        await logAction('УДАЛЕНИЕ БЛЮДА', `Удалено: ${result.name}`);
        res.json({ success: true, message: "Блюдо удалено" });
    } catch (e: any) {
        console.error('❌ Ошибка удаления:', e.message);
        res.status(500).json({
            error: "Не удалось удалить блюдо. Возможно, оно критически связано с историей заказов.",
            details: e.message
        });
    }
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
    try {
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
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch(['/orders/:id', '/api/orders/:id'], async (req, res) => {
    try {
        const result = await prisma.order.update({
            where: { id: req.params.id },
            data: { status: req.body.status }
        });
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- AI CHAT ---
app.post(['/ai/chat', '/api/ai/chat'], async (req, res) => {
    try {
        const { messages } = req.body;
        const dishes = await prisma.dish.findMany({ where: { isAvailable: true } });
        const menuContext = dishes.map(d => `${d.name} (${d.price}₽) - ${d.description}`).join('\n');

        // Возвращаемся к 1.5 flash, так как у 2.0 часто бывают лимиты 0 на бесплатных ключах
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `Ты - Алекс, виртуальный шеф-повар ресторана. 
        Меню: ${menuContext}. Отвечай кратко. История: ${JSON.stringify(messages)}`;

        const result = await model.generateContent(prompt);
        res.json({ text: result.response.text() });
    } catch (e: any) {
        console.error('❌ AI Quota/Error:', e.message);
        // Если ошибка квоты, возвращаем 429 программно
        const isQuota = e.message.includes('quota') || e.message.includes('429');
        res.status(isQuota ? 429 : 500).json({
            error: isQuota ? "Лимит запросов ИИ исчерпан. Попробуйте завтра или через минуту." : e.message
        });
    }
});

// --- МЕТРИКИ ---
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

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 СЕРВЕР ЗАПУЩЕН v2.1.1 ПОРТ ${PORT}`));
