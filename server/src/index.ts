import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import Groq from 'groq-sdk';

dotenv.config();

console.log('🏁 Запуск сервера v2.1.5 - Category Reordering...');
const app = express();
const PORT: number = Number(process.env.PORT) || 5000;

const prisma = new PrismaClient();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

app.use(cors({ origin: '*', methods: '*', allowedHeaders: '*' }));
app.use(express.json({ limit: '10mb' })); // Увеличен лимит для загрузки фото
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

const logAction = async (action: string, details: string, staffName: string = 'Система') => {
    try {
        await prisma.actionLog.create({ data: { action, details, staffName } });
    } catch (e: any) { console.error('⚠️ Ошибка лога:', e.message); }
};

app.get('/', (req: any, res: any) => res.send('<h1>QR Menu Server v2.1.5</h1>'));

app.get('/health', async (req: any, res: any) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'ok', db: 'up' });
    } catch (e: any) { res.status(500).json({ status: 'error', db: 'down', err: e.message }); }
});

const safeQuery = async (res: any, fn: () => Promise<any>) => {
    try { res.json(await fn()); }
    catch (e: any) {
        console.error('❌ Ошибка:', e.message);
        res.status(500).json({ error: e.message });
    }
};

const checkAuth = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Доступ запрещен. Требуется авторизация.' });
    }
    const token = authHeader.split(' ')[1];
    if (token !== 'fake-jwt-admin' && token !== 'fake-jwt-waiter') {
        return res.status(401).json({ error: 'Невалидный токен.' });
    }
    next();
};
app.post(['/auth/login', '/api/auth/login'], async (req: any, res: any) => {
    const { login, password } = req.body;
    const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'admin';
    const ADMIN_PASS = process.env.ADMIN_PASS || 'admin777';
    const WAITER_LOGIN = process.env.WAITER_LOGIN || 'waiter';
    const WAITER_PASS = process.env.WAITER_PASS || 'waiter777';

    if (login === ADMIN_LOGIN && password === ADMIN_PASS) {
        return res.json({ role: 'ADMIN', token: 'fake-jwt-admin' });
    }
    if (login === WAITER_LOGIN && password === WAITER_PASS) {
        return res.json({ role: 'WAITER', token: 'fake-jwt-waiter' });
    }

    res.status(401).json({ error: 'Неверный логин или пароль' });
});
app.get(['/ai/instructions', '/api/ai/instructions'], checkAuth, async (req: any, res: any) => {
    try {
        const instruction = await prisma.aIInstruction.findFirst({ orderBy: { version: 'desc' } });
        res.json(instruction || { promptText: "Ты - Марк, виртуальный кальянный мастер-консультант." });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post(['/ai/instructions', '/api/ai/instructions'], checkAuth, async (req: any, res: any) => {
    try {
        const { promptText } = req.body;
        const result = await prisma.aIInstruction.create({
            data: { promptText, version: (await prisma.aIInstruction.count()) + 1 }
        });
        await logAction('ОБУЧЕНИЕ ИИ', `Новая версия v${result.version}`, 'Админ');
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
app.get(['/categories', '/api/categories'], (req: any, res: any) => safeQuery(res, () => prisma.category.findMany({ orderBy: { order: 'asc' } })));

app.post(['/categories', '/api/categories'], checkAuth, async (req: any, res: any) => {
    try {
        const maxOrder = await prisma.category.aggregate({ _max: { order: true } });
        const result = await prisma.category.upsert({
            where: { name: req.body.name },
            update: {},
            create: { name: req.body.name, order: (maxOrder._max.order || 0) + 1 }
        });
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post(['/categories/reorder', '/api/categories/reorder'], checkAuth, async (req: any, res: any) => {
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

app.patch(['/categories/:id', '/api/categories/:id'], checkAuth, async (req: any, res: any) => {
    try {
        const result = await prisma.category.update({
            where: { id: req.params.id },
            data: { order: parseInt(req.body.order) }
        });
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete(['/categories/:id', '/api/categories/:id'], checkAuth, async (req: any, res: any) => {
    try {
        const result = await prisma.category.delete({ where: { id: req.params.id } });
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get(['/menu', '/api/menu'], async (req: any, res: any) => {
    try {
        const categories = await prisma.category.findMany({ orderBy: { order: 'asc' } });
        const dishes = await prisma.dish.findMany({ orderBy: { order: 'asc' } });
        const catMap: any = categories.reduce((acc: any, cat: any, idx) => ({ ...acc, [cat.name]: idx }), {});
        const sortedDishes = dishes.sort((a: any, b: any) => {
            const catDiff = (catMap[a.category] || 99) - (catMap[b.category] || 99);
            if (catDiff !== 0) return catDiff;
            return ((a.order || 0) as number) - ((b.order || 0) as number);
        });

        res.json(sortedDishes);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post(['/dishes', '/api/dishes'], async (req: any, res: any) => {
    try {
        const maxOrderResult = await prisma.dish.aggregate({ _max: { order: true } });
        const result = await prisma.dish.create({
            data: {
                ...req.body,
                price: parseFloat(req.body.price) || 0,
                order: (maxOrderResult._max.order || 0) + 1
            }
        });
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post(['/dishes/reorder', '/api/dishes/reorder'], checkAuth, async (req: any, res: any) => {
    try {
        const { dishes } = req.body;
        await prisma.$transaction(
            dishes.map((d: any) => prisma.dish.update({
                where: { id: d.id },
                data: { order: parseInt(d.order) }
            }))
        );
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put(['/dishes/:id', '/api/dishes/:id'], async (req: any, res: any) => {
    try {
        const data = { ...req.body, price: parseFloat(req.body.price) || 0 };
        delete data.id;
        const result = await prisma.dish.update({ where: { id: req.params.id }, data });
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete(['/dishes/:id', '/api/dishes/:id'], async (req: any, res: any) => {
    try {
        await prisma.$transaction(async (tx: any) => {
            await tx.orderItem.deleteMany({ where: { dishId: req.params.id } });
            const dish = await tx.dish.delete({ where: { id: req.params.id } });
            await logAction('УДАЛЕНИЕ БЛЮДА', `Удалено: ${dish.name}`, 'Админ');
        });
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
app.post(['/orders', '/api/orders'], async (req: any, res: any) => {
    try {
        const { tableNumber, items, totalPrice, comments } = req.body;
        console.log('📦 Новый заказ:', { tableNumber, itemCount: items?.length, totalPrice });

        const tableIdx = parseInt(tableNumber);
        if (isNaN(tableIdx) || tableIdx < 0 || tableIdx > 100) {
            return res.status(400).json({ error: 'Некорректный номер столика (0-100)' });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Корзина пуста' });
        }

        const result = await prisma.order.create({
            data: {
                tableNumber: String(tableIdx),
                totalPrice: parseFloat(totalPrice) || 0,
                comments: comments || '',
                items: {
                    create: items.map((it: any) => ({
                        dishId: it.dishId,
                        quantity: parseInt(it.quantity) || 1,
                        price: parseFloat(it.price) || 0
                    }))
                }
            }
        });

        await logAction('НОВЫЙ ЗАКАЗ', `Стол ${tableNumber}, ${result.totalPrice}₽`, 'Гость');
        res.json(result);
    } catch (e: any) {
        console.error('❌ Ошибка создания заказа:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.get(['/orders', '/api/orders'], checkAuth, (req: any, res: any) => safeQuery(res, () => prisma.order.findMany({ include: { items: { include: { dish: true } } }, orderBy: { createdAt: 'desc' } })));
app.get(['/orders/:id', '/api/orders/:id'], (req: any, res: any) => safeQuery(res, () => prisma.order.findUnique({ where: { id: req.params.id }, include: { items: { include: { dish: true } } } })));

app.patch(['/orders/:id', '/api/orders/:id'], checkAuth, async (req: any, res: any) => {
    const result = await prisma.order.update({ where: { id: req.params.id }, data: { status: req.body.status } });
    await logAction('СТАТУС ЗАКАЗА', `Заказ ${result.id.slice(0, 5)} -> ${req.body.status}`, 'Официант');
    res.json(result);
});

// --- File Upload system using Database Base64 Strings ---
app.post(['/upload', '/api/upload'], checkAuth, async (req: any, res: any) => {
    try {
        const { data } = req.body;
        if (!data || !data.startsWith('data:image')) {
            return res.status(400).json({ error: 'Неверный формат изображения или файл не передан' });
        }
        const img = await prisma.image.create({ data: { data } });
        // Getting host correctly for absolute URLs isn't strictly necessary, 
        // a relative /api/image/ path works perfectly since frontend prepends the API URL
        res.json({ url: `/api/image/${img.id}` });
    } catch (e: any) {
        console.error('Ошибка загрузки фото:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.get(['/image/:id', '/api/image/:id'], async (req: any, res: any) => {
    try {
        const img = await prisma.image.findUnique({ where: { id: req.params.id } });
        if (!img) return res.status(404).send('Изображение не найдено');

        // "data:image/jpeg;base64,....." -> Extract MIME type & base64 content
        const matches = img.data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return res.status(500).send('Ошибка чтения формата в БД');
        }

        const type = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');

        // Set strong cache header (1 year caching, as IDs are unique UUIDs)
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Content-Type', type);
        res.send(buffer);
    } catch (e: any) {
        res.status(500).send('Ошибка при получении фото');
    }
});

app.post(['/calls', '/api/calls'], async (req: any, res: any) => {
    try {
        const { tableNumber, type } = req.body;
        const result = await prisma.staffCall.create({ data: { tableNumber: String(tableNumber), type: type || 'MASTER' } });
        await logAction('ВЫЗОВ', `${type || 'МАСТЕР'} (Стол ${tableNumber})`, 'Гость');
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get(['/calls', '/api/calls'], checkAuth, (req: any, res: any) => safeQuery(res, () => prisma.staffCall.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' } })));

app.patch(['/calls/:id', '/api/calls/:id'], checkAuth, async (req: any, res: any) => {
    try {
        const result = await prisma.staffCall.update({ where: { id: req.params.id }, data: { status: 'DONE' } });
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});
app.post(['/ai/chat', '/api/ai/chat'], async (req: any, res: any) => {
    try {
        const { messages } = req.body;
        const dishes = await prisma.dish.findMany({ where: { isAvailable: true } });
        const menuContext = dishes.map(d => `[Категория: ${d.category || 'Разное'}] ${d.name} (${d.price}₽) - ${d.description}`).join('\n');
        const instruction = await prisma.aIInstruction.findFirst({ orderBy: { version: 'desc' } });
        const systemRules = "ОТВЕЧАЙ МАКСИМАЛЬНО КРАТКО (2-3 предложения). БЕЗ ВОДЫ. ПРАВИЛО №1: Пока гость не выбрал кальян/табак, ТЕБЕ КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО упоминать напитки, еду и другие товары. Консультируй ТОЛЬКО по вкусам и крепости табаков. ПРАВИЛО №2: Предлагай напитки ТОЛЬКО как доп. продажу (апселл), когда кальян уже выбран. НИКАКИХ markdown таблиц. Не перечисляй всё меню. Ты кальянный мастер Марк. НИКОГДА не говори, что ты ИИ.";
        const systemPrompt = `${instruction?.promptText || ''}\n\n${systemRules}\n\nДоступное меню:\n${menuContext}`;
        
        let apiMessages: any[] = [{ role: "system", content: systemPrompt }];
        if (Array.isArray(messages)) {
            apiMessages = apiMessages.concat(messages.map(m => ({
                role: m.role || "user",
                content: m.content || m.text || ""
            })));
        } else {
            apiMessages.push({ role: "user", content: JSON.stringify(messages) });
        }

        const chatResponse = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: apiMessages
        });
        const text = chatResponse.choices?.[0]?.message?.content;
        res.json({ text: typeof text === 'string' ? text : "Ошибка при получении ответа" });
    } catch (e: any) {
        console.error('AI Error:', e.message);
        const isQuota = e.message?.includes('429') || e.message?.includes('quota');
        res.status(isQuota ? 429 : 500).json({ error: e.message });
    }
});
app.get(['/logs', '/api/logs'], checkAuth, (req: any, res: any) => safeQuery(res, () => prisma.actionLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })));
app.get(['/metrics', '/api/metrics'], checkAuth, async (req: any, res: any) => {
    try {
        const orders = await prisma.order.findMany({
            where: {
                status: { not: 'CANCELLED' },
                isClosed: false
            }
        });
        res.json({
            totalOrders: orders.length,
            totalRevenue: orders.reduce((sum, o) => sum + o.totalPrice, 0),
            totalDishes: await prisma.dish.count(),
            topDishes: []
        });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post(['/shift/close', '/api/shift/close'], checkAuth, async (req: any, res: any) => {
    try {
        const activeOrders = await prisma.order.findMany({
            where: { isClosed: false, status: { not: 'CANCELLED' } },
            include: { items: { include: { dish: true } } },
            orderBy: { createdAt: 'asc' }
        });
        await prisma.order.updateMany({
            where: { isClosed: false },
            data: { isClosed: true }
        });

        await logAction('ЗАКРЫТИЕ КАССЫ', `Смена закрыта. Заказов: ${activeOrders.length}`, 'Админ');

        res.json(activeOrders);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post(['/metrics/adjust', '/api/metrics/adjust'], async (req: any, res: any) => {
    try {
        const { metricName, value, note } = req.body;
        await logAction('КОРРЕКТИРОВКА', `${metricName}: ${value} (${note})`, 'Руководитель');
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// --- PROMOS ---
app.get(['/promos', '/api/promos'], (req: any, res: any) => safeQuery(res, () => prisma.promo.findMany({ where: { isActive: true }, orderBy: { createdAt: 'desc' } })));

app.post(['/promos', '/api/promos'], checkAuth, async (req: any, res: any) => {
    try {
        const result = await prisma.promo.create({ data: req.body });
        await logAction('НОВОЕ ПРОМО', `Добавлено промо: ${req.body.title || 'Без названия'}`, 'Админ');
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete(['/promos/:id', '/api/promos/:id'], checkAuth, async (req: any, res: any) => {
    try {
        await prisma.promo.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 СЕРВЕР v2.1.5 ПОРТ ${PORT}`));
