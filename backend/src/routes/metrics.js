import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
const prisma = new PrismaClient()

/**
 * GET /api/metrics
 * Returns production-monitoring metrics for the full pipeline.
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query
    const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const to   = dateTo   ? new Date(dateTo)   : new Date()

    const [
      totalEmails,
      processedEmails,
      errorEmails,
      totalAttachments,
      analyzedAttachments,
      totalCoupons,
      signedCoupons,
      unsignedCoupons,
      dubiousCoupons,
      pendingCoupons,
      batchCloseDocs,
      couponsWithDni,
      couponsWithAclaracion,
      partialSignatures,
      lowConfidenceCoupons,
      lowQualityImages,
      recentLogs,
      avgConfidence,
    ] = await Promise.all([
      prisma.email.count({ where: { createdAt: { gte: from, lte: to } } }),
      prisma.email.count({ where: { processed: true, createdAt: { gte: from, lte: to } } }),
      prisma.email.count({ where: { errorMessage: { not: null }, createdAt: { gte: from, lte: to } } }),
      prisma.attachment.count({ where: { createdAt: { gte: from, lte: to } } }),
      prisma.attachment.count({ where: { analyzed: true, createdAt: { gte: from, lte: to } } }),
      prisma.coupon.count({ where: { isBatchClose: false, createdAt: { gte: from, lte: to } } }),
      prisma.coupon.count({ where: { isBatchClose: false, signatureStatus: 'SIGNED',   createdAt: { gte: from, lte: to } } }),
      prisma.coupon.count({ where: { isBatchClose: false, signatureStatus: 'UNSIGNED', createdAt: { gte: from, lte: to } } }),
      prisma.coupon.count({ where: { isBatchClose: false, signatureStatus: 'DUBIOUS',  createdAt: { gte: from, lte: to } } }),
      prisma.coupon.count({ where: { isBatchClose: false, signatureStatus: 'PENDING',  createdAt: { gte: from, lte: to } } }),
      prisma.coupon.count({ where: { isBatchClose: true,  createdAt: { gte: from, lte: to } } }),
      prisma.coupon.count({ where: { isBatchClose: false, hasDni: true,          createdAt: { gte: from, lte: to } } }),
      prisma.coupon.count({ where: { isBatchClose: false, hasAclaracion: true,   createdAt: { gte: from, lte: to } } }),
      prisma.coupon.count({ where: { isBatchClose: false, isPartialSignature: true, createdAt: { gte: from, lte: to } } }),
      prisma.coupon.count({ where: { isBatchClose: false, aiConfidence: { lt: 0.6 }, createdAt: { gte: from, lte: to } } }),
      prisma.coupon.count({ where: { isBatchClose: false, imageQualityScore: { lt: 0.6 }, createdAt: { gte: from, lte: to } } }),
      prisma.systemLog.findMany({
        where:   { level: { in: ['ERROR', 'WARNING'] }, createdAt: { gte: from, lte: to } },
        orderBy: { createdAt: 'desc' },
        take:    20,
        select:  { level: true, message: true, source: true, createdAt: true },
      }),
      prisma.coupon.aggregate({
        _avg: { aiConfidence: true },
        where: { isBatchClose: false, createdAt: { gte: from, lte: to } },
      }),
    ])

    const pct = (n) => totalCoupons > 0 ? +((n / totalCoupons) * 100).toFixed(1) : 0

    res.json({
      period: { from: from.toISOString(), to: to.toISOString() },

      pipeline: {
        emailsReceived:  totalEmails,
        emailsProcessed: processedEmails,
        emailsErrored:   errorEmails,
        processingRate:  totalEmails > 0 ? +((processedEmails / totalEmails) * 100).toFixed(1) : 0,
      },

      attachments: {
        total:      totalAttachments,
        analyzed:   analyzedAttachments,
        analysisRate: totalAttachments > 0
          ? +((analyzedAttachments / totalAttachments) * 100).toFixed(1)
          : 0,
      },

      coupons: {
        total:          totalCoupons,
        batchCloseDocs,
        signed:         signedCoupons,
        unsigned:       unsignedCoupons,
        dubious:        dubiousCoupons,
        pending:        pendingCoupons,
        signedPct:      pct(signedCoupons),
        unsignedPct:    pct(unsignedCoupons),
        dubiousPct:     pct(dubiousCoupons),
      },

      validation: {
        withDni:          couponsWithDni,
        withAclaracion:   couponsWithAclaracion,
        partialSignatures,
        dniPct:           pct(couponsWithDni),
        aclaracionPct:    pct(couponsWithAclaracion),
      },

      quality: {
        avgAiConfidence:       avgConfidence._avg.aiConfidence != null
          ? +avgConfidence._avg.aiConfidence.toFixed(3)
          : null,
        lowConfidenceCoupons,
        lowQualityImages,
        lowConfidencePct: pct(lowConfidenceCoupons),
        lowQualityPct:    pct(lowQualityImages),
      },

      recentErrors: recentLogs,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
