import { NextRequest, NextResponse } from 'next/server'
import { PermissionManager } from '@/lib/permissions-management'
import { createClient } from '@/lib/supabase/server'
import { UserManager } from '@/lib/users-management'

/**
 * GET /api/admin/permissions
 * Obtener todos los permisos
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
    const userWithPermissions = await UserManager.getUserWithPermissions(user.email || '')
    
    if (!userWithPermissions?.role?.permissions.some(rp => 
      rp.permission.name === 'usuarios.write' || rp.permission.name === 'config.write'
    )) {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })
    }

    const permissions = await PermissionManager.getAllPermissions()
    return NextResponse.json({ permissions })
  } catch (error) {
    console.error('Error getting permissions:', error)
    return NextResponse.json(
      { error: 'Error al obtener permisos' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/permissions
 * Crear nuevo permiso
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
      rp.permission.name === 'usuarios.write' || rp.permission.name === 'config.write'
    )) {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, resource, action } = body

    // Validar datos requeridos
    if (!name) {
      return NextResponse.json({ error: 'El nombre del permiso es requerido' }, { status: 400 })
    }
    if (!resource) {
      return NextResponse.json({ error: 'El recurso es requerido' }, { status: 400 })
    }
    if (!action) {
      return NextResponse.json({ error: 'La acción es requerida' }, { status: 400 })
    }

    const result = await PermissionManager.createPermission({
      name,
      description,
      resource,
      action
    })
    
    if (result.success) {
      return NextResponse.json({ permission: result.permission }, { status: 201 })
    } else {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  } catch (error) {
    console.error('Error creating permission:', error)
    return NextResponse.json(
      { error: 'Error al crear permiso' },
      { status: 500 }
    )
  }
}