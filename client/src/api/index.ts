import axios from 'axios';

// 1. АВТО-ОПРЕДЕЛЕНИЕ URL (Локально или Railway)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const BASE_URL = API_URL.startsWith('http') ? API_URL : `https://${API_URL}`;

console.log('📡 СЕРВИС: Подключение к API по адресу:', BASE_URL);

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 8000,
    headers: { 'Content-Type': 'application/json' }
});

// Добавляем токен ко всем запросам
api.interceptors.request.use(config => {
    const token = localStorage.getItem('qr_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Обработка ошибок авторизации (401)
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            console.warn('🔑 Сессия истекла или невалидна. Выход...');
            localStorage.removeItem('qr_token');
            localStorage.removeItem('qr_role');
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// 2. УНИВЕРСАЛЬНЫЙ СЕРВИС (Прямое управление)
export const menuService = {
    // Категории
    getCategories: async () => {
        try {
            const res = await api.get('/categories');
            return Array.isArray(res.data) ? res.data : [];
        } catch (e: any) {
            console.error('Ошибка в Категориях:', e.message);
            return [];
        }
    },
    createCategory: async (name: string) => (await api.post('/categories', { name })).data,
    updateCategoryOrder: async (id: string, order: number) => (await api.patch(`/categories/${id}`, { order })).data,
    reorderCategories: async (categories: { id: string, order: number }[]) => (await api.post('/categories/reorder', { categories })).data,
    deleteCategory: async (id: string) => (await api.delete(`/categories/${id}`)),

    // Блюда
    getMenu: async () => {
        try {
            const res = await api.get('/menu');
            return Array.isArray(res.data) ? res.data : [];
        } catch (e: any) {
            console.error('Ошибка в Меню:', e.message);
            return [];
        }
    },
    getAdminMenu: async () => {
        try {
            const res = await api.get('/menu');
            return Array.isArray(res.data) ? res.data : [];
        } catch (e: any) {
            console.error('Ошибка в Админ-меню:', e.message);
            return [];
        }
    },
    createDish: async (d: any) => (await api.post('/dishes', d)).data,
    updateDish: async (id: string, d: any) => (await api.put(`/dishes/${id}`, d)).data,
    deleteDish: async (id: string) => (await api.delete(`/dishes/${id}`)).data,

    // Метрики и журналы
    getMetrics: async () => {
        try {
            return (await api.get('/metrics')).data;
        } catch (e: any) {
            console.error('Ошибка в Метриках:', e.message);
            return { totalOrders: 0, totalRevenue: 0, totalDishes: 0, topDishes: [] };
        }
    },
    getLogs: async () => {
        try {
            const res = await api.get('/logs');
            return Array.isArray(res.data) ? res.data : [];
        } catch (e: any) {
            console.error('Ошибка в Журнале:', e.message);
            return [];
        }
    },
    getAiInstructions: async () => {
        try {
            return (await api.get('/ai/instructions')).data;
        } catch (e: any) {
            console.error('Ошибка при получении инструкций:', e.message);
            return { promptText: '' };
        }
    },
    saveAiInstructions: async (promptText: string) => {
        try {
            return (await api.post('/ai/instructions', { promptText })).data;
        } catch (e: any) {
            console.error('Ошибка при сохранении инструкций:', e.message);
            throw e;
        }
    },
    createAdjustment: async (data: any) => (await api.post('/metrics/adjust', data)).data,
    sendMessage: async (messages: any[]) => (await api.post('/ai/chat', { messages })).data
};

export const orderService = {
    getOrders: async () => (await api.get('/orders')).data || [],
    createOrder: async (d: any) => (await api.post('/orders', d)).data,
    updateOrderStatus: async (id: string, s: string) => (await api.patch(`/orders/${id}`, { status: s })).data,
    getOrder: async (id: string) => (await api.get(`/orders/${id}`)).data
};

export const callService = {
    createCall: async (tableNumber: string, type: string = 'MASTER') => (await api.post('/calls', { tableNumber, type })).data,
    getCalls: async () => (await api.get('/calls')).data || [],
    completeCall: async (id: string) => (await api.patch(`/calls/${id}`, { status: 'DONE' })).data
};

export const authService = {
    login: async (credentials: any) => (await api.post('/auth/login', credentials)).data
};

export default api;
