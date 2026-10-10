import { NextRequest, NextResponse } from 'next/server'
import { PermissionManager } from '@/lib/permissions-management'
import { createClient } from '@/lib/supabase/server'
import { UserManager } from '@/lib/users-management'

/**
 * POST /api/admin/roles/[roleId]/permissions
 * Actualizar permisos de un rol (reemplazar todos)
 */
export async function POST(
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
    const { permissionIds } = body

    // Validar que permissionIds es un array
    if (!Array.isArray(permissionIds)) {
      return NextResponse.json({ error: 'permissionIds debe ser un array' }, { status: 400 })
    }

    const result = await PermissionManager.updateRolePermissions(roleId, permissionIds)
    
    if (result.success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  } catch (error) {
    console.error('Error updating role permissions:', error)
    return NextResponse.json(
      { error: 'Error al actualizar permisos del rol' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/roles/[roleId]/permissions
 * Agregar un permiso específico al rol
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
    const { permissionId } = body

    if (!permissionId) {
      return NextResponse.json({ error: 'permissionId es requerido' }, { status: 400 })
    }

    const result = await PermissionManager.assignPermissionToRole(roleId, permissionId)
    
    if (result.success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  } catch (error) {
    console.error('Error adding permission to role:', error)
    return NextResponse.json(
      { error: 'Error al agregar permiso al rol' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/roles/[roleId]/permissions
 * Remover un permiso específico del rol
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

    const body = await request.json()
    const { permissionId } = body

    if (!permissionId) {
      return NextResponse.json({ error: 'permissionId es requerido' }, { status: 400 })
    }

    const result = await PermissionManager.removePermissionFromRole(roleId, permissionId)
    
    if (result.success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  } catch (error) {
    console.error('Error removing permission from role:', error)
    return NextResponse.json(
      { error: 'Error al remover permiso del rol' },
      { status: 500 }
    )
  }
}