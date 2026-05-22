import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const router = Router()
const prisma = new PrismaClient()

// GET /api/alerts
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, type, dismissed, branchId } = req.query
    const skip = (Number(page) - 1) * Number(limit)
    const where = {
      ...(type && { type }),
      ...(dismissed !== undefined && { dismissed: dismissed === 'true' }),
      ...(branchId && { branchId }),
    }

    const [alerts, total] = await Promise.all([
      prisma.alert.findMany({
        where, skip, take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          branch: { select: { code: true, name: true } },
          email: { select: { subject: true, from: true } },
          coupon: { select: { id: true } }
        }
      }),
      prisma.alert.count({ where })
    ])

    const pending = await prisma.alert.count({ where: { dismissed: false } })

    res.json({ data: alerts, total, pending, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PATCH /api/alerts/:id/dismiss
router.patch('/:id/dismiss', authMiddleware, async (req, res) => {
  try {
    const alert = await prisma.alert.update({
      where: { id: req.params.id },
      data: { dismissed: true, dismissedAt: new Date(), dismissedById: req.user.id }
    })
    res.json(alert)
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Alerta no encontrada' })
    res.status(500).json({ message: err.message })
  }
})

// POST /api/alerts/dismiss-all
router.post('/dismiss-all', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { type } = req.body
    const result = await prisma.alert.updateMany({
      where: { dismissed: false, ...(type && { type }) },
      data: { dismissed: true, dismissedAt: new Date(), dismissedById: req.user.id }
    })
    res.json({ dismissed: result.count })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
