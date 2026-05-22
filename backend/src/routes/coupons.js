import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { analyzeImage } from '../services/openaiService.js'
import XLSX from 'xlsx'

const router = express.Router()
const prisma = new PrismaClient()

router.use(authMiddleware)

// GET /api/coupons
router.get('/', async (req, res) => {
  try {
    const { search, status, branch, shift, dateFrom, dateTo, page = 1, limit = 20 } = req.query

    const where = {}

    if (status) where.signatureStatus = status

    if (branch || shift || dateFrom || dateTo) {
      where.attachment = {
        email: {}
      }
      if (branch) where.attachment.email.branch = { code: branch }
      if (shift) where.attachment.email.shift = shift
      if (dateFrom || dateTo) {
        where.attachment.email.receivedAt = {}
        if (dateFrom) where.attachment.email.receivedAt.gte = new Date(dateFrom)
        if (dateTo) where.attachment.email.receivedAt.lte = new Date(dateTo)
      }
    }

    if (search) {
      where.OR = [
        { couponNumber: { contains: search, mode: 'insensitive' } },
        { cardType: { contains: search, mode: 'insensitive' } },
        { merchant: { contains: search, mode: 'insensitive' } },
        { authCode: { contains: search, mode: 'insensitive' } },
      ]
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [coupons, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          attachment: {
            select: {
              imageUrl: true,
              filename: true,
              email: {
                select: {
                  id: true,
                  subject: true,
                  shift: true,
                  receivedAt: true,
                  branch: { select: { id: true, code: true, name: true } },
                },
              },
            },
          },
        },
      }),
      prisma.coupon.count({ where }),
    ])

    res.json({ coupons, total, page: parseInt(page), limit: parseInt(limit) })
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener cupones' })
  }
})

// GET /api/coupons/export
router.get('/export', adminMiddleware, async (req, res) => {
  try {
    const { status, branch, shift, dateFrom, dateTo } = req.query
    const where = {}
    if (status) where.signatureStatus = status

    const coupons = await prisma.coupon.findMany({
      where,
      include: {
        attachment: {
          include: {
            email: { include: { branch: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const rows = coupons.map((c) => ({
      'N° Cupón': c.couponNumber || '',
      Sucursal: c.attachment?.email?.branch?.code || '',
      Turno: c.attachment?.email?.shift || '',
      Monto: c.amount ? Number(c.amount) : '',
      Tarjeta: c.cardType || '',
      Cuotas: c.installments || '',
      Autorización: c.authCode || '',
      Comercio: c.merchant || '',
      'Fecha Cupón': c.couponDate ? c.couponDate.toLocaleDateString('es-AR') : '',
      Estado: c.signatureStatus,
      'Confianza IA': c.aiConfidence ? `${Math.round(c.aiConfidence * 100)}%` : '',
      'Fecha Carga': c.createdAt.toLocaleDateString('es-AR'),
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Cupones')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="cupones_${Date.now()}.xlsx"`)
    res.send(buffer)
  } catch (err) {
    res.status(500).json({ message: 'Error al exportar' })
  }
})

// GET /api/coupons/:id
router.get('/:id', async (req, res) => {
  try {
    const coupon = await prisma.coupon.findUnique({
      where: { id: req.params.id },
      include: {
        attachment: {
          include: {
            email: { include: { branch: true } },
          },
        },
      },
    })
    if (!coupon) return res.status(404).json({ message: 'Cupón no encontrado' })
    res.json(coupon)
  } catch {
    res.status(500).json({ message: 'Error' })
  }
})

// PATCH /api/coupons/:id/status  (admin only)
router.patch('/:id/status', adminMiddleware, async (req, res) => {
  try {
    const { signatureStatus, notes } = req.body
    const coupon = await prisma.coupon.update({
      where: { id: req.params.id },
      data: { signatureStatus, notes, manualOverride: true },
    })

    await prisma.auditLog.create({
      data: {
        action: 'UPDATE_COUPON_STATUS',
        entity: 'Coupon',
        entityId: coupon.id,
        details: { signatureStatus, notes },
        userId: req.user.id,
      },
    })

    res.json(coupon)
  } catch {
    res.status(500).json({ message: 'Error al actualizar' })
  }
})

// POST /api/coupons/:id/reanalyze  (admin only)
router.post('/:id/reanalyze', adminMiddleware, async (req, res) => {
  try {
    const coupon = await prisma.coupon.findUnique({
      where: { id: req.params.id },
      include: { attachment: true },
    })

    if (!coupon?.attachment?.imageUrl) {
      return res.status(400).json({ message: 'Sin imagen para analizar' })
    }

    const analysis = await analyzeImage(coupon.attachment.imageUrl)

    const updated = await prisma.coupon.update({
      where: { id: req.params.id },
      data: {
        signatureStatus: analysis.signatureStatus,
        aiConfidence: analysis.confidence,
        amount: analysis.amount,
        cardType: analysis.cardType,
        installments: analysis.installments,
        couponNumber: analysis.couponNumber,
        authCode: analysis.authCode,
        merchant: analysis.merchant,
        aiRawResponse: analysis.raw,
        manualOverride: false,
      },
    })

    res.json(updated)
  } catch (err) {
    res.status(500).json({ message: 'Error al reanalizar' })
  }
})

// DELETE /api/coupons/:id  (admin only)
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    await prisma.coupon.delete({ where: { id: req.params.id } })
    await prisma.auditLog.create({
      data: {
        action: 'DELETE_COUPON',
        entity: 'Coupon',
        entityId: req.params.id,
        userId: req.user.id,
      },
    })
    res.json({ message: 'Cupón eliminado' })
  } catch {
    res.status(500).json({ message: 'Error al eliminar' })
  }
})

export default router
