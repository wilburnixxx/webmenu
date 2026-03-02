import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
const PORT = process.env.PORT || 5000;

// SSE listeners for new order notifications
const orderListeners: { res: express.Response }[] = [];

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

console.log('🔑 Gemini API Key Status:', process.env.GEMINI_API_KEY ? 'LOADED' : 'MISSING');

// Initialize Database
const db = new Database('qrmenu.db', { verbose: console.log });
db.pragma('journal_mode = WAL');

// Create Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS dishes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    imageUrl TEXT,
    category TEXT NOT NULL,
    isAvailable INTEGER DEFAULT 1,
    allergens TEXT DEFAULT '[]',
    deletedAt DATETIME DEFAULT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    tableNumber TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    totalPrice REAL NOT NULL,
    comments TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    orderId TEXT NOT NULL,
    dishId TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY (orderId) REFERENCES orders (id),
    FOREIGN KEY (dishId) REFERENCES dishes (id)
  );

  CREATE TABLE IF NOT EXISTS ai_instructions (
    id TEXT PRIMARY KEY,
    promptText TEXT NOT NULL,
    isActive INTEGER DEFAULT 1,
    version INTEGER DEFAULT 1,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS staff_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    staffName TEXT DEFAULT 'System',
    details TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS adjustments (
    id TEXT PRIMARY KEY,
    metricName TEXT NOT NULL,
    value REAL NOT NULL,
    note TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration: Check for missing columns
try {
    const tableInfo = db.prepare("PRAGMA table_info(dishes)").all() as any[];
    const hasDeletedAt = tableInfo.some(col => col.name === 'deletedAt');
    if (!hasDeletedAt) {
        db.exec("ALTER TABLE dishes ADD COLUMN deletedAt DATETIME DEFAULT NULL");
        console.log('✅ Migration: Added deletedAt to dishes');
    }
} catch (e) {
    console.error('❌ Migration failed:', e);
}

// Auto-seed if empty
function seedIfNeeded() {
    // Seed Categories
    const defaultCats = ['Закуски', 'Супы', 'Горячее', 'Десерты', 'Напитки', 'Viennoiserie', 'Boulangerie', 'Pâtisserie'];
    const insertCat = db.prepare('INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)');
    defaultCats.forEach(cat => insertCat.run(crypto.randomUUID(), cat));

    const dishesToSeed = [
        { name: 'Croissant Classique', desc: 'Сливочный, хрустящий круассан на натуральном масле.', price: 250, cat: 'Viennoiserie', img: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800' },
        { name: 'Pain au Chocolat', desc: 'Слоеная булочка с двумя палочками темного шоколада.', price: 290, cat: 'Viennoiserie', img: 'https://images.unsplash.com/photo-1549590143-d5855148a9d5?w=800' },
        { name: 'Baguette Tradition', desc: 'Классический французский багет с хрустящей корочкой.', price: 180, cat: 'Boulangerie', img: 'https://images.unsplash.com/photo-1597079910443-60c43fc4f729?w=800' },
        { name: 'Éclair au Chocolat', desc: 'Заварное тесто с нежным шоколадным кремом.', price: 320, cat: 'Pâtisserie', img: 'https://images.unsplash.com/photo-1511081692775-05d0f180a421?w=800' },
        { name: 'Tarte aux Fraises', desc: 'Песочная корзинка со свежей клубникой.', price: 450, cat: 'Pâtisserie', img: 'https://images.unsplash.com/photo-1464305795204-6f5bbfc7fb81?w=800' },
        { name: 'Quiche Lorraine', desc: 'Сытный пирог с копченым беконом и сыром.', price: 550, cat: 'Boulangerie', img: 'https://images.unsplash.com/photo-1485962391905-132036737330?w=800' },
        { name: 'Macarons Assortis', desc: 'Набор из 5 изысканных пирожных макарон.', price: 600, cat: 'Pâtisserie', img: 'https://images.unsplash.com/photo-1563245339-612e52467d9c?w=800' },
        { name: 'Café au Lait', desc: 'Традиционный французский кофе с горячим молоком.', price: 280, cat: 'Напитки', img: 'https://images.unsplash.com/photo-1541167760496-162955ed2a9f?w=800' }
    ];

    const checkDish = db.prepare('SELECT id FROM dishes WHERE name = ?');
    const insertDish = db.prepare(`
        INSERT INTO dishes (id, name, description, price, imageUrl, category) 
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    const updateVisibility = db.prepare('UPDATE dishes SET isAvailable = 1, deletedAt = NULL WHERE name = ?');

    let addedCount = 0;
    let updatedCount = 0;
    for (const d of dishesToSeed) {
        const exists = checkDish.get(d.name);
        if (!exists) {
            insertDish.run(crypto.randomUUID(), d.name, d.desc, d.price, d.img, d.cat);
            addedCount++;
        } else {
            updateVisibility.run(d.name);
            updatedCount++;
        }
    }
    if (addedCount > 0 || updatedCount > 0) {
        console.log(`✅ Seed: Added ${addedCount}, Restored visibility for ${updatedCount} dishes.`);
    }
}
seedIfNeeded();

function logAction(action: string, details: string, staffName: string = 'Staff Member') {
    try {
        db.prepare('INSERT INTO staff_logs (id, action, details, staffName) VALUES (?, ?, ?, ?)').run(
            crypto.randomUUID(), action, details, staffName
        );
    } catch (e) {
        console.error('Logging failed:', e);
    }
}

// Background cleanup: Remove dishes in trash for > 7 days
function cleanupTrash() {
    try {
        const deletedCount = db.prepare(`
            DELETE FROM dishes 
            WHERE deletedAt IS NOT NULL 
            AND deletedAt < datetime('now', '-7 days')
        `).run();

        if (deletedCount.changes > 0) {
            console.log(`🧹 Cleanup: Permanently deleted ${deletedCount.changes} dishes from trash (older than 7 days).`);
            logAction('SYSTEM_CLEANUP', `Permanently deleted ${deletedCount.changes} old items from trash.`, 'System');
        }
    } catch (e) {
        console.error('Cleanup failed:', e);
    }
}

// Run cleanup immediately then every hour
cleanupTrash();
setInterval(cleanupTrash, 60 * 60 * 1000);

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Basic Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug Route
app.get('/api/debug/db', (req, res) => {
    try {
        const counts = {
            dishes: db.prepare('SELECT count(*) as count FROM dishes').get(),
            visibleDishes: db.prepare('SELECT count(*) as count FROM dishes WHERE deletedAt IS NULL AND isAvailable = 1').get(),
            categories: db.prepare('SELECT count(*) as count FROM categories').get(),
        };
        const sample = db.prepare('SELECT * FROM dishes LIMIT 3').all();
        res.json({ counts, sample });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Menu Routes (Public)
app.get('/api/menu', (req, res) => {
    try {
        const dishes = db.prepare('SELECT * FROM dishes WHERE deletedAt IS NULL AND isAvailable = 1').all();
        const result = dishes.map((d: any) => ({
            ...d,
            isAvailable: Boolean(d.isAvailable),
            allergens: JSON.parse(d.allergens || '[]')
        }));
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch menu' });
    }
});

// Menu Routes (Admin - All dishes)
app.get('/api/admin/menu', (req, res) => {
    try {
        const dishes = db.prepare('SELECT * FROM dishes WHERE deletedAt IS NULL').all();
        const result = dishes.map((d: any) => ({
            ...d,
            isAvailable: Boolean(d.isAvailable),
            allergens: JSON.parse(d.allergens || '[]')
        }));
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch admin menu' });
    }
});

app.get('/api/admin/trash', (req, res) => {
    try {
        const dishes = db.prepare('SELECT * FROM dishes WHERE deletedAt IS NOT NULL').all();
        const result = dishes.map((d: any) => ({
            ...d,
            isAvailable: Boolean(d.isAvailable),
            allergens: JSON.parse(d.allergens || '[]')
        }));
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch trash' });
    }
});

// Create Order
app.post('/api/orders', (req, res) => {
    const { tableNumber, items, totalPrice, comments } = req.body;

    const transaction = db.transaction(() => {
        const orderId = crypto.randomUUID();

        // Insert order with simplified status ACCEPTED (means accepted in kitchen)
        db.prepare(`
            INSERT INTO orders (id, tableNumber, totalPrice, comments, status)
            VALUES (?, ?, ?, ?, ?)
        `).run(orderId, tableNumber, totalPrice, comments, 'ACCEPTED');

        const insertItem = db.prepare(`
            INSERT INTO order_items (id, orderId, dishId, quantity, price)
            VALUES (?, ?, ?, ?, ?)
        `);

        for (const item of items) {
            insertItem.run(crypto.randomUUID(), orderId, item.dishId, item.quantity, item.price);
        }

        // Notify all SSE listeners about the new order
        const newOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
        orderListeners.forEach((listener) => {
            listener.res.write(`event: newOrder\n`);
            listener.res.write(`data: ${JSON.stringify(newOrder)}\n\n`);
        });

        return orderId;
    });

    try {
        const orderId = transaction();
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
        const orderItems = db.prepare('SELECT * FROM order_items WHERE orderId = ?').all(orderId);
        res.status(201).json({ ...(order as any), items: orderItems });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// Dishes CRUD (Admin)
app.post('/api/dishes', (req, res) => {
    const { name, description, price, imageUrl, category } = req.body;
    try {
        const id = crypto.randomUUID();
        db.prepare(`
            INSERT INTO dishes (id, name, description, price, imageUrl, category)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, name, description, price, imageUrl, category);
        logAction('ADD_DISH', `Added dish: ${name}`, 'Admin');
        res.status(201).json({ id, name, description, price, imageUrl, category });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create dish' });
    }
});

app.put('/api/dishes/:id', (req, res) => {
    const { id } = req.params;
    const { name, description, price, imageUrl, category, isAvailable } = req.body;
    try {
        db.prepare(`
            UPDATE dishes SET 
                name = ?, description = ?, price = ?, 
                imageUrl = ?, category = ?, isAvailable = ?,
                updatedAt = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(name, description, price, imageUrl, category, isAvailable ? 1 : 0, id);
        logAction('UPDATE_DISH', `Updated dish: ${name}`, 'Admin');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update dish' });
    }
});

app.delete('/api/dishes/:id', (req, res) => {
    const { id } = req.params;
    try {
        db.prepare("UPDATE dishes SET deletedAt = DATETIME('now') WHERE id = ?").run(id);
        logAction('DELETE_DISH', `Moved dish to trash: ${id}`, 'Admin');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete dish' });
    }
});

app.post('/api/dishes/:id/restore', (req, res) => {
    const { id } = req.params;
    try {
        db.prepare("UPDATE dishes SET deletedAt = NULL WHERE id = ?").run(id);
        logAction('RESTORE_DISH', `Restored dish from trash: ${id}`, 'Admin');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to restore dish' });
    }
});

// Stats for Admin (with date filtering)
app.get('/api/admin/metrics', (req, res) => {
    const { start, end } = req.query;
    const dateFilter = (start && end) ? `AND createdAt BETWEEN '${start}' AND '${end}'` : '';
    const dateFilterWhere = (start && end) ? `WHERE createdAt BETWEEN '${start}' AND '${end}'` : '';

    try {
        const totalOrders = db.prepare(`SELECT COUNT(*) as count FROM orders ${dateFilterWhere}`).get() as any;
        const totalRevenue = db.prepare(`SELECT SUM(totalPrice) as sum FROM orders WHERE status = 'ARCHIVED' ${dateFilter}`).get() as any;

        const topDishes = db.prepare(`
            SELECT d.name, COUNT(oi.id) as count 
            FROM order_items oi 
            JOIN dishes d ON oi.dishId = d.id 
            JOIN orders o ON oi.orderId = o.id
            WHERE o.status = 'ARCHIVED'
            ${dateFilter.replace('createdAt', 'o.createdAt')}
            GROUP BY d.id 
            ORDER BY count DESC LIMIT 5
        `).all();

        const adjustments = db.prepare('SELECT SUM(value) as sum FROM adjustments').get() as any;

        // Daily revenue for charts
        const dailyRevenue = db.prepare(`
            SELECT date(createdAt) as date, SUM(totalPrice) as revenue 
            FROM orders 
            WHERE status = 'ARCHIVED' 
            ${dateFilter}
            GROUP BY date(createdAt)
            ORDER BY date ASC
        `).all();

        res.json({
            totalOrders: totalOrders.count,
            totalRevenue: (totalRevenue.sum || 0) + (adjustments.sum || 0),
            topDishes,
            dailyRevenue,
            adjustments: adjustments.sum || 0
        });
    } catch (error) {
        console.error('Metrics error:', error);
        res.status(500).json({ error: 'Failed to fetch metrics' });
    }
});

// Staff Logs
app.get('/api/admin/logs', (req, res) => {
    try {
        const logs = db.prepare('SELECT * FROM staff_logs ORDER BY createdAt DESC LIMIT 100').all();
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// Adjustments
app.post('/api/admin/adjustments', (req, res) => {
    const { metricName, value, note } = req.body;
    try {
        db.prepare('INSERT INTO adjustments (id, metricName, value, note) VALUES (?, ?, ?, ?)').run(
            crypto.randomUUID(), metricName, value, note
        );
        logAction('ADJUSTMENT', `Manual correction: ${metricName} adjusted by ${value}`, 'Admin');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save adjustment' });
    }
});

// AI Instructions
app.get('/api/admin/ai-instructions', (req, res) => {
    try {
        const instruction = db.prepare(`
            SELECT * FROM ai_instructions 
            WHERE isActive = 1 
            ORDER BY createdAt DESC LIMIT 1
        `).get();
        res.json(instruction || null);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch AI instructions' });
    }
});

app.post('/api/admin/ai-instructions', (req, res) => {
    const { promptText } = req.body;
    try {
        db.prepare('UPDATE ai_instructions SET isActive = 0').run();
        db.prepare('INSERT INTO ai_instructions (id, promptText, isActive) VALUES (?, ?, 1)').run(crypto.randomUUID(), promptText);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save instructions' });
    }
});

// Get Orders (for Waiters)
app.get('/api/orders', (req, res) => {
    try {
        const orders = db.prepare('SELECT * FROM orders ORDER BY createdAt DESC').all();
        const result = orders.map((order: any) => {
            const items = db.prepare('SELECT * FROM order_items WHERE orderId = ?').all(order.id);
            return {
                id: order.id,
                tableNumber: order.tableNumber,
                status: order.status,
                totalPrice: order.totalPrice,
                comments: order.comments,
                createdAt: order.createdAt,
                updatedAt: order.updatedAt,
                items
            };
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// Stream new orders to dashboards (SSE)
app.get('/api/orders/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const listener = { res };
    orderListeners.push(listener);

    const keepAlive = setInterval(() => {
        res.write(':\n\n');
    }, 15000);

    req.on('close', () => {
        clearInterval(keepAlive);
        const index = orderListeners.indexOf(listener);
        if (index > -1) {
            orderListeners.splice(index, 1);
        }
    });
});

// Get Single Order
app.get('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    try {
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
        if (!order) return res.status(404).json({ error: 'Order not found' });
        const items = db.prepare('SELECT * FROM order_items WHERE orderId = ?').all(id);
        res.json({ ...(order as any), items });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});

// Update Order Status - Simplified: ACCEPTED, READY, CANCELLED
app.patch('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const allowedStatuses = ['ACCEPTED', 'READY', 'CANCELLED', 'ARCHIVED'];

    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Use ACCEPTED, READY, or CANCELLED' });
    }

    try {
        db.prepare('UPDATE orders SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
        logAction('UPDATE_ORDER', `Changed order status to ${status} for ID: ${id}`, 'Staff');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update order' });
    }
});


// Categories Routes (Admin)
app.get('/api/categories', (req, res) => {
    try {
        const categories = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

app.post('/api/categories', (req, res) => {
    const { name } = req.body;
    try {
        const id = crypto.randomUUID();
        db.prepare('INSERT INTO categories (id, name) VALUES (?, ?)').run(id, name);
        logAction('ADD_CATEGORY', `Added category: ${name}`, 'Admin');
        res.status(201).json({ id, name });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create category' });
    }
});

app.delete('/api/categories/:id', (req, res) => {
    const { id } = req.params;
    try {
        // Check if dishes still use this category name
        const category = db.prepare('SELECT name FROM categories WHERE id = ?').get(id) as any;
        if (!category) return res.status(404).json({ error: 'Category not found' });

        const usageCount = db.prepare('SELECT COUNT(*) as count FROM dishes WHERE category = ? AND deletedAt IS NULL').get(category.name) as any;
        if (usageCount.count > 0) {
            return res.status(400).json({ error: 'Cannot delete category while dishes are assigned to it' });
        }

        db.prepare('DELETE FROM categories WHERE id = ?').run(id);
        logAction('DELETE_CATEGORY', `Deleted category: ${category.name}`, 'Admin');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

// AI Chat Assistant
app.post('/api/chat', async (req, res) => {
    const { messages } = req.body;

    try {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY is not defined in .env');
        }

        // Fetch current menu with allergens for context
        const dishes = db.prepare('SELECT name, description, price, category, allergens FROM dishes WHERE isAvailable = 1').all();
        const menuContext = dishes.map((d: any) =>
            `- ${d.name} (${d.category}): ${d.description}. Аллергены: ${d.allergens || 'нет'}. Цена: ${d.price} руб.`
        ).join('\n');

        // Fetch custom admin instruction for today
        const adminInstruction = db.prepare('SELECT promptText FROM ai_instructions WHERE isActive = 1 ORDER BY createdAt DESC LIMIT 1').get() as any;
        const extraPrompt = adminInstruction ? `\n\nОСОБОЕ ПОРУЧЕНИЕ ОТ АДМИНИСТРАЦИИ НА СЕЙЧАС:\n${adminInstruction.promptText}` : '';

        const systemInstruction = `
            Ты — "Алекс", элитный цифровой официант-сомелье нашего ресторана. Ты обладаешь безупречным вкусом и глубокими знаниями о еде.
            
            Твои задачи:
            1. ПАМЯТЬ: Ты помнишь весь ход беседы. Если гость просит "еще что-то", предлагай блюдо, отличное от того, что уже обсуждали. Предлагай подходящие сочетания на основе истории.
            2. ЗНАНИЯ: Используй список меню ниже. Обращай внимание на аллергены. Если гость говорит "у меня аллергия на орехи", исключай такие блюда.
            3. ПАРЫ: К любому заказу еды ненавязчиво рекомендуй идеальный напиток из нашего меню.
            4. СТИЛЬ: Тон дружелюбный, профессиональный, чуть-чуть восторженный от нашей кухни. Используй уместные эмодзи. 🥗🍷
            
            ${extraPrompt}

            ТЕКУЩЕЕ МЕНЮ:
            ${menuContext}
            
            ПРАВИЛА:
            - Отвечай кратко (не более 3-4 предложений).
            - Предлагай 1-2 конкретных блюда, не перечисляй всё меню.
            - Если спрашивать будут не про ресторан, вежливо верни к теме еды.
        `;


        if (!messages || messages.length === 0) {
            throw new Error('No messages provided');
        }

        // Convert messages to Gemini history format (excluding the very last one)
        let history = messages.slice(0, -1).map((m: any) => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
        }));

        // Gemini requires the first message in history to be from 'user'
        while (history.length > 0 && history[0].role !== 'user') {
            history.shift();
        }

        const lastMessage = messages[messages.length - 1].content;

        // RESILIENCE: High-performance execution with stable fallback
        let result;
        const systemInstructionObj = { parts: [{ text: systemInstruction }] };

        try {
            console.log("🤖 Trying primary model: gemini-2.0-flash");
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", systemInstruction: systemInstructionObj as any });
            const chat = model.startChat({ history });
            result = await chat.sendMessage(lastMessage);
        } catch (error: any) {
            console.warn(`⚠️ Primary model error: ${error.message}. Switching to gemini-1.5-flash...`);
            try {
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", systemInstruction: systemInstructionObj as any });
                const chat = model.startChat({ history });
                result = await chat.sendMessage(lastMessage);
            } catch (fallbackError: any) {
                console.error("🔥 All AI models failed:", fallbackError);
                throw fallbackError;
            }
        }

        const response = await result.response;
        const text = response.text();

        console.log('🤖 Gemini Chat Response success');
        res.json({ text });
    } catch (error: any) {
        console.error('🔥 FINAL API ERROR:', error);
        res.status(500).json({
            error: 'AI Assistant Service Interrupted',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
