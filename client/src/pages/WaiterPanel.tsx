import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orderService, callService } from '../api';
import { CheckCircle, Clock, Wind, XCircle, Archive, Layout, Bell, Package, BellRing } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PurgeTimer = ({ startTime }: { startTime: string }) => {
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        const calculateTimeLeft = () => {
            const start = new Date(startTime).getTime();
            const now = new Date().getTime();
            const expiration = start + (20 * 60 * 1000); // 20 minutes
            const remaining = Math.max(0, Math.floor((expiration - now) / 1000));
            setTimeLeft(remaining);
        };

        calculateTimeLeft();
        const interval = setInterval(calculateTimeLeft, 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    if (timeLeft <= 0) return null;

    return (
        <div style={{
            background: 'var(--primary)',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            fontWeight: '900',
            fontSize: '14px',
            boxShadow: '0 8px 25px rgba(168, 85, 247, 0.4)',
            marginBottom: '20px'
        }}>
            <BellRing size={18} />
            ДО ПРОДУВКИ: {minutes}:{seconds < 10 ? `0${seconds}` : seconds} МИН
        </div>
    );
};

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
                    {activeOrders?.map((order: any) => {
                        // Extract hookahs from structured comments
                        const hookahLines = (order.comments || '').split('\n').filter((l: string) => l.startsWith('[HOOKAH]'));
                        const hookahs = hookahLines.map((line: string) => {
                            const details = line.replace('[HOOKAH] ', '');
                            const liquid = details.match(/Наполнение: (.*?)(,|$)/)?.[1] || 'Вода';
                            const tobacco = details.match(/Табак: (.*?)(,|$)/)?.[1] || 'Неизвестно';
                            const strength = details.match(/Крепость: (.*?)\/10/)?.[1] || '?';
                            return { liquid, tobacco, strength };
                        });

                        // Filter other products from Menu category
                        const menuProducts = order.items.filter((it: any) => it.dish?.category === 'Меню');

                        // Extract user note
                        const noteMatch = (order.comments || '').match(/ЗАМЕТКА: (.*)(\n|$)/);
                        const userNote = noteMatch?.[1]?.trim();

                        return (
                            <motion.div
                                key={order.id}
                                layout
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                className="card"
                                style={{
                                    padding: '24px',
                                    display: 'flex', flexDirection: 'column',
                                    borderTop: `6px solid ${statusMap[order.status]?.color || 'var(--border-color)'}`,
                                    position: 'relative',
                                    height: 'fit-content'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', alignItems: 'center' }}>
                                    <h2 style={{ fontSize: '32px', fontWeight: '950', margin: 0, letterSpacing: '-1.5px' }}>Стол {order.tableNumber}</h2>
                                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: '800', opacity: 0.6 }}>
                                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>

                                {/* Hookah Section - FIRST */}
                                {hookahs.length > 0 && (
                                    <div style={{ marginBottom: '24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--primary)' }}>
                                            <Wind size={18} />
                                            <span style={{ fontSize: '12px', fontWeight: '900', letterSpacing: '1px' }}>СОСТАВ КАЛЬЯНА:</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {hookahs.map((h: any, idx: number) => {
                                                const matchedItem = order.items.find((it: any) => it.dish?.name === `Hookah: ${h.tobacco}`);
                                                return (
                                                    <div key={idx} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px', background: 'rgba(168, 85, 247, 0.05)', borderRadius: '16px', border: '1px solid rgba(168, 85, 247, 0.1)', alignItems: 'center' }}>
                                                        <div style={{ background: 'var(--bg-tertiary)', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '13px', fontWeight: '800' }}>{h.liquid}</div>
                                                        <div style={{ background: 'var(--bg-tertiary)', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '13px', fontWeight: '800' }}>{h.tobacco}</div>
                                                        <div style={{ background: 'var(--bg-tertiary)', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '13px', fontWeight: '800' }}>Крепость: {h.strength}/10</div>
                                                        {matchedItem && <div style={{ marginLeft: 'auto', color: 'var(--primary)', fontWeight: '950', fontSize: '15px' }}>{matchedItem.price} ₸</div>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Other Products Section - SECOND */}
                                {menuProducts.length > 0 && (
                                    <div style={{ marginBottom: '24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--text-secondary)' }}>
                                            <Package size={18} />
                                            <span style={{ fontSize: '12px', fontWeight: '900', letterSpacing: '1px' }}>ПРОЧИЕ ТОВАРЫ:</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {menuProducts.map((it: any, idx: number) => (
                                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-tertiary)', padding: '12px 16px', borderRadius: '14px', border: '1px solid var(--border-color)', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                        <span style={{ fontWeight: '800' }}>{it.dish?.name || 'Товар'}</span>
                                                        <span style={{ opacity: 0.5, fontWeight: '900', fontSize: '12px' }}>x{it.quantity}</span>
                                                    </div>
                                                    <span style={{ color: 'var(--primary)', fontWeight: '900' }}>{it.price * it.quantity} ₸</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* User Comment */}
                                {userNote && (
                                    <div style={{ background: 'rgba(255, 107, 53, 0.05)', padding: '16px 20px', borderRadius: '20px', marginBottom: '24px', border: '1px solid rgba(255, 107, 53, 0.1)' }}>
                                        <p style={{ margin: 0, fontSize: '10px', fontWeight: '900', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>КОММЕНТАРИЙ:</p>
                                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: '1.5' }}>"{userNote}"</p>
                                    </div>
                                )}

                                {/* Total Price - ADDED */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', padding: '20px 4px 0 4px', borderTop: '1px solid var(--border-color)' }}>
                                    <span style={{ fontSize: '14px', fontWeight: '900', opacity: 0.5 }}>ИТОГО К ОПЛАТЕ:</span>
                                    <span style={{ fontSize: '26px', fontWeight: '950', color: 'var(--primary)' }}>{order.totalPrice} ₸</span>
                                </div>

                                {/* Purge Timer */}
                                {order.status === 'READY' && <PurgeTimer startTime={order.updatedAt} />}

                                {/* Action Buttons */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
                                    {['ACCEPTED', 'READY', 'CANCELLED'].map(s => (
                                        <button
                                            key={s}
                                            onClick={() => statusMutation.mutate({ orderId: order.id, status: s })}
                                            style={{
                                                padding: '12px 6px', borderRadius: '16px', cursor: 'pointer',
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                                                background: order.status === s ? statusMap[s].color : 'var(--bg-secondary)',
                                                border: 'none',
                                                color: order.status === s ? 'white' : 'var(--text-tertiary)',
                                                transition: 'all 0.2s',
                                                fontWeight: '900', fontSize: '10px'
                                            }}
                                        >
                                            <span style={{ opacity: 0.8 }}>{statusMap[s].icon}</span>
                                            {statusMap[s].label}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={() => statusMutation.mutate({ orderId: order.id, status: 'ARCHIVED' })}
                                    style={{
                                        width: '100%', height: '60px', borderRadius: '18px',
                                        background: 'var(--success)', color: 'white', border: 'none',
                                        fontWeight: '950', fontSize: '14px', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', gap: '10px',
                                        cursor: 'pointer', boxShadow: '0 8px 30px rgba(16, 185, 129, 0.25)'
                                    }}
                                >
                                    <Archive size={20} /> ОПЛАЧЕНО И В АРХИВ
                                </button>
                            </motion.div>
                        );
                    })}
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
