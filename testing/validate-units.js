// Script de testing para validar las unidades vendidas en productos destacados
import { createClient } from '@/lib/supabase/server'

async function validateTopProductsUnits() {
    const supabase = await createClient()
    
    console.log('🔍 VALIDACIÓN DE UNIDADES - PRODUCTOS DESTACADOS')
    console.log('=' .repeat(60))
    
    try {
        // 1. Obtener algunos productos de ejemplo directamente de la DB
        console.log('\n1️⃣ MUESTRA DIRECTA DE DATOS EN boletas_detalles:')
        const { data: sampleData } = await supabase
            .from('boletas_detalles')
            .select('nombre, cantidad, precio')
            .limit(10)
            
        sampleData?.forEach((item, index) => {
            console.log(`   ${index + 1}. ${item.nombre} -> Cantidad: ${item.cantidad}, Precio: $${item.precio}`)
        })
        
        // 2. Verificar agregación por producto
        console.log('\n2️⃣ AGREGACIÓN MANUAL - TOP 3 PRODUCTOS:')
        const { data: allProducts } = await supabase
            .from('boletas_detalles')
            .select('nombre, cantidad')
            
        // Agrupar manualmente
        const productMap = new Map()
        allProducts?.forEach(item => {
            const nombre = item.nombre || 'Sin nombre'
            const cantidad = Number(item.cantidad) || 0
            
            if (productMap.has(nombre)) {
                productMap.set(nombre, productMap.get(nombre) + cantidad)
            } else {
                productMap.set(nombre, cantidad)
            }
        })
        
        // Obtener top 3
        const topManual = Array.from(productMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            
        topManual.forEach(([nombre, total], index) => {
            console.log(`   ${index + 1}. ${nombre} -> TOTAL: ${total} unidades`)
        })
        
        // 3. Comparar con el método actual del servicio
        console.log('\n3️⃣ COMPARACIÓN CON MÉTODO DEL SERVICIO:')
        
        // Simular la lógica actual del servicio
        const { data: boletasUltimos14Dias } = await supabase
            .from('boletas')
            .select('folio')
            .gte('fecha', '2025-09-18')
            .lte('fecha', '2025-10-02')
            
        console.log(`   📅 Boletas en últimos 14 días: ${boletasUltimos14Dias?.length || 0}`)
        
        if (boletasUltimos14Dias && boletasUltimos14Dias.length > 0) {
            const folios = boletasUltimos14Dias.map(b => b.folio)
            
            const { data: productsInPeriod } = await supabase
                .from('boletas_detalles')
                .select('nombre, cantidad, precio')
                .in('boleta_folio', folios)
                
            console.log(`   📦 Productos en período: ${productsInPeriod?.length || 0} registros`)
            
            // Agrupar por producto en el período
            const periodMap = new Map()
            productsInPeriod?.forEach(item => {
                const nombre = item.nombre || 'Sin nombre'
                const cantidad = Number(item.cantidad) || 0
                
                if (periodMap.has(nombre)) {
                    periodMap.set(nombre, periodMap.get(nombre) + cantidad)
                } else {
                    periodMap.set(nombre, cantidad)
                }
            })
            
            const topPeriod = Array.from(periodMap.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                
            console.log('   🏆 TOP 3 EN PERÍODO:')
            topPeriod.forEach(([nombre, total], index) => {
                console.log(`      ${index + 1}. ${nombre} -> ${total} unidades`)
            })
        }
        
        // 4. Verificar tipos de datos
        console.log('\n4️⃣ VERIFICACIÓN DE TIPOS DE DATOS:')
        const { data: typeCheck } = await supabase
            .from('boletas_detalles')
            .select('cantidad')
            .limit(5)
            
        typeCheck?.forEach((item, index) => {
            console.log(`   Registro ${index + 1}: cantidad = ${item.cantidad} (tipo: ${typeof item.cantidad})`)
        })
        
    } catch (error) {
        console.error('❌ Error en validación:', error)
    }
}

// Ejecutar validación si es llamado directamente
if (require.main === module) {
    validateTopProductsUnits()
}

export { validateTopProductsUnits }
