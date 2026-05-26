import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { body, validationResult } from 'express-validator'

const router = Router()
const prisma = new PrismaClient()

// GET /api/users
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    })
    res.json(users)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/users
router.post('/', authMiddleware, adminMiddleware, [
  body('email').isEmail().normalizeEmail(),
  body('name').notEmpty().trim(),
  body('password').isLength({ min: 8 }),
  body('role').isIn(['ADMIN', 'USER']),
], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

  try {
    const { email, name, password, role } = req.body
    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return res.status(409).json({ message: 'El email ya está en uso' })

    const hash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { email, name, password: hash, role },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true }
    })
    res.status(201).json(user)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PATCH /api/users/:id
router.patch('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, role, active } = req.body
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(role !== undefined && { role }),
        ...(active !== undefined && { active }),
      },
      select: { id: true, email: true, name: true, role: true, active: true }
    })
    res.json(user)
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Usuario no encontrado' })
    res.status(500).json({ message: err.message })
  }
})

// POST /api/users/:id/reset-password
router.post('/:id/reset-password', authMiddleware, adminMiddleware, [
  body('newPassword').isLength({ min: 8 }),
], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

  try {
    const hash = await bcrypt.hash(req.body.newPassword, 12)
    await prisma.user.update({ where: { id: req.params.id }, data: { password: hash } })
    res.json({ message: 'Contraseña actualizada' })
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Usuario no encontrado' })
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/users/:id
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ message: 'No podés eliminarte a vos mismo' })
    await prisma.user.delete({ where: { id: req.params.id } })
    res.json({ message: 'Usuario eliminado' })
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Usuario no encontrado' })
    res.status(500).json({ message: err.message })
  }
})

export default router
