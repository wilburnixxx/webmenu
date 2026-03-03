import { useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orderService, menuService, callService } from '../api';
import { CheckCircle, Clock, Wind, XCircle, Archive, Layout, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const statusMap: Record<string, { label: string, color: string, icon: any }> = {
    ACCEPTED: { label: 'ГОТОВИТСЯ', color: '#A855F7', icon: <Wind size={18} /> },
    READY: { label: 'ГОТОВО', color: '#4ADE80', icon: <CheckCircle size={18} /> },
    CANCELLED: { label: 'ОТМЕНЕНО', color: '#FF5757', icon: <XCircle size={18} /> },
    ARCHIVED: { label: 'АРХИВ', color: 'var(--text-tertiary)', icon: <Archive size={18} /> },
};

const WaiterPanel = () => {
    const queryClient = useQueryClient();
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const lastCallCount = useRef(0);

    const { data: allOrders, isLoading } = useQuery({
        queryKey: ['orders'],
        queryFn: orderService.getOrders,
        refetchInterval: 5000,
    });

    const { data: dishes } = useQuery({
        queryKey: ['menu'],
        queryFn: menuService.getMenu
    });

    const { data: activeCalls } = useQuery({
        queryKey: ['calls'],
        queryFn: callService.getCalls,
        refetchInterval: 5000,
        //@ts-ignore
        onSuccess: (data: any[]) => {
            if (data.length > lastCallCount.current) {
                audioRef.current?.play().catch(() => { });
            }
            lastCallCount.current = data.length;
        }
    });

    // Дополнительный эффект для звука (т.к. React Query v5+ изменил onSuccess)
    const callsLength = (activeCalls as any[])?.length || 0;
    if (callsLength > lastCallCount.current) {
        audioRef.current?.play().catch(() => { });
        lastCallCount.current = callsLength;
    }

    const activeOrders = (allOrders as any[])?.filter((o: any) => o.status !== 'ARCHIVED');

    const statusMutation = useMutation({
        mutationFn: ({ orderId, status }: { orderId: string, status: string }) =>
            orderService.updateOrderStatus(orderId, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['orders'] });
        }
    });

    const callCompleteMutation = useMutation({
        mutationFn: (id: string) => callService.completeCall(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['calls'] });
        }
    });

    /* SSE logic partially disabled to prevent errors in production
    useEffect(() => {
        // SSE URL should come from API config, not hardcoded localhost
        const eventSource = new EventSource(`${(orderService as any).getBaseUrl?.() || ''}/api/orders/stream`);
        eventSource.addEventListener('newOrder', () => {
            if (audioRef.current) audioRef.current.play().catch(() => { });
            queryClient.invalidateQueries({ queryKey: ['orders'] });
        });
        return () => eventSource.close();
    }, [queryClient]);
    */

    if (isLoading) return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '20px', background: 'var(--bg-base)' }}>
            <div className="status-indicator" style={{ width: '40px', height: '40px' }} />
            <p style={{ fontWeight: '700', letterSpacing: '0.1em', opacity: 0.5, color: 'var(--text-primary)' }}>ЗАГРУЗКА ЗАКАЗОВ...</p>
        </div>
    );

    return (
        <div style={{ padding: 'clamp(16px, 4vw, 40px)', width: '100%', minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
            <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto" />

            {/* Header (Waiter - Responsive) */}
            <header style={{
                background: 'var(--bg-secondary)', padding: '24px', borderBottom: '1px solid var(--border-color)',
                display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px',
                borderRadius: '24px', boxShadow: '0 8px 30px rgba(0,0,0,0.2)', gap: '24px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{
                        width: '56px', height: '56px', borderRadius: '18px',
                        background: 'linear-gradient(135deg, var(--primary), #7E22CE)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 10px 25px rgba(168, 85, 247, 0.25)'
                    }}>
                        <Layout color="white" size={32} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: '900', margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>ПАНЕЛЬ МАСТЕРА</h1>
                        <p style={{ fontSize: '11px', fontWeight: '800', opacity: 0.5, letterSpacing: '1px', textTransform: 'uppercase' }}>АКТИВНЫХ ЗАКАЗОВ: {activeOrders?.length || 0}</p>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div className="status-indicator" style={{ width: '10px', height: '10px', boxShadow: '0 0 10px var(--primary)' }} />
                </div>
            </header>

            {/* Active Calls Section */}
            {(activeCalls as any[]) && (activeCalls as any[]).length > 0 && (
                <div style={{ marginBottom: '40px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <Bell size={20} color="var(--primary)" fill="var(--primary)" />
                        <h2 style={{ fontSize: '18px', fontWeight: '900', margin: 0 }}>ЗАПРОСЫ ({(activeCalls as any[]).length})</h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                        <AnimatePresence>
                            {(activeCalls as any[]).map((call: any) => (
                                <motion.div
                                    key={call.id}
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.8, opacity: 0 }}
                                    style={{
                                        background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '20px 24px',
                                        borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '16px',
                                        boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
                                        border: '1px solid var(--border-color)',
                                        position: 'relative', overflow: 'hidden'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontSize: '24px', fontWeight: '950', letterSpacing: '-1px' }}>СТОЛ {call.tableNumber}</div>
                                        <div style={{
                                            background: 'rgba(255, 107, 53, 0.15)',
                                            color: 'var(--primary)',
                                            padding: '6px 12px',
                                            borderRadius: '10px',
                                            fontSize: '11px',
                                            fontWeight: '900',
                                            textTransform: 'uppercase',
                                            border: '1px solid rgba(255,107,53,0.2)'
                                        }}>
                                            {call.type === 'MASTER' ? 'Мастер' :
                                                call.type === 'COALS' ? 'Угли' :
                                                    call.type === 'TOBACCO' ? 'Табак' :
                                                        call.type === 'HOOKAH_CHANGE' ? 'Кальян' : call.type}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                                        <button
                                            onClick={() => callCompleteMutation.mutate(call.id)}
                                            style={{
                                                flex: 1, background: 'var(--primary)', border: 'none', color: 'white',
                                                padding: '12px', borderRadius: '14px', fontSize: '13px',
                                                fontWeight: '900', cursor: 'pointer', transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                                            onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                                        >
                                            ПРИНЯТЬ И ВЫПОЛНИТЬ
                                        </button>
                                    </div>

                                    {/* Subtle pulse effect for high priority */}
                                    <motion.div
                                        animate={{ opacity: [0.1, 0.2, 0.1] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, pointerEvents: 'none', background: 'var(--primary)' }}
                                    />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
            )}

            {/* Main Order Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'clamp(16px, 3vw, 32px)' }}>
                <AnimatePresence>
                    {activeOrders?.map((order: any) => (
                        <motion.div
                            key={order.id}
                            layout
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="card"
                            style={{
                                padding: 'clamp(20px, 3vw, 32px)',
                                display: 'flex', flexDirection: 'column',
                                borderTop: `6px solid ${statusMap[order.status]?.color || 'var(--border-color)'}`,
                                position: 'relative'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px', alignItems: 'flex-start' }}>
                                <div>
                                    <h2 style={{ fontSize: '28px', fontWeight: '950', margin: 0, letterSpacing: '-1px' }}>Стол {order.tableNumber}</h2>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '800', opacity: 0.4, letterSpacing: '1px' }}>
                                        <div className="status-indicator" style={{ width: '6px', height: '6px' }} />
                                        <span>#{order.id.slice(0, 8).toUpperCase()}</span>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ background: 'var(--bg-secondary)', padding: '10px 16px', borderRadius: '14px', fontSize: '14px', fontWeight: '900', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
                                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>

                            <div style={{ flex: 1, marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {order.items.map((item: any, idx: number) => {
                                    const dishName = (dishes as any[])?.find(d => d.id === item.dishId)?.name || ` Dish ${item.dishId.slice(0, 4)}`;
                                    return (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                                                <div style={{ background: 'var(--primary)', color: 'white', padding: '6px 12px', borderRadius: '10px', fontSize: '13px', fontWeight: '950', boxShadow: '0 4px 12px rgba(255,107,53,0.2)' }}>{item.quantity}</div>
                                                <span style={{ fontWeight: '800', fontSize: '15px' }}>{dishName}</span>
                                            </div>
                                            <span className="price-mono" style={{ opacity: 0.5, fontSize: '14px' }}>{item.price * item.quantity} ₸</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {order.comments && (
                                <div style={{ background: 'rgba(255, 107, 53, 0.08)', padding: '16px 20px', borderRadius: '18px', marginBottom: '32px', border: '1px solid rgba(255, 107, 53, 0.1)' }}>
                                    <p style={{ margin: 0, fontSize: '11px', fontWeight: '900', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>КОММЕНТАРИЙ ГОСТЯ:</p>
                                    <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: '1.5' }}>"{order.comments}"</p>
                                </div>
                            )}

                            <div style={{ padding: '24px 0', borderTop: '1px solid var(--border-color)', marginBottom: '32px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '12px', fontWeight: '950', color: 'var(--text-tertiary)', letterSpacing: '1px' }}>ИТОГО К ОПЛАТЕ</span>
                                    <span className="price-mono" style={{ fontSize: '28px', color: 'var(--primary)', fontWeight: '950' }}>{order.totalPrice} ₸</span>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                                {Object.entries(statusMap).filter(([s]) => s !== 'ARCHIVED').map(([status, config]) => (
                                    <button
                                        key={status}
                                        onClick={() => statusMutation.mutate({ orderId: order.id, status })}
                                        style={{
                                            padding: '16px 8px', borderRadius: '18px', cursor: 'pointer',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                                            background: order.status === status ? config.color : 'var(--bg-secondary)',
                                            border: 'none',
                                            color: order.status === status ? 'white' : 'var(--text-secondary)',
                                            boxShadow: order.status === status ? `0 8px 20px ${config.color}30` : 'none',
                                            transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)'
                                        }}
                                    >
                                        <span style={{ opacity: 0.9 }}>{config.icon}</span>
                                        <span style={{ fontSize: '11px', fontWeight: '900', letterSpacing: '0.5px' }}>{config.label}</span>
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => statusMutation.mutate({ orderId: order.id, status: 'ARCHIVED' })}
                                className="btn-primary"
                                style={{ width: '100%', height: '72px', fontSize: '15px', fontWeight: '950', background: 'var(--success)', color: 'white', border: 'none', borderRadius: '24px', boxShadow: '0 12px 35px rgba(74,222,128,0.25)', letterSpacing: '0.5px' }}
                            >
                                <Archive size={22} style={{ marginRight: '12px' }} /> ОПЛАЧЕНО И В АРХИВ
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {
                activeOrders?.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '160px 40px', color: 'var(--text-tertiary)' }}>
                        <div className="card" style={{ width: '140px', height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 40px', borderRadius: '48px', opacity: 0.5 }}>
                            <Clock size={48} />
                        </div>
                        <h3 style={{ fontSize: '32px', fontWeight: '950', color: 'var(--text-primary)', marginBottom: '12px', letterSpacing: '-1px' }}>Затишье.</h3>
                        <p style={{ fontWeight: '600' }}>Все гости довольны. Наслаждайтесь моментом.</p>
                    </div>
                )
            }
        </div >
    );
};

export default WaiterPanel;
