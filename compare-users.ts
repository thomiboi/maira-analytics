import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'

// Cargar variables de entorno
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const prisma = new PrismaClient()

async function compareUsers() {
  console.log('🔍 Comparando usuarios entre Supabase Auth y Base de Datos Local\n')

  try {
    // Obtener usuarios de Supabase Auth
    const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError) {
      console.error('❌ Error al obtener usuarios de Supabase:', authError)
      return
    }

    console.log(`📊 Usuarios en Supabase Auth: ${authUsers?.length || 0}`)

    // Obtener usuarios de la BD local
    const dbUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        isActive: true
      }
    })

    console.log(`💾 Usuarios en BD Local: ${dbUsers.length}\n`)

    // Comparar
    console.log('🔄 Comparación:\n')

    for (const authUser of authUsers || []) {
      const dbUser = dbUsers.find(u => u.id === authUser.id)
      
      if (dbUser) {
        const status = dbUser.isActive ? '🟢' : '🔴'
        console.log(`${status} ${authUser.email}`)
        console.log(`   Supabase ID: ${authUser.id}`)
        console.log(`   DB ID: ${dbUser.id}`)
        console.log(`   Match: ✅`)
        console.log(`   isActive: ${dbUser.isActive}`)
      } else {
        console.log(`⚠️ ${authUser.email}`)
        console.log(`   Supabase ID: ${authUser.id}`)
        console.log(`   En BD Local: ❌ NO ENCONTRADO`)
      }
      console.log('')
    }

    // Buscar usuarios en BD que no están en Auth
    console.log('🔍 Usuarios en BD Local que NO están en Supabase Auth:\n')
    
    for (const dbUser of dbUsers) {
      const authUser = authUsers?.find(u => u.id === dbUser.id)
      if (!authUser) {
        console.log(`⚠️ ${dbUser.email}`)
        console.log(`   DB ID: ${dbUser.id}`)
        console.log(`   En Supabase Auth: ❌ NO ENCONTRADO`)
        console.log('')
      }
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

compareUsers()
