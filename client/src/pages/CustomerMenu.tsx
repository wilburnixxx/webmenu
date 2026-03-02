import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { menuService, orderService, callService } from '../api';
import DishCard from '../components/DishCard';
import { ShoppingBag, Plus, Minus, Send, ChevronUp, X, ChefHat, User, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';

const CustomerMenu = () => {
    const navigate = useNavigate();
    const [activeCategory, setActiveCategory] = useState('');
    const [isAiOpen, setIsAiOpen] = useState(false);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [tableNumber] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const table = parseInt(params.get('table') || '1');
        return (table >= 0 && table <= 100) ? String(table) : '1';
    });
    const [selectedDish, setSelectedDish] = useState<any>(null);
    const [isCalling, setIsCalling] = useState(false);
    const [callSuccess, setCallSuccess] = useState(false);

    const statusMap: Record<string, { label: string, color: string }> = {
        PENDING: { label: 'ОЖИДАНИЕ', color: '#8E8E93' },
        ACCEPTED: { label: 'ГОТОВИТСЯ', color: '#3B82F6' },
        READY: { label: 'ГОТОВО', color: '#4ADE80' },
        CANCELLED: { label: 'ОТМЕНЕНО', color: '#FF5757' },
    };

    const [activeOrderId, setActiveOrderId] = useState<string | null>(localStorage.getItem('activeOrderId'));
    const [orderComment, setOrderComment] = useState('');

    const { data: dishes, isLoading } = useQuery({
        queryKey: ['menu'],
        queryFn: menuService.getMenu
    });

    const { data: menuCategories } = useQuery({
        queryKey: ['categories'],
        queryFn: menuService.getCategories
    });

    const { data: activeOrder } = useQuery({
        queryKey: ['activeOrder', activeOrderId ?? undefined],
        queryFn: () => activeOrderId ? orderService.getOrder(activeOrderId) : null,
        enabled: !!activeOrderId,
        refetchInterval: 5000
    });

    useEffect(() => {
        if ((activeOrder as any)?.status === 'ARCHIVED') {
            localStorage.removeItem('activeOrderId');
            setActiveOrderId(null);
            setIsStatusModalOpen(false);
        }
    }, [activeOrder]);

    const { cart, addToCart, removeFromCart, totalPrice, clearCart } = useCart();
    console.log('🖼️ CustomerMenu Render - Cart Length:', cart.length);

    const orderMutation = useMutation({
        mutationFn: (data: any) => orderService.createOrder(data),
        onSuccess: (data: any) => {
            clearCart();
            setIsCartOpen(false);
            setActiveOrderId(data.id);
            localStorage.setItem('activeOrderId', data.id);
            setIsStatusModalOpen(true);
        },
        onError: () => alert('Ошибка при отправке заказа')
    });

    const callMutation = useMutation({
        mutationFn: () => callService.createCall(tableNumber),
        onSuccess: () => {
            setCallSuccess(true);
            setIsCalling(false);
            setTimeout(() => setCallSuccess(false), 5000);
        },
        onError: () => {
            alert('Ошибка при вызове официанта');
            setIsCalling(false);
        }
    });

    const handleCallWaiter = () => {
        if (isCalling) return;
        setIsCalling(true);
        callMutation.mutate();
    };

    const categories = menuCategories?.map((c: any) => c.name) || [];

    const scrollToCategory = (catName: string) => {
        const element = document.getElementById(`category-${catName}`);
        if (element) {
            const yOffset = -70; // Header height
            const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
            setActiveCategory(catName);
        }
    };

    const handleCheckout = () => {
        if (cart.length === 0) return;
        orderMutation.mutate({
            tableNumber,
            totalPrice: totalPrice,
            items: (cart as any[]).map((item: any) => ({ dishId: item.dish.id, quantity: item.quantity, price: item.dish.price })),
            comments: orderComment
        });
    };

    // AI Chat Bot
    const [chatMessages, setChatMessages] = useState<{ role: string, content: string }[]>([
        { role: 'assistant', content: 'Привет! Я ваш ИИ-ассистент. Могу порекомендовать блюда на основе ваших вкусов. Что вы любите?' }
    ]);
    const [chatInput, setChatInput] = useState('');
    const [isAiTyping, setIsAiTyping] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, isAiTyping]);

    const handleSendMessage = async () => {
        if (!chatInput.trim() || isAiTyping) return;
        const userMsg = { role: 'user', content: chatInput };
        const newMessages = [...chatMessages, userMsg];
        setChatMessages(newMessages);
        setChatInput('');
        setIsAiTyping(true);
        try {
            const response = await menuService.sendMessage(newMessages);
            setChatMessages([...newMessages, { role: 'assistant', content: response.text }]);
        } catch (error: any) {
            console.error('AI Error:', error);
            let errorText = "Произошла ошибка связи. Проверьте интернет или попробуйте позже. 🔌";

            if (error.response) {
                const status = error.response.status;
                if (status === 429) errorText = "У Алекса сейчас слишком много заказов (лимит запросов). Пожалуйста, попробуйте через 15-20 секунд! ☕";
                else if (status === 500) errorText = `Ошибка сервера (${status}): ${error.response.data?.error || 'Внутренняя ошибка ИИ'}. 🛠️`;
                else if (status === 404) errorText = "Бэкенд ИИ не найден (404). Проверьте настройки API_URL. 🗺️";
                else errorText = `Ошибка ${status}: ${error.response.data?.error || 'Что-то пошло не так'}. ⚠️`;
            } else if (error.request) {
                errorText = "Сервер не отвечает. Возможно, бэкенд на Railway спит или упал. �";
            }

            setChatMessages([...newMessages, { role: 'assistant', content: errorText }]);
        } finally {
            setIsAiTyping(false);
        }
    };

    if (isLoading) return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '32px', background: 'var(--bg-base)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', width: '320px' }}>
                {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: '240px', borderRadius: '16px' }} />)}
            </div>
            <p style={{ fontWeight: '700', letterSpacing: '2px', color: 'var(--primary)', fontSize: '12px' }}>LOADING EXPERIENCE...</p>
        </div>
    );

    return (
        <div style={{ width: '100%', paddingBottom: '140px', minHeight: '100vh', position: 'relative' }}>

            {/* Call Success Toast */}
            <AnimatePresence>
                {callSuccess && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        style={{
                            position: 'fixed', bottom: '100px', left: '20px', right: '20px',
                            zIndex: 2500, display: 'flex', justifyContent: 'center'
                        }}
                    >
                        <div style={{
                            background: '#1A1A1A', color: 'white', padding: '16px 24px',
                            borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                            display: 'flex', alignItems: 'center', gap: '12px',
                            border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            <div style={{ padding: '8px', background: 'var(--primary)', borderRadius: '10px' }}>
                                <Bell size={16} fill="white" />
                            </div>
                            <span style={{ fontSize: '14px', fontWeight: '700' }}>Официант скоро подойдет! 🧑‍🍳</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Award-Winning Header (Sticky) */}
            <header className="glass" style={{
                position: 'sticky', top: 0, zIndex: 1000,
                paddingTop: 'calc(env(safe-area-inset-top, 0px))',
                minHeight: 'calc(56px + env(safe-area-inset-top, 0px))',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                paddingLeft: 'max(16px, env(safe-area-inset-left))',
                paddingRight: 'max(16px, env(safe-area-inset-right))',
                paddingBottom: '8px'
            }}>
                <div style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '-0.5px' }}>
                    LIQUID<span style={{ color: 'var(--primary)' }}>MENU</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        onClick={handleCallWaiter}
                        disabled={isCalling}
                        style={{
                            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                            color: isCalling ? 'var(--text-tertiary)' : 'var(--primary)',
                            padding: '8px 12px', borderRadius: '12px',
                            display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Bell size={18} fill={isCalling ? 'none' : 'currentColor'} style={{ opacity: isCalling ? 0.5 : 1 }} />
                        <span style={{ fontSize: '10px', fontWeight: '900', letterSpacing: '0.5px' }}>ВЫЗОВ</span>
                    </button>
                    <div className="status-indicator" style={{ marginRight: '8px' }} />
                    <button
                        onClick={() => setIsCartOpen(true)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-primary)', position: 'relative', padding: '8px' }}
                    >
                        <ShoppingBag size={22} />
                        {cart.length > 0 && (
                            <span style={{
                                position: 'absolute', top: '0px', right: '0px',
                                background: 'var(--primary)', color: 'white',
                                width: '18px', height: '18px', borderRadius: '50%',
                                fontSize: '10px', fontWeight: '800', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                border: '2px solid #0F0F0F'
                            }}>
                                {cart.length}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => navigate('/login')}
                        style={{
                            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '12px',
                            display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                            marginLeft: '4px'
                        }}
                    >
                        <User size={16} />
                        <span style={{ fontSize: '10px', fontWeight: '900', letterSpacing: '0.5px' }}>STAFF</span>
                    </button>
                </div>
            </header>

            {/* Category Scroll (Sticky/Non-Sticky Switch Base on scroll) */}
            <div style={{
                background: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(20px)',
                padding: '14px 16px',
                paddingLeft: 'max(16px, env(safe-area-inset-left))',
                paddingRight: 'max(16px, env(safe-area-inset-right))',
                overflowX: 'auto',
                scrollbarWidth: 'none',
                display: 'flex',
                gap: '12px',
                position: 'sticky',
                top: 'calc(56px + env(safe-area-inset-top, 0px))',
                zIndex: 999,
                borderBottom: '1px solid var(--border-color)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
            }}>
                {categories.map(cat => (
                    <button
                        key={cat}
                        className={`tab-btn ${activeCategory === cat ? 'active' : ''}`}
                        onClick={() => scrollToCategory(cat)}
                        style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                        {cat}
                    </button>
                ))}
                <div style={{ minWidth: '40px' }} /> {/* End spacing */}
            </div>

            {/* Active Order Banner (Order Tracking) */}
            <AnimatePresence>
                {activeOrderId && activeOrder && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        onClick={() => setIsStatusModalOpen(true)}
                        className="glass"
                        style={{
                            margin: '12px 16px',
                            padding: '16px 20px',
                            borderRadius: '20px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            border: '1px solid var(--border-color)',
                            boxShadow: '0 8px 30px rgba(0,0,0,0.05)',
                            background: 'rgba(255,255,255,0.95)'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div className="status-indicator" style={{
                                background: statusMap[activeOrder.status]?.color || '#8E8E93',
                                boxShadow: `0 0 10px ${statusMap[activeOrder.status]?.color}40`
                            }} />
                            <div>
                                <div style={{ fontSize: '11px', fontWeight: '900', opacity: 0.5, letterSpacing: '1px' }}>ВАШ ЗАКАЗ</div>
                                <div style={{ fontSize: '15px', fontWeight: '900', color: statusMap[activeOrder.status]?.color }}>
                                    {statusMap[activeOrder.status]?.label || 'ОБРАБОТКА'}
                                </div>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '10px', fontWeight: '800', opacity: 0.4 }}>ПОДРОБНЕЕ</div>
                            <div className="price-mono" style={{ fontSize: '14px' }}>ID: {activeOrder.id.slice(0, 5).toUpperCase()}</div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Content Area */}
            <main style={{
                padding: '24px 16px',
                paddingLeft: 'max(16px, env(safe-area-inset-left))',
                paddingRight: 'max(16px, env(safe-area-inset-right))',
                paddingBottom: 'calc(140px + env(safe-area-inset-bottom))',
                display: 'flex',
                flexDirection: 'column',
                gap: '64px',
                width: '100%'
            }}>

                {/* AI Brand Box */}
                <div className="card" style={{
                    padding: 'clamp(20px, 5vw, 32px)',
                    background: 'linear-gradient(135deg, #FF6B35 0%, #FF8A52 100%)',
                    color: 'white',
                    position: 'relative',
                    border: 'none',
                    borderRadius: '24px',
                    boxShadow: '0 15px 35px rgba(255, 107, 53, 0.15)'
                }}>
                    <div style={{ fontSize: '11px', fontWeight: '900', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>AI SOMMELIER</div>
                    <h1 style={{ marginBottom: '12px', fontSize: 'clamp(24px, 5vw, 36px)', color: 'white', lineHeight: '1.1' }}>Что пожелаете?</h1>
                    <p className="body-small" style={{ opacity: 0.9, marginBottom: '20px', maxWidth: '450px', lineHeight: '1.4' }}>
                        Ваш персональный гид по вкусам. Подберу идеальное блюдо под ваше настроение.
                    </p>
                    <button onClick={() => setIsAiOpen(true)} className="btn-primary" style={{ background: 'white', color: '#FF6B35', border: 'none', height: '44px', padding: '0 24px', fontSize: '14px' }}>СПОСИТЬ СОВЕТ</button>
                </div>

                {/* Categories Grid */}
                {categories.map(cat => (
                    <section key={cat} id={`category-${cat}`}>
                        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '24px', gap: '12px' }}>
                            <h2 style={{ fontSize: '32px', letterSpacing: '-1px' }}>{cat}</h2>
                            <span style={{ fontSize: '14px', color: 'var(--text-tertiary)', fontWeight: '600' }}>{dishes?.filter(d => d.category === cat).length} позиций</span>
                        </div>
                        <div className="dish-grid">
                            {dishes?.filter(d => d.category === cat).map((dish: any) => (
                                <DishCard
                                    key={dish.id}
                                    dish={dish}
                                    onAddToCart={addToCart}
                                    onShowDetails={(d) => setSelectedDish(d)}
                                />
                            ))}
                        </div>
                    </section>
                ))}
            </main>

            {/* Sticky Floating Action Bar (Cart Trigger) */}
            <AnimatePresence>
                {cart.length > 0 && (
                    <motion.div
                        initial={{ y: 100 }}
                        animate={{ y: 0 }}
                        exit={{ y: 100 }}
                        theme-data="cart-footer"
                        style={{
                            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1100,
                            padding: '20px', background: 'rgba(255,255,255,0.8)',
                            backdropFilter: 'blur(20px)',
                            borderTop: '1px solid var(--border-color)'
                        }}
                    >
                        <div
                            onClick={() => setIsCartOpen(true)}
                            className="btn-primary"
                            style={{
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0 24px'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <ShoppingBag size={20} />
                                <span>{cart.length} товаров</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <span className="price-mono" style={{ color: 'white', fontSize: '20px' }}>{totalPrice} ₽</span>
                                <ChevronUp size={20} />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modals & Overlays */}
            <AnimatePresence>
                {/* Dish Details Modal */}
                {selectedDish && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 5000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedDish(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)' }} />
                        <motion.div initial={{ scale: 0.9, opacity: 0, y: 40 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 40 }} transition={{ type: 'spring', damping: 25 }}
                            style={{
                                width: '100%', maxWidth: '540px', background: '#FFFFFF', borderRadius: '32px', position: 'relative', zIndex: 5001,
                                overflow: 'hidden', boxShadow: '0 50px 120px rgba(0,0,0,0.15)', border: '1px solid var(--border-color)'
                            }}
                        >
                            <div style={{ position: 'relative' }}>
                                <img src={selectedDish.imageUrl} style={{ width: '100%', height: '340px', objectFit: 'cover' }} />
                                <button onClick={() => setSelectedDish(null)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '16px', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}><X size={24} /></button>
                            </div>

                            <div style={{ padding: 'clamp(24px, 5vw, 40px)' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', gap: '16px' }}>
                                    <h1 style={{ fontSize: '32px', margin: 0, fontWeight: '950', letterSpacing: '-1.5px', color: 'var(--text-primary)' }}>{selectedDish.name}</h1>
                                    <span className="price-mono" style={{ fontSize: '28px', color: 'var(--primary)', fontWeight: '950' }}>{selectedDish.price} ₽</span>
                                </div>
                                <p className="body-large" style={{ color: 'var(--text-secondary)', marginBottom: '36px', lineHeight: '1.7', fontWeight: '500' }}>{selectedDish.description}</p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    <div>
                                        <p style={{ fontSize: '11px', fontWeight: '900', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '2px' }}>ВАЖНАЯ ИНФОРМАЦИЯ / АЛЛЕРГЕНЫ</p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                            {(selectedDish.allergens || []).length > 0 ? (selectedDish.allergens || []).map((a: string) => <span key={a} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '10px 18px', borderRadius: '14px', fontSize: '14px', color: 'var(--text-primary)', fontWeight: '700' }}>{a}</span>) : <span style={{ color: 'var(--text-tertiary)', fontSize: '14px', fontStyle: 'italic' }}>Нет особых пометок</span>}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { addToCart(selectedDish); setSelectedDish(null); }}
                                        className="btn-primary"
                                        style={{ width: '100%', height: '64px', fontSize: '18px', borderRadius: '20px', marginTop: '12px', boxShadow: '0 10px 30px rgba(255, 107, 53, 0.3)' }}
                                    >
                                        ДОБАВИТЬ В МОЙ ЗАКАЗ
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Cart Bottom Sheet */}
                {isCartOpen && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCartOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)' }} />
                        <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            style={{
                                width: '100%', maxWidth: '640px', background: '#FFFFFF',
                                borderRadius: '40px 40px 0 0', position: 'relative', zIndex: 3001,
                                height: 'auto', maxHeight: '95vh', display: 'flex', flexDirection: 'column',
                                boxShadow: '0 -20px 80px rgba(0,0,0,0.1)', border: '1px solid var(--border-color)'
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div style={{ width: '60px', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '10px', margin: '16px auto', opacity: 0.5 }} />
                            <div style={{ padding: '0 32px 40px 32px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                                    <h2 style={{ fontSize: '28px', fontWeight: '950', margin: 0, letterSpacing: '-1px' }}>Ваш выбор</h2>
                                    <span style={{ fontSize: '14px', fontWeight: '800', background: 'var(--bg-secondary)', padding: '6px 14px', borderRadius: '10px', color: 'var(--text-tertiary)' }}>{cart.length} ПОЗИЦИЙ</span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', maxHeight: '50vh', paddingRight: '4px' }}>
                                    {cart.map((item, idx) => (
                                        <div key={idx} style={{ display: 'flex', gap: '20px', alignItems: 'center', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                                            <img src={item.dish.imageUrl ?? undefined} style={{ width: '64px', height: '64px', borderRadius: '16px', objectFit: 'cover', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                                            <div style={{ flex: 1 }}>
                                                <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', margin: 0, fontWeight: '800' }}>{item.dish.name}</h3>
                                                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '8px' }}>
                                                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center', background: '#FFFFFF', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                                        <button onClick={() => removeFromCart(item.dish.id)} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: 'var(--text-tertiary)' }}><Minus size={16} /></button>
                                                        <span style={{ fontWeight: '900', color: 'var(--text-primary)', fontSize: '16px' }}>{item.quantity}</span>
                                                        <button onClick={() => addToCart(item.dish)} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: 'var(--primary)' }}><Plus size={16} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <p className="price-mono" style={{ fontSize: '18px', color: 'var(--primary)', fontWeight: '900' }}>{item.dish.price * item.quantity} ₽</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ marginTop: '24px' }}>
                                    <p style={{ fontSize: '11px', fontWeight: '900', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '1px' }}>КОММЕНТАРИЙ К ЗАКАЗУ</p>
                                    <textarea
                                        value={orderComment}
                                        onChange={e => setOrderComment(e.target.value)}
                                        placeholder="Напр. без лука, столовые приборы на 3-х..."
                                        style={{ width: '100%', height: '80px', padding: '16px', borderRadius: '18px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', fontSize: '14px', resize: 'none', color: 'var(--text-primary)', fontWeight: '600' }}
                                    />
                                </div>

                                <div style={{ marginTop: '32px', paddingTop: '32px', borderTop: '2px dashed var(--border-color)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                        <span style={{ color: 'var(--text-tertiary)', fontWeight: '700' }}>Стоимость меню</span>
                                        <span style={{ color: 'var(--text-primary)', fontWeight: '800' }}>{totalPrice} ₽</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
                                        <span style={{ fontSize: '24px', fontWeight: '950', letterSpacing: '-1px' }}>ИТОГО</span>
                                        <span className="price-mono" style={{ fontSize: '28px', color: 'var(--primary)', fontWeight: '950' }}>{totalPrice} ₽</span>
                                    </div>
                                    <button onClick={handleCheckout} className="btn-primary" style={{ width: '100%', height: '68px', fontSize: '18px', borderRadius: '22px', boxShadow: '0 12px 35px rgba(255, 107, 53, 0.35)' }}>
                                        {orderMutation.isPending ? 'ФОРМИРУЕМ ЗАКАЗ...' : 'ПОДТВЕРДИТЬ И ЗАКАЗАТЬ'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* AI Chat Window */}
                {isAiOpen && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 4000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAiOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)' }} />
                        <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            style={{
                                width: '100%', maxWidth: '440px', height: '650px', background: '#FFFFFF',
                                borderRadius: '32px', position: 'relative', zIndex: 4001, overflow: 'hidden',
                                display: 'flex', flexDirection: 'column',
                                boxShadow: '0 40px 100px rgba(0,0,0,0.12)', border: '1px solid var(--border-color)'
                            }}
                        >
                            <header style={{
                                height: '72px', background: 'linear-gradient(135deg, var(--primary) 0%, #FF8A52 100%)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px', color: 'white'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.2)', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <ChefHat size={20} />
                                    </div>
                                    <span style={{ fontWeight: '900', letterSpacing: '0.5px' }}>AI SOMMELIER</span>
                                </div>
                                <button onClick={() => setIsAiOpen(false)} style={{ color: 'white', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '12px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
                            </header>

                            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--bg-base)' }}>
                                {chatMessages.map((m, i) => (
                                    <div key={i} style={{
                                        alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                                        background: m.role === 'user' ? 'var(--primary)' : 'var(--bg-secondary)',
                                        color: m.role === 'user' ? 'white' : 'var(--text-primary)',
                                        padding: '16px 20px',
                                        borderRadius: m.role === 'user' ? '24px 24px 4px 24px' : '24px 24px 24px 4px',
                                        maxWidth: '85%', fontSize: '15px', fontWeight: m.role === 'user' ? '700' : '600',
                                        lineHeight: '1.6',
                                        boxShadow: m.role === 'user' ? '0 10px 25px rgba(255,107,53,0.3)' : '0 4px 15px rgba(0,0,0,0.03)',
                                        border: m.role === 'user' ? 'none' : '1px solid var(--border-color)'
                                    }}>
                                        {m.content}
                                    </div>
                                ))}
                                {isAiTyping && (
                                    <div style={{ alignSelf: 'flex-start', background: 'var(--bg-secondary)', padding: '16px 24px', borderRadius: '24px', display: 'flex', gap: '6px', border: '1px solid var(--border-color)' }}>
                                        {[0.1, 0.3, 0.5].map(d => <motion.div key={d} animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: d }} style={{ width: '8px', height: '8px', background: 'var(--primary)', borderRadius: '50%' }} />)}
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            <div style={{ padding: '24px', borderTop: '1px solid var(--border-color)', background: '#FFFFFF', display: 'flex', gap: '12px' }}>
                                <input
                                    style={{ flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '14px 20px', borderRadius: '18px', fontSize: '15px', fontWeight: '600' }}
                                    placeholder="Напишите ваш вопрос..."
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                                />
                                <button onClick={handleSendMessage} disabled={isAiTyping} className="btn-primary" style={{ width: '52px', height: '52px', padding: 0, borderRadius: '18px', flexShrink: 0 }}><Send size={20} /></button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Status Bottom Sheet */}
                {isStatusModalOpen && activeOrder && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 6000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 20px' }}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsStatusModalOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)' }} />
                        <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25 }}
                            style={{
                                width: '100%', maxWidth: '540px', background: '#FFFFFF', borderRadius: '40px 40px 0 0',
                                padding: '48px 32px', textAlign: 'center', position: 'relative', zIndex: 6001,
                                boxShadow: '0 -20px 80px rgba(0,0,0,0.1)', border: '1px solid var(--border-color)'
                            }}
                        >
                            <div style={{ background: 'var(--success)', width: '96px', height: '96px', borderRadius: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px', color: 'white', fontSize: '40px', boxShadow: '0 15px 35px rgba(74,222,128,0.3)' }}>✓</div>
                            <h1 style={{ marginBottom: '12px', fontSize: '36px', fontWeight: '950', letterSpacing: '-1.5px' }}>Заказ принят!</h1>
                            <p className="price-mono" style={{ fontSize: '20px', marginBottom: '40px', color: 'var(--text-tertiary)' }}>#{activeOrder.id.slice(0, 8).toUpperCase()}</p>

                            <div style={{ background: 'var(--bg-secondary)', borderRadius: '24px', padding: '32px', textAlign: 'left', marginBottom: '40px', border: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                    <span style={{ color: 'var(--text-tertiary)', fontWeight: '700' }}>Ваш стол</span>
                                    <span style={{ color: 'var(--text-primary)', fontWeight: '900', fontSize: '18px' }}>№{tableNumber}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-tertiary)', fontWeight: '700' }}>К оплате</span>
                                    <span className="price-mono" style={{ fontSize: '22px', color: 'var(--primary)', fontWeight: '950' }}>{activeOrder.totalPrice} ₽</span>
                                </div>
                            </div>
                            <button onClick={() => setIsStatusModalOpen(false)} className="btn-primary" style={{ width: '100%', height: '64px', fontSize: '18px', borderRadius: '20px' }}>ВЕРНУТЬСЯ В МЕНЮ</button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Employee Access Footer Pin */}
            <footer style={{ marginTop: '80px', padding: '40px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', opacity: 0.6 }}>
                <p style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '2px', color: 'var(--text-tertiary)', margin: 0 }}>LIQUID SERVICE V3.0</p>
                <button
                    onClick={() => navigate('/login')}
                    style={{
                        background: 'none', border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)', padding: '12px 24px', borderRadius: '14px',
                        fontSize: '11px', fontWeight: '900', letterSpacing: '1px',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                >
                    <User size={14} /> ЛОГИН ДЛЯ ПЕРСОНАЛА
                </button>
            </footer>
        </div>
    );
};

export default CustomerMenu;
