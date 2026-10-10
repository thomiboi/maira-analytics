import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { externalApiService } from '@/lib/external-api'
import { PharmacyDashboardData } from '@/types/pharmacy'
import { PharmacyDataService } from '@/lib/pharmacy-data-service'

// Cache global a nivel de servidor para evitar múltiples requests
const globalServerCache = new Map<string, { data: PharmacyDashboardData; timestamp: number; promise?: Promise<PharmacyDashboardData> }>()

// Cache duration adaptativo basado en el período
function getCacheDuration(periodParam: string): number {
    if (periodParam === 'all') {
        return 10 * 60 * 1000; // 10 minutos para datos históricos
    }

    const periodDays = parseInt(periodParam);
    if (periodDays >= 365) {
        return 8 * 60 * 1000;  // 8 minutos para períodos largos
    } else if (periodDays >= 30) {
        return 3 * 60 * 1000;  // 3 minutos para períodos medios
    } else {
        return 1 * 60 * 1000;  // 1 minuto para períodos cortos (más responsivo)
    }
}


export async function GET(request: NextRequest) {
    try {
        // Obtener parámetros del query string primero para crear la clave de cache
        const { searchParams } = new URL(request.url)
        const periodParam = searchParams.get('period_days') || '30'
        const periodDays = periodParam === 'all' ? -1 : parseInt(periodParam)
        const branchParam = searchParams.get('branch_id') || 'all'

        // Convertir branchId: "null" string -> null, "all" -> undefined
        const branchId = branchParam === 'null' ? null :
            branchParam === 'all' ? undefined :
                branchParam

        // SOLO DATOS REALES: Eliminar opción de datos ficticios
        const cacheKey = `dashboard_${periodParam}_${periodDays}_${branchParam}_real`
        console.log('🔑 Clave de caché:', cacheKey)
        const currentTime = Date.now()

        // Cache duration dinámico basado en el período
        const CACHE_DURATION = getCacheDuration(periodParam)
        console.log(`⏰ Cache duration para período ${periodParam}: ${CACHE_DURATION / 1000}s`)

        // Verificar cache
        const cachedEntry = globalServerCache.get(cacheKey)
        if (cachedEntry) {
            if (cachedEntry.promise) {
                console.log('🔄 API: Request en progreso, esperando...')
                const result = await cachedEntry.promise
                return NextResponse.json(result)
            }
            if (currentTime - cachedEntry.timestamp < CACHE_DURATION) {
                console.log('🚀 API: Usando datos del cache del servidor')
                return NextResponse.json(cachedEntry.data)
            }
        }

        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        // Crear promesa para obtener datos reales
        const fetchPromise = fetchDashboardDataInternal(periodParam, periodDays, branchId)

        // Almacenar la promesa en caché
        globalServerCache.set(cacheKey, {
            data: {} as PharmacyDashboardData, // temporal 
            timestamp: currentTime,
            promise: fetchPromise
        })

        try {
            console.log('🔄 API: Ejecutando fetch de datos...')
            const dashboardData = await fetchPromise

            // Actualizar caché con datos reales
            globalServerCache.set(cacheKey, {
                data: dashboardData,
                timestamp: currentTime
            })

            return NextResponse.json(dashboardData)
        } catch (error) {
            // Limpiar cache en caso de error
            globalServerCache.delete(cacheKey)
            throw error
        }

    } catch (error) {
        console.error('Error en API dashboard:', error)
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        )
    }
}

// Función interna para obtener datos del dashboard (SOLO DATOS REALES)
async function fetchDashboardDataInternal(periodParam: string, periodDays: number, branchId: string | null | undefined): Promise<PharmacyDashboardData> {
    try {
        // Calcular fechas basadas en el período seleccionado
        let startDate: string
        let endDate: string

        if (periodParam === 'all') {
            // Para todos los datos históricos, usar un rango muy amplio
            startDate = '1900-01-01'
            endDate = '2099-12-31'
            // Consultando TODOS los datos históricos disponibles
        } else {
            endDate = new Date().toISOString().split('T')[0]
            startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            // Consultando período de ${periodDays} días
        }

        let dashboardData: PharmacyDashboardData

        try {
            // Obteniendo datos reales de Supabase

            // Verificar conexión con las tablas de boletas en Supabase
            const isSupabaseAvailable = await PharmacyDataService.testConnection()

            if (!isSupabaseAvailable) {
                console.warn('❌ Tablas de boletas no disponibles en Supabase')

                // Ejecutar diagnóstico para obtener más información
                await PharmacyDataService.diagnoseDatabase()
                // Diagnóstico de tablas completado

                throw new Error('Base de datos no disponible. Verifique la configuración de Supabase.')
            }

            // Conexión exitosa, obteniendo datos reales

            // Verificar uso de índices (solo en desarrollo)
            if (process.env.NODE_ENV === 'development') {
                await PharmacyDataService.checkIndexUsage()
            }

            // Obtener datos reales completos del PharmacyDataService
            console.log('🔄 Obteniendo datos completos del dashboard...')
            dashboardData = await PharmacyDataService.getDashboardData({
                startDate,
                endDate,
                branchId
            })

            console.log('🎯 Datos calculados para período:', {
                startDate,
                endDate,
                totalSales: dashboardData.stats.totalSales,
                totalRevenue: dashboardData.stats.totalRevenue,
                averageTicket: dashboardData.stats.averageTicket,
                totalProducts: dashboardData.stats.totalProducts
            })

            // Datos reales obtenidos exitosamente

        } catch (error) {
            console.error('❌ Error crítico obteniendo datos de Supabase:', error)
            throw new Error(`No se pudieron obtener los datos reales: ${error instanceof Error ? error.message : String(error)}`)
        }

        return dashboardData
    } catch (error) {
        console.error('Error crítico obteniendo datos del dashboard:', error)
        throw error // Propagar el error en lugar de usar datos simulados
    }
}

// Endpoint para sincronizar datos con la API externa
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { startDate, endDate } = await request.json()

        if (!startDate || !endDate) {
            return NextResponse.json(
                { error: 'startDate y endDate son requeridos' },
                { status: 400 }
            )
        }

        try {
            console.log('🔄 Iniciando sincronización con API externa...')

            // Verificar si la API externa está configurada correctamente
            const apiUrl = process.env.EXTERNAL_SALES_API_URL || ''
            const apiToken = process.env.EXTERNAL_API_TOKEN || ''

            if (!apiUrl || !apiToken ||
                apiUrl.includes('tu-api-') ||
                apiToken.includes('tu-token-') ||
                apiUrl === 'https://tu-api-sii.com/api/v1' ||
                apiToken === 'tu-token-de-acceso') {
                console.log('⚠️ API externa no configurada correctamente, simulando sincronización exitosa')
                return NextResponse.json({
                    message: 'Sincronización simulada (API externa no configurada)',
                    records: 0,
                    data: null,
                    simulated: true
                })
            }

            // Verificar conexión
            const isApiAvailable = await externalApiService.testConnection()

            if (!isApiAvailable) {
                console.log('⚠️ API externa no disponible, simulando sincronización')
                return NextResponse.json({
                    message: 'Sincronización simulada (API externa no disponible)',
                    records: 0,
                    data: null,
                    simulated: true,
                    warning: 'API externa no disponible'
                })
            }

            // Obtener y procesar datos
            // Obteniendo datos de API externa
            const salesData = await externalApiService.getSalesData(startDate, endDate)
            const processedData = externalApiService.transformToPharmacyData(salesData)

            // Sincronización exitosa
            return NextResponse.json({
                message: 'Datos sincronizados exitosamente',
                records: salesData.length,
                data: processedData
            })

        } catch (error) {
            console.error('❌ Error en sincronización:', error)

            // En lugar de fallar, simular una sincronización exitosa
            return NextResponse.json({
                message: 'Sincronización simulada (error en API externa)',
                records: 0,
                data: null,
                simulated: true,
                error: error instanceof Error ? error.message : 'Error desconocido'
            })
        }

    } catch (error) {
        console.error('Error en POST dashboard:', error)
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        )
    }
}
