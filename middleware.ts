import { createClient } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware simplificado que SOLO maneja autenticación y estado de usuario.
 * La verificación de permisos se hace en los Server Components o API Routes.
 * 
 * IMPORTANTE: El middleware de Next.js corre en Edge Runtime donde:
 * - No se puede usar Prisma directamente (causaría loops)
 * - Debe ser extremadamente rápido
 * - No debe hacer consultas DB pesadas
 */
export async function middleware(request: NextRequest) {
    const { supabase, response } = createClient(request)
    const pathname = request.nextUrl.pathname

    // Refresh session if expired - required for Server Components
    const {
        data: { session },
    } = await supabase.auth.getSession()

    // Protect dashboard routes - first check if user is authenticated
    if (pathname.startsWith('/dashboard') && !session) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    // Redirect to dashboard if logged in and trying to access login
    if (pathname === '/login' && session) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // ✅ Solo verificación de autenticación aquí
    // ✅ Los permisos se verifican en cada página/componente individualmente
    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         * - api routes (handled separately)
         */
        '/((?!_next/static|_next/image|favicon.ico|public|api).*)',
    ],
}
