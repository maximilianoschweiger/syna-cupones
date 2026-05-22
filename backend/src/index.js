import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { PrismaClient } from '@prisma/client'
import { startCronJobs } from './jobs/emailProcessor.js'

// Routes
import authRoutes from './routes/auth.js'
import dashboardRoutes from './routes/dashboard.js'
import couponsRoutes from './routes/coupons.js'
import branchesRoutes from './routes/branches.js'
import emailsRoutes from './routes/emails.js'
import alertsRoutes from './routes/alerts.js'
import usersRoutes from './routes/users.js'
import settingsRoutes from './routes/settings.js'
import logsRoutes from './routes/logs.js'

const app = express()
const prisma = new PrismaClient()
const PORT = process.env.PORT || 3001

// ── Security ──
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    /\.netlify\.app$/,
  ],
  credentials: true,
}))

// ── Rate limiting ──
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true }))
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }))

// ── Body ──
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// ── Routes ──
app.use('/api/auth', authRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/coupons', couponsRoutes)
app.use('/api/branches', branchesRoutes)
app.use('/api/emails', emailsRoutes)
app.use('/api/alerts', alertsRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/logs', logsRoutes)

// ── Health check ──
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))

// ── 404 ──
app.use((req, res) => res.status(404).json({ message: 'Ruta no encontrada' }))

// ── Error handler ──
app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({ message: err.message || 'Error interno del servidor' })
})

// ── Start ──
async function main() {
  try {
    await prisma.$connect()
    console.log('✅ PostgreSQL conectado')
    app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`))
    setTimeout(() => startCronJobs(), 10000)
  } catch (err) {
    console.error('❌ Error al iniciar:', err)
    process.exit(1)
  }
}

main()

// ── Graceful shutdown ──
process.on('SIGTERM', async () => {
  await prisma.$disconnect()
  process.exit(0)
})
