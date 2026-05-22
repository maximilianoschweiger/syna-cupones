import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  LayoutDashboard, Ticket, Bell, GitBranch, Mail,
  Users, Settings, FileText, ChevronLeft, ChevronRight,
  LogOut, ChevronDown, Wifi, WifiOff
} from 'lucide-react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/coupons', icon: Ticket, label: 'Cupones' },
  { to: '/alerts', icon: Bell, label: 'Alertas', badge: true },
  { to: '/branches', icon: GitBranch, label: 'Sucursales' },
  { to: '/emails', icon: Mail, label: 'Mails' },
]
const adminItems = [
  { to: '/users', icon: Users, label: 'Usuarios' },
  { to: '/settings', icon: Settings, label: 'Configuración' },
  { to: '/logs', icon: FileText, label: 'Logs del Sistema' },
]

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [imapOnline] = useState(true)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="flex min-h-screen" style={{ background: '#060e1c' }}>
      {/* Sidebar */}
      <aside
        className="flex flex-col flex-shrink-0 transition-all duration-300 relative"
        style={{
          width: collapsed ? 68 : 240,
          background: '#0a1628',
          borderRight: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-16 flex-shrink-0 overflow-hidden">
          <div className="glow-dot flex-shrink-0" />
          {!collapsed && (
            <span className="text-white font-bold text-base tracking-tight whitespace-nowrap">
              <span style={{ color: '#00e5a0' }}>Syna</span> Cupones
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 flex flex-col gap-1 overflow-y-auto">
          {!collapsed && <p className="sidebar-section mb-1 mt-1">Principal</p>}
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`
              }
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}

          {user?.role === 'ADMIN' && (
            <>
              {!collapsed && <p className="sidebar-section mb-1 mt-4">Administración</p>}
              {collapsed && <div className="my-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }} />}
              {adminItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `nav-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`
                  }
                  title={collapsed ? label : undefined}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  {!collapsed && <span>{label}</span>}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* IMAP status */}
        {!collapsed && (
          <div
            className="mx-3 mb-3 px-3 py-2.5 rounded-xl flex items-center gap-2.5"
            style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            {imapOnline
              ? <Wifi size={14} style={{ color: '#00e5a0' }} />
              : <WifiOff size={14} className="text-red-400" />
            }
            <div className="min-w-0">
              <p className="text-xs font-semibold" style={{ color: imapOnline ? '#00e5a0' : '#f87171' }}>
                IMAP {imapOnline ? 'Online' : 'Offline'}
              </p>
              <p className="text-xs text-slate-500 truncate">cupones@syna.com.ar</p>
            </div>
          </div>
        )}

        {/* User */}
        <div
          className={`flex items-center gap-3 px-3 py-3 mx-2 mb-2 rounded-xl cursor-pointer transition-all duration-200
                      hover:bg-white/5 ${collapsed ? 'justify-center' : ''}`}
          onClick={handleLogout}
          title="Cerrar sesión"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'rgba(0,229,160,0.15)', color: '#00e5a0' }}
          >
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.role}</p>
            </div>
          )}
          {!collapsed && <LogOut size={15} className="text-slate-500 flex-shrink-0" />}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-14 w-6 h-6 rounded-full flex items-center justify-center
                     transition-all duration-200 hover:scale-110 z-10"
          style={{ background: '#1c2e4a', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b' }}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <header
          className="flex items-center justify-between px-6 h-16 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#0a1628' }}
        >
          <div />
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm cursor-pointer transition-all hover:bg-white/5"
              style={{ border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: 'rgba(0,229,160,0.15)', color: '#00e5a0' }}
              >
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className="text-slate-300 font-medium">{user?.name}</span>
              <ChevronDown size={14} className="text-slate-500" />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
