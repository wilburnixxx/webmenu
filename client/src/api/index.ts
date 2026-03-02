import axios from 'axios';
import type { Dish, Order } from '../types';

// Foolproof URL formatter
const getBaseUrl = () => {
    let url = import.meta.env.VITE_API_URL || '';
    if (!url) return '';
    // If URL doesn't start with http, it's treated as relative. Force absolute.
    if (!url.startsWith('http')) {
        url = `https://${url}`;
    }
    // Remove trailing slash if exists
    return url.replace(/\/$/, '');
};

const API_BASE_URL = getBaseUrl();

console.log('🌐 API Configured to hit:', API_BASE_URL);

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use(config => {
    const fullUrl = `${config.baseURL}${config.url}`;
    console.log(`📡 SENDING ${config.method?.toUpperCase()}: ${fullUrl}`);
    return config;
});

export const menuService = {
    getMenu: async () => (await api.get('/menu')).data || [],
    getAdminMenu: async () => (await api.get('/menu')).data || [],
    createDish: async (data: any) => (await api.post('/dishes', data)).data,
    updateDish: async (id: string, data: any) => (await api.put(`/dishes/${id}`, data)).data,
    deleteDish: async (id: string) => (await api.delete(`/dishes/${id}`)).data,
    getCategories: async () => {
        try {
            const res = await api.get('/categories');
            return Array.isArray(res.data) ? res.data : [];
        } catch (e) { return []; }
    },
    createCategory: async (name: string) => (await api.post('/categories', { name })).data,
    deleteCategory: async (id: string) => (await api.delete(`/categories/${id}`)).data,
    getMetrics: async () => ({ totalOrders: 0, totalRevenue: 0, totalDishes: 0 }),
    getLogs: async () => [],
    getAiInstructions: async () => ({ promptText: '' }),
    saveAiInstructions: async (t: string) => ({})
};

export const orderService = {
    getOrders: async () => (await api.get('/orders')).data || [],
    createOrder: async (data: any) => (await api.post('/orders', data)).data,
    updateOrderStatus: async (id: string, s: string) => (await api.patch(`/orders/${id}`, { status: s })).data
};

export default api;
