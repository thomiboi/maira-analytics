import { NextRequest, NextResponse } from 'next/server'
import { UserManager } from '@/lib/users-management'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/admin/users/[userId]
 * Obtener usuario específico
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params

  try {
    // Verificar autenticación
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar permisos de administrador (solo admin puede ver detalles de otros usuarios)
    const userWithPermissions = await UserManager.getUserWithPermissions(user.email || '')
    
    const isAdmin = userWithPermissions?.role?.name === 'admin' || 
                   userWithPermissions?.role?.permissions.some(rp => 
                     rp.permission.name === 'config.write'
                   )

    if (!isAdmin) {
      return NextResponse.json({ error: 'Solo administradores pueden acceder a esta función' }, { status: 403 })
    }

    const targetUser = await UserManager.getUserById(userId)
    
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ user: targetUser })
  } catch (error) {
    console.error('Error getting user:', error)
    return NextResponse.json(
      { error: 'Error al obtener usuario' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/users/[userId]
 * Actualizar usuario (solo admin)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params

  try {
    // Verificar autenticación
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar permisos de administrador
    const userWithPermissions = await UserManager.getUserWithPermissions(user.email || '')
    
    const isAdmin = userWithPermissions?.role?.name === 'admin' || 
                   userWithPermissions?.role?.permissions.some(rp => 
                     rp.permission.name === 'config.write'
                   )

    if (!isAdmin) {
      return NextResponse.json({ error: 'Solo administradores pueden editar usuarios' }, { status: 403 })
    }

    const body = await request.json()
    const { email, roleId } = body

    const result = await UserManager.updateUser(userId, {
      email,
      roleId
    })
    
    if (result.success) {
      return NextResponse.json({ user: result.user })
    } else {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Error al actualizar usuario' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/users/[userId]
 * Eliminar usuario (solo admin)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params

  try {
    // Verificar autenticación
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar permisos de administrador
    const userWithPermissions = await UserManager.getUserWithPermissions(user.email || '')
    
    const isAdmin = userWithPermissions?.role?.name === 'admin' || 
                   userWithPermissions?.role?.permissions.some(rp => 
                     rp.permission.name === 'config.write'
                   )

    if (!isAdmin) {
      return NextResponse.json({ error: 'Solo administradores pueden eliminar usuarios' }, { status: 403 })
    }

    // Verificar que el usuario no se elimine a sí mismo
    const targetUser = await UserManager.getUserById(userId)
    if (targetUser?.email === user.email) {
      return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 400 })
    }

    const result = await UserManager.deleteUser(userId)
    
    if (result.success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Error al eliminar usuario' },
      { status: 500 }
    )
  }
}