export interface Dish {
    id: string;
    name: string;
    description: string | null;
    price: number;
    imageUrl: string | null;
    category: string;
    isAvailable: boolean;
    allergens: string[];
    createdAt: string;
    updatedAt: string;
}

export interface MenuItem {
    dish: Dish;
    quantity: number;
}

export interface Order {
    id: string;
    tableNumber: string;
    status: 'ACCEPTED' | 'READY' | 'CANCELLED' | 'ARCHIVED';
    totalPrice: number;
    comments: string | null;
    items: OrderItem[];
    createdAt: string;
}

export interface OrderItem {
    id?: string;
    orderId?: string;
    dishId: string;
    quantity: number;
    price: number;
}
