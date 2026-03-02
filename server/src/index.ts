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

// Basic Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// Create Order
app.post('/api/orders', async (req, res) => {
    const { tableNumber, items, totalPrice, comments } = req.body;

    try {
        const order = await prisma.order.create({
            data: {
                tableNumber,
                totalPrice,
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

        // Notify SSE listeners
        orderListeners.forEach((listener) => {
            listener.res.write(`event: newOrder\n`);
            listener.res.write(`data: ${JSON.stringify(order)}\n\n`);
        });

        res.status(201).json(order);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// Dishes CRUD (Admin)
app.post('/api/dishes', async (req, res) => {
    const { name, description, price, imageUrl, category } = req.body;
    try {
        const dish = await prisma.dish.create({
            data: { name, description, price, imageUrl, category }
        });
        res.status(201).json(dish);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create dish' });
    }
});

app.put('/api/dishes/:id', async (req, res) => {
    const { id } = req.params;
    const { name, description, price, imageUrl, category, isAvailable } = req.body;
    try {
        await prisma.dish.update({
            where: { id },
            data: { name, description, price, imageUrl, category, isAvailable }
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

// AI Chat Assistant
app.post('/api/chat', async (req, res) => {
    const { messages } = req.body;

    try {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY is not defined');
        }

        const dishes = await prisma.dish.findMany({ where: { isAvailable: true } });
        const menuContext = dishes.map((d: any) =>
            `- ${d.name} (${d.category}): ${d.description}. Цена: ${d.price} руб.`
        ).join('\n');

        const systemInstruction = `
            Ты — Алекс, сомелье нашего ресторана.
            Используй меню:
            ${menuContext}
            Будь вежлив и краток.
        `;

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent([systemInstruction, ...messages.map((m: any) => m.content)]);
        const response = await result.response;
        res.json({ text: response.text() });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Waiter Orders & Status
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await prisma.order.findMany({
            include: { items: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

app.patch('/api/orders/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        await prisma.order.update({
            where: { id },
            data: { status }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update order' });
    }
});

// SSE Stream
app.get('/api/orders/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const listener = { res };
    orderListeners.push(listener);

    req.on('close', () => {
        const index = orderListeners.indexOf(listener);
        if (index > -1) orderListeners.splice(index, 1);
    });
});

// Export for Vercel or start locally
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 Local Server running on port ${PORT}`);
    });
}

export default app;
