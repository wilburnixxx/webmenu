// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
const PORT = process.env.PORT || 5000;
const prisma = new PrismaClient();
const orderListeners: { res: express.Response }[] = [];
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Welcome route to verify server is alive
app.get('/', (req, res) => {
    res.send(`<h1>QR Menu Server is Running</h1><p>Status: OK</p><p>Version: 1.0.6</p><p>Time: ${new Date().toISOString()}</p>`);
});

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: '1.0.6', time: new Date().toISOString() });
});

// Category Routes
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await (prisma as any).category.findMany();
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

app.post('/api/categories', async (req, res) => {
    const { name } = req.body;
    try {
        const category = await (prisma as any).category.create({ data: { name } });
        res.status(201).json(category);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create category' });
    }
});

app.delete('/api/categories/:id', async (req, res) => {
    try {
        await (prisma as any).category.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

// Menu Routes
app.get('/api/menu', async (req, res) => {
    try {
        const dishes = await prisma.dish.findMany({ where: { isAvailable: true } });
        res.json(dishes);
    } catch (error) {
        res.status(500).json([]);
    }
});

app.get('/api/admin/menu', async (req, res) => {
    try {
        const dishes = await prisma.dish.findMany();
        res.json(dishes);
    } catch (error) {
        res.status(500).json([]);
    }
});

app.post('/api/dishes', async (req, res) => {
    const { name, description, price, imageUrl, category, allergens } = req.body;
    try {
        const dish = await prisma.dish.create({
            data: { name, description, price: Number(price), imageUrl, category, allergens: allergens || [] }
        });
        res.status(201).json(dish);
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

app.put('/api/dishes/:id', async (req, res) => {
    const { name, description, price, imageUrl, category, isAvailable, allergens } = req.body;
    try {
        await prisma.dish.update({
            where: { id: req.params.id },
            data: { name, description, price: Number(price), imageUrl, category, isAvailable, allergens: allergens || [] }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

app.delete('/api/dishes/:id', async (req, res) => {
    try {
        await prisma.dish.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

// Orders
app.post('/api/orders', async (req, res) => {
    try {
        const { tableNumber, items, totalPrice, comments } = req.body;
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
        res.status(500).json({ error: 'Failed' });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const orders = await prisma.order.findMany({ include: { items: true }, orderBy: { createdAt: 'desc' } });
        res.json(orders);
    } catch (error) {
        res.status(500).json([]);
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

// Admin Extra
app.get('/api/admin/metrics', async (req, res) => {
    try {
        const [totalOrders, totalDishes, orders] = await Promise.all([
            prisma.order.count(),
            prisma.dish.count(),
            prisma.order.findMany()
        ]);
        const totalRevenue = orders.reduce((sum, o) => sum + o.totalPrice, 0);
        res.json({ totalOrders, totalRevenue, totalDishes, topDishes: [] });
    } catch (error) {
        res.status(500).json({});
    }
});

app.get('/api/admin/logs', async (req, res) => {
    try {
        const logs = await (prisma as any).metric.findMany({ orderBy: { timestamp: 'desc' }, take: 30 });
        res.json(logs);
    } catch (error) {
        res.json([]);
    }
});

app.get('/api/admin/ai-instructions', async (req, res) => {
    try {
        const instruction = await (prisma as any).aIInstruction.findFirst({ orderBy: { createdAt: 'desc' } });
        res.json(instruction || { promptText: '' });
    } catch (error) {
        res.json({ promptText: '' });
    }
});

app.post('/api/admin/ai-instructions', async (req, res) => {
    try {
        const item = await (prisma as any).aIInstruction.create({ data: { promptText: req.body.promptText, isActive: true } });
        res.json(item);
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

// Start
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Final Server is listening on 0.0.0.0:${PORT}`);
});

export default app;
