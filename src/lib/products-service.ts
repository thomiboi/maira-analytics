import { createClient } from '@/lib/supabase/server'
import { TopProduct } from '@/types/pharmacy'

export interface DashboardQueryParams {
    startDate: string
    endDate: string
}

export class ProductsService {
    /**
     * Obtiene los productos más vendidos - Implementación simplificada y eficiente
     */
    static async getTopProducts(params: DashboardQueryParams): Promise<TopProduct[]> {
        const supabase = await createClient()

        try {
            console.log('🔍 Productos destacados - Nueva implementación para período:', {
                startDate: params.startDate,
                endDate: params.endDate
            })

            const isAllData = params.startDate === '1900-01-01' && params.endDate === '2099-12-31'

            // Implementación simple y directa con JOIN eficiente
            let productsQuery = supabase
                .from('boletas_detalles')
                .select(`
                    nombre,
                    cantidad,
                    precio,
                    boletas!inner(fecha)
                `)

            // Solo filtrar por fecha si no es "todos los datos"
            if (!isAllData) {
                productsQuery = productsQuery
                    .gte('boletas.fecha', params.startDate)
                    .lte('boletas.fecha', params.endDate)
            }

            console.log('📝 Ejecutando consulta optimizada de productos destacados...')

            const { data: productosData, error } = await productsQuery

            if (error) {
                console.error('❌ Error en consulta de productos:', error)
                throw error
            }

            console.log('📦 Productos obtenidos:', productosData?.length || 0)

            if (!productosData || productosData.length === 0) {
                console.log('⚠️ No se encontraron productos para el período especificado')
                return []
            }

            // Agrupar productos por nombre y sumar cantidades
            const productosMap = new Map<string, { cantidad: number, ingresos: number }>()

            productosData.forEach(item => {
                const nombre = item.nombre || 'Producto sin nombre'
                const cantidad = item.cantidad || 0
                const precio = item.precio || 0
                const ingresos = cantidad * precio

                if (productosMap.has(nombre)) {
                    const existing = productosMap.get(nombre)!
                    existing.cantidad += cantidad
                    existing.ingresos += ingresos
                } else {
                    productosMap.set(nombre, { cantidad, ingresos })
                }
            })

            // Productos únicos agrupados

            // Convertir a formato TopProduct y ordenar por ventas
            const productos = Array.from(productosMap.entries())
                .map(([nombre, data], index) => ({
                    id: index + 1,
                    name: nombre,
                    category: nombre.split(' ')[0] || 'General',
                    sales: data.cantidad,
                    revenue: data.ingresos,
                    change: 0 // Sin cambio por ahora - se puede calcular comparando períodos
                }))
                .sort((a, b) => b.sales - a.sales)
                .slice(0, 10)

            console.log('🏆 Top productos procesados:', productos.length > 0 ?
                productos.slice(0, Math.min(3, productos.length)).map(p => `${p.name}: ${p.sales} uds`) : 'Sin productos')

            return productos

        } catch (error) {
            console.error('❌ Error obteniendo productos destacados:', error)
            return []
        }
    }
}