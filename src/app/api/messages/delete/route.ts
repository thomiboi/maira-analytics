/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { mensajeId } = await request.json()
    if (!mensajeId) {
        return NextResponse.json({ error: 'mensajeId requerido' }, { status: 400 })
    }

    const { error } = await supabase
        .from('mensaje_destinatarios')
        .update({ deleted_at: new Date().toISOString() })
        .eq('mensaje_id', mensajeId)
        .eq('destinatario_id', authData.user.id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
}


