/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const onlyUnread = searchParams.get('unread') === 'true'
    const last7 = searchParams.get('last7') === 'true'

    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Consulta simplificada sin relaciones automáticas
    let query = supabase
        .from('mensaje_destinatarios')
        .select(`
            mensaje_id,
            read_at,
            archived_at,
            deleted_at,
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

    if (onlyUnread) {
        query = query.is('read_at', null)
    }

    if (last7) {
        const since = new Date()
        since.setDate(since.getDate() - 7)
        query = query.gte('mensajes.created_at', since.toISOString())
    }

    // Solo ordenar por read_at, el resto se ordenará en el cliente
    query = query.order('read_at', { ascending: true, nullsFirst: true })

    const { data, error } = await query
    if (error) {
        console.error('Error fetching inbox:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Obtener información de usuarios por separado
    const mensajeIds = (data || []).map((row: any) => row.mensajes?.id).filter(Boolean)
    const remitenteIds = (data || []).map((row: any) => row.mensajes?.remitente_id).filter(Boolean)
    
    // Consulta separada para obtener información de usuarios
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
            read_at: row.read_at,
            archived_at: row.archived_at,
        }
    })

    // Ordenar en el cliente: primero no leídos, luego por fecha descendente
    items.sort((a, b) => {
        // Primero ordenar por estado de lectura (no leídos primero)
        if (a.leido !== b.leido) {
            return a.leido ? 1 : -1
        }
        // Luego por fecha de creación (más recientes primero)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    return NextResponse.json({ items })
}


