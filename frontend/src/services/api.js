import axios from 'axios'
import toast from 'react-hot-toast'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor — attach token
api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem('syna_token') ||
      sessionStorage.getItem('syna_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor — handle errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || 'Error de conexión'
    const status = error.response?.status

    if (status === 401) {
      localStorage.removeItem('syna_token')
      localStorage.removeItem('syna_user')
      sessionStorage.removeItem('syna_token')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (status === 403) {
      toast.error('No tenés permisos para esta acción')
    } else if (status >= 500) {
      toast.error('Error del servidor. Intentá de nuevo.')
    } else if (status !== 404) {
      toast.error(message)
    }

    return Promise.reject(error)
  }
)

export default api

// ─── Auth ──────────────────────────────────────────────
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
}

// ─── Dashboard ─────────────────────────────────────────
export const dashboardAPI = {
  getStats: (params) => api.get('/dashboard/stats', { params }),
  getDailyChart: (params) => api.get('/dashboard/daily', { params }),
  getMonthlyChart: (params) => api.get('/dashboard/monthly', { params }),
  getTopBranches: (params) => api.get('/dashboard/top-branches', { params }),
  getRecentActivity: () => api.get('/dashboard/recent'),
}

// ─── Coupons ───────────────────────────────────────────
export const couponsAPI = {
  getAll: (params) => api.get('/coupons', { params }),
  getById: (id) => api.get(`/coupons/${id}`),
  updateStatus: (id, data) => api.patch(`/coupons/${id}/status`, data),
  reanalyze: (id) => api.post(`/coupons/${id}/reanalyze`),
  delete: (id) => api.delete(`/coupons/${id}`),
  export: (params) => api.get('/coupons/export', { params, responseType: 'blob' }),
}

// ─── Branches ──────────────────────────────────────────
export const branchesAPI = {
  getAll: () => api.get('/branches'),
  getById: (id) => api.get(`/branches/${id}`),
  getStats: (id, params) => api.get(`/branches/${id}/stats`, { params }),
  create: (data) => api.post('/branches', data),
  update: (id, data) => api.put(`/branches/${id}`, data),
  delete: (id) => api.delete(`/branches/${id}`),
}

// ─── Emails ────────────────────────────────────────────
export const emailsAPI = {
  getAll: (params) => api.get('/emails', { params }),
  getById: (id) => api.get(`/emails/${id}`),
  processManual: () => api.post('/emails/process'),
  getStatus: () => api.get('/emails/imap-status'),
}

// ─── Alerts ────────────────────────────────────────────
export const alertsAPI = {
  getAll: (params) => api.get('/alerts', { params }),
  dismiss: (id) => api.patch(`/alerts/${id}/dismiss`),
  dismissAll: () => api.patch('/alerts/dismiss-all'),
}

// ─── Users ─────────────────────────────────────────────
export const usersAPI = {
  getAll: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  resetPassword: (id) => api.post(`/users/${id}/reset-password`),
}

// ─── Settings ──────────────────────────────────────────
export const settingsAPI = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
  testImap: (data) => api.post('/settings/test-imap', data),
  testOpenAI: () => api.post('/settings/test-openai'),
}

// ─── Logs ──────────────────────────────────────────────
export const logsAPI = {
  getAll: (params) => api.get('/logs', { params }),
  clear: () => api.delete('/logs'),
}
