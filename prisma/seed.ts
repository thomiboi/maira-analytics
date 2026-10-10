import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed de roles y permisos...')

  // 1. Crear permisos básicos
  console.log('📝 Creando permisos...')
  
  const permissionsData = [
    {
      name: 'home.read',
      description: 'Ver página principal',
      resource: 'home',
      action: 'read'
    },
    {
      name: 'dashboard.read',
      description: 'Ver dashboard',
      resource: 'dashboard',
      action: 'read'
    },
    {
      name: 'analytics.read',
      description: 'Ver analytics y reportes',
      resource: 'analytics',
      action: 'read'
    },
    {
      name: 'ranking.read',
      description: 'Ver rankings y estadísticas',
      resource: 'ranking',
      action: 'read'
    },
    {
      name: 'proveedores.read',
      description: 'Ver proveedores',
      resource: 'proveedores',
      action: 'read'
    },
    {
      name: 'usuarios.read',
      description: 'Ver usuarios del sistema',
      resource: 'usuarios',
      action: 'read'
    },
    {
      name: 'usuarios.write',
      description: 'Gestionar usuarios del sistema',
      resource: 'usuarios',
      action: 'write'
    },
    {
      name: 'config.read',
      description: 'Ver configuración del sistema',
      resource: 'config',
      action: 'read'
    },
    {
      name: 'config.write',
      description: 'Modificar configuración del sistema',
      resource: 'config',
      action: 'write'
    },
    {
      name: 'inventory.read',
      description: 'Ver inventario',
      resource: 'inventory',
      action: 'read'
    },
    {
      name: 'inventory.write',
      description: 'Gestionar inventario',
      resource: 'inventory',
      action: 'write'
    },
    {
      name: 'pharmacy.read',
      description: 'Ver información de farmacia',
      resource: 'pharmacy',
      action: 'read'
    },
    {
      name: 'pharmacy.write',
      description: 'Gestionar información de farmacia',
      resource: 'pharmacy',
      action: 'write'
    },
    {
      name: 'mensajes.read',
      description: 'Ver mensajes internos',
      resource: 'mensajes',
      action: 'read'
    },
    {
      name: 'mensajes.write',
      description: 'Enviar y gestionar mensajes internos',
      resource: 'mensajes',
      action: 'write'
    }
  ] satisfies Array<{
    name: string
    description: string
    resource: string
    action: string
  }>

  const permissions = [] as Array<typeof permissionsData[number] & { id: string }>

  for (const permission of permissionsData) {
    const record = await prisma.permission.upsert({
      where: { name: permission.name },
      update: {
        description: permission.description,
        resource: permission.resource,
        action: permission.action
      },
      create: permission
    })

    permissions.push({ ...permission, id: record.id })
  }

  console.log(`✅ Creados ${permissions.length} permisos`)

  // 2. Crear roles básicos
  console.log('👑 Creando roles...')
  
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'Administrador del sistema con acceso completo'
    }
  })

  const pharmacistRole = await prisma.role.upsert({
    where: { name: 'pharmacist' },
    update: {},
    create: {
      name: 'pharmacist',
      description: 'Farmacéutico con acceso limitado'
    }
  })

  const viewerRole = await prisma.role.upsert({
    where: { name: 'viewer' },
    update: {},
    create: {
      name: 'viewer',
      description: 'Usuario con permisos de solo lectura'
    }
  })

  console.log('✅ Creados 3 roles')

  // 3. Asignar permisos a roles
  console.log('🔗 Asignando permisos a roles...')

  // Admin tiene todos los permisos
  const adminPermissions = permissions.map(p => ({
    roleId: adminRole.id,
    permissionId: p.id
  }))

  // Pharmacist tiene permisos específicos
  const pharmacistPermissions = permissions
    .filter(p => 
      p.name.includes('home') ||
      p.name.includes('dashboard') ||
      p.name.includes('pharmacy') ||
      p.name.includes('inventory') ||
      p.name.includes('mensajes')
    )
    .map(p => ({
      roleId: pharmacistRole.id,
      permissionId: p.id
    }))

  // Viewer solo lectura básica
  const viewerPermissions = permissions
    .filter(p => 
      p.name.includes('home') ||
      p.name.includes('dashboard') ||
      (p.action === 'read' && !p.name.includes('config'))
    )
    .map(p => ({
      roleId: viewerRole.id,
      permissionId: p.id
    }))

  // Crear las relaciones en lotes
  await prisma.rolePermission.createMany({
    data: [...adminPermissions, ...pharmacistPermissions, ...viewerPermissions],
    skipDuplicates: true
  })

  console.log(`✅ Asignados permisos: Admin(${adminPermissions.length}), Pharmacist(${pharmacistPermissions.length}), Viewer(${viewerPermissions.length})`)

  // 4. Crear usuario administrador de prueba
  console.log('👤 Creando usuario administrador...')
  
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      roleId: adminRole.id
    },
    create: {
      email: 'admin@example.com',
      roleId: adminRole.id
    }
  })

  console.log('✅ Usuario administrador creado')

  console.log('\n🎉 ¡Seed completado exitosamente!')
  console.log('\n📋 Resumen:')
  console.log(`   - ${permissions.length} permisos creados`)
  console.log('   - 3 roles creados (admin, pharmacist, viewer)')
  console.log(`   - ${adminPermissions.length + pharmacistPermissions.length + viewerPermissions.length} relaciones de permisos`)
  console.log('   - 1 usuario administrador de prueba')
  console.log('\n🔐 Credenciales de prueba:')
  console.log('   Email: admin@example.com')
  console.log('   Contraseña: password123 (configurar en Supabase Auth)')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Error en seed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })