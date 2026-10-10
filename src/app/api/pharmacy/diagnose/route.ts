import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PharmacyDataService } from '@/lib/pharmacy-data-service'

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        console.log('🔍 Iniciando diagnóstico de base de datos...')

        // Ejecutar diagnóstico y test de conexión
        const diagnosis = await PharmacyDataService.diagnoseDatabase()
        const connectionTest = await PharmacyDataService.testConnection()

        // Obtener información básica de las tablas
        const { data: boletasCount } = await supabase
            .from('boletas')
            .select('*', { count: 'exact', head: true })

        const { data: detallesCount } = await supabase
            .from('boletas_detalles')
            .select('*', { count: 'exact', head: true })

        const { data: pagosCount } = await supabase
            .from('boletas_pagos')
            .select('*', { count: 'exact', head: true })

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            user: user.email,
            diagnosis,
            connectionTest,
            tableInfo: {
                boletas: boletasCount || 0,
                boletas_detalles: detallesCount || 0,
                boletas_pagos: pagosCount || 0
            },
            summary: {
                connectionWorking: connectionTest,
                databaseStatus: diagnosis.status,
                message: diagnosis.message
            }
        })

    } catch (error) {
        console.error('Error en diagnóstico:', error)
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido',
            timestamp: new Date().toISOString()
        }, { status: 500 })
    }
}