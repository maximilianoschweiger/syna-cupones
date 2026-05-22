import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import {
  CreditCard, CheckCircle2, XCircle, AlertTriangle,
  Building2, TrendingUp, Mail, RefreshCw
} from 'lucide-react'
import { dashboardAPI } from '../services/api'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay },
})

const COLORS = ['#00e5a0', '#ef4444', '#f59e0b']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-dark-600 border border-dark-400 rounded-xl p-3 text-sm shadow-card">
      <p className="text-slate-text mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-white font-medium">{p.value}</span>
          <span className="text-slate-text capitalize">{p.dataKey}</span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [daily, setDaily] = useState([])
  const [topBranches, setTopBranches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [statsRes, dailyRes, branchesRes] = await Promise.all([
        dashboardAPI.getStats(),
        dashboardAPI.getDailyChart(),
        dashboardAPI.getTopBranches(),
      ])
      setStats(statsRes.data)
      setDaily(dailyRes.data)
      setTopBranches(branchesRes.data)
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <DashboardSkeleton />

  const signedPct = stats
    ? Math.round((stats.signedCoupons / (stats.totalCoupons || 1)) * 100)
    : 0

  const pieData = stats
    ? [
        { name: 'Firmados', value: stats.signedCoupons },
        { name: 'Sin firma', value: stats.unsignedCoupons },
        { name: 'Dudosos', value: stats.dubiousCoupons },
      ]
    : []

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <motion.div {...fadeUp(0)} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-text text-sm mt-0.5">
            {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="btn-ghost flex items-center gap-2 text-sm"
        >
          <RefreshCw size={14} />
          Actualizar
        </button>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total cupones',
            value: stats?.totalCoupons?.toLocaleString() || '0',
            icon: CreditCard,
            color: 'text-primary',
            bg: 'bg-primary/10',
            delay: 0.1,
          },
          {
            label: 'Firmados',
            value: stats?.signedCoupons?.toLocaleString() || '0',
            icon: CheckCircle2,
            color: 'text-primary',
            bg: 'bg-primary/10',
            sub: `${signedPct}%`,
            delay: 0.15,
          },
          {
            label: 'Sin firma',
            value: stats?.unsignedCoupons?.toLocaleString() || '0',
            icon: XCircle,
            color: 'text-red-400',
            bg: 'bg-red-500/10',
            delay: 0.2,
          },
          {
            label: 'Dudosos',
            value: stats?.dubiousCoupons?.toLocaleString() || '0',
            icon: AlertTriangle,
            color: 'text-yellow-400',
            bg: 'bg-yellow-500/10',
            delay: 0.25,
          },
        ].map(({ label, value, icon: Icon, color, bg, sub, delay }) => (
          <motion.div key={label} {...fadeUp(delay)} className="stat-card">
            <div className="flex items-start justify-between">
              <div className={`p-2.5 rounded-xl ${bg}`}>
                <Icon size={18} className={color} />
              </div>
              {sub && (
                <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {sub}
                </span>
              )}
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-slate-text text-xs mt-0.5">{label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Area chart */}
        <motion.div {...fadeUp(0.3)} className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold text-white">Cupones por día</h2>
              <p className="text-slate-text text-xs mt-0.5">Últimos 14 días</p>
            </div>
            <TrendingUp size={16} className="text-primary" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={daily}>
              <defs>
                <linearGradient id="colorFirmados" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00e5a0" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00e5a0" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorNoFirmados" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c2a42" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#8892a4', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8892a4', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="firmados" stroke="#00e5a0" fill="url(#colorFirmados)" strokeWidth={2} />
              <Area type="monotone" dataKey="noFirmados" stroke="#ef4444" fill="url(#colorNoFirmados)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Pie chart */}
        <motion.div {...fadeUp(0.35)} className="card p-6">
          <h2 className="text-base font-semibold text-white mb-1">Estado general</h2>
          <p className="text-slate-text text-xs mb-6">Distribución de cupones</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#111b2d', border: '1px solid #1c2a42', borderRadius: '12px', fontSize: '12px' }}
                itemStyle={{ color: '#fff' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-2 mt-2">
            {[
              { label: 'Firmados', color: '#00e5a0' },
              { label: 'Sin firma', color: '#ef4444' },
              { label: 'Dudosos', color: '#f59e0b' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-xs text-slate-text">{label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Bottom row */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Top branches */}
        <motion.div {...fadeUp(0.4)} className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-white">Ranking sucursales</h2>
            <Building2 size={15} className="text-slate-text" />
          </div>
          <div className="flex flex-col gap-3">
            {topBranches.slice(0, 5).map((branch, i) => {
              const pct = Math.round((branch.signed / (branch.total || 1)) * 100)
              return (
                <div key={branch.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-text w-5">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-white truncate">
                        Suc. {branch.code}
                      </p>
                      <span className="text-xs font-semibold text-primary ml-2 flex-shrink-0">
                        {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-dark-500 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: 0.5 + i * 0.1 }}
                        className="h-full rounded-full"
                        style={{
                          background: pct >= 90
                            ? '#00e5a0'
                            : pct >= 70
                            ? '#f59e0b'
                            : '#ef4444',
                        }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* Bar chart by branch */}
        <motion.div {...fadeUp(0.45)} className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-semibold text-white">Errores por sucursal</h2>
            <Mail size={15} className="text-slate-text" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topBranches.slice(0, 6)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c2a42" vertical={false} />
              <XAxis dataKey="code" tick={{ fill: '#8892a4', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8892a4', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="unsigned" fill="#ef4444" radius={[4, 4, 0, 0]} name="Sin firma" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-8 w-48 skeleton rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-6 h-28 skeleton" />
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-6 h-72 skeleton lg:col-span-2" />
        <div className="card p-6 h-72 skeleton" />
      </div>
    </div>
  )
}
