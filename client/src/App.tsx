import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CustomerMenu from './pages/CustomerMenu';
import WaiterPanel from './pages/WaiterPanel';
import AdminDashboard from './pages/AdminDashboard';
import LoginPage from './pages/LoginPage';
import { CartProvider } from './context/CartContext';

const queryClient = new QueryClient();

// Компонент для защиты ролей
const ProtectedRoute = ({ children, role }: { children: React.ReactNode, role: 'ADMIN' | 'WAITER' | 'ANY' }) => {
  const token = localStorage.getItem('qr_token');
  const userRole = localStorage.getItem('qr_role');
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role !== 'ANY' && userRole !== 'ADMIN' && userRole !== role) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            {/* Публичная часть (Гости) */}
            <Route path="/" element={<CustomerMenu />} />
            <Route path="/menu" element={<CustomerMenu />} />
            <Route path="/order/:orderId" element={<div>Order Status</div>} />

            {/* Вход */}
            <Route path="/login" element={<LoginPage />} />

            {/* Панель Официанта - Доступ только официантам и админам */}
            <Route path="/waiter" element={
              <ProtectedRoute role="ANY">
                <WaiterPanel />
              </ProtectedRoute>
            } />

            {/* Панель Админа - Только админы */}
            <Route path="/admin/*" element={
              <ProtectedRoute role="ADMIN">
                <AdminDashboard />
              </ProtectedRoute>
            } />

            {/* Редиректы для старых роутов админа */}
            <Route path="/admin/menu" element={<Navigate to="/admin" replace />} />
            <Route path="/admin/ai" element={<Navigate to="/admin" replace />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </QueryClientProvider>
  );
}

export default App;
