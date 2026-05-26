import cron from 'node-cron'
import { PrismaClient } from '@prisma/client'
import logger from '../utils/logger.js'
import { processMails } from '../services/imapService.js'

const prisma = new PrismaClient()

let cronJob = null
let isRunning = false

async function getCronSchedule() {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } })
    return settings?.cronSchedule || process.env.CRON_SCHEDULE || '*/15 * * * *'
  } catch {
    return process.env.CRON_SCHEDULE || '*/15 * * * *'
  }
}

async function runEmailProcessor() {
  if (isRunning) {
    logger.info('Email processor already running, skipping')
    return
  }

  isRunning = true
  const startTime = Date.now()

  try {
    logger.info('⏰ Cron: Starting email processing...')

    await prisma.systemLog.create({
      data: {
        level: 'INFO',
        message: 'Cron job started: email processing',
        source: 'cron',
      },
    })

    const result = await processMails()

    const duration = Date.now() - startTime
    logger.info(`⏰ Cron: Complete in ${duration}ms`, result)

    await prisma.systemLog.create({
      data: {
        level: 'SUCCESS',
        message: `Cron job completed: ${result.processed} emails processed`,
        source: 'cron',
        meta: { ...result, durationMs: duration },
      },
    })
  } catch (err) {
    logger.error('⏰ Cron: Error during processing', { error: err.message })

    await prisma.systemLog.create({
      data: {
        level: 'ERROR',
        message: `Cron job error: ${err.message}`,
        source: 'cron',
      },
    }).catch(() => {})
  } finally {
    isRunning = false
  }
}

function startCronJobs() {
  getCronSchedule().then((schedule) => {
    if (!cron.validate(schedule)) {
      logger.error(`Invalid cron schedule: ${schedule}, using default`)
      schedule = '*/15 * * * *'
    }

    logger.info(`📅 Starting cron job with schedule: ${schedule}`)

    cronJob = cron.schedule(schedule, runEmailProcessor, {
      scheduled: true,
      timezone: 'America/Argentina/Buenos_Aires',
    })

    // Run immediately on startup (after 10s delay)
    setTimeout(runEmailProcessor, 10000)
  })
}

function stopCronJobs() {
  if (cronJob) {
    cronJob.destroy()
    cronJob = null
    logger.info('Cron jobs stopped')
  }
}

function restartCronJobs() {
  stopCronJobs()
  startCronJobs()
}

export { startCronJobs, stopCronJobs, restartCronJobs, runEmailProcessor }
