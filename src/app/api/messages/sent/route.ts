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
        .from('mensajes')
        .select('id, asunto, cuerpo, created_at, mensaje_destinatarios(destinatario_id)')
        .eq('remitente_id', authData.user.id)
        .order('created_at', { ascending: false })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const items = (data || []).map((row: any) => ({
        id: row.id,
        asunto: row.asunto,
        cuerpo: row.cuerpo,
        created_at: row.created_at,
        destinatarios: (row.mensaje_destinatarios || []).map((d: any) => d.destinatario_id),
    }))

    return NextResponse.json({ items })
}


