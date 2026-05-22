import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { body, validationResult } from 'express-validator'

const router = Router()
const prisma = new PrismaClient()

// GET /api/branches
router.get('/', authMiddleware, async (req, res) => {
  try {
    const branches = await prisma.branch.findMany({
      orderBy: { code: 'asc' },
      include: {
        _count: { select: { coupons: true, emails: true } },
        coupons: {
          select: { signatureStatus: true },
          where: {
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          }
        }
      }
    })

    const result = branches.map(b => {
      const total = b.coupons.length
      const signed = b.coupons.filter(c => c.signatureStatus === 'SIGNED').length
      return {
        ...b,
        stats: {
          totalCoupons: b._count.coupons,
          totalEmails: b._count.emails,
          signatureRate: total > 0 ? Math.round((signed / total) * 100) : 0,
          recentTotal: total,
          recentSigned: signed,
        },
        coupons: undefined,
        _count: undefined,
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
        coupons: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { attachment: { select: { cloudinaryUrl: true } } }
        },
        emails: { orderBy: { receivedAt: 'desc' }, take: 10 }
      }
    })
    if (!branch) return res.status(404).json({ message: 'Sucursal no encontrada' })
    res.json(branch)
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
    const { code, name, email, address, phone } = req.body
    const existing = await prisma.branch.findFirst({ where: { code } })
    if (existing) return res.status(409).json({ message: 'Ya existe una sucursal con ese código' })

    const branch = await prisma.branch.create({
      data: { code, name, email: email || null, address: address || null, phone: phone || null }
    })
    res.status(201).json(branch)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PATCH /api/branches/:id
router.patch('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, email, address, phone, active } = req.body
    const branch = await prisma.branch.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(active !== undefined && { active }),
      }
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
