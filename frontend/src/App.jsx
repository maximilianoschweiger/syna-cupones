import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './hooks/useAuth.jsx'
import ProtectedRoute from './components/ui/ProtectedRoute.jsx'
import AdminRoute from './components/ui/AdminRoute.jsx'
import Layout from './components/layout/Layout.jsx'

// Pages
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Coupons from './pages/Coupons.jsx'
import CouponDetail from './pages/CouponDetail.jsx'
import Branches from './pages/Branches.jsx'
import Alerts from './pages/Alerts.jsx'
import Emails from './pages/Emails.jsx'
import Users from './pages/Users.jsx'
import Settings from './pages/Settings.jsx'
import Logs from './pages/Logs.jsx'

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#111b2d',
              color: '#fff',
              border: '1px solid #1c2a42',
              fontFamily: 'Outfit, sans-serif',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#00e5a0', secondary: '#060b14' },
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: '#060b14' },
            },
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/cupones" element={<Coupons />} />
              <Route path="/cupones/:id" element={<CouponDetail />} />
              <Route path="/sucursales" element={<Branches />} />
              <Route path="/alertas" element={<Alerts />} />
              <Route path="/emails" element={<Emails />} />
              <Route element={<AdminRoute />}>
                <Route path="/usuarios" element={<Users />} />
                <Route path="/configuracion" element={<Settings />} />
                <Route path="/logs" element={<Logs />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
