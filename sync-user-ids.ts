import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

// Cargar variables de entorno
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const prisma = new PrismaClient()
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function syncUserIds() {
  console.log('🔄 Iniciando sincronización de IDs entre Supabase Auth y BD Local...\n')

  try {
    // 1. Obtener usuarios de Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError || !authData) {
      console.error('❌ Error obteniendo usuarios de Supabase:', authError)
      return
    }

    const authUsers = authData.users
    console.log(`📊 Usuarios en Supabase Auth: ${authUsers.length}`)

    // 2. Obtener usuarios de tu BD
    const dbUsers = await prisma.user.findMany({
      include: {
        role: true,
        profile: true
      }
    })
    console.log(`📊 Usuarios en BD local: ${dbUsers.length}\n`)

    let sincronizados = 0
    let creados = 0
    let actualizados = 0
    let errores = 0

    // 3. Sincronizar cada usuario de Supabase Auth
    for (const authUser of authUsers) {
      if (!authUser.email) {
        console.log(`⚠️  Usuario sin email en Supabase Auth (ID: ${authUser.id}) - saltando\n`)
        continue
      }

      const dbUser = dbUsers.find(u => u.email === authUser.email)

      if (!dbUser) {
        // Usuario existe en Auth pero NO en BD local - crear
        console.log(`➕ Usuario ${authUser.email} existe en Auth pero NO en BD local`)
        console.log(`   Creando usuario en BD con ID: ${authUser.id}`)
        
        try {
          await prisma.user.create({
            data: {
              id: authUser.id,
              email: authUser.email,
              isActive: true,
            }
          })
          console.log(`   ✅ Usuario creado\n`)
          creados++
        } catch (error) {
          console.error(`   ❌ Error creando usuario:`, error)
          errores++
        }

      } else if (dbUser.id !== authUser.id) {
        // IDs diferentes - sincronizar
        console.log(`🔄 Sincronizando ${authUser.email}:`)
        console.log(`   Auth ID: ${authUser.id}`)
        console.log(`   BD ID:   ${dbUser.id} ❌ DIFERENTE`)

        try {
          // Usar una transacción para garantizar atomicidad
          await prisma.$transaction(async (tx) => {
            // 1. Actualizar posts del usuario
            const postsCount = await tx.post.count({
              where: { authorId: dbUser.id }
            })
            
            if (postsCount > 0) {
              await tx.post.updateMany({
                where: { authorId: dbUser.id },
                data: { authorId: authUser.id }
              })
              console.log(`   📝 ${postsCount} posts actualizados`)
            }

            // 2. Actualizar o recrear perfil
            if (dbUser.profile) {
              await tx.userProfile.delete({
                where: { userId: dbUser.id }
              })
              
              await tx.userProfile.create({
                data: {
                  id: dbUser.profile.id,
                  userId: authUser.id,
                  firstName: dbUser.profile.firstName,
                  lastName: dbUser.profile.lastName,
                  avatar: dbUser.profile.avatar,
                  bio: dbUser.profile.bio,
                  phone: dbUser.profile.phone,
                  createdAt: dbUser.profile.createdAt,
                  updatedAt: dbUser.profile.updatedAt
                }
              })
              console.log(`   👤 Perfil actualizado`)
            }

            // 3. Eliminar usuario antiguo
            await tx.user.delete({
              where: { id: dbUser.id }
            })

            // 4. Crear usuario con ID correcto
            await tx.user.create({
              data: {
                id: authUser.id,
                email: dbUser.email,
                roleId: dbUser.roleId,
                isActive: dbUser.isActive,
                createdAt: dbUser.createdAt,
                updatedAt: dbUser.updatedAt
              }
            })
          })

          console.log(`   ✅ ID sincronizado correctamente: ${authUser.id}\n`)
          actualizados++

        } catch (error) {
          console.error(`   ❌ Error sincronizando usuario:`, error)
          console.error(`   Saltando ${authUser.email}...\n`)
          errores++
        }

      } else {
        // IDs coinciden - todo bien
        console.log(`✅ ${authUser.email} - IDs ya sincronizados`)
        sincronizados++
      }
    }

    // 4. Verificar usuarios en BD que no están en Auth
    console.log('\n🔍 Verificando usuarios en BD Local que NO están en Supabase Auth:\n')
    
    let huerfanos = 0
    for (const dbUser of dbUsers) {
      const authUser = authUsers.find(u => u.email === dbUser.email)
      if (!authUser) {
        console.log(`⚠️  ${dbUser.email}`)
        console.log(`   DB ID: ${dbUser.id}`)
        console.log(`   En Supabase Auth: ❌ NO ENCONTRADO`)
        console.log(`   Acción: Mantener en BD (puede ser usuario legacy)\n`)
        huerfanos++
      }
    }

    // 5. Resumen
    console.log('\n' + '='.repeat(60))
    console.log('📊 RESUMEN DE SINCRONIZACIÓN')
    console.log('='.repeat(60))
    console.log(`✅ Ya sincronizados:      ${sincronizados}`)
    console.log(`➕ Creados en BD:         ${creados}`)
    console.log(`🔄 IDs actualizados:      ${actualizados}`)
    console.log(`⚠️  Usuarios huérfanos:   ${huerfanos}`)
    console.log(`❌ Errores:               ${errores}`)
    console.log('='.repeat(60))

    if (errores > 0) {
      console.log('\n⚠️  Algunos usuarios no pudieron sincronizarse. Revisa los errores arriba.')
    } else if (actualizados > 0 || creados > 0) {
      console.log('\n🎉 ¡Sincronización completada exitosamente!')
    } else {
      console.log('\n✨ Todos los usuarios ya estaban sincronizados.')
    }

    if (huerfanos > 0) {
      console.log('\n💡 Tip: Los usuarios huérfanos existen en tu BD pero no en Supabase Auth.')
      console.log('   Considera eliminarlos o crear sus cuentas en Supabase Auth.')
    }

  } catch (error) {
    console.error('\n❌ Error fatal durante la sincronización:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Ejecutar
console.log('⚠️  ADVERTENCIA: Este script modificará la base de datos.')
console.log('   Asegúrate de tener un backup antes de continuar.\n')

syncUserIds()
  .then(() => {
    console.log('\n✅ Script finalizado.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error ejecutando script:', error)
    process.exit(1)
  })
