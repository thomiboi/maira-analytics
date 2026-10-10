import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCachedUserPermissions } from '@/lib/permissions-cache'

// Cache global para promesas activas de permisos  
type UserPermissionsResult = {
  permissions: { id: string; name: string; resource: string; action: string }[];
  role: { id: string; name: string; description: string | null } | null;
  user: { id: string; email: string };
}
const activePermissionsRequests = new Map<string, Promise<UserPermissionsResult>>()

export async function GET() {
  try {
    // Obtener el usuario autenticado de Supabase
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('Error de autenticación:', authError)
      return NextResponse.json(
        { error: 'Usuario no autenticado' },
        { status: 401 }
      )
    }

    const userEmail = user.email!

    // Verificar si ya hay una promesa activa para este usuario
    const activePromise = activePermissionsRequests.get(userEmail)
    if (activePromise) {
      console.log('🔄 PERMISOS: Request en progreso, esperando...')
      const result = await activePromise
      return NextResponse.json(result)
    }

    // Crear nueva promesa para obtener permisos
    const permissionsPromise = fetchUserPermissionsInternal({ id: user.id, email: user.email! })
    activePermissionsRequests.set(userEmail, permissionsPromise)

    try {
      console.log('🔄 PERMISOS: Ejecutando fetch de permisos...')
      const result = await permissionsPromise
      return NextResponse.json(result)
    } finally {
      // Limpiar promesa activa cuando termine
      activePermissionsRequests.delete(userEmail)
    }

  } catch (error) {
    console.error('Error al obtener permisos del usuario:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// Función interna para obtener permisos del usuario
async function fetchUserPermissionsInternal(user: { id: string; email: string }) {
  // Obtener permisos desde caché (optimizado)
  const userPermissions = await getCachedUserPermissions(user.email!)

  if (!userPermissions) {
    console.error('Usuario no encontrado en la base de datos:', user.email)
    throw new Error('Usuario no encontrado en la base de datos')
  }

  return {
    permissions: userPermissions.permissions,
    role: userPermissions.role,
    user: {
      id: user.id,
      email: user.email
    }
  }
}