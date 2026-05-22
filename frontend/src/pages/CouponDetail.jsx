import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import {
  ArrowLeft, CheckCircle2, XCircle, AlertTriangle,
  ZoomIn, ZoomOut, RotateCcw, RefreshCw, Edit3, Save, X
} from 'lucide-react'
import { couponsAPI } from '../services/api'
import { format } from 'date-fns'
import { useAuth } from '../hooks/useAuth.jsx'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const STATUS_MAP = {
  SIGNED: { cls: 'badge-signed', icon: CheckCircle2, label: 'Firmado', color: '#00e5a0' },
  UNSIGNED: { cls: 'badge-unsigned', icon: XCircle, label: 'Sin firma', color: '#ef4444' },
  DUBIOUS: { cls: 'badge-dubious', icon: AlertTriangle, label: 'Dudoso', color: '#f59e0b' },
}

export default function CouponDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [coupon, setCoupon] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editStatus, setEditStatus] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [reanalyzing, setReanalyzing] = useState(false)

  useEffect(() => {
    fetchCoupon()
  }, [id])

  const fetchCoupon = async () => {
    setLoading(true)
    try {
      const { data } = await couponsAPI.getById(id)
      setCoupon(data)
      setEditStatus(data.signatureStatus)
      setEditNotes(data.notes || '')
    } catch {
      navigate('/cupones')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await couponsAPI.updateStatus(id, { signatureStatus: editStatus, notes: editNotes })
      toast.success('Estado actualizado')
      setEditing(false)
      fetchCoupon()
    } catch {} finally {
      setSaving(false)
    }
  }

  const handleReanalyze = async () => {
    setReanalyzing(true)
    try {
      await couponsAPI.reanalyze(id)
      toast.success('Reanalizado con IA correctamente')
      fetchCoupon()
    } catch {} finally {
      setReanalyzing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (!coupon) return null

  const status = STATUS_MAP[coupon.signatureStatus] || STATUS_MAP.DUBIOUS
  const StatusIcon = status.icon

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      {/* Back + header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/cupones')}
            className="btn-ghost flex items-center gap-2 text-sm"
          >
            <ArrowLeft size={14} />
            Volver
          </button>
          <div className="w-px h-5 bg-dark-500" />
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Cupón #{coupon.couponNumber || id.slice(-8)}
              <span className={status.cls}>
                <StatusIcon size={11} />
                {status.label}
              </span>
            </h1>
            <p className="text-slate-text text-xs mt-0.5">
              Procesado {format(new Date(coupon.createdAt), 'dd/MM/yyyy HH:mm')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && !editing && (
            <>
              <button
                onClick={handleReanalyze}
                disabled={reanalyzing}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <RefreshCw size={14} className={reanalyzing ? 'animate-spin' : ''} />
                Reanalizar IA
              </button>
              <button
                onClick={() => setEditing(true)}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <Edit3 size={14} />
                Editar estado
              </button>
            </>
          )}
          {isAdmin && editing && (
            <>
              <button onClick={() => setEditing(false)} className="btn-secondary flex items-center gap-2 text-sm">
                <X size={14} /> Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
                <Save size={14} />
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          )}
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Image viewer */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="card overflow-hidden"
        >
          <div className="p-4 border-b border-dark-500 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Imagen del cupón</h2>
            <div className="flex items-center gap-1 text-xs text-slate-text">
              <ZoomIn size={12} />
              <span>Usá scroll para hacer zoom</span>
            </div>
          </div>
          <div className="bg-dark-900 aspect-[4/3] flex items-center justify-center overflow-hidden">
            {coupon.attachment?.imageUrl ? (
              <TransformWrapper initialScale={1} minScale={0.5} maxScale={4}>
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <div className="w-full h-full relative">
                    <div className="absolute top-3 right-3 z-10 flex gap-1.5">
                      <button
                        onClick={() => zoomIn()}
                        className="p-1.5 bg-dark-700/80 border border-dark-500 rounded-lg text-slate-text hover:text-white backdrop-blur-sm"
                      >
                        <ZoomIn size={14} />
                      </button>
                      <button
                        onClick={() => zoomOut()}
                        className="p-1.5 bg-dark-700/80 border border-dark-500 rounded-lg text-slate-text hover:text-white backdrop-blur-sm"
                      >
                        <ZoomOut size={14} />
                      </button>
                      <button
                        onClick={() => resetTransform()}
                        className="p-1.5 bg-dark-700/80 border border-dark-500 rounded-lg text-slate-text hover:text-white backdrop-blur-sm"
                      >
                        <RotateCcw size={14} />
                      </button>
                    </div>
                    <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full">
                      <img
                        src={coupon.attachment.imageUrl}
                        alt="Cupón"
                        className="w-full h-full object-contain"
                      />
                    </TransformComponent>
                  </div>
                )}
              </TransformWrapper>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-text">
                <XCircle size={32} className="opacity-30" />
                <p className="text-sm">Sin imagen disponible</p>
              </div>
            )}
          </div>
          {/* IA confidence */}
          {coupon.aiConfidence != null && (
            <div className="p-4 border-t border-dark-500">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-text">Confianza IA</span>
                <span className="text-xs font-semibold" style={{ color: status.color }}>
                  {Math.round(coupon.aiConfidence * 100)}%
                </span>
              </div>
              <div className="h-1.5 bg-dark-500 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${coupon.aiConfidence * 100}%`,
                    background: status.color,
                  }}
                />
              </div>
            </div>
          )}
        </motion.div>

        {/* Details */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="flex flex-col gap-4"
        >
          {/* Edit status */}
          {editing && (
            <div className="card p-4 border-primary/30">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">
                Editar estado
              </p>
              <div className="flex gap-2 mb-3">
                {Object.entries(STATUS_MAP).map(([key, val]) => {
                  const Icon = val.icon
                  return (
                    <button
                      key={key}
                      onClick={() => setEditStatus(key)}
                      className={clsx(
                        'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border transition-all',
                        editStatus === key
                          ? `${val.cls} border-current`
                          : 'border-dark-400 text-slate-text hover:border-dark-300'
                      )}
                    >
                      <Icon size={12} />
                      {val.label}
                    </button>
                  )
                })}
              </div>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Notas adicionales..."
                className="input-field resize-none text-sm"
                rows={3}
              />
            </div>
          )}

          {/* Data extracted */}
          <div className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-text mb-4">
              Datos extraídos por IA
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {[
                { label: 'Monto', value: coupon.amount ? `$${Number(coupon.amount).toLocaleString('es-AR')}` : '—' },
                { label: 'Cuotas', value: coupon.installments || '—' },
                { label: 'Tarjeta', value: coupon.cardType || '—' },
                { label: 'N° cupón', value: coupon.couponNumber || '—' },
                { label: 'Autorización', value: coupon.authCode || '—' },
                { label: 'Comercio', value: coupon.merchant || '—' },
                { label: 'Fecha cupón', value: coupon.couponDate ? format(new Date(coupon.couponDate), 'dd/MM/yyyy') : '—' },
                { label: 'Firma', value: STATUS_MAP[coupon.signatureStatus]?.label || '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs text-slate-text mb-0.5">{label}</dt>
                  <dd className="text-sm font-semibold text-white truncate">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Origin */}
          <div className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-text mb-4">
              Mail de origen
            </p>
            <div className="flex flex-col gap-2 text-sm">
              {[
                { label: 'Sucursal', value: `Suc. ${coupon.email?.branch?.code || '—'}` },
                { label: 'Turno', value: coupon.email?.shift || '—' },
                { label: 'Remitente', value: coupon.email?.senderEmail || '—' },
                { label: 'Asunto', value: coupon.email?.subject || '—' },
                { label: 'Recibido', value: coupon.email?.receivedAt ? format(new Date(coupon.email.receivedAt), 'dd/MM/yyyy HH:mm') : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-4">
                  <span className="text-slate-text flex-shrink-0">{label}</span>
                  <span className="text-white font-medium text-right truncate max-w-48">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {coupon.notes && !editing && (
            <div className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-text mb-2">Notas</p>
              <p className="text-sm text-white/80">{coupon.notes}</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
