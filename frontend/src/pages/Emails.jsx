import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Mail, RefreshCw, Paperclip, CheckCircle, XCircle, Play } from 'lucide-react'
import { emailsAPI } from '../services/api'
import { format } from 'date-fns'
import { useAuth } from '../hooks/useAuth.jsx'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function Emails() {
  const { isAdmin } = useAuth()
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [imapStatus, setImapStatus] = useState(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    fetchEmails()
    if (isAdmin) checkImapStatus()
  }, [page])

  const fetchEmails = async () => {
    setLoading(true)
    try {
      const { data } = await emailsAPI.getAll({ page, limit: 20 })
      setEmails(data.emails)
      setTotal(data.total)
    } catch {} finally {
      setLoading(false)
    }
  }

  const checkImapStatus = async () => {
    try {
      const { data } = await emailsAPI.getStatus()
      setImapStatus(data)
    } catch {}
  }

  const handleProcess = async () => {
    setProcessing(true)
    try {
      const { data } = await emailsAPI.processManual()
      toast.success(`${data.processed} mails procesados`)
      fetchEmails()
    } catch {} finally {
      setProcessing(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Emails</h1>
          <p className="text-slate-text text-sm mt-0.5">{total} mails procesados</p>
        </div>
        <div className="flex items-center gap-2">
          {imapStatus && (
            <div className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium',
              imapStatus.connected
                ? 'bg-primary/10 border-primary/20 text-primary'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            )}>
              <div className={clsx('w-1.5 h-1.5 rounded-full', imapStatus.connected ? 'bg-primary animate-pulse' : 'bg-red-400')} />
              IMAP {imapStatus.connected ? 'Conectado' : 'Desconectado'}
            </div>
          )}
          {isAdmin && (
            <button
              onClick={handleProcess}
              disabled={processing}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              {processing
                ? <RefreshCw size={14} className="animate-spin" />
                : <Play size={14} />
              }
              {processing ? 'Procesando...' : 'Procesar mails'}
            </button>
          )}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="card overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-500">
                {['Asunto', 'Remitente', 'Sucursal', 'Turno', 'Adjuntos', 'Estado', 'Recibido'].map(h => (
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
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 skeleton rounded w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : emails.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-text">
                    <Mail size={24} className="mx-auto mb-2 opacity-40" />
                    <p>No hay mails procesados</p>
                  </td>
                </tr>
              ) : (
                emails.map((email) => (
                  <tr key={email.id} className="table-row">
                    <td className="px-4 py-3 max-w-56">
                      <p className="text-white font-medium truncate text-sm">{email.subject}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-text text-xs max-w-36">
                      <span className="truncate block">{email.senderEmail}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-white">
                        {email.branch ? `Suc. ${email.branch.code}` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-text capitalize text-xs">
                      {email.shift?.toLowerCase() || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Paperclip size={12} className="text-slate-text" />
                        <span className="text-sm font-medium text-white">
                          {email._count?.attachments || 0}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {email.processed ? (
                        <span className="badge-signed">
                          <CheckCircle size={10} />
                          Procesado
                        </span>
                      ) : (
                        <span className="badge-unsigned">
                          <XCircle size={10} />
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-text text-xs">
                      {email.receivedAt ? format(new Date(email.receivedAt), 'dd/MM/yy HH:mm') : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {Math.ceil(total / 20) > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-dark-500">
            <p className="text-xs text-slate-text">Página {page} de {Math.ceil(total / 20)}</p>
            <div className="flex gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-30">Anterior</button>
              <button onClick={() => setPage(p => Math.min(Math.ceil(total / 20), p + 1))} disabled={page >= Math.ceil(total / 20)} className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-30">Siguiente</button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
