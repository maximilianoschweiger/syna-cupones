import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { processMails, testImapConnection } from '../services/imapService.js'

const router = Router()
const prisma = new PrismaClient()

// GET /api/emails
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, branchId, processed, dateFrom, dateTo } = req.query
    const skip = (Number(page) - 1) * Number(limit)
    const where = {
      ...(branchId && { branchId }),
      ...(processed !== undefined && { processed: processed === 'true' }),
      ...(dateFrom || dateTo ? {
        receivedAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo + 'T23:59:59Z') }),
        }
      } : {}),
    }

    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where, skip, take: Number(limit),
        orderBy: { receivedAt: 'desc' },
        include: {
          branch: { select: { code: true, name: true } },
          _count: { select: { attachments: true } }
        }
      }),
      prisma.email.count({ where })
    ])

    res.json({ data: emails, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/emails/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const email = await prisma.email.findUnique({
      where: { id: req.params.id },
      include: {
        branch: true,
        attachments: {
          include: { coupon: true }
        }
      }
    })
    if (!email) return res.status(404).json({ message: 'Mail no encontrado' })
    res.json(email)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/emails/process — manual trigger
router.post('/process', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    res.json({ message: 'Procesamiento iniciado en segundo plano' })
    processMails().catch(err => console.error('Manual process error:', err))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/emails/imap/status
router.get('/imap/status', authMiddleware, async (req, res) => {
  try {
    const ok = await testImapConnection()
    res.json({ connected: ok })
  } catch (err) {
    res.json({ connected: false, error: err.message })
  }
})

export default router
