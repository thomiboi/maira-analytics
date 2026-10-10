import { NextRequest, NextResponse } from 'next/server'
import { UserManager } from '@/lib/users-management'
import { createClient } from '@/lib/supabase/server'
import { getCachedUserPermissions } from '@/lib/permissions-cache'

/**
 * GET /api/admin/users
 * Obtener todos los usuarios
 */
export async function GET() {
  try {
    // Verificar autenticación
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar permisos de administrador
    const userPermissions = await getCachedUserPermissions(user.email || '')

    const hasAccess = userPermissions?.permissions.some((permission) => {
      if (!permission) return false

      const matchesName = permission.name === 'usuarios.write' || permission.name === 'usuarios.read'
      const matchesResource = permission.resource === 'usuarios' && (permission.action === 'write' || permission.action === 'read')

      return matchesName || matchesResource
    })

    if (!hasAccess) {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })
    }

    const users = await UserManager.getAllUsers()
    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error getting users:', error)
    return NextResponse.json(
      { error: 'Error al obtener usuarios' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/users
 * Crear nuevo usuario
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar permisos de administrador
    const userWithPermissions = await UserManager.getUserWithPermissions(user.email || '')
    
    if (!userWithPermissions?.role?.permissions.some(rp => 
      rp.permission.name === 'usuarios.write'
    )) {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })
    }

    const body = await request.json()
    const { email, password, firstName, lastName, roleId, sendWelcomeEmail } = body

    // Validar datos requeridos
    if (!email) {
      return NextResponse.json({ error: 'El email es requerido' }, { status: 400 })
    }
    if (!password) {
      return NextResponse.json({ error: 'La contraseña es requerida' }, { status: 400 })
    }
    if (!firstName) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }
    if (!lastName) {
      return NextResponse.json({ error: 'El apellido es requerido' }, { status: 400 })
    }
    if (!roleId) {
      return NextResponse.json({ error: 'El rol es requerido' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
    }

    const result = await UserManager.createUserWithRole({
      email,
      password,
      firstName,
      lastName,
      roleId,
      sendWelcomeEmail
    })
    
    if (result.success) {
      return NextResponse.json({ user: result.user }, { status: 201 })
    } else {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Error al crear usuario' },
      { status: 500 }
    )
  }
}