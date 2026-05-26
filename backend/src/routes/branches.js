import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { body, validationResult } from 'express-validator'

const router = Router()
const prisma = new PrismaClient()

// GET /api/branches
router.get('/', authMiddleware, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const branches = await prisma.branch.findMany({
      orderBy: { code: 'asc' },
      include: {
        _count: { select: { emails: true } },
      },
    })

    // Get coupon stats per branch using the denormalized branchId on Coupon
    const couponStats = await prisma.coupon.groupBy({
      by: ['branchId', 'signatureStatus'],
      where: {
        branchId:    { not: null },
        isBatchClose: false,
        createdAt:   { gte: thirtyDaysAgo },
      },
      _count: { id: true },
    })

    const totalCouponsPerBranch = await prisma.coupon.groupBy({
      by: ['branchId'],
      where: { branchId: { not: null }, isBatchClose: false },
      _count: { id: true },
    })

    const statsMap = {}
    for (const row of couponStats) {
      if (!row.branchId) continue
      if (!statsMap[row.branchId]) statsMap[row.branchId] = { total: 0, signed: 0 }
      statsMap[row.branchId].total += row._count.id
      if (row.signatureStatus === 'SIGNED') statsMap[row.branchId].signed += row._count.id
    }

    const totalMap = {}
    for (const row of totalCouponsPerBranch) {
      if (row.branchId) totalMap[row.branchId] = row._count.id
    }

    const result = branches.map((b) => {
      const s = statsMap[b.id] || { total: 0, signed: 0 }
      return {
        ...b,
        _count: undefined,
        stats: {
          totalCoupons:  totalMap[b.id] || 0,
          totalEmails:   b._count.emails,
          recentTotal:   s.total,
          recentSigned:  s.signed,
          signatureRate: s.total > 0 ? Math.round((s.signed / s.total) * 100) : 0,
        },
      }
    })

    res.json(result)
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener sucursales', error: err.message })
  }
})

// GET /api/branches/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const branch = await prisma.branch.findUnique({
      where: { id: req.params.id },
      include: {
        emails: { orderBy: { receivedAt: 'desc' }, take: 10 },
      },
    })
    if (!branch) return res.status(404).json({ message: 'Sucursal no encontrada' })

    // Coupons via denormalized branchId
    const coupons = await prisma.coupon.findMany({
      where:   { branchId: req.params.id, isBatchClose: false },
      orderBy: { createdAt: 'desc' },
      take:    20,
      include: { attachment: { select: { imageUrl: true } } },
    })

    res.json({ ...branch, coupons })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/branches/:id/stats
router.get('/:id/stats', authMiddleware, async (req, res) => {
  try {
    const { days = 30 } = req.query
    const from = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000)

    const [total, signed, unsigned, dubious] = await Promise.all([
      prisma.coupon.count({ where: { branchId: req.params.id, isBatchClose: false, createdAt: { gte: from } } }),
      prisma.coupon.count({ where: { branchId: req.params.id, signatureStatus: 'SIGNED',   isBatchClose: false, createdAt: { gte: from } } }),
      prisma.coupon.count({ where: { branchId: req.params.id, signatureStatus: 'UNSIGNED', isBatchClose: false, createdAt: { gte: from } } }),
      prisma.coupon.count({ where: { branchId: req.params.id, signatureStatus: 'DUBIOUS',  isBatchClose: false, createdAt: { gte: from } } }),
    ])

    res.json({ total, signed, unsigned, dubious, signatureRate: total > 0 ? Math.round((signed / total) * 100) : 0 })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/branches
router.post('/', authMiddleware, adminMiddleware, [
  body('code').notEmpty().trim(),
  body('name').notEmpty().trim(),
], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

  try {
    const { code, name, email } = req.body
    const existing = await prisma.branch.findFirst({ where: { code } })
    if (existing) return res.status(409).json({ message: 'Ya existe una sucursal con ese código' })

    const branch = await prisma.branch.create({ data: { code, name, email: email || null } })
    res.status(201).json(branch)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PATCH /api/branches/:id
router.patch('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, email, active } = req.body
    const branch = await prisma.branch.update({
      where: { id: req.params.id },
      data: {
        ...(name   !== undefined && { name }),
        ...(email  !== undefined && { email }),
        ...(active !== undefined && { active }),
      },
    })
    res.json(branch)
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Sucursal no encontrada' })
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/branches/:id
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await prisma.branch.delete({ where: { id: req.params.id } })
    res.json({ message: 'Sucursal eliminada' })
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Sucursal no encontrada' })
    res.status(500).json({ message: err.message })
  }
})

export default router
