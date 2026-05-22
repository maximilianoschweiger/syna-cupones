import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bell, BellOff, AlertTriangle, XCircle, MailX, Building2, CheckCheck } from 'lucide-react'
import { alertsAPI } from '../services/api'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const ALERT_TYPES = {
  UNSIGNED_THRESHOLD: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'Umbral sin firma' },
  NO_ATTACHMENT: { icon: MailX, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', label: 'Sin adjunto' },
  DUBIOUS_COUPON: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', label: 'Cupón dudoso' },
  MISSING_CLOSING: { icon: Building2, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', label: 'Sin cierre' },
}

export default function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')

  useEffect(() => { fetchAlerts() }, [filter])

  const fetchAlerts = async () => {
    setLoading(true)
    try {
      const { data } = await alertsAPI.getAll({ status: filter })
      setAlerts(data)
    } catch {} finally {
      setLoading(false)
    }
  }

  const dismiss = async (id) => {
    try {
      await alertsAPI.dismiss(id)
      setAlerts(a => a.filter(x => x.id !== id))
      toast.success('Alerta descartada')
    } catch {}
  }

  const dismissAll = async () => {
    try {
      await alertsAPI.dismissAll()
      setAlerts([])
      toast.success('Todas las alertas descartadas')
    } catch {}
  }

  const active = alerts.filter(a => !a.dismissed)

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Alertas
            {active.length > 0 && (
              <span className="text-sm font-semibold bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">
                {active.length}
              </span>
            )}
          </h1>
          <p className="text-slate-text text-sm mt-0.5">
            Notificaciones del sistema de auditoría
          </p>
        </div>
        {active.length > 0 && (
          <button onClick={dismissAll} className="btn-secondary flex items-center gap-2 text-sm">
            <CheckCheck size={14} />
            Descartar todas
          </button>
        )}
      </motion.div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[
          { key: 'active', label: 'Activas' },
          { key: 'all', label: 'Todas' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={clsx(
              'px-4 py-2 rounded-xl text-sm font-medium transition-all',
              filter === key
                ? 'bg-primary/15 text-primary border border-primary/25'
                : 'text-slate-text hover:text-white hover:bg-dark-600'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5 h-20 skeleton" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="card p-16 flex flex-col items-center gap-3">
          <BellOff size={36} className="text-dark-400" />
          <p className="text-slate-text text-sm">No hay alertas {filter === 'active' ? 'activas' : ''}</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col gap-3"
        >
          {alerts.map((alert, i) => {
            const type = ALERT_TYPES[alert.type] || ALERT_TYPES.DUBIOUS_COUPON
            const Icon = type.icon
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={clsx(
                  'card p-4 flex items-start gap-4 border',
                  type.border,
                  alert.dismissed && 'opacity-50'
                )}
              >
                <div className={clsx('p-2.5 rounded-xl flex-shrink-0', type.bg)}>
                  <Icon size={16} className={type.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{alert.title}</p>
                      <p className="text-xs text-slate-text mt-0.5">{alert.message}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[11px] text-slate-text">
                        {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true, locale: es })}
                      </span>
                      {!alert.dismissed && (
                        <button
                          onClick={() => dismiss(alert.id)}
                          className="p-1.5 text-slate-text hover:text-white hover:bg-dark-600 rounded-lg transition-colors"
                        >
                          <BellOff size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  {alert.branchCode && (
                    <span className="mt-2 inline-flex items-center gap-1 text-xs bg-dark-600 px-2 py-0.5 rounded-full text-slate-text">
                      <Building2 size={10} />
                      Suc. {alert.branchCode}
                    </span>
                  )}
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}
