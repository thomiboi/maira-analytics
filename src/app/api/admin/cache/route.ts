import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCacheStats, invalidateAllPermissionsCache, invalidateUserPermissionsCache } from '@/lib/permissions-cache'

export async function GET() {
  try {
    // Verificar autenticación
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Usuario no autenticado' }, 
        { status: 401 }
      )
    }

    // Obtener estadísticas del caché
    const stats = getCacheStats()

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error al obtener estadísticas del caché:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    // Verificar autenticación
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Usuario no autenticado' }, 
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const email = url.searchParams.get('email')

    if (email) {
      // Invalidar caché para usuario específico
      const invalidated = invalidateUserPermissionsCache(email)
      return NextResponse.json({
        success: true,
        message: invalidated 
          ? `Caché invalidado para ${email}` 
          : `No se encontró caché para ${email}`,
        email
      })
    } else {
      // Invalidar todo el caché
      invalidateAllPermissionsCache()
      return NextResponse.json({
        success: true,
        message: 'Todo el caché de permisos ha sido invalidado'
      })
    }

  } catch (error) {
    console.error('Error al invalidar caché:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}