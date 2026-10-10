import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
    try {
        const supabase = await createClient()
        
        console.log('🔍 VALIDACIÓN DE UNIDADES - PRODUCTOS DESTACADOS')
        
        // 1. Muestra directa de datos
        const { data: sampleData } = await supabase
            .from('boletas_detalles')
            .select('nombre, cantidad, precio')
            .limit(10)
            
        // 2. Agregación manual - todos los productos
        const { data: allProducts } = await supabase
            .from('boletas_detalles')
            .select('nombre, cantidad')
            
        const productMap = new Map<string, number>()
        allProducts?.forEach(item => {
            const nombre = item.nombre || 'Sin nombre'
            const cantidad = Number(item.cantidad) || 0
            
            if (productMap.has(nombre)) {
                productMap.set(nombre, (productMap.get(nombre) || 0) + cantidad)
            } else {
                productMap.set(nombre, cantidad)
            }
        })
        
        const topManual = Array.from(productMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            
        // 3. Método actual del servicio - período específico
        const { data: boletasUltimos14Dias } = await supabase
            .from('boletas')
            .select('folio')
            .gte('fecha', '2025-09-18')
            .lte('fecha', '2025-10-02')
            
        let topPeriod: Array<[string, number]> = []
        
        if (boletasUltimos14Dias && boletasUltimos14Dias.length > 0) {
            const folios = boletasUltimos14Dias.map(b => b.folio)
            
            const { data: productsInPeriod } = await supabase
                .from('boletas_detalles')
                .select('nombre, cantidad, precio')
                .in('boleta_folio', folios)
                
            const periodMap = new Map<string, number>()
            productsInPeriod?.forEach(item => {
                const nombre = item.nombre || 'Sin nombre'
                const cantidad = Number(item.cantidad) || 0
                
                if (periodMap.has(nombre)) {
                    periodMap.set(nombre, (periodMap.get(nombre) || 0) + cantidad)
                } else {
                    periodMap.set(nombre, cantidad)
                }
            })
            
            topPeriod = Array.from(periodMap.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
        }
        
        // 4. Verificar tipos de datos
        const { data: typeCheck } = await supabase
            .from('boletas_detalles')
            .select('cantidad')
            .limit(5)
        
        return NextResponse.json({
            success: true,
            validation: {
                sampleData: sampleData?.map(item => ({
                    nombre: item.nombre,
                    cantidad: item.cantidad,
                    tipo: typeof item.cantidad,
                    precio: item.precio
                })),
                topProductsAllTime: topManual.map(([nombre, cantidad]) => ({
                    nombre,
                    cantidad,
                    tipo: typeof cantidad
                })),
                boletasEnPeriodo: boletasUltimos14Dias?.length || 0,
                topProductsPeriodo: topPeriod.map(([nombre, cantidad]) => ({
                    nombre,
                    cantidad,
                    tipo: typeof cantidad
                })),
                tiposDeData: typeCheck?.map((item, index) => ({
                    registro: index + 1,
                    cantidad: item.cantidad,
                    tipo: typeof item.cantidad,
                    esNumero: typeof item.cantidad === 'number',
                    esString: typeof item.cantidad === 'string',
                    valorNumerico: Number(item.cantidad)
                }))
            }
        })
        
    } catch (error) {
        console.error('❌ Error en validación:', error)
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }, { status: 500 })
    }
}