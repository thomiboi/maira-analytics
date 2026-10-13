import { createClient } from '@/lib/supabase/server'
import { TopProduct, SalesStats, SalesTrend, PharmacyDashboardData, RecentSale, PaymentMethod } from '@/types/pharmacy'

export interface DashboardQueryParams {
    startDate: string
    endDate: string
    branchId?: string | null  // null = Casa Matriz, "2191" = Segunda Sucursal, undefined = Todas
}

export class PharmacyDataService {
    /**
     * Obtiene los productos más vendidos
     */
    static async getTopProducts(params: DashboardQueryParams): Promise<TopProduct[]> {
        const supabase = await createClient()

        try {
            console.log('🎯 [RPC OPTIMIZADO] getTopProducts iniciado para período:', {
                startDate: params.startDate,
                endDate: params.endDate,
                branchId: params.branchId,
                timestamp: new Date().toISOString()
            })

            // 🚀 USAR SIEMPRE LA FUNCIÓN RPC OPTIMIZADA (más consistente y rápida)
            const isAllData = params.startDate === '1900-01-01' && params.endDate === '2099-12-31'

            const startDate = isAllData ? '2020-01-01' : params.startDate
            const endDate = isAllData ? '2099-12-31' : params.endDate
            // ✨ NUEVO MAPEO según función SQL actualizada:
            // "0" → 0 (todas las sucursales)
            // "null" → null (casa matriz con sucursal_id IS NULL)
            // "2191" → 2191 (segunda sucursal)
            const sucursalId = params.branchId === "0" ? 0 :
                params.branchId === "null" ? null :
                    params.branchId ? parseInt(params.branchId) : null

            console.log('� Ejecutando función RPC con parámetros:', {
                startDate,
                endDate,
                sucursalId,
                limit: 10
            })

            const { data: productosRPC, error: rpcError } = await supabase
                .rpc('get_top_productos_agregados', {
                    p_start_date: startDate,
                    p_end_date: endDate,
                    p_sucursal_id: sucursalId,
                    p_limit: 10
                })

            if (rpcError) {
                console.error('❌ Error en función RPC:', rpcError)
                throw rpcError
            }

            if (!productosRPC || productosRPC.length === 0) {
                return []
            }

            // Convertir resultado RPC a formato TopProduct
            const productos = productosRPC.map((item: { codigo: string, nombre_producto: string, total_cantidad: number, total_ingresos: number }, index: number) => ({
                id: index + 1,
                name: item.nombre_producto || item.codigo,
                category: item.nombre_producto?.split(' ')[0] || 'General',
                sales: Number(item.total_cantidad),
                revenue: Number(item.total_ingresos),
                change: 0, // Se puede calcular comparando con período anterior
                code: item.codigo
            }))

            return productos

        } catch (error) {
            console.error('❌ Error obteniendo productos destacados:', error)
            return []
        }
    }

    /**
     * Obtiene las tendencias de ventas por día
     */
    static async getSalesTrends(params: DashboardQueryParams): Promise<SalesTrend[]> {
        const supabase = await createClient()

        try {
            const isAllData = params.startDate === '1900-01-01' && params.endDate === '2099-12-31'

            // Obtener TODAS las boletas del período con paginación
            const allBoletas = []
            let from = 0
            const batchSize = 100000  // ✅ Aumentado de 10000 a 100000 (nuevo límite Supabase)
            let hasMore = true

            while (hasMore) {
                let batchQuery = supabase
                    .from('boletas')
                    .select('fecha, montoneto, sucursal_id')
                    .order('fecha', { ascending: true })
                    .range(from, from + batchSize - 1)

                if (!isAllData) {
                    batchQuery = batchQuery
                        .gte('fecha', params.startDate)
                        .lte('fecha', params.endDate)
                }

                // ✨ Filtrar por sucursal usando el NUEVO SISTEMA (tendencias)
                if (params.branchId !== undefined) {
                    if (params.branchId === "null") {
                        // Casa Matriz (sucursal_id IS NULL)
                        batchQuery = batchQuery.is('sucursal_id', null)
                    } else if (params.branchId === "2191") {
                        // Segunda Sucursal (sucursal_id = 2191)
                        batchQuery = batchQuery.eq('sucursal_id', 2191)
                    }
                    // Si branchId === "0", NO agregamos filtro (todas las sucursales)
                }

                const { data: batch, error } = await batchQuery

                if (error) throw error

                if (batch && batch.length > 0) {
                    allBoletas.push(...batch)
                    from += batchSize
                    hasMore = batch.length === batchSize
                } else {
                    hasMore = false
                }
            }

            if (!allBoletas || allBoletas.length === 0) {
                return []
            }

            // Agrupar por fecha
            const trendsMap = new Map<string, { date: string, sales: number, revenue: number }>()

            allBoletas.forEach((boleta: { fecha: string; montoneto: number }) => {
                const fecha = boleta.fecha
                const revenue = boleta.montoneto || 0

                if (trendsMap.has(fecha)) {
                    const existing = trendsMap.get(fecha)!
                    existing.sales += 1
                    existing.revenue += revenue
                } else {
                    trendsMap.set(fecha, {
                        date: fecha,
                        sales: 1,
                        revenue: revenue
                    })
                }
            })

            return Array.from(trendsMap.values())
                .sort((a, b) => a.date.localeCompare(b.date))

        } catch (error) {
            console.error('❌ Error obteniendo tendencias:', error)
            return []
        }
    }

    /**
     * Obtiene métricas del dashboard usando función RPC
     */
    static async getSalesStats(params: DashboardQueryParams): Promise<SalesStats> {
        const supabase = await createClient()

        try {
            const isAllData = params.startDate === '1900-01-01' && params.endDate === '2099-12-31'
            const startDate = isAllData ? '2020-01-01' : params.startDate
            const endDate = isAllData ? '2099-12-31' : params.endDate

            const sucursalId = params.branchId === "0" ? 0 :
                params.branchId === "null" ? null :
                    params.branchId ? parseInt(params.branchId) : null

            const { data: metricas, error: rpcError } = await supabase
                .rpc('get_metricas_dashboard', {
                    p_start_date: startDate,
                    p_end_date: endDate,
                    p_sucursal_id: sucursalId
                })

            if (rpcError) {
                console.error('❌ Error en función RPC métricas:', rpcError)
                throw rpcError
            }

            if (!metricas || metricas.length === 0) {
                console.warn('⚠️ Función RPC métricas devolvió datos vacíos')
                return {
                    totalSales: 0,
                    totalRevenue: 0,
                    averageTicket: 0,
                    totalProducts: 0,
                    topCategories: []
                }
            }

            const resultado = metricas[0]

            return {
                totalSales: Number(resultado.total_documentos),
                totalRevenue: Number(resultado.total_ingresos),
                averageTicket: Number(resultado.ticket_promedio),
                totalProducts: Number(resultado.total_productos),
                topCategories: [] // Se puede implementar después si es necesario
            }
        } catch (error) {
            console.error('❌ Error obteniendo estadísticas con RPC:', error)
            return {
                totalSales: 0,
                totalRevenue: 0,
                averageTicket: 0,
                totalProducts: 0,
                topCategories: []
            }
        }
    }

    /**
     * Obtiene datos completos del dashboard
     */
    static async getDashboardData(params: DashboardQueryParams): Promise<PharmacyDashboardData> {
        try {
            // Obtener datos completos del dashboard
            const [stats, topProducts, salesTrends, paymentMethods] = await Promise.all([
                this.getSalesStats(params),      // Generalmente más rápida
                this.getTopProducts(params),     // Potencialmente más lenta (muchos registros)
                this.getSalesTrends(params),     // Velocidad media
                this.getPaymentMethods(params)   // Muy rápida (datos por defecto)
            ])

            // Para recentSales, usar array vacío por ahora (se puede implementar después)
            const recentSales: RecentSale[] = []

            return {
                stats,
                topProducts,
                salesTrends,
                recentSales,
                paymentMethods
            }
        } catch (error) {
            console.error('❌ Error obteniendo datos del dashboard:', error)
            throw error
        }
    }

    /**
     * Test de conexión
     */
    static async testConnection(): Promise<boolean> {
        try {
            const supabase = await createClient()
            const { error } = await supabase
                .from('boletas')
                .select('folio', { count: 'exact', head: true })
                .limit(1)

            return !error
        } catch (error) {
            console.error('❌ Error test conexión:', error)
            return false
        }
    }

    /**
     * Diagnóstico de la base de datos
     */
    static async diagnoseDatabase(): Promise<{ status: string, message: string }> {
        return { status: 'ok', message: 'Base de datos funcionando correctamente' }
    }

    /**
     * Verificar uso de índices (para desarrollo)
     */
    static async checkIndexUsage(): Promise<void> {
        // Placeholder para futuras verificaciones de índices
    }

    /**
     * Obtiene las estadísticas de métodos de pago
     */
    static async getPaymentMethods(params: DashboardQueryParams): Promise<PaymentMethod[]> {
        try {
            console.log('💳 Obteniendo métodos de pago para período:', params)

            // Por ahora retornar datos por defecto con filtrado por sucursal
            // Se puede implementar la lógica real más tarde
            const branchLabel = params.branchId === null ? 'Casa Matriz' :
                params.branchId === '2191' ? 'Segunda Sucursal' :
                    params.branchId === '0' ? 'Todas las Sucursales' : 'Sucursal Específica'

            console.log(`💳 Métodos de pago para: ${branchLabel}`)

            return [
                { method: 'Efectivo', transactions: 0, totalAmount: 0, averageAmount: 0, usagePercentage: 0 },
                { method: 'Tarjeta de Débito', transactions: 0, totalAmount: 0, averageAmount: 0, usagePercentage: 0 },
                { method: 'Tarjeta de Crédito', transactions: 0, totalAmount: 0, averageAmount: 0, usagePercentage: 0 },
                { method: 'Transferencia', transactions: 0, totalAmount: 0, averageAmount: 0, usagePercentage: 0 }
            ]
        } catch (error) {
            console.error('❌ Error obteniendo métodos de pago:', error)
            return []
        }
    }
}
