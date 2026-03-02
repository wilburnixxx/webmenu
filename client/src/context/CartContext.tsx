import React, { createContext, useContext, useState, type ReactNode } from 'react';
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
    const [cart, setCart] = useState<MenuItem[]>([]);

    const addToCart = (dish: Dish) => {
        const dishId = String(dish.id);
        console.log('🛒 Добавляем в корзину:', dish.name, 'ID:', dishId);
        setCart(prev => {
            const existing = prev.find(item => String(item.dish.id) === dishId);
            if (existing) {
                console.log('✨ Увеличиваем количество для:', dish.name);
                return prev.map(item =>
                    String(item.dish.id) === dishId
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            console.log('🆕 Новый товар в корзине:', dish.name);
            return [...prev, { dish, quantity: 1 }];
        });
    };

    const removeFromCart = (dishId: string) => {
        const idStr = String(dishId);
        setCart(prev =>
            prev.map(item =>
                String(item.dish.id) === idStr
                    ? { ...item, quantity: Math.max(0, item.quantity - 1) }
                    : item
            ).filter(item => item.quantity > 0)
        );
    };

    const clearCart = () => {
        console.log('🛒 Очистка корзины');
        setCart([]);
    };

    const totalPrice = cart.reduce((sum, item) => {
        const p = Number(item.dish.price) || 0;
        return sum + (p * item.quantity);
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
