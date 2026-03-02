import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CustomerMenu from './pages/CustomerMenu';
import WaiterPanel from './pages/WaiterPanel';
import AdminDashboard from './pages/AdminDashboard';
import { CartProvider } from './context/CartContext';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Customer Routes */}
            <Route path="/" element={<CustomerMenu />} />
            <Route path="/menu" element={<CustomerMenu />} />
            <Route path="/order/:orderId" element={<div>Order Status</div>} />

            {/* Waiter Routes */}
            <Route path="/waiter" element={<WaiterPanel />} />

            {/* Admin Routes */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/menu" element={<AdminDashboard />} />
            <Route path="/admin/ai" element={<AdminDashboard />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </QueryClientProvider>
  );
}

export default App;
