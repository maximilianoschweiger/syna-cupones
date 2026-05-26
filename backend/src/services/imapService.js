import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { PrismaClient } from '@prisma/client'
import logger from '../utils/logger.js'
import { uploadImage, uploadPDF, getPdfPageUrl } from './cloudinaryService.js'
import { analyzeCouponImage } from './openaiService.js'

const prisma = new PrismaClient()

const BRANCH_PATTERNS = [
  /SUC[.\s#-]?(\d{2,4})/i,
  /SUCURSAL[.\s#-]?(\d{2,4})/i,
  /N[°º]?\s*(\d{2,4})/i,
]

const SHIFT_PATTERNS = {
  MORNING:   [/TURNO\s+MA[NÑ]ANA/i, /\bTM\b/i, /MAÑANA/i],
  AFTERNOON: [/TURNO\s+TARDE/i,     /\bTT\b/i, /TARDE/i],
  NIGHT:     [/TURNO\s+NOCHE/i,     /\bTN\b/i, /NOCHE/i],
  CLOSING:   [/CIERRE\s+DE\s+CAJA/i, /CIERRE\s+CAJA/i, /CIERRE/i, /CLOSING/i],
}

function detectBranch(subject, senderEmail) {
  const text = `${subject} ${senderEmail}`
  for (const pattern of BRANCH_PATTERNS) {
    const match = text.match(pattern)
    if (match) return match[1]
  }
  return null
}

function detectShift(subject) {
  for (const [shift, patterns] of Object.entries(SHIFT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(subject)) return shift
    }
  }
  return 'UNKNOWN'
}

async function getImapConfig() {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } })
    if (settings?.imapHost && settings?.imapUser && settings?.imapPassword) {
      return {
        host: settings.imapHost,
        port: settings.imapPort || 993,
        secure: settings.imapTls !== false,
        auth: { user: settings.imapUser, pass: settings.imapPassword },
      }
    }
  } catch (err) {
    logger.warn('Could not load IMAP config from DB, falling back to env', { error: err.message })
  }

  return {
    host: process.env.IMAP_HOST || '',
    port: parseInt(process.env.IMAP_PORT || '993'),
    secure: process.env.IMAP_TLS !== 'false',
    auth: {
      user: process.env.IMAP_USER || '',
      pass: process.env.IMAP_PASSWORD || '',
    },
  }
}

async function getOpenAIModel() {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } })
    return settings?.openaiModel || process.env.OPENAI_MODEL || 'gpt-4o'
  } catch {
    return process.env.OPENAI_MODEL || 'gpt-4o'
  }
}

/**
 * Persist a single analyzed document as a Coupon row.
 */
async function saveCoupon(analysis, attachmentId, emailId, branchId, pageIndex) {
  return prisma.coupon.create({
    data: {
      couponNumber:       analysis.couponNumber,
      amount:             analysis.amount,
      installments:       analysis.installments,
      cardType:           analysis.cardType,
      authCode:           analysis.authCode,
      merchant:           analysis.merchant,
      couponDate:         analysis.couponDate,
      signatureStatus:    analysis.signatureStatus || 'DUBIOUS',
      aiConfidence:       analysis.aiConfidence,
      aiRawResponse:      analysis.aiRawResponse,
      hasDni:             analysis.hasDni,
      hasAclaracion:      analysis.hasAclaracion,
      isPartialSignature: analysis.isPartialSignature,
      hasManualWriting:   analysis.hasManualWriting,
      missingFields:      analysis.missingFields || [],
      ocrText:            analysis.ocrText,
      imageQualityScore:  analysis.imageQualityScore,
      isBatchClose:       analysis.isBatchClose || false,
      pageIndex,
      attachmentId,
      emailId,
      branchId,
    },
  })
}

/**
 * Process one email attachment (image or PDF).
 * PDFs are processed page-by-page: each page is analyzed independently.
 */
async function processAttachment(attachment, emailRecord, aiModel) {
  const { content, contentType, filename, size } = attachment

  if (size > 25 * 1024 * 1024) {
    logger.warn('Attachment too large, skipping', { filename, sizeMB: (size / 1024 / 1024).toFixed(1) })
    return null
  }

  const buffer = content instanceof Buffer ? content : Buffer.from(content)
  const isImage = contentType?.startsWith('image/')
  const isPDF   = contentType === 'application/pdf' ||
                  filename?.toLowerCase().endsWith('.pdf')

  if (!isImage && !isPDF) {
    logger.info('Skipping non-image/PDF attachment', { filename, contentType })
    return null
  }

  let imageUrl  = null
  let publicId  = null
  let pageCount = 1

  try {
    if (isImage) {
      const result = await uploadImage(buffer, 'syna-cupones/images')
      imageUrl = result.url
      publicId = result.publicId
    } else {
      // Upload PDF as resource_type=image so Cloudinary renders each page
      const result = await uploadPDF(buffer, 'syna-cupones/pdfs')
      imageUrl  = result.url
      publicId  = result.publicId
      pageCount = result.pageCount || 1
      logger.info(`PDF uploaded (${pageCount} pages)`, { filename })
    }
  } catch (err) {
    logger.error('Cloudinary upload failed', { filename, error: err.message })
    await createAlert('AI_ERROR', `Error subiendo adjunto: ${filename}`, err.message, emailRecord)
    return null
  }

  const attachmentRecord = await prisma.attachment.create({
    data: {
      filename:    filename || 'unknown',
      contentType: contentType || 'application/octet-stream',
      size:        size || buffer.length,
      imageUrl,
      publicId,
      pageCount,
      emailId:     emailRecord.id,
    },
  })

  let couponsCreated = 0

  try {
    if (isImage) {
      // Single image → analyze once
      const results = await analyzeCouponImage(imageUrl, aiModel)
      for (const doc of results) {
        await saveCoupon(doc, attachmentRecord.id, emailRecord.id, emailRecord.branchId, 1)
        couponsCreated++
      }
    } else if (isPDF && publicId) {
      // PDF → analyze each page independently
      for (let page = 1; page <= pageCount; page++) {
        const pageUrl = getPdfPageUrl(publicId, page)
        logger.info(`Analyzing PDF page ${page}/${pageCount}`, { filename })
        const results = await analyzeCouponImage(pageUrl, aiModel)
        for (const doc of results) {
          await saveCoupon(doc, attachmentRecord.id, emailRecord.id, emailRecord.branchId, page)
          couponsCreated++
        }
      }
    }

    await prisma.attachment.update({
      where: { id: attachmentRecord.id },
      data: { analyzed: true },
    })

    logger.info(`Attachment processed: ${couponsCreated} document(s) created`, { filename })
  } catch (err) {
    logger.error('AI analysis failed for attachment', { filename, error: err.message })
    await createAlert(
      'AI_ERROR',
      `Error de análisis IA: ${filename}`,
      err.message,
      emailRecord
    )
  }

  return attachmentRecord
}

/**
 * Main IMAP polling function.
 */
async function processMails() {
  const config = await getImapConfig()

  if (!config.auth.user || !config.auth.pass) {
    logger.warn('IMAP credentials not configured, skipping')
    return { processed: 0, errors: 0, coupons: 0 }
  }

  const aiModel = await getOpenAIModel()

  const client = new ImapFlow({
    host:   config.host,
    port:   config.port,
    secure: config.secure,
    auth:   config.auth,
    logger: false,
    tls:    { rejectUnauthorized: false },
  })

  let processed = 0
  let errors    = 0
  let coupons   = 0

  try {
    await client.connect()
    logger.info('IMAP connected', { host: config.host, user: config.auth.user })

    const lock = await client.getMailboxLock('INBOX')

    try {
      for await (const message of client.fetch('UNSEEN', {
        source: true,
        uid:    true,
        envelope: true,
        flags:  true,
      })) {
        try {
          const parsed      = await simpleParser(message.source)
          const subject     = parsed.subject || ''
          const senderEmail = parsed.from?.value?.[0]?.address || ''
          const senderName  = parsed.from?.value?.[0]?.name    || ''
          const receivedAt  = parsed.date || new Date()
          const messageId   = parsed.messageId || `msg-${Date.now()}-${Math.random()}`

          // Idempotency check
          const existing = await prisma.email.findUnique({ where: { messageId } })
          if (existing) {
            await client.messageFlagsAdd(message.uid, ['\\Seen'], { uid: true })
            continue
          }

          // Resolve branch
          const branchCode = detectBranch(subject, senderEmail)
          let branchId     = null

          if (branchCode) {
            let branch = await prisma.branch.findUnique({ where: { code: branchCode } })
            if (!branch) {
              branch = await prisma.branch.create({
                data: { code: branchCode, name: `Suc. ${branchCode}` },
              })
              logger.info(`Auto-created branch: ${branchCode}`)
            }
            branchId = branch.id
          }

          const emailRecord = await prisma.email.create({
            data: {
              messageId,
              subject:     subject.slice(0, 500),
              senderEmail,
              senderName,
              receivedAt,
              shift:       detectShift(subject),
              branchId,
              rawDate:     receivedAt.toISOString(),
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
            const result = await processAttachment(att, emailRecord, aiModel)
            if (result) attachmentCount++
          }

          // Count coupons created for this email
          const emailCoupons = await prisma.coupon.count({ where: { emailId: emailRecord.id } })
          coupons += emailCoupons

          await prisma.email.update({
            where: { id: emailRecord.id },
            data:  { processed: true, processedAt: new Date() },
          })

          await client.messageFlagsAdd(message.uid, ['\\Seen'], { uid: true })

          processed++
          logger.info('Email processed', {
            subject:     subject.slice(0, 50),
            branch:      branchCode,
            shift:       detectShift(subject),
            attachments: attachmentCount,
            coupons:     emailCoupons,
          })

          await checkUnsignedThreshold(branchId)
        } catch (msgErr) {
          errors++
          logger.error('Failed to process email', { error: msgErr.message, stack: msgErr.stack })
        }
      }
    } finally {
      lock.release()
    }

    await client.logout()
    logger.info('IMAP processing complete', { processed, errors, coupons })
    return { processed, errors, coupons }
  } catch (err) {
    logger.error('IMAP connection failed', { error: err.message, host: config.host })
    await createAlert('IMAP_ERROR', 'Error de conexión IMAP', err.message, null)
    return { processed: 0, errors: 1, coupons: 0 }
  }
}

async function checkUnsignedThreshold(branchId) {
  if (!branchId) return

  try {
    const settings  = await prisma.settings.findUnique({ where: { id: 1 } })
    const threshold = settings?.unsignedThreshold || 5

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const unsignedToday = await prisma.coupon.count({
      where: {
        branchId,
        signatureStatus: 'UNSIGNED',
        isBatchClose:    false,
        createdAt:       { gte: todayStart },
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
  } catch (err) {
    logger.warn('checkUnsignedThreshold error', { error: err.message })
  }
}

async function createAlert(type, title, message, emailRecord = null, branchCode = null, branchId = null) {
  try {
    await prisma.alert.create({
      data: { type, title, message, branchCode, branchId, emailId: emailRecord?.id || null },
    })
  } catch (err) {
    logger.warn('createAlert failed', { error: err.message })
  }
}

/**
 * Test IMAP connection using current configuration.
 * Loads config from DB/env automatically (no args needed).
 */
async function testImapConnection(overrideConfig = null) {
  const config = overrideConfig ? {
    host:   overrideConfig.imapHost,
    port:   overrideConfig.imapPort || 993,
    secure: overrideConfig.imapTls !== false,
    auth:   { user: overrideConfig.imapUser, pass: overrideConfig.imapPassword },
  } : await getImapConfig()

  const client = new ImapFlow({
    host:   config.host,
    port:   config.port,
    secure: config.secure,
    auth:   config.auth,
    logger: false,
    tls:    { rejectUnauthorized: false },
  })

  await client.connect()
  await client.logout()
  return true
}

export { processMails, testImapConnection, detectBranch, detectShift }
