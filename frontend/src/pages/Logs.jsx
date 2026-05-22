import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ScrollText, Trash2, RefreshCw, AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react'
import { logsAPI } from '../services/api'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const LEVEL_MAP = {
  INFO: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  SUCCESS: { icon: CheckCircle, color: 'text-primary', bg: 'bg-primary/10' },
  WARNING: { icon: AlertCircle, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  ERROR: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
}

export default function Logs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [levelFilter, setLevelFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => { fetchLogs() }, [page, levelFilter])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const { data } = await logsAPI.getAll({ page, limit: 50, level: levelFilter })
      setLogs(data.logs)
      setTotal(data.total)
    } catch {} finally {
      setLoading(false)
    }
  }

  const handleClear = async () => {
    if (!confirm('¿Limpiar todos los logs?')) return
    try {
      await logsAPI.clear()
      toast.success('Logs eliminados')
      fetchLogs()
    } catch {}
  }

  return (
    <div className="flex flex-col gap-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Logs del sistema</h1>
          <p className="text-slate-text text-sm mt-0.5">{total} registros</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={levelFilter} onChange={(e) => { setLevelFilter(e.target.value); setPage(1) }} className="input-field w-auto text-sm py-2">
            <option value="">Todos los niveles</option>
            <option value="INFO">Info</option>
            <option value="SUCCESS">Success</option>
            <option value="WARNING">Warning</option>
            <option value="ERROR">Error</option>
          </select>
          <button onClick={fetchLogs} className="btn-ghost flex items-center gap-2 text-sm"><RefreshCw size={13} /></button>
          <button onClick={handleClear} className="btn-secondary flex items-center gap-2 text-sm text-red-400 border-red-500/20 hover:border-red-500/40">
            <Trash2 size={13} /> Limpiar
          </button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="card overflow-hidden">
        <div className="font-mono text-xs">
          {loading ? (
            <div className="p-8 text-center text-slate-text">Cargando logs...</div>
          ) : logs.length === 0 ? (
            <div className="p-16 text-center">
              <ScrollText size={24} className="mx-auto mb-2 text-dark-400" />
              <p className="text-slate-text text-sm">No hay logs disponibles</p>
            </div>
          ) : (
            logs.map((log, i) => {
              const level = LEVEL_MAP[log.level] || LEVEL_MAP.INFO
              const Icon = level.icon
              return (
                <div key={log.id} className={clsx('flex items-start gap-3 px-4 py-2.5 border-b border-dark-500/50 hover:bg-dark-700/30 transition-colors', i % 2 === 0 && 'bg-dark-800/20')}>
                  <div className={clsx('p-1 rounded flex-shrink-0 mt-0.5', level.bg)}>
                    <Icon size={11} className={level.color} />
                  </div>
                  <span className="text-slate-text flex-shrink-0 w-32">
                    {format(new Date(log.createdAt), 'dd/MM HH:mm:ss')}
                  </span>
                  <span className={clsx('font-semibold flex-shrink-0 w-16', level.color)}>
                    [{log.level}]
                  </span>
                  <span className="text-white/80 flex-1 break-all">{log.message}</span>
                  {log.meta && (
                    <span className="text-dark-400 text-[10px] flex-shrink-0 max-w-32 truncate">
                      {JSON.stringify(log.meta)}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
        {Math.ceil(total / 50) > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-dark-500">
            <p className="text-xs text-slate-text">Página {page} de {Math.ceil(total / 50)}</p>
            <div className="flex gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-30">Anterior</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 50)} className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-30">Siguiente</button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
