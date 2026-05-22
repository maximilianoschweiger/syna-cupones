// Settings.jsx
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Settings as SettingsIcon, Save, TestTube2, Wifi, WifiOff } from 'lucide-react'
import { settingsAPI } from '../services/api'
import toast from 'react-hot-toast'

export default function Settings() {
  const [settings, setSettings] = useState({
    imapHost: '',
    imapPort: '993',
    imapUser: '',
    imapPassword: '',
    imapTls: true,
    openaiModel: 'gpt-4o',
    cronSchedule: '*/15 * * * *',
    unsignedThreshold: '5',
    alertEmail: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingImap, setTestingImap] = useState(false)
  const [testingAI, setTestingAI] = useState(false)

  useEffect(() => {
    settingsAPI.get().then(({ data }) => {
      setSettings(s => ({ ...s, ...data }))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await settingsAPI.update(settings)
      toast.success('Configuración guardada')
    } catch {} finally {
      setSaving(false)
    }
  }

  const testImap = async () => {
    setTestingImap(true)
    try {
      await settingsAPI.testImap(settings)
      toast.success('¡IMAP conectado correctamente!')
    } catch {
      toast.error('Error al conectar IMAP')
    } finally {
      setTestingImap(false)
    }
  }

  const testAI = async () => {
    setTestingAI(true)
    try {
      await settingsAPI.testOpenAI()
      toast.success('¡OpenAI API funcionando!')
    } catch {
      toast.error('Error al conectar OpenAI')
    } finally {
      setTestingAI(false)
    }
  }

  const field = (key, label, type = 'text', placeholder = '') => (
    <div key={key}>
      <label className="text-xs font-semibold uppercase tracking-wider text-slate-text block mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={settings[key]}
        onChange={(e) => setSettings(s => ({ ...s, [key]: e.target.value }))}
        placeholder={placeholder}
        className="input-field"
      />
    </div>
  )

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-white">Configuración</h1>
        <p className="text-slate-text text-sm mt-0.5">IMAP, IA y parámetros del sistema</p>
      </motion.div>

      {/* IMAP */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <Wifi size={16} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Configuración IMAP</h2>
              <p className="text-xs text-slate-text">Cuenta de correo para recibir cupones</p>
            </div>
          </div>
          <button onClick={testImap} disabled={testingImap} className="btn-secondary flex items-center gap-2 text-sm">
            <TestTube2 size={13} />
            {testingImap ? 'Probando...' : 'Probar'}
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {field('imapHost', 'Servidor IMAP', 'text', 'imap.gmail.com')}
          {field('imapPort', 'Puerto', 'number', '993')}
          {field('imapUser', 'Usuario / Email', 'email', 'cupones@syna.com.ar')}
          {field('imapPassword', 'Contraseña / App Password', 'password', '••••••••')}
        </div>
      </motion.div>

      {/* OpenAI */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/10 rounded-xl">
              <SettingsIcon size={16} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">OpenAI Vision API</h2>
              <p className="text-xs text-slate-text">Configuración del modelo de análisis</p>
            </div>
          </div>
          <button onClick={testAI} disabled={testingAI} className="btn-secondary flex items-center gap-2 text-sm">
            <TestTube2 size={13} />
            {testingAI ? 'Probando...' : 'Probar API'}
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-text block mb-1.5">Modelo</label>
            <select value={settings.openaiModel} onChange={(e) => setSettings(s => ({ ...s, openaiModel: e.target.value }))} className="input-field">
              <option value="gpt-4o">GPT-4o (recomendado)</option>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="gpt-4-vision-preview">GPT-4 Vision</option>
            </select>
          </div>
          {field('cronSchedule', 'Cron (revisar mails)', 'text', '*/15 * * * *')}
          {field('unsignedThreshold', 'Umbral alertas (sin firma)', 'number', '5')}
          {field('alertEmail', 'Email para alertas', 'email', 'admin@empresa.com')}
        </div>
      </motion.div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
          <Save size={15} />
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  )
}
