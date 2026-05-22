import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const router = Router()
const prisma = new PrismaClient()

// GET /api/logs
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 50, level, service, search } = req.query
    const skip = (Number(page) - 1) * Number(limit)
    const where = {
      ...(level && { level }),
      ...(service && { service }),
      ...(search && {
        OR: [
          { message: { contains: search, mode: 'insensitive' } },
          { service: { contains: search, mode: 'insensitive' } },
        ]
      })
    }

    const [logs, total] = await Promise.all([
      prisma.systemLog.findMany({
        where, skip, take: Number(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.systemLog.count({ where })
    ])

    res.json({ data: logs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/logs — clear old logs
router.delete('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { olderThanDays = 30 } = req.body
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)
    const result = await prisma.systemLog.deleteMany({ where: { createdAt: { lt: cutoff } } })
    res.json({ deleted: result.count })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
