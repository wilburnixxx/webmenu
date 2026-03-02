// @ts-nocheck
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

console.log('🏁 Запуск сервера v2.1.5 - Category Reordering...');
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

app.get('/', (req, res) => res.send('<h1>QR Menu Server v2.1.5</h1>'));

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

// --- AI ИНСТРУКЦИИ ---
app.get(['/ai/instructions', '/api/ai/instructions'], async (req, res) => {
    try {
        const instruction = await prisma.aIInstruction.findFirst({ orderBy: { version: 'desc' } });
        res.json(instruction || { promptText: "Ты - Алекс, виртуальный шеф-повар." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post(['/ai/instructions', '/api/ai/instructions'], async (req, res) => {
    try {
        const { promptText } = req.body;
        const result = await prisma.aIInstruction.create({
            data: { promptText, version: (await prisma.aIInstruction.count()) + 1 }
        });
        await logAction('ОБУЧЕНИЕ ИИ', `Новая версия v${result.version}`);
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- КАТЕГОРИИ (Сортировка) ---
app.get(['/categories', '/api/categories'], (req, res) => safeQuery(res, () => prisma.category.findMany({ orderBy: { order: 'asc' } })));

app.post(['/categories', '/api/categories'], async (req, res) => {
    try {
        const maxOrder = await prisma.category.aggregate({ _max: { order: true } });
        const result = await prisma.category.upsert({
            where: { name: req.body.name },
            update: {},
            create: { name: req.body.name, order: (maxOrder._max.order || 0) + 1 }
        });
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post(['/categories/reorder', '/api/categories/reorder'], async (req, res) => {
    try {
        const { categories } = req.body;
        await prisma.$transaction(
            categories.map((c: any) => prisma.category.update({
                where: { id: c.id },
                data: { order: parseInt(c.order) }
            }))
        );
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.patch(['/categories/:id', '/api/categories/:id'], async (req, res) => {
    try {
        const result = await prisma.category.update({
            where: { id: req.params.id },
            data: { order: parseInt(req.body.order) }
        });
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete(['/categories/:id', '/api/categories/:id'], async (req, res) => {
    try {
        const result = await prisma.category.delete({ where: { id: req.params.id } });
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- МЕНЮ ---
app.get(['/menu', '/api/menu'], async (req, res) => {
    try {
        const categories = await prisma.category.findMany({ orderBy: { order: 'asc' } });
        const dishes = await prisma.dish.findMany();

        // Сортируем блюда согласно порядку категорий
        const catMap = categories.reduce((acc, cat, idx) => ({ ...acc, [cat.name]: idx }), {});
        const sortedDishes = dishes.sort((a, b) => (catMap[a.category] || 99) - (catMap[b.category] || 99));

        res.json(sortedDishes);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post(['/dishes', '/api/dishes'], async (req, res) => {
    try {
        const result = await prisma.dish.create({ data: { ...req.body, price: parseFloat(req.body.price) || 0 } });
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put(['/dishes/:id', '/api/dishes/:id'], async (req, res) => {
    try {
        const data = { ...req.body, price: parseFloat(req.body.price) || 0 };
        delete data.id;
        const result = await prisma.dish.update({ where: { id: req.params.id }, data });
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete(['/dishes/:id', '/api/dishes/:id'], async (req, res) => {
    try {
        await prisma.$transaction(async (tx) => {
            await tx.orderItem.deleteMany({ where: { dishId: req.params.id } });
            await tx.dish.delete({ where: { id: req.params.id } });
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ЗАКАЗЫ ---
app.post(['/orders', '/api/orders'], async (req, res) => {
    try {
        const { tableNumber, items, totalPrice, comments } = req.body;
        const result = await prisma.order.create({
            data: {
                tableNumber, totalPrice: parseFloat(totalPrice) || 0, comments,
                items: { create: items.map(it => ({ dishId: it.dishId, quantity: it.quantity, price: parseFloat(it.price) || 0 })) }
            }
        });
        await logAction('НОВЫЙ ЗАКАЗ', `Стол ${tableNumber}, ${totalPrice}₽`);
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get(['/orders', '/api/orders'], (req, res) => safeQuery(res, () => prisma.order.findMany({ include: { items: { include: { dish: true } } }, orderBy: { createdAt: 'desc' } })));
app.get(['/orders/:id', '/api/orders/:id'], (req, res) => safeQuery(res, () => prisma.order.findUnique({ where: { id: req.params.id }, include: { items: { include: { dish: true } } } })));
app.patch(['/orders/:id', '/api/orders/:id'], async (req, res) => {
    const result = await prisma.order.update({ where: { id: req.params.id }, data: { status: req.body.status } });
    res.json(result);
});

// --- AI CHAT ---
app.post(['/ai/chat', '/api/ai/chat'], async (req, res) => {
    try {
        const { messages } = req.body;
        const dishes = await prisma.dish.findMany({ where: { isAvailable: true } });
        const menuContext = dishes.map(d => `${d.name} (${d.price}₽) - ${d.description}`).join('\n');
        const instruction = await prisma.aIInstruction.findFirst({ orderBy: { version: 'desc' } });
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `${instruction?.promptText || ''}\n\nМеню:\n${menuContext}\n\nОтветь на: ${JSON.stringify(messages)}`;
        const result = await model.generateContent(prompt);
        res.json({ text: result.response.text() });
    } catch (e: any) {
        console.error('AI Error:', e.message);
        const isQuota = e.message?.includes('429') || e.message?.includes('quota');
        res.status(isQuota ? 429 : 500).json({ error: e.message });
    }
});

// --- LOGS & METRICS ---
app.get(['/logs', '/api/logs'], (req, res) => safeQuery(res, () => prisma.actionLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })));
app.get(['/metrics', '/api/metrics'], async (req, res) => {
    try {
        const orders = await prisma.order.findMany({ where: { status: { not: 'CANCELLED' } } });
        res.json({ totalOrders: orders.length, totalRevenue: orders.reduce((sum, o) => sum + o.totalPrice, 0), totalDishes: await prisma.dish.count(), topDishes: [] });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 СЕРВЕР v2.1.5 ПОРТ ${PORT}`));
