import { NextRequest, NextResponse } from 'next/server'
import { RoleManager } from '@/lib/roles-management'
import { createClient } from '@/lib/supabase/server'
import { UserManager } from '@/lib/users-management'

/**
 * GET /api/admin/roles/[roleId]
 * Obtener rol específico con permisos
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  const { roleId } = await params

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
      rp.permission.name === 'usuarios.write' || rp.permission.name === 'config.write'
    )) {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })
    }

    const role = await RoleManager.getRoleById(roleId)
    
    if (!role) {
      return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ role })
  } catch (error) {
    console.error('Error getting role:', error)
    return NextResponse.json(
      { error: 'Error al obtener rol' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/roles/[roleId]
 * Actualizar rol
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  const { roleId } = await params

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
      rp.permission.name === 'usuarios.write' || rp.permission.name === 'config.write'
    )) {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description } = body

    const result = await RoleManager.updateRole(roleId, {
      name,
      description
    })
    
    if (result.success) {
      return NextResponse.json({ role: result.role })
    } else {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  } catch (error) {
    console.error('Error updating role:', error)
    return NextResponse.json(
      { error: 'Error al actualizar rol' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/roles/[roleId]
 * Eliminar rol
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  const { roleId } = await params

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
      rp.permission.name === 'usuarios.write' || rp.permission.name === 'config.write'
    )) {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })
    }

    const result = await RoleManager.deleteRole(roleId)
    
    if (result.success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  } catch (error) {
    console.error('Error deleting role:', error)
    return NextResponse.json(
      { error: 'Error al eliminar rol' },
      { status: 500 }
    )
  }
}