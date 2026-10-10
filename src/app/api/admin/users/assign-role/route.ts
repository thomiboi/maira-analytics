import { NextRequest, NextResponse } from 'next/server'
import { UserManager } from '@/lib/users-management'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/admin/users/assign-role
 * Asignar rol a usuario
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
    const { userEmail, roleId } = body

    // Validar datos requeridos
    if (!userEmail) {
      return NextResponse.json({ error: 'El email del usuario es requerido' }, { status: 400 })
    }
    if (!roleId) {
      return NextResponse.json({ error: 'El rol es requerido' }, { status: 400 })
    }

    const result = await UserManager.assignRoleToUser(userEmail, roleId)
    
    if (result.success) {
      return NextResponse.json({ user: result.user })
    } else {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  } catch (error) {
    console.error('Error assigning role:', error)
    return NextResponse.json(
      { error: 'Error al asignar rol' },
      { status: 500 }
    )
  }
}