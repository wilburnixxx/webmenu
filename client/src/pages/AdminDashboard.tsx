import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { menuService } from '../api';
import {
    Plus, Trash2, DollarSign, Package,
    X, Settings, GripVertical, Sparkles, Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';

const AdminDashboard = () => {
    const queryClient = useQueryClient();
    const [editingDish, setEditingDish] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'dishes' | 'categories' | 'promo' | 'ai' | 'qr' | 'logs'>('dishes');
    const [aiPrompt, setAiPrompt] = useState('');
    const [qrData, setQrData] = useState({ table: '1', seats: '4' });
    const [copied, setCopied] = useState(false);

    // Financial overrides state
    const [isAdjusting, setIsAdjusting] = useState(false);
    const [adjData, setAdjData] = useState<{ metricName: string; value: number | string; note: string }>({ metricName: 'Volume', value: 0, note: '' });

    const [localCats, setLocalCats] = useState<any[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Queries
    const { data: dishes, isLoading: menuLoading } = useQuery({ queryKey: ['admin-menu'], queryFn: menuService.getAdminMenu });
    const { data: logs } = useQuery({ queryKey: ['logs'], queryFn: menuService.getLogs, enabled: activeTab === 'logs', refetchInterval: 5000 });
    const { data: metrics } = useQuery({
        queryKey: ['metrics'],
        queryFn: () => menuService.getMetrics(),
        refetchInterval: 10000
    });
    const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: menuService.getCategories });
    const { data: currentAiInstruction } = useQuery({
        queryKey: ['ai-instructions'],
        queryFn: menuService.getAiInstructions,
        enabled: activeTab === 'ai'
    });

    const { data: promos } = useQuery({
        queryKey: ['promos'],
        queryFn: menuService.getPromos,
        enabled: activeTab === 'promo'
    });

    useEffect(() => {
        if (currentAiInstruction) setAiPrompt(currentAiInstruction.promptText);
    }, [currentAiInstruction]);

    useEffect(() => {
        if (categories) setLocalCats([...categories].sort((a, b) => a.order - b.order));
    }, [categories]);

    // Mutations
    const deleteMutation = useMutation({
        mutationFn: (id: string) => {
            if (window.confirm('Вы уверены, что хотите безвозвратно удалить это блюдо из меню? Это действие нельзя отменить.')) {
                return menuService.deleteDish(id);
            }
            throw new Error('Удаление отменено');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-menu'] });
            queryClient.invalidateQueries({ queryKey: ['metrics'] });
        },
        onError: (err: any) => {
            alert('Ошибка при удалении: ' + (err.response?.data?.error || err.message));
        }
    });


    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            if (editingDish?.id) await menuService.updateDish(editingDish.id, data);
            else await menuService.createDish(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-menu'] });
            queryClient.invalidateQueries({ queryKey: ['metrics'] });
            setIsModalOpen(false);
            setEditingDish(null);
        }
    });

    const adjMutation = useMutation({
        mutationFn: (data: { metricName: string, value: string | number, note: string }) => menuService.createAdjustment(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['metrics'] });
            setIsAdjusting(false);
            setAdjData({ metricName: 'Volume', value: 0, note: '' });
        }
    });

    const aiMutation = useMutation({
        mutationFn: (text: string) => menuService.saveAiInstructions(text),
        onSuccess: () => alert('Шеф успешно обучен! 🧠✨')
    });

    const createCatMutation = useMutation({
        mutationFn: (name: string) => menuService.createCategory(name),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
        }
    });

    const deleteCatMutation = useMutation({
        mutationFn: (id: string) => menuService.deleteCategory(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
        },
        onError: (err: any) => {
            alert(err.response?.data?.error || 'Ошибка при удалении категории');
        }
    });

    const reorderCatMutation = useMutation({
        mutationFn: (newCats: any[]) => {
            const updates = newCats.map((c, i) => ({ id: c.id, order: i }));
            return menuService.reorderCategories(updates);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] })
    });

    const handleReorder = (newOrderedList: any[]) => {
        setLocalCats(newOrderedList);
        reorderCatMutation.mutate(newOrderedList);
    };

    if (menuLoading) return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '20px', background: 'var(--bg-base)' }}>
            <div className="status-indicator" style={{ width: '40px', height: '40px' }} />
            <p style={{ fontWeight: '700', letterSpacing: '0.1em', opacity: 0.5, color: 'var(--text-primary)' }}>ЗАГРУЗКА...</p>
        </div>
    );

    const tabLabels = {
        dishes: 'ПОЗИЦИИ',
        categories: 'КАТЕГОРИИ',
        promo: 'ПРОМО',
        ai: 'ИИ-МАСТЕР',
        qr: 'QR-КОДЫ',
        logs: 'ЖУРНАЛ'
    };

    return (
        <div style={{ padding: 'clamp(16px, 4vw, 40px)', width: '100%', minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
            <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto" />

            {/* Header Section (Responsive) */}
            <header style={{
                background: 'var(--bg-secondary)', padding: '24px', borderBottom: '1px solid var(--border-color)',
                display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px',
                borderRadius: '24px', boxShadow: '0 8px 30px rgba(0,0,0,0.2)', gap: '24px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ background: 'var(--primary)', width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 8px 20px rgba(168, 85, 247, 0.3)' }}>
                        <Settings size={24} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: '900', margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>OnlineMenu ADMIN</h1>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', padding: '6px', borderRadius: '16px', overflowX: 'auto', maxWidth: '100%', scrollbarWidth: 'none' }}>
                    {(['dishes', 'categories', 'promo', 'ai', 'qr', 'logs'] as const).map((tab: string) => (
                        <button key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            style={{
                                padding: '10px 20px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                                fontSize: '13px', fontWeight: '800', whiteSpace: 'nowrap',
                                background: activeTab === tab ? 'var(--primary)' : 'transparent',
                                color: activeTab === tab ? '#FFFFFF' : 'var(--text-tertiary)',
                                boxShadow: activeTab === tab ? '0 4px 12px rgba(168, 85, 247, 0.2)' : 'none',
                                transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                        >
                            {tabLabels[tab as keyof typeof tabLabels]}
                        </button>
                    ))}
                </div>


                <button className="btn-primary" onClick={() => {
                    setEditingDish({ name: '', price: 0, category: categories?.[0]?.name || '', description: '', imageUrl: '', allergens: [], isAvailable: true });
                    setIsModalOpen(true);
                }} style={{ padding: '0 32px' }}>
                    <Plus size={20} /> ДОБАВИТЬ ПОЗИЦИЮ
                </button>
            </header>

            {/* Admin Stats Row (Responsive) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '40px' }}>
                <AdminStatCard title="Заказов за смену" value={metrics?.totalOrders || 0} icon={<Package />} color="#3B82F6" />
                <AdminStatCard title="Общая выручка" value={`${(metrics?.totalRevenue || 0).toLocaleString()} ₸`} icon={<DollarSign />} color="#4ADE80" onClick={() => { setAdjData({ metricName: 'Volume', value: 0, note: '' }); setIsAdjusting(true); }} />
            </div>

            {/* Tab Contents */}
            <AnimatePresence mode="wait">
                {activeTab === 'dishes' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
                        {dishes?.map((dish: { id: string; imageUrl: string; category: string; name: string; price: number; description: string; }) => (
                            <div key={dish.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ position: 'relative', paddingTop: '60%', overflow: 'hidden' }}>
                                    <img src={dish.imageUrl} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                                    <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
                                        <span className="badge-category" style={{ background: 'rgba(146, 63, 32, 0.9)', color: 'white' }}>{dish.category}</span>
                                    </div>
                                </div>
                                <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'baseline' }}>
                                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>{dish.name}</h3>
                                        <span className="price-mono" style={{ fontSize: '18px' }}>{dish.price} ₸</span>
                                    </div>
                                    <p className="body-small truncate-3" style={{ color: 'var(--text-tertiary)', marginBottom: '24px', flex: 1 }}>{dish.description}</p>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                                        <button onClick={() => { setEditingDish(dish); setIsModalOpen(true); }} className="btn-secondary" style={{ flex: 1, height: '40px', fontSize: '12px' }}>ИЗМЕНИТЬ</button>
                                        <button onClick={() => deleteMutation.mutate(dish.id)} className="btn-secondary" style={{ width: '40px', height: '40px', padding: 0, color: 'var(--error)', borderColor: 'var(--error)' }}><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )}

                {activeTab === 'logs' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ background: 'var(--bg-secondary)', borderRadius: '32px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.2)' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                                <thead style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                    <tr>
                                        <th style={{ padding: '24px', textAlign: 'left', fontSize: '11px', fontWeight: '900', color: 'var(--text-tertiary)', letterSpacing: '1px' }}>ВРЕМЯ</th>
                                        <th style={{ padding: '24px', textAlign: 'left', fontSize: '11px', fontWeight: '900', color: 'var(--text-tertiary)', letterSpacing: '1px' }}>ДЕЙСТВИЕ</th>
                                        <th style={{ padding: '24px', textAlign: 'left', fontSize: '11px', fontWeight: '900', color: 'var(--text-tertiary)', letterSpacing: '1px' }}>ОТВЕТСТВЕННЫЙ</th>
                                        <th style={{ padding: '24px', textAlign: 'left', fontSize: '11px', fontWeight: '900', color: 'var(--text-tertiary)', letterSpacing: '1px' }}>ДЕТАЛИ СОБЫТИЯ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs?.map((log: any) => (
                                        <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 200ms' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <td style={{ padding: '20px 24px', fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: '600' }}>{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                                            <td style={{ padding: '20px 24px' }}>
                                                <span style={{ fontSize: '12px', fontWeight: '900', color: 'var(--text-primary)', background: 'var(--bg-tertiary)', padding: '6px 12px', borderRadius: '8px', textTransform: 'uppercase' }}>{log.action}</span>
                                            </td>
                                            <td style={{ padding: '20px 24px', fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{log.staffName || 'Система'}</td>
                                            <td style={{ padding: '20px 24px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', maxWidth: '400px' }}>{log.details}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}

                {/* Categories Tab (Admin - Light Mode) */}
                {activeTab === 'categories' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: '800px', margin: '0 auto' }}>
                        <div style={{ background: 'var(--bg-secondary)', borderRadius: '32px', padding: 'clamp(20px, 5vw, 48px)', border: '1px solid var(--border-color)', boxShadow: '0 12px 40px rgba(0,0,0,0.03)' }}>
                            <h2 style={{ marginBottom: '32px', fontSize: '28px', fontWeight: '900' }}>Управление категориями</h2>
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '40px' }}>
                                <input id="admin-cat-input" placeholder="Название новой категории" style={{ flex: 1, height: '56px', padding: '0 20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', fontSize: '15px' }} />
                                <button className="btn-primary" onClick={() => {
                                    const input = document.getElementById('admin-cat-input') as HTMLInputElement;
                                    if (input.value) { createCatMutation.mutate(input.value); input.value = ''; }
                                }} style={{ padding: '0 32px' }}>Добавить</button>
                            </div>
                            <Reorder.Group axis="y" values={localCats} onReorder={handleReorder} style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: 0, listStyle: 'none' }}>
                                {localCats.map((cat: any) => (
                                    <Reorder.Item
                                        key={cat.id}
                                        value={cat}
                                        style={{
                                            padding: '16px 24px', background: 'var(--bg-secondary)', borderRadius: '20px',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            border: '1px solid var(--border-color)', cursor: 'grab'
                                        }}
                                        whileDrag={{ scale: 1.02, boxShadow: '0 10px 40px rgba(0,0,0,0.08)' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ color: 'var(--text-tertiary)', display: 'flex' }}>
                                                <GripVertical size={20} />
                                            </div>
                                            <span style={{ fontWeight: '800', color: 'var(--text-primary)', fontSize: '16px' }}>{cat.name}</span>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteCatMutation.mutate(cat.id); }}
                                            style={{ color: 'var(--error)', border: 'none', background: 'none', cursor: 'pointer', padding: '8px' }}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </Reorder.Item>
                                ))}
                            </Reorder.Group>
                        </div>
                    </motion.div>
                )}

                {/* Promo Slider Tab */}
                {activeTab === 'promo' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: '900px', margin: '0 auto' }}>
                        <div style={{ background: 'var(--bg-secondary)', borderRadius: '32px', padding: 'clamp(20px, 5vw, 48px)', border: '1px solid var(--border-color)', boxShadow: '0 12px 40px rgba(0,0,0,0.2)' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '20px', marginBottom: '40px' }}>
                                <div style={{ background: 'linear-gradient(135deg, var(--primary), #A855F7)', width: '64px', height: '64px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                    <ImageIcon size={36} />
                                </div>
                                <h2 style={{ margin: 0, fontSize: '28px', fontWeight: '900' }}>ПРОМО-АКЦИИ</h2>
                            </div>

                            <form onSubmit={(e: any) => {
                                e.preventDefault();
                                const formData = new FormData(e.target);
                                queryClient.setMutationDefaults(['createPromo'], {
                                    mutationFn: menuService.createPromo,
                                    onSuccess: () => {
                                        queryClient.invalidateQueries({ queryKey: ['promos'] });
                                        e.target.reset();
                                    }
                                });
                                const mutation = queryClient.getMutationCache().build(queryClient, { mutationKey: ['createPromo'] });
                                mutation.execute({ title: formData.get('title'), imageUrl: formData.get('imageUrl') });
                            }} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '40px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <input name="title" placeholder="Заголовок акции (опц.)" required style={{ height: '56px', padding: '0 20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
                                    <input name="imageUrl" placeholder="URL фото (1200x600)" required style={{ height: '56px', padding: '0 20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
                                </div>
                                <button type="submit" className="btn-primary" style={{ height: '56px', borderRadius: '16px' }}>ДОБАВИТЬ АКЦИЮ</button>
                            </form>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                                {promos ? (promos as any[]).map((p: any) => (
                                    <div key={p.id} style={{ position: 'relative', borderRadius: '24px', overflow: 'hidden', aspectRatio: '2/1', border: '1px solid var(--border-color)' }}>
                                        <img src={p.imageUrl} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)', display: 'flex', alignItems: 'flex-end', padding: '16px' }}>
                                            <span style={{ color: 'white', fontWeight: '800', fontSize: '14px' }}>{p.title}</span>
                                        </div>
                                        <button onClick={() => {
                                            queryClient.setMutationDefaults(['deletePromo'], {
                                                mutationFn: menuService.deletePromo,
                                                onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promos'] })
                                            });
                                            const mutation = queryClient.getMutationCache().build(queryClient, { mutationKey: ['deletePromo'] });
                                            mutation.execute(p.id);
                                        }} style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(255,59,48,0.9)', color: 'white', border: 'none', width: '32px', height: '32px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                    </div>
                                )) : <p style={{ opacity: 0.5 }}>Загрузка акций...</p>}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* AI Chef Settings Tab (Admin - Light Mode) */}
                {activeTab === 'ai' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: '900px', margin: '0 auto' }}>
                        <div style={{ background: 'var(--bg-secondary)', borderRadius: '32px', padding: 'clamp(20px, 5vw, 48px)', border: '1px solid var(--border-color)', boxShadow: '0 12px 40px rgba(0,0,0,0.2)' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '20px', marginBottom: '40px' }}>
                                <div style={{ background: 'linear-gradient(135deg, var(--primary), #A855F7)', width: '64px', height: '64px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 10px 25px rgba(255, 107, 53, 0.3)' }}>
                                    <Sparkles size={36} />
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '28px', fontWeight: '900' }}>Настройка ИИ-Ассистента</h2>
                                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-tertiary)', fontWeight: '600' }}>Персонализируйте вашего виртуального помощника</p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label style={{ fontSize: '12px', fontWeight: '900', color: 'var(--text-tertiary)', letterSpacing: '1.5px' }}>СИСТЕМНАЯ ПОДСКАЗКА (PROMPT)</label>
                                        <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '800' }}>AUTO-LEARNING ACTIVE</span>
                                    </div>
                                    <textarea
                                        value={aiPrompt}
                                        onChange={e => setAiPrompt(e.target.value)}
                                        style={{ width: '100%', minHeight: '350px', padding: '24px', borderRadius: '24px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', fontSize: '16px', lineHeight: '1.7', color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'var(--font-main)' }}
                                        placeholder="Опишите особые предпочтения или акции для ИИ сегодня..."
                                    />
                                </div>
                                <button
                                    className="btn-primary"
                                    style={{ width: '100%', height: '64px', fontSize: '16px', borderRadius: '20px' }}
                                    onClick={() => aiMutation.mutate(aiPrompt)}
                                    disabled={aiMutation.isPending}
                                >
                                    {aiMutation.isPending ? 'ОБНОВЛЕНИЕ БАЗЫ...' : 'СОХРАНИТЬ И ОБУЧИТЬ'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* QR Codes Tab (Admin - Light Mode) */}
                {activeTab === 'qr' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: '1000px', margin: '0 auto' }}>
                        <div style={{ background: 'var(--bg-secondary)', borderRadius: '32px', padding: 'clamp(20px, 5vw, 48px)', border: '1px solid var(--border-color)', boxShadow: '0 12px 40px rgba(0,0,0,0.03)' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '48px', gap: '24px' }}>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '28px', fontWeight: '900' }}>Генератор QR-кодов</h2>
                                    <p style={{ margin: 0, fontSize: '15px', color: 'var(--text-tertiary)', marginTop: '8px', fontWeight: '600' }}>QR-коды для ваших столов</p>
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-tertiary)', marginLeft: '4px' }}>СТОЛ №</label>
                                        <input
                                            type="number"
                                            value={qrData.table}
                                            min="0"
                                            max="100"
                                            onChange={e => {
                                                const val = parseInt(e.target.value);
                                                if (val >= 0 && val <= 100) setQrData({ ...qrData, table: String(val) });
                                                else if (e.target.value === '') setQrData({ ...qrData, table: '' });
                                            }}
                                            style={{ width: '100px', height: '48px', padding: '0 16px', borderRadius: '14px', border: '1px solid var(--border-color)', fontSize: '16px', textAlign: 'center', fontWeight: '800' }}
                                        />
                                    </div>
                                    <button className="btn-primary" onClick={() => window.print()} style={{ alignSelf: 'flex-end', height: '48px', padding: '0 32px' }}>ПЕЧАТЬ</button>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '48px' }}>
                                <div style={{ background: 'var(--bg-tertiary)', padding: '48px', borderRadius: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed var(--border-color)' }}>
                                    <div style={{ padding: '32px', background: 'white', borderRadius: '24px', boxShadow: '0 15px 45px rgba(0,0,0,0.08)' }}>
                                        <QRCodeSVG
                                            value={`${window.location.origin}/?table=${qrData.table}`}
                                            size={220}
                                            level="H"
                                            includeMargin={true}
                                        />
                                        <div style={{ marginTop: '20px', textAlign: 'center', fontWeight: '950', fontSize: '24px', letterSpacing: '4px', color: 'var(--text-primary)' }}>TABLE {qrData.table}</div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', justifyContent: 'center' }}>
                                    <div className="card" style={{ background: 'var(--bg-tertiary)', padding: '32px', border: '1px solid var(--border-color)', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
                                        <h3 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '800' }}>ПРЯМАЯ ССЫЛКА</h3>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                readOnly
                                                value={`${window.location.origin}/?table=${qrData.table}`}
                                                style={{ flex: 1, height: '48px', padding: '0 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: '600' }}
                                            />
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`${window.location.origin}/?table=${qrData.table}`);
                                                    setCopied(true);
                                                    setTimeout(() => setCopied(false), 2000);
                                                }}
                                                style={{ padding: '0 16px', background: 'var(--bg-tertiary)', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '12px', fontWeight: '900', color: 'var(--text-primary)' }}
                                            >
                                                {copied ? 'ГОТОВО' : 'КОПИЯ'}
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ padding: '32px', borderRadius: '24px', background: 'rgba(255, 107, 53, 0.05)', border: '1px solid rgba(255, 107, 53, 0.1)' }}>
                                        <p style={{ margin: 0, fontSize: '14px', color: 'var(--primary)', lineHeight: '1.7', fontWeight: '600' }}>
                                            <strong>Pro Tip:</strong> Печатайте QR-коды на качественной бумаге или акриловых подставках. Брендированные коды повышают доверие гостей и скорость заказов.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Adjustment Overlay */}
            <AnimatePresence>
                {isAdjusting && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAdjusting(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} />
                        <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} style={{ background: 'var(--bg-secondary)', padding: '40px', borderRadius: '32px', width: '100%', maxWidth: '440px', position: 'relative', zIndex: 3001, boxShadow: '0 25px 60px rgba(0,0,0,0.4)', border: '1px solid var(--border-color)' }}>
                            <h2 style={{ marginBottom: '32px', fontSize: '28px', fontWeight: '900' }}>Корректировка</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: '900', color: 'var(--text-tertiary)', letterSpacing: '1px' }}>ПАРАМЕТР</label>
                                    <select style={{ width: '100%', height: '52px', padding: '0 16px', border: '1px solid var(--border-color)', borderRadius: '14px', background: 'var(--bg-secondary)', fontWeight: '700' }} value={adjData.metricName} onChange={e => setAdjData({ ...adjData, metricName: e.target.value })}>
                                        <option value="Volume">Ручная выручка</option>
                                        <option value="DishesCount">Количество блюд</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: '900', color: 'var(--text-tertiary)', letterSpacing: '1px' }}>ЗНАЧЕНИЕ (±)</label>
                                    <input type="number" placeholder="0" style={{ width: '100%', height: '52px', padding: '0 16px', border: '1px solid var(--border-color)', borderRadius: '14px', background: 'var(--bg-secondary)', fontSize: '18px', fontWeight: '900' }} onChange={e => setAdjData({ ...adjData, value: Number(e.target.value) })} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: '900', color: 'var(--text-tertiary)', letterSpacing: '1px' }}>ОБОСНОВАНИЕ</label>
                                    <textarea placeholder="Почему вносятся изменения?" style={{ width: '100%', height: '100px', padding: '16px', border: '1px solid var(--border-color)', borderRadius: '14px', background: 'var(--bg-secondary)', resize: 'none' }} onChange={e => setAdjData({ ...adjData, note: e.target.value })} />
                                </div>
                                <button className="btn-primary" style={{ width: '100%', height: '60px', borderRadius: '18px', fontSize: '16px', marginTop: '12px' }} disabled={!adjData.note} onClick={() => adjMutation.mutate(adjData)}>ПРИМЕНИТЬ ПРАВКИ</button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {isModalOpen && editingDish && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} />
                        <motion.div initial={{ scale: 0.9, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 30 }}
                            style={{
                                background: 'var(--bg-secondary)', padding: '40px', borderRadius: '32px', width: '100%', maxWidth: '550px', position: 'relative', zIndex: 3001,
                                maxHeight: '95vh', overflowY: 'auto', boxShadow: '0 30px 80px rgba(0,0,0,0.4)', border: '1px solid var(--border-color)'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '32px', fontWeight: '900', letterSpacing: '-1px' }}>{editingDish.id ? 'Редактор' : 'Новое блюдо'}</h2>
                                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-tertiary)', fontWeight: '600' }}>Заполните данные о позиции в меню</p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} style={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X /></button>
                            </div>

                            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(editingDish); }} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <label style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-secondary)' }}>Название блюда</label>
                                    <input value={editingDish.name} onChange={e => setEditingDish({ ...editingDish, name: e.target.value })} style={{ height: '52px', padding: '0 20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }} required />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <label style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-secondary)' }}>Стоимость (₸)</label>
                                        <input type="number" value={editingDish.price} onChange={e => setEditingDish({ ...editingDish, price: Number(e.target.value) })} style={{ height: '52px', padding: '0 20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)' }} required />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <label style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-secondary)' }}>Категория</label>
                                        <select value={editingDish.category} onChange={e => setEditingDish({ ...editingDish, category: e.target.value })} style={{ height: '52px', padding: '0 20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', fontWeight: '700', color: 'var(--text-primary)' }}>
                                            {categories?.map((cat: any) => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <label style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-secondary)' }}>Ссылка на фото (Unsplash / CDN)</label>
                                    <input value={editingDish.imageUrl} onChange={e => setEditingDish({ ...editingDish, imageUrl: e.target.value })} style={{ height: '52px', padding: '0 20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', fontSize: '14px', color: 'var(--text-primary)' }} placeholder="https://images.unsplash.com/..." />
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <label style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-secondary)' }}>Описание для гостя</label>
                                    <textarea value={editingDish.description} onChange={e => setEditingDish({ ...editingDish, description: e.target.value })} style={{ minHeight: '120px', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', resize: 'vertical', fontSize: '15px', lineHeight: '1.6', color: 'var(--text-primary)' }} />
                                </div>

                                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', background: 'var(--bg-secondary)', padding: '16px 20px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                                    <input type="checkbox" checked={editingDish.isAvailable} onChange={e => setEditingDish({ ...editingDish, isAvailable: e.target.checked })} style={{ width: '24px', height: '24px', cursor: 'pointer', accentColor: 'var(--primary)' }} />
                                    <label style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>Доступно для заказа гостями</label>
                                </div>

                                <button type="submit" className="btn-primary" style={{ width: '100%', height: '64px', fontSize: '16px', borderRadius: '20px', marginTop: '16px', boxShadow: '0 10px 30px rgba(255, 107, 53, 0.3)' }} disabled={saveMutation.isPending}>
                                    {saveMutation.isPending ? 'СОХРАНЕНИЕ...' : (editingDish.id ? 'ОБНОВИТЬ ПОЗИЦИЮ' : 'ДОБАВИТЬ В МЕНЮ')}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

const AdminStatCard = ({ title, value, icon, color, onClick }: any) => (
    <div onClick={onClick} style={{
        background: 'var(--bg-secondary)', padding: '24px', borderRadius: '24px', border: '1px solid var(--border-color)',
        cursor: onClick ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '20px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.02)', transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
        <div style={{ background: `${color}10`, width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: color, boxShadow: `0 8px 20px ${color}15` }}>
            {icon}
        </div>
        <div>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: '900', color: 'var(--text-tertiary)', letterSpacing: '1px' }}>{title.toUpperCase()}</p>
            <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>{value}</h3>
        </div>
    </div>
);

export default AdminDashboard;
