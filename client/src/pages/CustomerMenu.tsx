import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { menuService, orderService, callService } from '../api';
import { ShoppingBag, Send, X, Bell, Flame, Wind, Zap, CheckCircle, Clock, XCircle, Archive, Trash2, GripVertical, Sparkles, User, Package, Info, ChevronDown } from 'lucide-react';
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
    const [isTobaccoModalOpen, setIsTobaccoModalOpen] = useState(false);

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
        onError: (err: any) => {
            console.error('Order Error:', err);
            const msg = err.response?.data?.error || 'Ошибка при отправке заказа';
            alert(`Ошибка: ${msg}`);
        }
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

    const [orderComment, setOrderComment] = useState('');
    const { data: promos } = useQuery({
        queryKey: ['promos'],
        queryFn: menuService.getPromos
    });

    const handleCheckout = () => {
        if (cart.length === 0) return;

        // Structured hookah info for the master
        const hookahConfigs = cart
            .filter(item => item.dish.name.startsWith('Hookah: '))
            .map(item => {
                const tobacco = item.dish.name.replace('Hookah: ', '');
                return `[HOOKAH] ${item.dish.description}, Табак: ${tobacco}`;
            })
            .join('\n');

        const finalComments = [
            orderComment.trim() ? `ЗАМЕТКА: ${orderComment}` : '',
            hookahConfigs
        ].filter(Boolean).join('\n\n');

        orderMutation.mutate({
            tableNumber,
            totalPrice: totalPrice,
            items: (cart as any[]).map((item: any) => ({
                dishId: item.dish.id,
                quantity: item.quantity,
                price: item.dish.price
            })),
            comments: finalComments
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
                paddingTop: 'env(safe-area-inset-top, 0px)',
                minHeight: '56px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                paddingLeft: 'max(20px, env(safe-area-inset-left))',
                paddingRight: 'max(20px, env(safe-area-inset-right))',
                paddingBottom: '4px', borderBottom: '1px solid var(--border-color)',
                width: '100%'
            }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <img src="/logo.png" alt="Logo" style={{ height: '26px', width: 'auto', objectFit: 'contain' }} onError={(e) => (e.currentTarget.style.display = 'none')} />
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

            {/* Horizontal Promo Gallery */}
            {promos && promos.length > 0 && (
                <div style={{ padding: '24px 20px 8px', overflowX: 'auto', display: 'flex', gap: '16px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {promos.map((p: any) => (
                        <div key={p.id} style={{
                            minWidth: '280px', height: '160px', borderRadius: '24px',
                            overflow: 'hidden', border: '1px solid var(--border-color)',
                            background: 'var(--bg-secondary)', position: 'relative',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
                        }}>
                            <img src={p.imageUrl} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{
                                position: 'absolute', inset: 0,
                                background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
                                display: 'flex', alignItems: 'flex-end', padding: '16px'
                            }}>
                                <span style={{ color: 'white', fontSize: '15px', fontWeight: '800' }}>
                                    {p.title}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Quick Actions Bar */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px',
                padding: '10px 20px', background: 'rgba(10, 10, 11, 0.85)',
                position: 'sticky', top: '56px', zIndex: 998,
                borderBottom: '1px solid var(--border-color)', backdropFilter: 'blur(20px)',
                width: '100%'
            }}>
                <ActionButton icon={<Bell size={18} />} label="МАСТЕР" onClick={() => handleCallAction('MASTER', 'Мастер скоро подойдет! 💨')} active={isCalling} />
                <ActionButton icon={<Flame size={18} />} label="УГЛИ" onClick={() => handleCallAction('COALS', 'Угли уже в пути! 🔥')} active={isCalling} />
                <ActionButton icon={<GripVertical size={18} />} label="ТАБАК" onClick={() => handleCallAction('TOBACCO', 'Сейчас заменим табак! 🍃')} active={isCalling} />
                <ActionButton icon={<Zap size={18} />} label="КАЛЬЯН" onClick={() => handleCallAction('HOOKAH_CHANGE', 'Готовим новый кальян! 🌬️')} active={isCalling} />
            </div>


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
            <main style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

                <section className="card" style={{ padding: '24px', background: 'var(--bg-secondary)', borderRadius: '32px', border: '1px solid var(--border-color)', boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }}>
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
                                style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--primary)', height: '8px', borderRadius: '4px' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', padding: '0 4px' }}>
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => (
                                    <span key={val} style={{ fontSize: '9px', fontWeight: '950', opacity: hookahStrength === val ? 1 : 0.3, color: hookahStrength === val ? 'var(--primary)' : 'var(--text-tertiary)', transition: 'all 0.2s' }}>{val}</span>
                                ))}
                            </div>
                        </div>

                        {/* 2. Tobacco Selector Button */}
                        <div>
                            <span style={{ fontSize: '11px', fontWeight: '900', color: 'var(--text-tertiary)', display: 'block', marginBottom: '12px' }}>ТАБАК</span>
                            <button
                                onClick={() => setIsTobaccoModalOpen(true)}
                                style={{
                                    width: '100%', height: '56px', borderRadius: '16px',
                                    background: selectedTobacco ? 'var(--primary-bg-alpha)' : 'var(--bg-tertiary)',
                                    border: '1px solid', borderColor: selectedTobacco ? 'var(--primary)' : 'var(--border-color)',
                                    color: selectedTobacco ? 'var(--primary)' : 'var(--text-primary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px',
                                    cursor: 'pointer', transition: 'all 200ms'
                                }}
                            >
                                <span style={{ fontWeight: '800' }}>{selectedTobacco ? selectedTobacco.name : 'Выбрать табак'}</span>
                                <ChevronDown size={18} style={{ opacity: 0.5 }} />
                            </button>
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

                        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                            <button
                                disabled={!selectedTobacco || !selectedLiquid}
                                onClick={() => {
                                    addToCart({
                                        ...selectedTobacco,
                                        id: selectedTobacco.id,
                                        name: `Hookah: ${selectedTobacco.name}`,
                                        price: selectedTobacco.price + (selectedLiquid?.price || 0),
                                        description: `Крепость: ${hookahStrength}/10, Наполнение: ${selectedLiquid.name}`,
                                    });
                                    setSelectedTobacco(null);
                                    setSelectedLiquid(null);
                                    setIsCartOpen(true);
                                }}
                                className="btn-primary"
                                style={{ flex: 7, height: '56px', borderRadius: '16px' }}
                            >
                                ДОБАВИТЬ ({(selectedTobacco?.price || 0) + (selectedLiquid?.price || 0)} ₸)
                            </button>
                            <button
                                onClick={() => setIsAiOpen(true)}
                                style={{
                                    flex: 3, height: '56px', background: 'var(--bg-tertiary)',
                                    border: '1px solid var(--border-color)', borderRadius: '16px',
                                    color: 'var(--primary)', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', gap: '8px', fontSize: '11px', fontWeight: '900',
                                    cursor: 'pointer', transition: 'all 0.2s'
                                }}
                            >
                                <Sparkles size={16} /> ИИ
                            </button>
                        </div>
                    </div>
                </section>

                {/* Other Categories Section */}
                {dishes?.some(d => d.category === 'Меню') && (
                    <section>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <div style={{ background: 'var(--primary)', padding: '8px', borderRadius: '12px', color: 'white' }}>
                                <Package size={18} />
                            </div>
                            <h2 style={{ fontSize: '18px', margin: 0, fontWeight: '900' }}>ДРУГИЕ ТОВАРЫ</h2>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            {dishes?.filter(d => d.category === 'Меню').map((item: any) => (
                                <div key={item.id} style={{ background: 'var(--bg-secondary)', borderRadius: '24px', overflow: 'hidden', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                                    {item.imageUrl && (
                                        <div style={{ width: '100%', height: '120px', overflow: 'hidden' }}>
                                            <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                    )}
                                    <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div style={{ flex: 1 }}>
                                            <h3 style={{ fontSize: '14px', fontWeight: '800', margin: 0 }}>{item.name}</h3>
                                            <p style={{ fontSize: '11px', opacity: 0.6, marginTop: '4px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.description}</p>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: '900', color: 'var(--primary)', fontSize: '14px' }}>{item.price} ₸</span>
                                            <button
                                                onClick={() => {
                                                    addToCart({ ...item, quantity: 1 });
                                                    setIsCartOpen(true);
                                                }}
                                                style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '10px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 10px rgba(168, 85, 247, 0.3)' }}
                                            >
                                                <Zap size={14} fill="white" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Information Block */}
                <section style={{
                    padding: '24px', background: 'var(--bg-tertiary)', borderRadius: '24px',
                    border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
                        <Info size={18} />
                        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '900', letterSpacing: '0.5px' }}>КАК ПРАВИЛЬНО?</h3>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', opacity: 0.8, fontWeight: '500' }}>
                        Для лучшего опыта рекомендуем менять угли каждые 30-40 минут.
                        Если кальян начал горчить — просто нажмите кнопку <b>МАСТЕР</b> в верхнем меню,
                        и мы все исправим за пару минут!
                    </p>
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
                                            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>{item.quantity} x {item.dish.price} ₸</p>
                                        </div>
                                        <button onClick={() => removeFromCart(item.dish.id)} style={{ padding: '8px', background: 'none', border: 'none', color: 'var(--error)' }}><Trash2 size={18} /></button>
                                    </div>
                                ))}
                            </div>
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ fontSize: '11px', fontWeight: '900', opacity: 0.5, display: 'block', marginBottom: '8px', letterSpacing: '1px' }}>КОММЕНТАРИЙ К ЗАКАЗУ</label>
                                <textarea
                                    value={orderComment}
                                    onChange={(e) => setOrderComment(e.target.value)}
                                    placeholder="Напишите ваши пожелания..."
                                    style={{
                                        width: '100%', height: '80px', background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)', borderRadius: '16px',
                                        padding: '16px', color: 'var(--text-primary)', fontSize: '14px',
                                        resize: 'none', outline: 'none'
                                    }}
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                                <span style={{ fontSize: '20px', fontWeight: '900' }}>ИТОГО</span>
                                <span style={{ fontSize: '20px', fontWeight: '900', color: 'var(--primary)' }}>{totalPrice} ₸</span>
                            </div>
                            <button onClick={handleCheckout} className="btn-primary" style={{ width: '100%', height: '60px', borderRadius: '16px' }}>
                                {orderMutation.isPending ? 'ОФОРМЛЯЕМ...' : 'ЗАКАЗАТЬ'}
                            </button>
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
                            style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-secondary)', borderRadius: '32px', padding: '32px', textAlign: 'center', position: 'relative', zIndex: 6001, border: '1px solid var(--border-color)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
                        >
                            <div style={{ background: 'var(--success)', width: '64px', height: '64px', borderRadius: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: 'white', flexShrink: 0 }}><CheckCircle size={32} /></div>
                            <h2 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '8px' }}>Заказ №{activeOrder.id.slice(0, 5).toUpperCase()}</h2>
                            <p style={{ color: 'var(--text-tertiary)', marginBottom: '16px', fontSize: '14px', fontWeight: '800' }}>Статус: <span style={{ color: statusMap[activeOrder.status]?.color || 'var(--primary)' }}>{statusMap[activeOrder.status]?.label}</span></p>

                            <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '20px', padding: '16px', marginBottom: '24px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {(() => {
                                    // Parse hookahs from structured comments
                                    const hookahLines = (activeOrder.comments || '').split('\n').filter((l: string) => l.startsWith('[HOOKAH]'));
                                    const hookahs = hookahLines.map((line: string) => {
                                        const details = line.replace('[HOOKAH] ', '');
                                        const liquid = details.match(/Наполнение: (.*?)(,|$)/)?.[1] || 'Вода';
                                        const taste = details.match(/Табак: (.*?)(,|$)/)?.[1] || 'Неизвестно';
                                        const strength = details.match(/Крепость: (.*?)\/10/)?.[1] || '?';

                                        // Try to find price in items (hookah price is combined tobacco + liquid)
                                        const matchedItem = (activeOrder.items as any[])?.find(it => it.dish?.name === taste);
                                        return { taste, liquid, strength, price: matchedItem?.price || 0 };
                                    });

                                    const menuProducts = (activeOrder.items as any[])?.filter(it => it.dish?.category === 'Меню');

                                    return (
                                        <>
                                            {hookahs.length > 0 && (
                                                <div>
                                                    <p style={{ fontSize: '10px', fontWeight: '900', opacity: 0.5, marginBottom: '8px', letterSpacing: '1px' }}>СОСТАВ КАЛЬЯНА:</p>
                                                    {hookahs.map((h: any, idx: number) => (
                                                        <div key={idx} style={{ marginBottom: '16px' }}>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                                                                <div style={{ background: 'var(--bg-tertiary)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12px', fontWeight: '800' }}>{h.liquid}</div>
                                                                <div style={{ background: 'var(--bg-tertiary)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12px', fontWeight: '800' }}>{h.taste}</div>
                                                                <div style={{ background: 'var(--bg-tertiary)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12px', fontWeight: '800' }}>Крепость: {h.strength}/10</div>
                                                                {h.price > 0 && <div style={{ marginLeft: 'auto', color: 'var(--primary)', fontWeight: '950', fontSize: '14px', alignSelf: 'center' }}>{h.price} ₸</div>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {menuProducts.length > 0 && (
                                                <div>
                                                    <p style={{ fontSize: '10px', fontWeight: '900', opacity: 0.5, marginBottom: '8px', letterSpacing: '1px' }}>ПРОЧИЕ ТОВАРЫ:</p>
                                                    {menuProducts.map((it, idx) => (
                                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                <span style={{ fontSize: '13px', fontWeight: '800' }}>{it.dish?.name || 'Товар'}</span>
                                                                <span style={{ fontSize: '11px', opacity: 0.4, fontWeight: '900' }}>x{it.quantity}</span>
                                                            </div>
                                                            <span style={{ fontSize: '13px', fontWeight: '900', color: 'var(--primary)' }}>{it.price * it.quantity} ₸</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}

                                {/* Total Price Section */}
                                <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '900', opacity: 0.5, letterSpacing: '1px' }}>ИТОГО К ОПЛАТЕ:</span>
                                    <span style={{ fontSize: '20px', fontWeight: '950', color: 'var(--primary)' }}>{activeOrder.totalPrice} ₸</span>
                                </div>
                            </div>

                            <button onClick={() => setIsStatusModalOpen(false)} className="btn-primary" style={{ width: '100%', height: '56px', borderRadius: '16px', flexShrink: 0 }}>ПОНЯТНО</button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Tobacco Selection Pop-up */}
            <AnimatePresence>
                {isTobaccoModalOpen && (
                    <div
                        onClick={() => setIsTobaccoModalOpen(false)}
                        style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'flex-end', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}
                    >
                        <motion.div
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                width: '100%', maxHeight: '90vh', background: 'var(--bg-base)', borderTopLeftRadius: '32px', borderTopRightRadius: '32px',
                                padding: '12px 20px calc(env(safe-area-inset-bottom, 24px) + 20px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px',
                                borderTop: '1px solid var(--border-color)', boxShadow: '0 -10px 40px rgba(0,0,0,0.5)'
                            }}
                        >
                            {/* Pull Handle */}
                            <div style={{ width: '40px', height: '4px', background: 'var(--border-color)', borderRadius: '2px', margin: '0 auto', flexShrink: 0 }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: '-12px', background: 'var(--bg-base)', zIndex: 10, padding: '12px 0' }}>
                                <div>
                                    <h2 style={{ fontSize: '22px', fontWeight: '950', margin: 0, letterSpacing: '-0.5px' }}>ВЫБОР ТАБАКА</h2>
                                    <p style={{ fontSize: '11px', fontWeight: '800', opacity: 0.5, letterSpacing: '1px', marginTop: '2px' }}>КОЛЛЕКЦИЯ ВКУСОВ</p>
                                </div>
                                <button onClick={() => setIsTobaccoModalOpen(false)} style={{ background: 'var(--bg-tertiary)', border: 'none', color: 'var(--text-primary)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '14px' }}>
                                {dishes?.filter(d => d.category === 'Табак').map((t: any) => (
                                    <div
                                        key={t.id}
                                        onClick={() => { setSelectedTobacco(t); setIsTobaccoModalOpen(false); }}
                                        style={{
                                            background: 'var(--bg-secondary)', borderRadius: '24px', overflow: 'hidden', border: '1px solid',
                                            borderColor: selectedTobacco?.id === t.id ? 'var(--primary)' : 'var(--border-color)',
                                            display: 'flex', flexDirection: 'column', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', position: 'relative',
                                            boxShadow: selectedTobacco?.id === t.id ? '0 0 20px var(--primary-bg-alpha)' : 'none'
                                        }}
                                    >
                                        <div style={{ width: '100%', height: '110px', overflow: 'hidden', position: 'relative' }}>
                                            <img src={t.imageUrl} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            {selectedTobacco?.id === t.id && (
                                                <div style={{ position: 'absolute', inset: 0, background: 'var(--primary-bg-alpha)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <CheckCircle size={32} color="white" />
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ padding: '14px' }}>
                                            <h3 style={{ fontSize: '15px', fontWeight: '900', margin: '0 0 4px 0', color: selectedTobacco?.id === t.id ? 'var(--primary)' : 'var(--text-primary)' }}>{t.name}</h3>
                                            <p style={{ fontSize: '11px', opacity: 0.6, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.4', fontWeight: '500' }}>{t.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CustomerMenu;
