import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users as UsersIcon, Plus, Edit3, Trash2, Key, Shield, User } from 'lucide-react'
import { usersAPI } from '../services/api'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function Users() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'USER' })

  useEffect(() => { fetchUsers() }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const { data } = await usersAPI.getAll()
      setUsers(data)
    } catch {} finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditUser(null)
    setForm({ name: '', email: '', password: '', role: 'USER' })
    setShowModal(true)
  }

  const openEdit = (user) => {
    setEditUser(user)
    setForm({ name: user.name, email: user.email, password: '', role: user.role })
    setShowModal(true)
  }

  const handleSave = async () => {
    try {
      if (editUser) {
        const { password, ...data } = form
        await usersAPI.update(editUser.id, password ? form : data)
        toast.success('Usuario actualizado')
      } else {
        await usersAPI.create(form)
        toast.success('Usuario creado')
      }
      setShowModal(false)
      fetchUsers()
    } catch {}
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este usuario?')) return
    try {
      await usersAPI.delete(id)
      toast.success('Usuario eliminado')
      fetchUsers()
    } catch {}
  }

  const handleReset = async (id) => {
    try {
      const { data } = await usersAPI.resetPassword(id)
      toast.success(`Nueva contraseña: ${data.password}`, { duration: 8000 })
    } catch {}
  }

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Usuarios</h1>
          <p className="text-slate-text text-sm mt-0.5">{users.length} usuarios registrados</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} />
          Nuevo usuario
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="card overflow-hidden"
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dark-500">
              {['Usuario', 'Email', 'Rol', 'Creado', 'Acciones'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-text">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i} className="border-b border-dark-500/50">
                  {[...Array(5)].map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 skeleton rounded" /></td>
                  ))}
                </tr>
              ))
            ) : users.map((user) => (
              <tr key={user.id} className="table-row">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary text-xs font-bold">
                        {user.name[0].toUpperCase()}
                      </span>
                    </div>
                    <span className="font-semibold text-white">{user.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-text">{user.email}</td>
                <td className="px-4 py-3">
                  <span className={clsx(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
                    user.role === 'ADMIN'
                      ? 'bg-primary/15 text-primary border border-primary/20'
                      : 'bg-dark-500 text-slate-text border border-dark-400'
                  )}>
                    {user.role === 'ADMIN' ? <Shield size={10} /> : <User size={10} />}
                    {user.role === 'ADMIN' ? 'Admin' : 'Usuario'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-text text-xs">
                  {format(new Date(user.createdAt), 'dd/MM/yyyy')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEdit(user)}
                      className="p-1.5 text-slate-text hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => handleReset(user.id)}
                      className="p-1.5 text-slate-text hover:text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-colors"
                      title="Reset contraseña"
                    >
                      <Key size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="p-1.5 text-slate-text hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card p-6 w-full max-w-md"
          >
            <h2 className="text-lg font-bold text-white mb-5">
              {editUser ? 'Editar usuario' : 'Nuevo usuario'}
            </h2>
            <div className="flex flex-col gap-4">
              {[
                { key: 'name', label: 'Nombre', type: 'text', placeholder: 'Juan Pérez' },
                { key: 'email', label: 'Email', type: 'email', placeholder: 'juan@empresa.com' },
                { key: 'password', label: editUser ? 'Nueva contraseña (opcional)' : 'Contraseña', type: 'password', placeholder: '••••••••' },
              ].map(({ key, label, type, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-text block mb-1.5">
                    {label}
                  </label>
                  <input
                    type={type}
                    value={form[key]}
                    onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="input-field"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-text block mb-1.5">
                  Rol
                </label>
                <select
                  value={form.role}
                  onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))}
                  className="input-field"
                >
                  <option value="USER">Usuario</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleSave} className="btn-primary flex-1">
                {editUser ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
