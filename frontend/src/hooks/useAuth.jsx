import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    // Check localStorage first (remember=true), then sessionStorage (remember=false)
    const token   = localStorage.getItem('syna_token')   || sessionStorage.getItem('syna_token')
    const savedUser = localStorage.getItem('syna_user')  || sessionStorage.getItem('syna_user')
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser))
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      } catch {
        localStorage.clear()
        sessionStorage.clear()
      }
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (email, password, remember = false) => {
    const { data } = await api.post('/auth/login', { email, password })
    const { token, user: userData } = data
    const userJson = JSON.stringify(userData)

    if (remember) {
      localStorage.setItem('syna_token', token)
      localStorage.setItem('syna_user', userJson)
    } else {
      // Store both token and user in sessionStorage so page reload keeps session
      sessionStorage.setItem('syna_token', token)
      sessionStorage.setItem('syna_user', userJson)
    }

    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    setUser(userData)
    navigate('/dashboard')
    return userData
  }, [navigate])

  const logout = useCallback(() => {
    localStorage.removeItem('syna_token')
    localStorage.removeItem('syna_user')
    sessionStorage.removeItem('syna_token')
    delete api.defaults.headers.common['Authorization']
    setUser(null)
    navigate('/login')
  }, [navigate])

  const isAdmin = user?.role === 'ADMIN'

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
