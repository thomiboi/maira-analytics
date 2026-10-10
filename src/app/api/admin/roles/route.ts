import { NextRequest, NextResponse } from 'next/server'
import { RoleManager } from '@/lib/roles-management'
import { createClient } from '@/lib/supabase/server'
import { UserManager } from '@/lib/users-management'

/**
 * GET /api/admin/roles
 * Obtener todos los roles
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

    const roles = await RoleManager.getAllRoles()
    return NextResponse.json({ roles })
  } catch (error) {
    console.error('Error getting roles:', error)
    return NextResponse.json(
      { error: 'Error al obtener roles' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/roles
 * Crear nuevo rol
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
    const { name, description, permissions } = body

    // Validar datos requeridos
    if (!name) {
      return NextResponse.json({ error: 'El nombre del rol es requerido' }, { status: 400 })
    }

    const result = await RoleManager.createRole({
      name,
      description,
      permissions
    })
    
    if (result.success) {
      return NextResponse.json({ role: result.role }, { status: 201 })
    } else {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  } catch (error) {
    console.error('Error creating role:', error)
    return NextResponse.json(
      { error: 'Error al crear rol' },
      { status: 500 }
    )
  }
}