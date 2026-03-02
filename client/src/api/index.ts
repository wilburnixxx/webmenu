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

// 2. УНИВЕРСАЛЬНЫЙ СЕРВИС (Прямое управление)
export const menuService = {
    // Категории
    getCategories: async () => {
        try {
            const res = await api.get('/categories');
            return Array.isArray(res.data) ? res.data : [];
        } catch (e) {
            console.error('Ошибка в Категориях:', e.message);
            return [];
        }
    },
    createCategory: async (name: string) => (await api.post('/categories', { name })).data,
    deleteCategory: async (id: string) => (await api.delete(`/categories/${id}`)),

    // Блюда
    getMenu: async () => {
        try {
            const res = await api.get('/menu');
            return Array.isArray(res.data) ? res.data : [];
        } catch (e) {
            console.error('Ошибка в Меню:', e.message);
            return [];
        }
    },
    getAdminMenu: async () => {
        try {
            const res = await api.get('/menu');
            return Array.isArray(res.data) ? res.data : [];
        } catch (e) {
            console.error('Ошибка в Админ-меню:', e.message);
            return [];
        }
    },
    createDish: async (d: any) => (await api.post('/dishes', d)).data,
    updateDish: async (id: string, d: any) => (await api.put(`/dishes/${id}`, d)).data,
    deleteDish: async (id: string) => (await api.delete(`/dishes/${id}`)).data,

    // Метрики и прочее
    getMetrics: async () => ({ totalOrders: 0, totalRevenue: 0, totalDishes: 0 }),
    getLogs: async () => [],
    getAiInstructions: async () => ({ promptText: '' }),
    saveAiInstructions: async (t: string) => ({})
};

export const orderService = {
    getOrders: async () => (await api.get('/orders')).data || [],
    createOrder: async (d: any) => (await api.post('/orders', d)).data,
    updateOrderStatus: async (id: string, s: string) => (await api.patch(`/orders/${id}`, { status: s })).data
};

export default api;
