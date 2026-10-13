import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

config({ path: '.env.local' })

const prisma = new PrismaClient()

async function checkUsers() {
  console.log('🔍 Verificando usuarios en la base de datos...\n')

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        isActive: true,
        role: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        email: 'asc'
      }
    })

    console.log('📊 Usuarios encontrados:', users.length, '\n')

    users.forEach((user, index) => {
      const status = user.isActive ? '🟢 ACTIVO' : '🔴 INACTIVO'
      console.log(`${index + 1}. ${status}`)
      console.log(`   Email: ${user.email}`)
      console.log(`   ID: ${user.id}`)
      console.log(`   Rol: ${user.role?.name || 'Sin rol'}`)
      console.log(`   isActive: ${user.isActive}`)
      console.log('')
    })

    // Contar activos e inactivos
    const activeCount = users.filter(u => u.isActive).length
    const inactiveCount = users.filter(u => !u.isActive).length

    console.log('📈 Resumen:')
    console.log(`   ✅ Activos: ${activeCount}`)
    console.log(`   ❌ Inactivos: ${inactiveCount}`)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkUsers()
