import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// Configuración para Vercel - usar Node.js runtime
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    console.log('🔍 [API] Verificando estado de usuario...');
    
    // Verificar autenticación
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    console.log('👤 [API] Usuario de Supabase:', user?.email, 'Error:', authError?.message);

    if (authError || !user) {
      console.log('❌ [API] No autorizado');
      return NextResponse.json(
        { error: 'No autorizado', isActive: false },
        { status: 401 }
      )
    }

    // Verificar el estado del usuario en la base de datos
    console.log('🔎 [API] Buscando usuario en DB con ID:', user.id);
    
    let dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { 
        isActive: true,
        email: true 
      }
    })

    // Si no se encuentra por ID, buscar por email (problema de IDs desincronizados)
    if (!dbUser && user.email) {
      console.log('⚠️ [API] Usuario no encontrado por ID, buscando por email:', user.email);
      
      dbUser = await prisma.user.findUnique({
        where: { email: user.email },
        select: { 
          isActive: true,
          email: true 
        }
      })
      
      if (dbUser) {
        console.log('✅ [API] Usuario encontrado por email (IDs desincronizados)');
      }
    }

    console.log('💾 [API] Usuario en DB:', JSON.stringify(dbUser, null, 2));

    if (!dbUser) {
      console.log('⚠️ [API] Usuario no encontrado en DB - puede ser usuario nuevo de Supabase');
      // Usuario existe en Supabase pero no en nuestra BD local
      // Por seguridad, bloquear acceso (isActive: false)
      return NextResponse.json(
        { 
          error: 'Usuario no sincronizado en el sistema. Contacta al administrador.',
          isActive: false,
          userId: user.id
        },
        { status: 200 } // Cambiar a 200 para que se procese correctamente
      )
    }

    console.log(`✅ [API] Estado del usuario ${dbUser.email}: isActive = ${dbUser.isActive}`);

    return NextResponse.json({
      isActive: dbUser.isActive,
      userId: user.id,
      email: dbUser.email
    })
  } catch (error) {
    console.error('❌ [API] Error checking user status:', error)
    // En caso de error, retornar isActive: false por seguridad
    return NextResponse.json(
      { isActive: false, error: 'Error al verificar estado' },
      { status: 500 }
    )
  }
}
