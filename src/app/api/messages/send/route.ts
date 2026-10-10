/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { asunto, cuerpo, destinatarios } = body as { asunto?: string; cuerpo?: string; destinatarios?: string[] }

    if (!asunto || !cuerpo || !Array.isArray(destinatarios) || destinatarios.length === 0) {
        return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const remitenteId = authData.user.id

    // Insert mensaje
    const { data: mensajeInsert, error: msgError } = await supabase
        .from('mensajes')
        .insert({ remitente_id: remitenteId, asunto, cuerpo })
        .select('id')
        .single()

    if (msgError || !mensajeInsert) {
        return NextResponse.json({ error: msgError?.message || 'No se pudo crear el mensaje' }, { status: 500 })
    }

    const mensajeId = mensajeInsert.id as number

    // Insert destinatarios (1→N)
    const destinatariosRows = destinatarios.map((id) => ({ mensaje_id: mensajeId, destinatario_id: id }))
    const { error: destError } = await supabase
        .from('mensaje_destinatarios')
        .insert(destinatariosRows)

    if (destError) {
        return NextResponse.json({ error: destError.message }, { status: 500 })
    }

    return NextResponse.json({ id: mensajeId }, { status: 201 })
}


