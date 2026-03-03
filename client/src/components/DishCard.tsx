import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import type { Dish } from '../types';

interface DishCardProps {
    dish: Dish;
    onAddToCart: (dish: Dish) => void;
    onShowDetails: (dish: Dish) => void;
}

const DishCard = ({ dish, onAddToCart, onShowDetails }: DishCardProps) => {

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card"
            style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                opacity: dish.isAvailable ? 1 : 0.6,
                position: 'relative'
            }}
        >
            {/* Aspect Ratio 16:9 Image Container */}
            <div
                onClick={() => onShowDetails(dish)}
                style={{
                    position: 'relative',
                    paddingTop: '56.25%', // 16:9
                    cursor: 'pointer',
                    overflow: 'hidden',
                    background: 'var(--bg-secondary)'
                }}
            >
                <img
                    src={dish.imageUrl ?? undefined}
                    alt={dish.name}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transition: 'transform 600ms cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                />

                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.05) 100%)',
                    pointerEvents: 'none'
                }} />

                {!dish.isAvailable && (
                    <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)'
                    }}>
                        <div style={{
                            padding: '8px 16px', borderRadius: '8px',
                            background: '#000000', color: '#F5F5F5',
                            fontSize: '14px', fontWeight: '700', textTransform: 'uppercase'
                        }}>
                            Недоступно
                        </div>
                    </div>
                )}
            </div>

            <div style={{ padding: 'clamp(10px, 2vw, 16px)', flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Title & Badge */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                    <span className="badge-category" style={{ width: 'fit-content' }}>{dish.category}</span>
                    <h2 className="truncate-2" style={{ margin: 0, fontSize: 'clamp(15px, 2vw, 18px)', fontWeight: '900', lineHeight: '1.2' }}>{dish.name}</h2>
                </div>

                {/* Description - condensed for compact views */}
                <p className="body-small truncate-2" style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '13px', lineHeight: '1.4' }}>
                    {dish.description}
                </p>

                {/* Price & Action */}
                <div style={{ marginTop: 'auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span className="price-mono" style={{ fontSize: 'clamp(16px, 2vw, 20px)' }}>{dish.price} ₸</span>
                    <button
                        onClick={() => dish.isAvailable && onAddToCart(dish)}
                        disabled={!dish.isAvailable}
                        className="btn-tertiary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 12px', fontSize: '12px' }}
                    >
                        <Plus size={14} /> КУПИТЬ
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

export default DishCard;
