/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { count, error } = await supabase
        .from('mensaje_destinatarios')
        .select('*', { count: 'exact', head: true })
        .eq('destinatario_id', authData.user.id)
        .is('deleted_at', null)
        .is('read_at', null)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ no_leidos: count ?? 0 })
}


