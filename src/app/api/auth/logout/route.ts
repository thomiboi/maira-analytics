import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { invalidateUserPermissionsCache } from '@/lib/permissions-cache'

export async function POST() {
  try {
    // Obtener el usuario autenticado de Supabase
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Usuario no autenticado' }, 
        { status: 401 }
      )
    }

    // Limpiar caché de permisos para el usuario actual
    const wasInvalidated = invalidateUserPermissionsCache(user.email!)
    
    console.log(`[LOGOUT] Caché de permisos limpiado para: ${user.email}`)

    return NextResponse.json({
      success: true,
      message: `Caché limpiado ${wasInvalidated ? 'exitosamente' : '(no había caché)'}`,
      email: user.email,
      wasInvalidated
    })

  } catch (error) {
    console.error('Error al limpiar caché en logout:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}