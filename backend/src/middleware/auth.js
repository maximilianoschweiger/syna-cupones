import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const authMiddleware = async (req, res, next) => {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token requerido' })
    }

    const token = header.slice(7)
    let decoded

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET)
    } catch {
      return res.status(401).json({ message: 'Token inválido o expirado' })
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, email: true, role: true, active: true },
    })

    if (!user || !user.active) {
      return res.status(401).json({ message: 'Usuario no encontrado o inactivo' })
    }

    req.user = user
    next()
  } catch (err) {
    next(err)
  }
}

const adminMiddleware = (req, res, next) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Acceso denegado: se requiere rol Admin' })
  }
  next()
}

export { authMiddleware, adminMiddleware }
