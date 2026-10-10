/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()

    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Buscar usuarios activos, excluir al propio usuario
    const { data, error } = await supabase
        .from('users')
        .select('id, email, is_active, user_profiles(first_name, last_name)')
        .eq('is_active', true)
        .neq('id', authData.user.id)
        .limit(50)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const norm = q.toLowerCase()
    const items = (data || [])
        .map((u: any) => {
            const name = `${u.user_profiles?.first_name ?? ''} ${u.user_profiles?.last_name ?? ''}`.trim()
            const label = name || u.email
            return { id: u.id, label, email: u.email }
        })
        .filter((u: any) => !norm || u.label.toLowerCase().includes(norm) || (u.email ?? '').toLowerCase().includes(norm))
        .slice(0, 20)

    return NextResponse.json({ items })
}


