import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Filter, Download, Eye, RefreshCw, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { couponsAPI } from '../services/api'
import { format } from 'date-fns'
import { useAuth } from '../hooks/useAuth.jsx'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const STATUS_BADGE = {
  SIGNED: { cls: 'badge-signed', icon: CheckCircle2, label: 'Firmado' },
  UNSIGNED: { cls: 'badge-unsigned', icon: XCircle, label: 'Sin firma' },
  DUBIOUS: { cls: 'badge-dubious', icon: AlertTriangle, label: 'Dudoso' },
}

export default function Coupons() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    status: '',
    branch: '',
    shift: '',
    dateFrom: '',
    dateTo: '',
  })
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const LIMIT = 20

  const fetchCoupons = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await couponsAPI.getAll({
        search,
        ...filters,
        page,
        limit: LIMIT,
      })
      setCoupons(data.coupons)
      setTotal(data.total)
    } catch {
      // handled
    } finally {
      setLoading(false)
    }
  }, [search, filters, page])

  useEffect(() => {
    const t = setTimeout(fetchCoupons, 300)
    return () => clearTimeout(t)
  }, [fetchCoupons])

  const handleExport = async () => {
    try {
      const { data } = await couponsAPI.export({ ...filters, search })
      const url = URL.createObjectURL(new Blob([data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `cupones_${format(new Date(), 'yyyyMMdd')}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Error al exportar')
    }
  }

  const handleReanalyze = async (id, e) => {
    e.stopPropagation()
    try {
      await couponsAPI.reanalyze(id)
      toast.success('Reanalizado con IA')
      fetchCoupons()
    } catch {}
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Cupones</h1>
          <p className="text-slate-text text-sm mt-0.5">
            {total.toLocaleString()} cupones encontrados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchCoupons} className="btn-ghost flex items-center gap-2 text-sm">
            <RefreshCw size={14} />
            Actualizar
          </button>
          {isAdmin && (
            <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-sm">
              <Download size={14} />
              Exportar
            </button>
          )}
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card p-4 flex flex-wrap gap-3"
      >
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-text" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar cupón, monto, tarjeta..."
            className="input-field pl-10 text-sm py-2.5"
          />
        </div>

        <select
          value={filters.status}
          onChange={(e) => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1) }}
          className="input-field w-auto text-sm py-2.5 min-w-36"
        >
          <option value="">Todos los estados</option>
          <option value="SIGNED">Firmados</option>
          <option value="UNSIGNED">Sin firma</option>
          <option value="DUBIOUS">Dudosos</option>
        </select>

        <select
          value={filters.shift}
          onChange={(e) => { setFilters(f => ({ ...f, shift: e.target.value })); setPage(1) }}
          className="input-field w-auto text-sm py-2.5 min-w-36"
        >
          <option value="">Todos los turnos</option>
          <option value="MORNING">Mañana</option>
          <option value="AFTERNOON">Tarde</option>
          <option value="NIGHT">Noche</option>
          <option value="CLOSING">Cierre</option>
        </select>

        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => { setFilters(f => ({ ...f, dateFrom: e.target.value })); setPage(1) }}
          className="input-field w-auto text-sm py-2.5"
        />
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => { setFilters(f => ({ ...f, dateTo: e.target.value })); setPage(1) }}
          className="input-field w-auto text-sm py-2.5"
        />
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="card overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-500">
                {['Cupón', 'Sucursal', 'Turno', 'Monto', 'Tarjeta', 'Cuotas', 'Fecha', 'Estado', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-text">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-dark-500/50">
                    {[...Array(9)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 skeleton rounded w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : coupons.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-slate-text">
                    <Search size={24} className="mx-auto mb-2 opacity-40" />
                    <p>No se encontraron cupones</p>
                  </td>
                </tr>
              ) : (
                coupons.map((coupon) => {
                  const status = STATUS_BADGE[coupon.signatureStatus] || STATUS_BADGE.DUBIOUS
                  const StatusIcon = status.icon
                  return (
                    <tr
                      key={coupon.id}
                      className="table-row cursor-pointer"
                      onClick={() => navigate(`/cupones/${coupon.id}`)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-slate-text">
                        #{coupon.couponNumber || coupon.id.slice(-6)}
                      </td>
                      <td className="px-4 py-3 font-medium text-white">
                        Suc. {coupon.email?.branch?.code || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-text capitalize text-xs">
                        {coupon.email?.shift?.toLowerCase() || '—'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-white">
                        {coupon.amount
                          ? `$${Number(coupon.amount).toLocaleString('es-AR')}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-text">{coupon.cardType || '—'}</td>
                      <td className="px-4 py-3 text-slate-text text-center">
                        {coupon.installments || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-text text-xs">
                        {coupon.couponDate
                          ? format(new Date(coupon.couponDate), 'dd/MM/yy')
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx(status.cls, 'whitespace-nowrap')}>
                          <StatusIcon size={11} />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/cupones/${coupon.id}`) }}
                            className="p-1.5 rounded-lg text-slate-text hover:text-primary hover:bg-primary/10 transition-colors"
                            title="Ver detalle"
                          >
                            <Eye size={14} />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={(e) => handleReanalyze(coupon.id, e)}
                              className="p-1.5 rounded-lg text-slate-text hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors"
                              title="Reanalizar con IA"
                            >
                              <RefreshCw size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-dark-500">
            <p className="text-xs text-slate-text">
              Página {page} de {totalPages}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-30"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-30"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
