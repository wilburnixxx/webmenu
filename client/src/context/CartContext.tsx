import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Dish, MenuItem } from '../types';

interface CartContextType {
    cart: MenuItem[];
    addToCart: (dish: Dish) => void;
    removeFromCart: (dishId: string) => void;
    clearCart: () => void;
    totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Пытаемся загрузить корзину из localStorage при старте
    const [cart, setCart] = useState<MenuItem[]>(() => {
        try {
            const saved = localStorage.getItem('qr_cart');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('⚠️ Ошибка загрузки корзины:', e);
            return [];
        }
    });

    // Сохраняем в localStorage при каждом изменении
    useEffect(() => {
        try {
            localStorage.setItem('qr_cart', JSON.stringify(cart));
            console.log('💾 Корзина сохранена в хранилище:', cart.length, 'позиций');
        } catch (e) {
            console.error('⚠️ Ошибка сохранения корзины:', e);
        }
    }, [cart]);

    const addToCart = (dish: Dish) => {
        const dishId = String(dish.id);
        console.log('🛒 ДОБАВЛЕНИЕ:', dish.name, 'ID:', dishId);

        setCart(prev => {
            const existingIndex = prev.findIndex(item => String(item.dish.id) === dishId);

            if (existingIndex !== -1) {
                console.log('✨ Позиция уже есть, увеличиваем кол-во');
                const newCart = [...prev];
                newCart[existingIndex] = {
                    ...newCart[existingIndex],
                    quantity: newCart[existingIndex].quantity + 1
                };
                return newCart;
            }

            console.log('🆕 Новая позиция в корзине');
            return [...prev, { dish, quantity: 1 }];
        });
    };

    const removeFromCart = (dishId: string) => {
        const idStr = String(dishId);
        console.log('🗑️ УДАЛЕНИЕ/УМЕНЬШЕНИЕ ID:', idStr);

        setCart(prev =>
            prev.map(item =>
                String(item.dish.id) === idStr
                    ? { ...item, quantity: item.quantity - 1 }
                    : item
            ).filter(item => item.quantity > 0)
        );
    };

    const clearCart = () => {
        console.log('🧹 ПОЛНАЯ ОЧИСТКА КОРЗИНЫ');
        setCart([]);
        localStorage.removeItem('qr_cart');
    };

    const totalPrice = cart.reduce((sum, item) => {
        const price = Number(item.dish.price) || 0;
        return sum + (price * item.quantity);
    }, 0);

    return (
        <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, totalPrice }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) throw new Error('useCart must be used within a CartProvider');
    return context;
};
