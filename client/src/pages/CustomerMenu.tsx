import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { menuService, orderService, callService } from '../api';
import { ShoppingBag, Send, X, Bell, Flame, Wind, Zap, CheckCircle, Clock, XCircle, Archive, Trash2, GripVertical, Sparkles, User, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';

const ActionButton = ({ icon, label, onClick, active }: any) => (
    <button
        onClick={onClick}
        disabled={active}
        style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
            color: active ? 'var(--text-tertiary)' : 'var(--text-primary)',
            padding: '10px 4px', borderRadius: '16px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
            cursor: 'pointer', transition: 'all 0.2s', width: '100%',
            opacity: active ? 0.6 : 1
        }}
    >
        <div style={{ color: active ? 'inherit' : 'var(--primary)' }}>{icon}</div>
        <span style={{ fontSize: '9px', fontWeight: '900', letterSpacing: '0.5px' }}>{label}</span>
    </button>
);

const CustomerMenu = () => {
    const navigate = useNavigate();
    const [isAiOpen, setIsAiOpen] = useState(false);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [tableNumber] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const table = parseInt(params.get('table') || '1');
        return (table >= 0 && table <= 100) ? String(table) : '1';
    });
    const [isCalling, setIsCalling] = useState(false);
    const [callSuccess, setCallSuccess] = useState(false);
    const [callMessage, setCallMessage] = useState('Мастер скоро подойдет! 💨');

    // Hookah Constructor State
    const [hookahStrength, setHookahStrength] = useState<number>(5);
    const [selectedTobacco, setSelectedTobacco] = useState<any>(null);
    const [selectedLiquid, setSelectedLiquid] = useState<any>(null);

    const statusMap: Record<string, { label: string, color: string, icon: any }> = {
        PENDING: { label: 'ОЖИДАНИЕ', color: '#8E8E93', icon: <Clock size={18} /> },
        ACCEPTED: { label: 'ГОТОВИТСЯ', color: '#A855F7', icon: <Wind size={18} /> },
        READY: { label: 'ГОТОВО', color: '#4ADE80', icon: <CheckCircle size={18} /> },
        CANCELLED: { label: 'ОТМЕНЕНО', color: '#FF5757', icon: <XCircle size={18} /> },
        ARCHIVED: { label: 'АРХИВ', color: 'var(--text-tertiary)', icon: <Archive size={18} /> },
    };

    const [activeOrderId, setActiveOrderId] = useState<string | null>(localStorage.getItem('activeOrderId'));

    const { data: dishes, isLoading } = useQuery({
        queryKey: ['menu'],
        queryFn: menuService.getMenu
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
        mutationFn: (type: string) => callService.createCall(tableNumber, type),
        onSuccess: () => {
            setCallSuccess(true);
            setIsCalling(false);
            setTimeout(() => setCallSuccess(false), 5000);
        },
        onError: () => {
            alert('Ошибка при вызове');
            setIsCalling(false);
        }
    });

    const handleCallAction = (type: string, message: string) => {
        if (isCalling) return;
        setIsCalling(true);
        setCallMessage(message);
        callMutation.mutate(type);
    };

    const handleCheckout = () => {
        if (cart.length === 0) return;

        // Merge all item descriptions into a single comment for the Master
        const mergedComments = cart.map(item => `- ${item.dish.name}: ${item.dish.description}`).join('\n');

        orderMutation.mutate({
            tableNumber,
            totalPrice: totalPrice,
            items: (cart as any[]).map((item: any) => ({
                dishId: item.dish.id,
                quantity: item.quantity,
                price: item.dish.price
            })),
            comments: mergedComments
        });
    };

    // AI Chat Bot
    const [chatMessages, setChatMessages] = useState<{ role: string, content: string }[]>([
        { role: 'assistant', content: 'Привет! Я ваш ИИ-мастер. Помогу выбрать идеальный табак и крепость под ваше настроение. Что предпочитаете?' }
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
                else errorText = `Ошибка ${status}: ${error.response.data?.error || 'Что-то пошло не так'}. ⚠️`;
            } else if (error.request) {
                errorText = "Сервер не отвечает. Возможно, бэкенд на Railway спит или упал. 💀";
            }
            setChatMessages([...newMessages, { role: 'assistant', content: errorText }]);
        } finally {
            setIsAiTyping(false);
        }
    };

    if (isLoading) return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '32px', background: 'var(--bg-base)' }}>
            <div className="status-indicator" style={{ width: '40px', height: '40px' }} />
            <p style={{ fontWeight: '700', letterSpacing: '2px', color: 'var(--primary)', fontSize: '12px' }}>LOADING EXPERIENCE...</p>
        </div>
    );

    return (
        <div style={{ width: '100%', paddingBottom: '140px', minHeight: '100vh', position: 'relative', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>

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
                            background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '20px 24px',
                            borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '16px',
                            boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
                            border: '1px solid var(--border-color)',
                            position: 'relative', overflow: 'hidden'
                        }}>
                            <div style={{ padding: '8px', background: 'var(--primary)', borderRadius: '10px' }}>
                                <Bell size={16} fill="white" />
                            </div>
                            <span style={{ fontSize: '14px', fontWeight: '700' }}>{callMessage}</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <header className="glass" style={{
                position: 'sticky', top: 0, zIndex: 1000,
                paddingTop: 'calc(env(safe-area-inset-top, 0px))',
                minHeight: 'calc(56px + env(safe-area-inset-top, 0px))',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                paddingLeft: 'max(16px, env(safe-area-inset-left))',
                paddingRight: 'max(16px, env(safe-area-inset-right))',
                paddingBottom: '8px', borderBottom: '1px solid var(--border-color)'
            }}>
                <div style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '-0.5px' }}>
                    HOOKAH<span style={{ color: 'var(--primary)' }}>LOUNGE</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                </div>
            </header>

            {/* Quick Actions Bar */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px',
                padding: '12px 16px', background: 'rgba(10, 10, 11, 0.7)',
                position: 'sticky', top: 'calc(56px + env(safe-area-inset-top, 0px))', zIndex: 998,
                borderBottom: '1px solid var(--border-color)', backdropFilter: 'blur(20px)'
            }}>
                <ActionButton icon={<Sparkles size={18} />} label="МАСТЕР" onClick={() => setIsAiOpen(true)} />
                <ActionButton icon={<Flame size={18} />} label="УГЛИ" onClick={() => handleCallAction('COALS', 'Угли уже в пути! 🔥')} active={isCalling} />
                <ActionButton icon={<GripVertical size={18} />} label="ТАБАК" onClick={() => handleCallAction('TOBACCO', 'Сейчас заменим табак! 🍃')} active={isCalling} />
                <ActionButton icon={<Zap size={18} />} label="КАЛЬЯН" onClick={() => handleCallAction('HOOKAH_CHANGE', 'Готовим новый кальян! 🌬️')} active={isCalling} />
            </div>

            {/* Floating AI Consultant Widget */}
            <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsAiOpen(true)}
                style={{
                    position: 'fixed', bottom: '100px', right: '20px', zIndex: 2000,
                    width: '64px', height: '64px', borderRadius: '32px',
                    background: 'var(--primary)', color: 'white', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 12px 32px rgba(168, 85, 247, 0.4)', cursor: 'pointer'
                }}
            >
                <Sparkles size={30} />
            </motion.button>

            {/* Active Order Banner */}
            <AnimatePresence>
                {activeOrderId && activeOrder && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        onClick={() => setIsStatusModalOpen(true)}
                        className="glass"
                        style={{
                            margin: '12px 16px', padding: '16px 20px', borderRadius: '20px',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            cursor: 'pointer', border: '1px solid var(--border-color)',
                            boxShadow: '0 8px 30px rgba(0,0,0,0.2)', background: 'var(--bg-secondary)'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ color: statusMap[activeOrder.status]?.color || '#8E8E93' }}>
                                {statusMap[activeOrder.status]?.icon || <Clock size={18} />}
                            </div>
                            <div>
                                <div style={{ fontSize: '11px', fontWeight: '900', opacity: 0.5, letterSpacing: '1px' }}>ВАШ ЗАКАЗ</div>
                                <div style={{ fontSize: '15px', fontWeight: '900', color: statusMap[activeOrder.status]?.color }}>
                                    {statusMap[activeOrder.status]?.label || 'ОБРАБОТКА'}
                                </div>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '10px', fontWeight: '800', opacity: 0.4 }}>ID: {activeOrder.id.slice(0, 5).toUpperCase()}</div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Content Area */}
            <main style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

                {/* Hookah Constructor Section */}
                <section className="card" style={{ padding: '24px', background: 'var(--bg-secondary)', borderRadius: '32px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <div style={{ background: 'var(--primary)', padding: '10px', borderRadius: '14px', color: 'white' }}>
                            <Wind size={20} />
                        </div>
                        <h2 style={{ fontSize: '20px', margin: 0, fontWeight: '900' }}>КОНСТРУКТОР</h2>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* 1. Strength Selector */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '900', color: 'var(--text-tertiary)' }}>КРЕПОСТЬ: {hookahStrength}/10</span>
                                <span style={{ background: 'var(--primary-bg-alpha)', color: 'var(--primary)', padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '900' }}>{hookahStrength < 4 ? 'ЛЕГКИЙ' : hookahStrength < 8 ? 'СРЕДНИЙ' : 'КРЕПКИЙ'}</span>
                            </div>
                            <input
                                type="range" min="1" max="10" step="1" value={hookahStrength}
                                onChange={(e) => setHookahStrength(parseInt(e.target.value))}
                                style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--primary)' }}
                            />
                        </div>

                        {/* 2. Tobacco Selector */}
                        <div>
                            <span style={{ fontSize: '11px', fontWeight: '900', color: 'var(--text-tertiary)', display: 'block', marginBottom: '12px' }}>ТАБАК</span>
                            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'none' }}>
                                {dishes?.filter(d => d.category === 'Табак').map((t: any) => (
                                    <button
                                        key={t.id} onClick={() => setSelectedTobacco(t)}
                                        style={{
                                            padding: '10px 16px', borderRadius: '12px', border: '1px solid',
                                            borderColor: selectedTobacco?.id === t.id ? 'var(--primary)' : 'var(--border-color)',
                                            background: selectedTobacco?.id === t.id ? 'var(--primary-bg-alpha)' : 'var(--bg-tertiary)',
                                            color: selectedTobacco?.id === t.id ? 'var(--primary)' : 'var(--text-primary)',
                                            fontSize: '13px', fontWeight: '700', whiteSpace: 'nowrap'
                                        }}
                                    >
                                        {t.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 3. Liquid Selector */}
                        <div>
                            <span style={{ fontSize: '11px', fontWeight: '900', color: 'var(--text-tertiary)', display: 'block', marginBottom: '12px' }}>ЖИДКОСТЬ В КОЛБУ</span>
                            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'none' }}>
                                {dishes?.filter(d => d.category === 'Жидкость').map((l: any) => (
                                    <button
                                        key={l.id} onClick={() => setSelectedLiquid(l)}
                                        style={{
                                            padding: '10px 16px', borderRadius: '12px', border: '1px solid',
                                            borderColor: selectedLiquid?.id === l.id ? 'var(--primary)' : 'var(--border-color)',
                                            background: selectedLiquid?.id === l.id ? 'var(--primary-bg-alpha)' : 'var(--bg-tertiary)',
                                            color: selectedLiquid?.id === l.id ? 'var(--primary)' : 'var(--text-primary)',
                                            fontSize: '13px', fontWeight: '700', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px'
                                        }}
                                    >
                                        <Package size={14} /> {l.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            disabled={!selectedTobacco || !selectedLiquid}
                            onClick={() => {
                                addToCart({
                                    ...selectedTobacco,
                                    id: selectedTobacco.id, // Ensure real ID is used
                                    name: `Hookah: ${selectedTobacco.name}`,
                                    price: selectedTobacco.price + (selectedLiquid?.price || 0),
                                    description: `Крепость: ${hookahStrength}/10, Наполнение: ${selectedLiquid.name}`,
                                });
                                setSelectedTobacco(null);
                                setSelectedLiquid(null);
                                setIsCartOpen(true); // Auto-open cart
                            }}
                            className="btn-primary"
                            style={{ width: '100%', height: '56px', borderRadius: '16px', marginTop: '12px' }}
                        >
                            ДОБАВИТЬ В КОРЗИНУ ({(selectedTobacco?.price || 0) + (selectedLiquid?.price || 0)} ₽)
                        </button>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer style={{ marginTop: '40px', padding: '40px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', opacity: 0.6 }}>
                <p style={{ fontSize: '10px', fontWeight: '800', letterSpacing: '2px', color: 'var(--text-tertiary)' }}>HOOKAH LOUNGE V1.0</p>
                <button
                    onClick={() => navigate('/login')}
                    style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 20px', borderRadius: '12px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <User size={14} /> STAFF ACCESS
                </button>
            </footer>

            {/* Cart Modal */}
            <AnimatePresence>
                {isCartOpen && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCartOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }} />
                        <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25 }}
                            style={{ width: '100%', maxWidth: '640px', background: 'var(--bg-base)', borderRadius: '32px 32px 0 0', position: 'relative', zIndex: 3001, maxHeight: '90vh', overflowY: 'auto', padding: '32px', border: '1px solid var(--border-color)' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <h2 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '24px' }}>Ваш выбор</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                                {cart.map((item, idx) => (
                                    <div key={idx} style={{ display: 'flex', gap: '16px', alignItems: 'center', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
                                        <div style={{ flex: 1 }}>
                                            <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0 }}>{item.dish.name}</h3>
                                            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>{item.quantity} x {item.dish.price} ₽</p>
                                        </div>
                                        <button onClick={() => removeFromCart(item.dish.id)} style={{ padding: '8px', background: 'none', border: 'none', color: 'var(--error)' }}><Trash2 size={18} /></button>
                                    </div>
                                ))}
                            </div>
                            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                                    <span style={{ fontSize: '20px', fontWeight: '900' }}>ИТОГО</span>
                                    <span style={{ fontSize: '20px', fontWeight: '900', color: 'var(--primary)' }}>{totalPrice} ₽</span>
                                </div>
                                <button onClick={handleCheckout} className="btn-primary" style={{ width: '100%', height: '60px', borderRadius: '16px' }}>
                                    {orderMutation.isPending ? 'ОФОРМЛЯЕМ...' : 'ЗАКАЗАТЬ'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* AI Modal */}
            <AnimatePresence>
                {isAiOpen && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 4000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAiOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }} />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            style={{
                                width: '100%', maxWidth: '440px', maxHeight: '80vh', minHeight: '400px',
                                background: 'var(--bg-secondary)', borderRadius: '32px', overflow: 'hidden',
                                display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)',
                                position: 'relative', zIndex: 4005, boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
                            }}
                        >
                            <header style={{ padding: '20px 24px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Sparkles size={20} color="var(--primary)" />
                                    <span style={{ fontWeight: '900', fontSize: '14px' }}>ИИ-МАСТЕР</span>
                                </div>
                                <button onClick={() => setIsAiOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)' }}><X size={20} /></button>
                            </header>
                            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {chatMessages.map((m, i) => (
                                    <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', background: m.role === 'user' ? 'var(--primary)' : 'var(--bg-tertiary)', color: m.role === 'user' ? 'white' : 'var(--text-primary)', padding: '12px 16px', borderRadius: '16px', maxWidth: '85%', fontSize: '14px', fontWeight: '600' }}>{m.content}</div>
                                ))}
                                {isAiTyping && <div style={{ alignSelf: 'flex-start', background: 'var(--bg-tertiary)', padding: '12px 16px', borderRadius: '16px', fontSize: '14px' }}>Печатает...</div>}
                                <div ref={chatEndRef} />
                            </div>
                            <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px' }}>
                                <input style={{ flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '10px 16px', color: 'var(--text-primary)' }} placeholder="Ваш вопрос..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSendMessage()} />
                                <button onClick={handleSendMessage} className="btn-primary" style={{ width: '44px', height: '44px', padding: 0, borderRadius: '12px' }}><Send size={18} /></button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Status Modal */}
            <AnimatePresence>
                {isStatusModalOpen && activeOrder && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsStatusModalOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }} />
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-secondary)', borderRadius: '32px', padding: '32px', textAlign: 'center', position: 'relative', zIndex: 6001, border: '1px solid var(--border-color)' }}
                        >
                            <div style={{ background: 'var(--success)', width: '64px', height: '64px', borderRadius: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: 'white' }}><CheckCircle size={32} /></div>
                            <h2 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '8px' }}>Заказ №{activeOrder.id.slice(0, 5).toUpperCase()}</h2>
                            <p style={{ color: 'var(--text-tertiary)', marginBottom: '32px' }}>Статус: {statusMap[activeOrder.status]?.label}</p>
                            <button onClick={() => setIsStatusModalOpen(false)} className="btn-primary" style={{ width: '100%', height: '52px', borderRadius: '14px' }}>ПОНЯТНО</button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CustomerMenu;
