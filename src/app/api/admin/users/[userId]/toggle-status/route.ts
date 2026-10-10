import { NextRequest, NextResponse } from 'next/server'
import { UserManager } from '@/lib/users-management'
import { createClient } from '@/lib/supabase/server'

// Configuración para Vercel - usar Node.js runtime
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    // Resolver params (Next.js 15+)
    const { userId } = await context.params

    // Verificar autenticación
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Obtener el usuario autenticado con permisos
    const currentUser = await UserManager.getUserWithPermissions(user.email!)
    
    if (!currentUser?.role) {
      return NextResponse.json(
        { error: 'No tienes permisos para realizar esta acción' },
        { status: 403 }
      )
    }

    // Verificar si tiene permiso de escritura en usuarios
    const hasWritePermission = currentUser.role.permissions.some(
      rp => rp.permission.resource === 'usuarios' && rp.permission.action === 'write'
    )

    if (!hasWritePermission) {
      return NextResponse.json(
        { error: 'No tienes permisos para modificar usuarios' },
        { status: 403 }
      )
    }

    // No permitir que el usuario se deshabilite a sí mismo
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'No puedes deshabilitarte a ti mismo' },
        { status: 400 }
      )
    }

    // Alternar el estado del usuario
    const result = await UserManager.toggleUserStatus(userId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Error al cambiar el estado del usuario' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      message: result.isActive 
        ? 'Usuario habilitado correctamente' 
        : 'Usuario deshabilitado correctamente',
      user: result.user,
      isActive: result.isActive
    })
  } catch (error) {
    console.error('Error toggling user status:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
