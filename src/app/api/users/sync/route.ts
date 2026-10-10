import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()

        if (error || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { id, email } = body

        // Verificar que el usuario autenticado coincida
        if (user.id !== id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Crear o actualizar usuario en Prisma
        const userData = await prisma.user.upsert({
            where: { id },
            update: { email },
            create: {
                id,
                email
            },
            include: {
                profile: true,
                _count: {
                    select: {
                        posts: true
                    }
                }
            }
        })

        return NextResponse.json({
            user: userData,
            message: 'User synced successfully'
        })
    } catch (error) {
        console.error('Error syncing user:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
