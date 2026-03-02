import axios from 'axios';
import type { Dish, Order } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const menuService = {
    getMenu: async (): Promise<Dish[]> => {
        try {
            const response = await api.get('/menu');
            return Array.isArray(response.data) ? response.data : [];
        } catch (error) {
            console.error('API Error:', error);
            return [];
        }
    },
    getAdminMenu: async (): Promise<Dish[]> => {
        try {
            const response = await api.get('/admin/menu');
            return Array.isArray(response.data) ? response.data : [];
        } catch (error) {
            console.error('API Error:', error);
            return [];
        }
    },
    createDish: async (dishData: Partial<Dish>): Promise<Dish> => {
        const response = await api.post('/dishes', dishData);
        return response.data;
    },
    updateDish: async (id: string, dishData: Partial<Dish>): Promise<void> => {
        await api.put(`/dishes/${id}`, dishData);
    },
    deleteDish: async (id: string): Promise<void> => {
        await api.delete(`/dishes/${id}`);
    },
    getMetrics: async (start?: string, end?: string): Promise<any> => {
        const response = await api.get('/admin/metrics', { params: { start, end } });
        return response.data;
    },
    sendMessage: async (messages: { role: string, content: string }[]): Promise<{ text: string }> => {
        const response = await api.post('/chat', { messages });
        return response.data;
    },
    getAiInstructions: async (): Promise<any> => {
        const response = await api.get('/admin/ai-instructions');
        return response.data;
    },
    saveAiInstructions: async (promptText: string): Promise<any> => {
        const response = await api.post('/admin/ai-instructions', { promptText });
        return response.data;
    },
    getTrash: async (): Promise<Dish[]> => {
        const response = await api.get('/admin/trash');
        return response.data;
    },
    restoreDish: async (id: string): Promise<void> => {
        await api.post(`/dishes/${id}/restore`);
    },
    getLogs: async (): Promise<any[]> => {
        const response = await api.get('/admin/logs');
        return response.data;
    },
    createAdjustment: async (data: any): Promise<void> => {
        await api.post('/admin/adjustments', data);
    },
    getCategories: async (): Promise<{ id: string, name: string }[]> => {
        const response = await api.get('/categories');
        return response.data;
    },
    createCategory: async (name: string): Promise<any> => {
        const response = await api.post('/categories', { name });
        return response.data;
    },
    deleteCategory: async (id: string): Promise<void> => {
        await api.delete(`/categories/${id}`);
    }
};

export const orderService = {
    createOrder: async (orderData: Partial<Order> & { items: any[] }): Promise<Order> => {
        const response = await api.post('/orders', orderData);
        return response.data;
    },
    getOrders: async (): Promise<Order[]> => {
        const response = await api.get('/orders');
        return response.data;
    },
    getOrder: async (id: string): Promise<Order> => {
        const response = await api.get(`/orders/${id}`);
        return response.data;
    },
    updateOrderStatus: async (orderId: string, status: string): Promise<Order> => {
        const response = await api.patch(`/orders/${orderId}`, { status });
        return response.data;
    }
};

export default api;
