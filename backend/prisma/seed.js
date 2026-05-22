const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create admin user
  const hashedPassword = await bcrypt.hash('Admin123!', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@syna.com.ar' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@syna.com.ar',
      password: hashedPassword,
      role: 'ADMIN',
    },
  })
  console.log('✅ Admin user created:', admin.email)

  // Create a regular user
  const userPassword = await bcrypt.hash('User123!', 12)
  await prisma.user.upsert({
    where: { email: 'usuario@syna.com.ar' },
    update: {},
    create: {
      name: 'Usuario Demo',
      email: 'usuario@syna.com.ar',
      password: userPassword,
      role: 'USER',
    },
  })

  // Create branches
  const branchCodes = ['110', '115', '120', '210', '215', '310', '315', '410', '415', '524']
  const branchNames = [
    'Centro', 'Norte', 'Sur', 'Belgrano', 'Palermo', 'Caballito', 
    'Flores', 'Villa Urquiza', 'Barracas', 'Quilmes'
  ]

  for (let i = 0; i < branchCodes.length; i++) {
    await prisma.branch.upsert({
      where: { code: branchCodes[i] },
      update: {},
      create: {
        code: branchCodes[i],
        name: `Suc. ${branchNames[i]}`,
        email: `suc${branchCodes[i]}@syna.com.ar`,
      },
    })
  }
  console.log('✅ Branches created')

  // Create default settings
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      openaiModel: 'gpt-4o',
      cronSchedule: '*/15 * * * *',
      unsignedThreshold: 5,
    },
  })
  console.log('✅ Settings initialized')

  console.log('\n🎉 Seed completed!')
  console.log('───────────────────────')
  console.log('Admin:   admin@syna.com.ar / Admin123!')
  console.log('Usuario: usuario@syna.com.ar / User123!')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
