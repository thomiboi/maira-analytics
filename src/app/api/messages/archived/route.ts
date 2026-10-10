/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
        .from('mensaje_destinatarios')
        .select(`
            mensaje_id,
            read_at,
            archived_at,
            mensajes!inner(
                id,
                asunto,
                cuerpo,
                created_at,
                remitente_id
            )
        `)
        .eq('destinatario_id', authData.user.id)
        .is('deleted_at', null)
        .not('archived_at', 'is', null)
        .order('mensajes(created_at)', { ascending: false })

    if (error) {
        console.error('Error fetching archived:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Obtener información de usuarios por separado
    const remitenteIds = (data || []).map((row: any) => row.mensajes?.remitente_id).filter(Boolean)
    
    const { data: usersData } = await supabase
        .from('users')
        .select(`
            id,
            email,
            user_profiles(first_name, last_name)
        `)
        .in('id', remitenteIds)

    const usersMap = new Map()
    ;(usersData || []).forEach((user: any) => {
        usersMap.set(user.id, user)
    })

    const items = (data || []).map((row: any) => {
        const mensaje = row.mensajes
        const user = usersMap.get(mensaje?.remitente_id)
        const nombre = user?.user_profiles?.first_name || user?.user_profiles?.last_name
            ? `${user?.user_profiles?.first_name ?? ''} ${user?.user_profiles?.last_name ?? ''}`.trim()
            : undefined
        return {
            id: mensaje?.id,
            asunto: mensaje?.asunto,
            cuerpo: mensaje?.cuerpo,
            created_at: mensaje?.created_at,
            remitente_email: user?.email,
            remitente_nombre: nombre || user?.email,
            leido: !!row.read_at,
            archived_at: row.archived_at,
        }
    })

    return NextResponse.json({ items })
}


