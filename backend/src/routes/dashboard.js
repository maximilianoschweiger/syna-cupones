import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware } from '../middleware/auth.js'
import { subDays, startOfDay, format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'

const router = express.Router()
const prisma = new PrismaClient()

router.use(authMiddleware)

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const [total, signed, unsigned, dubious, branches, emails] = await Promise.all([
      prisma.coupon.count(),
      prisma.coupon.count({ where: { signatureStatus: 'SIGNED' } }),
      prisma.coupon.count({ where: { signatureStatus: 'UNSIGNED' } }),
      prisma.coupon.count({ where: { signatureStatus: 'DUBIOUS' } }),
      prisma.branch.count(),
      prisma.email.count({ where: { processed: true } }),
    ])

    res.json({
      totalCoupons: total,
      signedCoupons: signed,
      unsignedCoupons: unsigned,
      dubiousCoupons: dubious,
      totalBranches: branches,
      totalEmails: emails,
    })
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener estadísticas' })
  }
})

// GET /api/dashboard/daily
router.get('/daily', async (req, res) => {
  try {
    const days = 14
    const start = startOfDay(subDays(new Date(), days - 1))

    const coupons = await prisma.coupon.findMany({
      where: { createdAt: { gte: start } },
      select: { createdAt: true, signatureStatus: true },
    })

    const interval = eachDayOfInterval({ start, end: new Date() })
    const data = interval.map((day) => {
      const dayStr = format(day, 'dd/MM')
      const dayStart = startOfDay(day)
      const dayEnd = new Date(dayStart.getTime() + 86400000)
      const dayCoupons = coupons.filter(
        (c) => c.createdAt >= dayStart && c.createdAt < dayEnd
      )
      return {
        date: dayStr,
        firmados: dayCoupons.filter((c) => c.signatureStatus === 'SIGNED').length,
        noFirmados: dayCoupons.filter((c) => c.signatureStatus === 'UNSIGNED').length,
        dudosos: dayCoupons.filter((c) => c.signatureStatus === 'DUBIOUS').length,
      }
    })

    res.json(data)
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener datos diarios' })
  }
})

// GET /api/dashboard/monthly
router.get('/monthly', async (req, res) => {
  try {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const date = subDays(new Date(), i * 30)
      const start = startOfMonth(date)
      const end = endOfMonth(date)

      const [signed, unsigned] = await Promise.all([
        prisma.coupon.count({
          where: { createdAt: { gte: start, lte: end }, signatureStatus: 'SIGNED' },
        }),
        prisma.coupon.count({
          where: { createdAt: { gte: start, lte: end }, signatureStatus: 'UNSIGNED' },
        }),
      ])

      months.push({
        month: format(date, 'MMM'),
        firmados: signed,
        noFirmados: unsigned,
      })
    }
    res.json(months)
  } catch (err) {
    res.status(500).json({ message: 'Error' })
  }
})

// GET /api/dashboard/top-branches
router.get('/top-branches', async (req, res) => {
  try {
    const branches = await prisma.branch.findMany({
      include: {
        _count: { select: { emails: true } },
        emails: {
          include: {
            attachments: {
              include: { coupons: { select: { signatureStatus: true } } },
            },
          },
        },
      },
    })

    const result = branches.map((branch) => {
      const allCoupons = branch.emails.flatMap((e) =>
        e.attachments.flatMap((a) => a.coupons)
      )
      return {
        id: branch.id,
        code: branch.code,
        name: branch.name,
        total: allCoupons.length,
        signed: allCoupons.filter((c) => c.signatureStatus === 'SIGNED').length,
        unsigned: allCoupons.filter((c) => c.signatureStatus === 'UNSIGNED').length,
      }
    })

    result.sort((a, b) => {
      const aPct = a.total ? a.signed / a.total : 0
      const bPct = b.total ? b.signed / b.total : 0
      return bPct - aPct
    })

    res.json(result)
  } catch (err) {
    res.status(500).json({ message: 'Error' })
  }
})

// GET /api/dashboard/recent
router.get('/recent', async (req, res) => {
  try {
    const recent = await prisma.coupon.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        attachment: {
          include: {
            email: { include: { branch: true } },
          },
        },
      },
    })
    res.json(recent)
  } catch (err) {
    res.status(500).json({ message: 'Error' })
  }
})

export default router
