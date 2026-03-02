// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const app = express();
const PORT = process.env.PORT || 5000;
const prisma = new PrismaClient();

// MANUAL CORS (Force everything)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

app.use(express.json());

// Root check
app.get('/', (req, res) => res.send('<h1>QR Menu Server v1.0.8</h1><p>Status: OK</p>'));

// SUPPORT BOTH /path AND /api/path (Compatibility mode)
const routes = ['/categories', '/menu', '/dishes', '/orders', '/admin/metrics', '/admin/ai-instructions', '/chat'];

// Category logic
const handleCategories = async (req, res) => {
    try {
        if (req.method === 'GET') {
            const data = await (prisma as any).category.findMany();
            res.json(data);
        } else if (req.method === 'POST') {
            const item = await (prisma as any).category.create({ data: { name: req.body.name } });
            res.status(201).json(item);
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
};

app.get('/categories', handleCategories);
app.get('/api/categories', handleCategories);
app.post('/categories', handleCategories);
app.post('/api/categories', handleCategories);

// Menu logic
const handleMenu = async (req, res) => {
    try {
        const data = await prisma.dish.findMany();
        res.json(data);
    } catch (e) { res.json([]); }
};
app.get('/menu', handleMenu);
app.get('/api/menu', handleMenu);
app.get('/api/admin/menu', handleMenu);

// Dish creation
app.post(['/dishes', '/api/dishes'], async (req, res) => {
    try {
        const item = await prisma.dish.create({ data: { ...req.body, price: Number(req.body.price) } });
        res.status(201).json(item);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 CORS-Enabled Server running on port ${PORT}`);
});

export default app;
