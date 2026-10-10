import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
    try {
        const supabase = await createClient()

        // Contar registros totales en cada tabla
        const { count: boletasCount, error: boletasError } = await supabase
            .from('boletas')
            .select('*', { count: 'exact', head: true })

        const { count: detallesCount, error: detallesError } = await supabase
            .from('boletas_detalles')
            .select('*', { count: 'exact', head: true })

        const { count: pagosCount, error: pagosError } = await supabase
            .from('boletas_pagos')
            .select('*', { count: 'exact', head: true })

        if (boletasError || detallesError || pagosError) {
            return NextResponse.json(
                {
                    error: 'Error en conteo',
                    details: { boletasError, detallesError, pagosError }
                },
                { status: 500 }
            )
        }

        // También vamos a probar obtener más de 1000 registros directamente
        const { data: sampleData, error: sampleError } = await supabase
            .from('boletas')
            .select('folio')
            .range(0, 1500) // Intentar obtener 1501 registros
            .limit(1501)

        return NextResponse.json({
            totalCounts: {
                boletas: boletasCount,
                boletas_detalles: detallesCount,
                boletas_pagos: pagosCount
            },
            sampleTest: {
                requestedRecords: 1501,
                actualRecords: sampleData?.length || 0,
                error: sampleError
            }
        })

    } catch (error) {
        console.error('Error en diagnóstico de conteo:', error)
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        )
    }
}