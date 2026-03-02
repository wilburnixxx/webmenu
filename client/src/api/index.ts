import axios from 'axios';

const getBaseUrl = () => {
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl) {
        // Если ссылка есть, убеждаемся, что она с https
        return envUrl.startsWith('http') ? envUrl : `https://${envUrl}`;
    }
    // Если работаем локально и VITE_API_URL не задан, стучимся на сервер 5000
    return 'http://localhost:5000';
};

const API_BASE_URL = getBaseUrl();
console.log('📡 API Стучится по адресу:', API_BASE_URL);

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' }
});

export const menuService = {
    getMenu: async () => (await api.get('/menu')).data || [],
    getAdminMenu: async () => (await api.get('/menu')).data || [],
    createDish: async (d: any) => (await api.post('/dishes', d)).data,
    getCategories: async () => (await api.get('/categories')).data || [],
    createCategory: async (name: string) => (await api.post('/categories', { name })).data,
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
