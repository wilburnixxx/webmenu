import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Prisma
const prisma = new PrismaClient();

// SSE listeners for new order notifications
const orderListeners: { res: express.Response }[] = [];

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

console.log('🔑 Gemini API Key Status:', process.env.GEMINI_API_KEY ? 'LOADED' : 'MISSING');
console.log('🐘 Database URL Status:', process.env.DATABASE_URL ? 'LOADED' : 'MISSING (Check your .env)');

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Basic Health Check (Updated to verify deployment)
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        version: '1.0.4',
        db_status: process.env.DATABASE_URL ? 'configured' : 'missing',
        time: new Date().toISOString()
    });
});

// Category Routes
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await (prisma as any).category.findMany();
        res.json(categories);
    } catch (error) {
        console.error('Fetch categories error:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

app.post('/api/categories', async (req, res) => {
    const { name } = req.body;
    try {
        const category = await (prisma as any).category.create({ data: { name } });
        res.status(201).json(category);
    } catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({ error: 'Failed to create category' });
    }
});

app.delete('/api/categories/:id', async (req, res) => {
    try {
        await (prisma as any).category.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

// Menu Routes (Public)
app.get('/api/menu', async (req, res) => {
    try {
        const dishes = await prisma.dish.findMany({
            where: { isAvailable: true }
        });
        res.json(dishes);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch menu' });
    }
});

// Menu Routes (Admin - All dishes)
app.get('/api/admin/menu', async (req, res) => {
    try {
        const dishes = await prisma.dish.findMany();
        res.json(dishes);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch admin menu' });
    }
});

// Dishes CRUD (Admin)
app.post('/api/dishes', async (req, res) => {
    const { name, description, price, imageUrl, category, allergens } = req.body;
    try {
        console.log('Attempting to create dish:', { name, category });
        const dish = await prisma.dish.create({
            data: {
                name,
                description,
                price: Number(price),
                imageUrl,
                category,
                allergens: allergens || []
            }
        });
        res.status(201).json(dish);
    } catch (error) {
        console.error('Create dish error details:', error);
        res.status(500).json({ error: 'Failed to create dish' });
    }
});

app.put('/api/dishes/:id', async (req, res) => {
    const { id } = req.params;
    const { name, description, price, imageUrl, category, isAvailable, allergens } = req.body;
    try {
        await prisma.dish.update({
            where: { id },
            data: {
                name,
                description,
                price: Number(price),
                imageUrl,
                category,
                isAvailable,
                allergens: allergens || []
            }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update dish' });
    }
});

app.delete('/api/dishes/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.dish.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete dish' });
    }
});

// Admin Metrics & Logs
app.get('/api/admin/metrics', async (req, res) => {
    try {
        const totalOrders = await prisma.order.count();
        const dishesCount = await prisma.dish.count();
        const orders = await prisma.order.findMany();
        const totalRevenue = orders.reduce((sum, o) => sum + o.totalPrice, 0);

        res.json({
            totalOrders,
            totalRevenue,
            totalDishes: dishesCount,
            topDishes: []
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch metrics' });
    }
});

app.get('/api/admin/logs', async (req, res) => {
    try {
        const logs = await (prisma as any).metric.findMany({ orderBy: { timestamp: 'desc' }, take: 50 });
        res.json(logs.map((m: any) => ({
            id: m.id,
            createdAt: m.timestamp,
            action: m.eventType,
            details: JSON.stringify(m.payload),
            staffName: 'System'
        })));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

app.get('/api/admin/ai-instructions', async (req, res) => {
    try {
        const instruction = await (prisma as any).aIInstruction.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(instruction || { promptText: '' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch AI instructions' });
    }
});

app.post('/api/admin/ai-instructions', async (req, res) => {
    const { promptText } = req.body;
    try {
        const instruction = await (prisma as any).aIInstruction.create({
            data: { promptText, isActive: true }
        });
        res.status(201).json(instruction);
    } catch (error) {
        res.status(500).json({ error: 'Failed to save AI instructions' });
    }
});

// Orders
app.post('/api/orders', async (req, res) => {
    const { tableNumber, items, totalPrice, comments } = req.body;
    try {
        const order = await prisma.order.create({
            data: {
                tableNumber: String(tableNumber),
                totalPrice: Number(totalPrice),
                comments,
                status: 'ACCEPTED',
                items: {
                    create: items.map((item: any) => ({
                        dishId: item.dishId,
                        quantity: item.quantity,
                        price: item.price
                    }))
                }
            },
            include: { items: true }
        });
        orderListeners.forEach(l => l.res.write(`event: newOrder\ndata: ${JSON.stringify(order)}\n\n`));
        res.status(201).json(order);
    } catch (error) {
        console.error('Order creation error:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const orders = await prisma.order.findMany({ include: { items: true }, orderBy: { createdAt: 'desc' } });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

app.patch('/api/orders/:id', async (req, res) => {
    const { status } = req.body;
    try {
        await prisma.order.update({ where: { id: req.params.id }, data: { status } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update order' });
    }
});

app.get('/api/orders/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const listener = { res };
    orderListeners.push(listener);
    req.on('close', () => {
        const idx = orderListeners.indexOf(listener);
        if (idx > -1) orderListeners.splice(idx, 1);
    });
});

// AI Chat
app.post('/api/chat', async (req, res) => {
    const { messages } = req.body;
    try {
        if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is missing');
        const dishes = await prisma.dish.findMany({ where: { isAvailable: true } });
        const menuContext = dishes.map(d => `- ${d.name} (${d.category}): ${d.description}. Цена: ${d.price} руб.`).join('\n');
        const instruction = await (prisma as any).aIInstruction.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'desc' } });
        const systemPrompt = instruction?.promptText || `Ты — ассистент ресторана. Меню:\n${menuContext}`;
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent([systemPrompt, ...messages.map((m: any) => m.content)]);
        res.json({ text: result.response.text() });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server is strictly listening on port ${PORT}`);
    console.log(`🔗 API Base: http://localhost:${PORT}/api`);
});

export default app;
