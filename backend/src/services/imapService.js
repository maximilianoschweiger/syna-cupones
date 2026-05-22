import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { PrismaClient } from '@prisma/client'
import logger from '../utils/logger.js'
import { uploadImage, uploadPDF } from './cloudinaryService.js'
import { analyzeCouponImage } from './openaiService.js'

const prisma = new PrismaClient()

// Patterns to detect branch code and shift from email subjects
const BRANCH_PATTERNS = [
  /SUC[.\s#]?(\d{2,4})/i,
  /SUCURSAL[.\s#]?(\d{2,4})/i,
  /N[°º]?\s*(\d{2,4})/i,
]

const SHIFT_PATTERNS = {
  MORNING: [/TURNO\s+MA[NÑ]ANA/i, /TM\b/i, /MAÑANA/i, /MORNING/i],
  AFTERNOON: [/TURNO\s+TARDE/i, /TT\b/i, /TARDE/i, /AFTERNOON/i],
  NIGHT: [/TURNO\s+NOCHE/i, /TN\b/i, /NOCHE/i, /NIGHT/i],
  CLOSING: [/CIERRE\s+DE\s+CAJA/i, /CIERRE\s+CAJA/i, /CIERRE/i, /CLOSING/i],
}

/**
 * Detect branch code from subject or sender
 */
function detectBranch(subject, senderEmail) {
  const text = `${subject} ${senderEmail}`
  for (const pattern of BRANCH_PATTERNS) {
    const match = text.match(pattern)
    if (match) return match[1]
  }
  return null
}

/**
 * Detect shift from subject
 */
function detectShift(subject) {
  for (const [shift, patterns] of Object.entries(SHIFT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(subject)) return shift
    }
  }
  return 'UNKNOWN'
}

/**
 * Get IMAP credentials from settings or environment
 */
async function getImapConfig() {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } })
    if (settings?.imapHost && settings?.imapUser && settings?.imapPassword) {
      return {
        host: settings.imapHost,
        port: settings.imapPort || 993,
        secure: settings.imapTls !== false,
        auth: { user: settings.imapUser, pass: settings.imapPassword },
      }
    }
  } catch {}

  // Fallback to environment variables
  return {
    host: process.env.IMAP_HOST || 'imap.gmail.com',
    port: parseInt(process.env.IMAP_PORT || '993'),
    secure: process.env.IMAP_TLS !== 'false',
    auth: {
      user: process.env.IMAP_USER,
      pass: process.env.IMAP_PASSWORD,
    },
  }
}

/**
 * Process a single email attachment
 */
async function processAttachment(attachment, emailRecord) {
  const { content, contentType, filename, size } = attachment

  if (size > 20 * 1024 * 1024) {
    logger.warn('Attachment too large, skipping', { filename, size })
    return null
  }

  const buffer = content instanceof Buffer ? content : Buffer.from(content)
  const isImage = contentType?.startsWith('image/')
  const isPDF = contentType === 'application/pdf'

  if (!isImage && !isPDF) {
    logger.info('Non-image/pdf attachment, skipping', { filename, contentType })
    return null
  }

  let imageUrl = null
  let publicId = null

  try {
    if (isImage) {
      const result = await uploadImage(buffer, 'syna-cupones/images')
      imageUrl = result.url
      publicId = result.publicId
    } else if (isPDF) {
      const result = await uploadPDF(buffer, 'syna-cupones/pdfs')
      imageUrl = result.url
      publicId = result.publicId
    }
  } catch (err) {
    logger.error('Failed to upload attachment', { filename, error: err.message })
    return null
  }

  const attachmentRecord = await prisma.attachment.create({
    data: {
      filename: filename || 'unknown',
      contentType: contentType || 'application/octet-stream',
      size: size || buffer.length,
      imageUrl,
      publicId,
      emailId: emailRecord.id,
    },
  })

  // Analyze with OpenAI Vision
  if (imageUrl && isImage) {
    try {
      const aiResults = await analyzeCouponImage(imageUrl, process.env.OPENAI_MODEL || 'gpt-4o')

      for (const analysis of aiResults) {
        await prisma.coupon.create({
          data: {
            couponNumber: analysis.couponNumber,
            amount: analysis.amount,
            installments: analysis.installments,
            cardType: analysis.cardType,
            authCode: analysis.authCode,
            merchant: analysis.merchant,
            couponDate: analysis.couponDate,
            signatureStatus: analysis.signatureStatus || 'DUBIOUS',
            aiConfidence: analysis.aiConfidence,
            aiRawResponse: analysis.aiRawResponse,
            attachmentId: attachmentRecord.id,
            emailId: emailRecord.id,
            branchId: emailRecord.branchId,
          },
        })
      }

      await prisma.attachment.update({
        where: { id: attachmentRecord.id },
        data: { analyzed: true },
      })

      logger.info(`Processed ${aiResults.length} coupon(s) from attachment`, { filename })
    } catch (err) {
      logger.error('AI analysis failed for attachment', { filename, error: err.message })
      await createAlert('AI_ERROR', `Error de análisis IA: ${filename}`, `No se pudo analizar la imagen: ${err.message}`, emailRecord)
    }
  }

  return attachmentRecord
}

/**
 * Main IMAP processing function
 */
async function processMails() {
  const config = await getImapConfig()

  if (!config.auth.user || !config.auth.pass) {
    logger.warn('IMAP credentials not configured, skipping')
    return { processed: 0, errors: 0 }
  }

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    logger: false,
    tls: { rejectUnauthorized: false },
  })

  let processed = 0
  let errors = 0

  try {
    await client.connect()
    logger.info('IMAP connected', { host: config.host, user: config.auth.user })

    const lock = await client.getMailboxLock('INBOX')

    try {
      // Fetch unseen messages only
      for await (const message of client.fetch('UNSEEN', {
        source: true,
        uid: true,
        envelope: true,
        flags: true,
      })) {
        try {
          const parsed = await simpleParser(message.source)

          const subject = parsed.subject || ''
          const senderEmail = parsed.from?.value?.[0]?.address || ''
          const senderName = parsed.from?.value?.[0]?.name || ''
          const receivedAt = parsed.date || new Date()
          const messageId = parsed.messageId || `msg-${Date.now()}`

          // Check if already processed
          const existing = await prisma.email.findUnique({ where: { messageId } })
          if (existing) {
            await client.messageFlagsAdd(message.uid, ['\\Seen'], { uid: true })
            continue
          }

          // Detect branch
          const branchCode = detectBranch(subject, senderEmail)
          let branchId = null

          if (branchCode) {
            const branch = await prisma.branch.findUnique({ where: { code: branchCode } })
            if (branch) {
              branchId = branch.id
            } else {
              // Auto-create branch if not found
              const newBranch = await prisma.branch.create({
                data: { code: branchCode, name: `Suc. ${branchCode}` },
              })
              branchId = newBranch.id
              logger.info(`Auto-created branch: ${branchCode}`)
            }
          }

          const shift = detectShift(subject)

          const emailRecord = await prisma.email.create({
            data: {
              messageId,
              subject: subject.slice(0, 500),
              senderEmail,
              senderName,
              receivedAt,
              shift,
              branchId,
              rawDate: receivedAt.toISOString(),
            },
          })

          const attachments = parsed.attachments || []

          if (attachments.length === 0) {
            await createAlert(
              'NO_ATTACHMENT',
              'Mail sin adjuntos',
              `El mail "${subject}" de ${senderEmail} no tiene adjuntos.`,
              emailRecord
            )
          }

          let attachmentCount = 0
          for (const att of attachments) {
            const result = await processAttachment(att, emailRecord)
            if (result) attachmentCount++
          }

          await prisma.email.update({
            where: { id: emailRecord.id },
            data: { processed: true, processedAt: new Date() },
          })

          // Mark as seen in IMAP
          await client.messageFlagsAdd(message.uid, ['\\Seen'], { uid: true })

          processed++
          logger.info(`Email processed`, {
            subject: subject.slice(0, 50),
            branch: branchCode,
            shift,
            attachments: attachmentCount,
          })

          // Check unsigned threshold alerts
          await checkUnsignedThreshold(branchId)
        } catch (msgErr) {
          errors++
          logger.error('Failed to process email', { error: msgErr.message })
        }
      }
    } finally {
      lock.release()
    }

    await client.logout()
    logger.info(`IMAP processing complete`, { processed, errors })
    return { processed, errors }
  } catch (err) {
    logger.error('IMAP connection failed', { error: err.message, host: config.host })
    await createAlert('IMAP_ERROR', 'Error de conexión IMAP', err.message, null)
    return { processed: 0, errors: 1 }
  }
}

async function checkUnsignedThreshold(branchId) {
  if (!branchId) return

  try {
    const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } })
    const threshold = settings?.unsignedThreshold || 5

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const unsignedToday = await prisma.coupon.count({
      where: {
        branchId,
        signatureStatus: 'UNSIGNED',
        createdAt: { gte: todayStart },
      },
    })

    if (unsignedToday >= threshold) {
      const branch = await prisma.branch.findUnique({ where: { id: branchId } })
      await createAlert(
        'UNSIGNED_THRESHOLD',
        `Sucursal ${branch?.code}: umbral de cupones sin firma`,
        `La sucursal ${branch?.code} tiene ${unsignedToday} cupones sin firma hoy (umbral: ${threshold}).`,
        null,
        branch?.code,
        branchId
      )
    }
  } catch {}
}

async function createAlert(type, title, message, emailRecord = null, branchCode = null, branchId = null) {
  try {
    await prisma.alert.create({
      data: {
        type,
        title,
        message,
        branchCode,
        branchId,
        emailId: emailRecord?.id || null,
      },
    })
  } catch {}
}

/**
 * Test IMAP connection
 */
async function testImapConnection(config) {
  const client = new ImapFlow({
    host: config.imapHost,
    port: config.imapPort || 993,
    secure: config.imapTls !== false,
    auth: { user: config.imapUser, pass: config.imapPassword },
    logger: false,
    tls: { rejectUnauthorized: false },
  })

  await client.connect()
  await client.logout()
  return true
}

export { processMails, testImapConnection, detectBranch, detectShift }
