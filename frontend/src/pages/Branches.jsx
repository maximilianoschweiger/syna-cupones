import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Building2, Plus, TrendingUp, TrendingDown, Search, Edit3, Trash2 } from 'lucide-react'
import { branchesAPI } from '../services/api'
import { useAuth } from '../hooks/useAuth.jsx'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function Branches() {
  const { isAdmin } = useAuth()
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editBranch, setEditBranch] = useState(null)
  const [form, setForm] = useState({ code: '', name: '', email: '' })

  useEffect(() => { fetchBranches() }, [])

  const fetchBranches = async () => {
    setLoading(true)
    try {
      const { data } = await branchesAPI.getAll()
      setBranches(data)
    } catch {} finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditBranch(null)
    setForm({ code: '', name: '', email: '' })
    setShowModal(true)
  }

  const openEdit = (branch) => {
    setEditBranch(branch)
    setForm({ code: branch.code, name: branch.name || '', email: branch.email || '' })
    setShowModal(true)
  }

  const handleSave = async () => {
    try {
      if (editBranch) {
        await branchesAPI.update(editBranch.id, form)
        toast.success('Sucursal actualizada')
      } else {
        await branchesAPI.create(form)
        toast.success('Sucursal creada')
      }
      setShowModal(false)
      fetchBranches()
    } catch {}
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta sucursal?')) return
    try {
      await branchesAPI.delete(id)
      toast.success('Sucursal eliminada')
      fetchBranches()
    } catch {}
  }

  const filtered = branches.filter(b =>
    b.code.toLowerCase().includes(search.toLowerCase()) ||
    b.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Sucursales</h1>
          <p className="text-slate-text text-sm mt-0.5">{branches.length} sucursales registradas</p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={15} />
            Nueva sucursal
          </button>
        )}
      </motion.div>

      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-text" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar sucursal..."
          className="input-field pl-10 text-sm py-2.5"
        />
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="card h-40 skeleton" />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((branch, i) => {
            const signedPct = branch._count?.coupons
              ? Math.round(((branch.signedCount || 0) / branch._count.coupons) * 100)
              : 0
            const isGood = signedPct >= 85
            return (
              <motion.div
                key={branch.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="card-hover p-5 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={clsx(
                      'w-10 h-10 rounded-xl flex items-center justify-center',
                      isGood ? 'bg-primary/15' : 'bg-red-500/15'
                    )}>
                      <Building2 size={18} className={isGood ? 'text-primary' : 'text-red-400'} />
                    </div>
                    <div>
                      <p className="font-bold text-white">Suc. {branch.code}</p>
                      <p className="text-xs text-slate-text">{branch.name || 'Sin nombre'}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(branch)}
                        className="p-1.5 text-slate-text hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(branch.id)}
                        className="p-1.5 text-slate-text hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-text">Tasa de firma</span>
                  <div className="flex items-center gap-1">
                    {isGood
                      ? <TrendingUp size={11} className="text-primary" />
                      : <TrendingDown size={11} className="text-red-400" />
                    }
                    <span className={clsx(
                      'text-sm font-bold',
                      isGood ? 'text-primary' : 'text-red-400'
                    )}>{signedPct}%</span>
                  </div>
                </div>
                <div className="h-1.5 bg-dark-500 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${signedPct}%`,
                      background: isGood ? '#00e5a0' : signedPct >= 60 ? '#f59e0b' : '#ef4444',
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-text">
                  <span>{branch._count?.coupons || 0} cupones</span>
                  <span>{branch.email || 'Sin email'}</span>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card p-6 w-full max-w-md"
          >
            <h2 className="text-lg font-bold text-white mb-5">
              {editBranch ? 'Editar sucursal' : 'Nueva sucursal'}
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-text block mb-1.5">
                  Código *
                </label>
                <input
                  value={form.code}
                  onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))}
                  placeholder="110"
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-text block mb-1.5">
                  Nombre
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Sucursal Centro"
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-text block mb-1.5">
                  Email de la sucursal
                </label>
                <input
                  value={form.email}
                  onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="suc110@empresa.com"
                  className="input-field"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button onClick={handleSave} className="btn-primary flex-1">
                {editBranch ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
