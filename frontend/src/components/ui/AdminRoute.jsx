import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.jsx'

export default function AdminRoute() {
  const { isAdmin } = useAuth()
  return isAdmin ? <Outlet /> : <Navigate to="/dashboard" replace />
}
