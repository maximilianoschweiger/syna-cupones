import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { body, validationResult } from 'express-validator'
import { PrismaClient } from '@prisma/client'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()
const prisma = new PrismaClient()

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
  ],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Datos inválidos' })
    }

    try {
      const { email, password } = req.body

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      })

      if (!user || !user.active) {
        return res.status(401).json({ message: 'Credenciales incorrectas' })
      }

      const valid = await bcrypt.compare(password, user.password)
      if (!valid) {
        return res.status(401).json({ message: 'Credenciales incorrectas' })
      }

      const token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      )

      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      })
    } catch (err) {
      res.status(500).json({ message: 'Error del servidor' })
    }
  }
)

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json(req.user)
})

export default router
