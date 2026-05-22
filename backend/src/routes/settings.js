import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { testImapConnection } from '../services/imapService.js'
import { testOpenAI } from '../services/openaiService.js'

const router = Router()
const prisma = new PrismaClient()

// GET /api/settings
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const settings = await prisma.settings.findFirst()
    if (!settings) return res.json({})
    // Mask sensitive fields
    const safe = { ...settings }
    if (safe.imapPassword) safe.imapPassword = '••••••••'
    res.json(safe)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PATCH /api/settings
router.patch('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const {
      imapHost, imapPort, imapUser, imapPassword, imapTls,
      openaiModel, openaiMaxTokens,
      cronSchedule,
      unsignedThreshold, alertNoAttachment, alertDubious, alertMissingClosing
    } = req.body

    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        imapHost, imapPort, imapUser,
        ...(imapPassword && { imapPassword }),
        imapTls: imapTls ?? true,
        openaiModel: openaiModel || 'gpt-4o',
        openaiMaxTokens: openaiMaxTokens || 1000,
        cronSchedule: cronSchedule || '*/15 * * * *',
        unsignedThreshold: unsignedThreshold ?? 3,
        alertNoAttachment: alertNoAttachment ?? true,
        alertDubious: alertDubious ?? true,
        alertMissingClosing: alertMissingClosing ?? true,
      },
      update: {
        ...(imapHost && { imapHost }),
        ...(imapPort && { imapPort }),
        ...(imapUser && { imapUser }),
        ...(imapPassword && { imapPassword }),
        ...(imapTls !== undefined && { imapTls }),
        ...(openaiModel && { openaiModel }),
        ...(openaiMaxTokens && { openaiMaxTokens }),
        ...(cronSchedule && { cronSchedule }),
        ...(unsignedThreshold !== undefined && { unsignedThreshold }),
        ...(alertNoAttachment !== undefined && { alertNoAttachment }),
        ...(alertDubious !== undefined && { alertDubious }),
        ...(alertMissingClosing !== undefined && { alertMissingClosing }),
      }
    })

    const safe = { ...settings }
    if (safe.imapPassword) safe.imapPassword = '••••••••'
    res.json(safe)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/settings/test-imap
router.post('/test-imap', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const ok = await testImapConnection(req.body)
    res.json({ success: ok, message: ok ? 'Conexión IMAP exitosa' : 'No se pudo conectar' })
  } catch (err) {
    res.json({ success: false, message: err.message })
  }
})

// POST /api/settings/test-openai
router.post('/test-openai', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await testOpenAI()
    res.json({ success: true, message: 'OpenAI respondió correctamente', model: result })
  } catch (err) {
    res.json({ success: false, message: err.message })
  }
})

export default router
