// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
const PORT = process.env.PORT || 5000;
const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

app.use(cors());
app.use(express.json());

// Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Root check
app.get('/', (req, res) => res.send('Server is LIVE v1.0.7'));

// ALL ROUTES WITHOUT /API PREFIX FOR SIMPLICITY
app.get('/categories', async (req, res) => {
    try {
        const categories = await (prisma as any).category.findMany();
        res.json(categories);
    } catch (e) { res.status(500).json([]); }
});

app.post('/categories', async (req, res) => {
    try {
        const item = await (prisma as any).category.create({ data: { name: req.body.name } });
        res.status(201).json(item);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/menu', async (req, res) => {
    try {
        const items = await prisma.dish.findMany();
        res.json(items);
    } catch (e) { res.status(500).json([]); }
});

app.post('/dishes', async (req, res) => {
    try {
        const item = await prisma.dish.create({ data: { ...req.body, price: Number(req.body.price) } });
        res.status(201).json(item);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('SERVER ERROR:', err);
    res.status(500).send('Something broke!');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

export default app;
