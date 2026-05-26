import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) return toast.error('Completá todos los campos')
    setLoading(true)
    try {
      await login(email, password, remember)
      // navigate is already called inside useAuth.login()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Credenciales incorrectas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#0a1628' }}>
      {/* LEFT — Form */}
      <div className="flex flex-col justify-center px-12 lg:px-20 w-full lg:w-1/2 relative">
        {/* Logo */}
        <div className="absolute top-8 left-12 lg:left-20 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-primary shadow-glow-sm" />
          <span className="text-white font-bold text-lg tracking-tight">
            <span className="text-primary">Syna</span> Cupones
          </span>
        </div>

        <div className="max-w-sm w-full">
          <h1 className="text-4xl font-bold text-white mb-1">¡Hola!</h1>
          <p className="text-slate-400 text-sm mb-8">Iniciá sesión para continuar</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="login-input"
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="login-input pr-12"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() => setRemember(!remember)}
                className={`w-4 h-4 rounded flex items-center justify-center border transition-all duration-200 cursor-pointer ${
                  remember
                    ? 'bg-primary border-primary'
                    : 'bg-transparent border-slate-600'
                }`}
              >
                {remember && (
                  <svg className="w-2.5 h-2.5 text-dark-900" fill="none" viewBox="0 0 12 12">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-slate-300">Recordarme</span>
            </label>

            {/* Buttons */}
            <div className="flex gap-3 mt-1">
              <button
                type="button"
                className="flex-1 py-3 rounded-xl border border-primary text-primary font-semibold text-sm
                           hover:bg-primary/10 transition-all duration-200 active:scale-95"
              >
                Registrarse
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 rounded-xl bg-white text-gray-900 font-semibold text-sm
                           hover:bg-gray-100 transition-all duration-200 active:scale-95
                           disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Ingresando...
                  </span>
                ) : 'Ingresar'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <button className="text-sm text-primary hover:text-primary-400 transition-colors font-medium">
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT — Illustration */}
      <div
        className="hidden lg:flex flex-col items-center justify-center w-1/2 relative overflow-hidden"
        style={{ background: 'radial-gradient(ellipse at center, #0d2a40 0%, #060f1e 70%)' }}
      >
        {/* Ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 60% 60% at 50% 55%, rgba(0,229,160,0.12) 0%, transparent 70%)',
          }}
        />

        {/* Phone mascot SVG */}
        <div className="relative z-10 flex flex-col items-center gap-6">
          <svg
            viewBox="0 0 280 380"
            width="280"
            height="380"
            className="drop-shadow-2xl"
            style={{ filter: 'drop-shadow(0 0 40px rgba(0,229,160,0.35))' }}
          >
            {/* Left arm */}
            <g>
              <line x1="72" y1="165" x2="30" y2="120" stroke="#00e5a0" strokeWidth="14" strokeLinecap="round"/>
              <circle cx="30" cy="120" r="10" fill="#00e5a0"/>
            </g>
            {/* Right arm */}
            <g>
              <line x1="208" y1="165" x2="250" y2="120" stroke="#00e5a0" strokeWidth="14" strokeLinecap="round"/>
              <circle cx="250" cy="120" r="10" fill="#00e5a0"/>
            </g>
            {/* Left leg */}
            <g>
              <line x1="110" y1="300" x2="88" y2="355" stroke="#00e5a0" strokeWidth="14" strokeLinecap="round"/>
              <ellipse cx="88" cy="360" rx="16" ry="9" fill="#00e5a0"/>
            </g>
            {/* Right leg */}
            <g>
              <line x1="170" y1="300" x2="192" y2="355" stroke="#00e5a0" strokeWidth="14" strokeLinecap="round"/>
              <ellipse cx="192" cy="360" rx="16" ry="9" fill="#00e5a0"/>
            </g>
            {/* Phone body */}
            <rect x="72" y="100" width="136" height="210" rx="22" ry="22" fill="#00e5a0"/>
            {/* Screen */}
            <rect x="82" y="116" width="116" height="178" rx="12" ry="12" fill="#08101e"/>
            {/* Camera notch */}
            <rect x="118" y="108" width="44" height="8" rx="4" fill="#08b07a"/>
            {/* Screen content — logo text */}
            <text
              x="140"
              y="213"
              textAnchor="middle"
              fontFamily="Arial, sans-serif"
              fontWeight="700"
              fontSize="22"
              fill="white"
            >
              Syna
            </text>
            <text
              x="140"
              y="238"
              textAnchor="middle"
              fontFamily="Arial, sans-serif"
              fontWeight="400"
              fontSize="13"
              fill="#00e5a0"
            >
              Cupones
            </text>
            {/* Decorative screen bars */}
            <rect x="100" y="252" width="80" height="5" rx="2.5" fill="#1a2e48"/>
            <rect x="108" y="263" width="64" height="4" rx="2" fill="#1a2e48"/>
          </svg>

          {/* Bottom label */}
          <div className="text-center">
            <p className="text-white font-bold text-xl tracking-tight">
              <span className="text-primary">Syna</span> Cupones
            </p>
            <p className="text-slate-400 text-sm mt-1">Sistema de auditoría inteligente</p>
          </div>
        </div>
      </div>
    </div>
  )
}
