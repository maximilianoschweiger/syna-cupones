import winston from 'winston'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const { combine, timestamp, colorize, printf, json } = winston.format

const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
  return `${timestamp} [${level}] ${message}${metaStr}`
})

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), json()),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'HH:mm:ss' }),
        consoleFormat
      ),
    }),
  ],
})

// Custom transport to save logs to DB
class PrismaTransport extends winston.Transport {
  log(info, callback) {
    const level = info.level.toUpperCase()
    const dbLevel = ['INFO', 'SUCCESS', 'WARNING', 'ERROR'].includes(level)
      ? level
      : 'INFO'

    // Don't block on DB write
    prisma.systemLog
      .create({
        data: {
          level: dbLevel,
          message: info.message,
          meta: info.meta || null,
          source: info.source || null,
        },
      })
      .catch(() => {}) // Silently fail if DB not available

    callback()
  }
}

if (process.env.NODE_ENV !== 'test') {
  logger.add(new PrismaTransport())
}

// Convenience method
logger.success = (message, meta) => logger.info(message, { ...meta, level: 'SUCCESS' })

export default logger
