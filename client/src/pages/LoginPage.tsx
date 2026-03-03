import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../api';
import { Lock, ShieldCheck, User as UserIcon } from 'lucide-react';
import { motion } from 'framer-motion';

const LoginPage = () => {
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();

    // Пытаемся понять, куда человек шел (админка или официант)
    const from = location.state?.from?.pathname || '/admin';

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const data = await authService.login({ login, password });

            // Сохраняем "сессию"
            localStorage.setItem('qr_token', data.token);
            localStorage.setItem('qr_role', data.role);

            console.log('✅ Вход выполнен:', data.role);

            // Перенаправляем
            if (data.role === 'ADMIN') navigate('/admin');
            else if (data.role === 'WAITER') navigate('/waiter');
            else navigate(from);

        } catch (err: any) {
            setError(err.response?.data?.error || 'Ошибка входа. Проверьте данные.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{
            height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-base)', padding: '20px'
        }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                    width: '100%', maxWidth: '400px', background: 'var(--bg-secondary)', padding: '40px',
                    borderRadius: '32px', border: '1px solid var(--border-color)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
                }}
            >
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '20px',
                        background: 'linear-gradient(135deg, var(--primary), #FF3B30)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 20px', color: 'white',
                        boxShadow: '0 10px 25px rgba(255, 107, 53, 0.3)'
                    }}>
                        <ShieldCheck size={32} />
                    </div>
                    <h1 style={{ fontSize: '24px', fontWeight: '950', marginBottom: '8px' }}>ВХОД В ПАНЕЛЬ</h1>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-tertiary)' }}>Укажите данные сотрудника</p>
                </div>

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                            <UserIcon size={18} />
                        </div>
                        <input
                            type="text"
                            placeholder="Логин"
                            value={login}
                            onChange={(e) => setLogin(e.target.value)}
                            style={{
                                width: '100%', height: '56px', padding: '0 16px 0 48px',
                                borderRadius: '16px', border: '1px solid var(--border-color)',
                                background: 'var(--bg-secondary)', fontSize: '15px', fontWeight: '600',
                                color: 'var(--text-primary)'
                            }}
                        />
                    </div>

                    <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                            <Lock size={18} />
                        </div>
                        <input
                            type="password"
                            placeholder="Пароль"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{
                                width: '100%', height: '56px', padding: '0 16px 0 48px',
                                borderRadius: '16px', border: '1px solid var(--border-color)',
                                background: 'var(--bg-secondary)', fontSize: '15px', fontWeight: '600',
                                color: 'var(--text-primary)'
                            }}
                        />
                    </div>

                    {error && (
                        <div style={{
                            padding: '12px 16px', background: 'rgba(255, 59, 48, 0.05)',
                            color: 'var(--error)', borderRadius: '12px', fontSize: '13px',
                            fontWeight: '700', border: '1px solid rgba(241, 56, 46, 0.1)'
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="btn-primary"
                        style={{ height: '60px', borderRadius: '18px', fontSize: '16px', fontWeight: '900' }}
                    >
                        {isLoading ? 'ВХОД...' : 'ВОЙТИ В СИСТЕМУ'}
                    </button>
                </form>
            </motion.div>
        </div>
    );
};

export default LoginPage;
