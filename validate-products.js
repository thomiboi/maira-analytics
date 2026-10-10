// Script para validar productos únicos - ejecutar con node
const { createClient } = require('@supabase/supabase-js')

// Configuración de Supabase (reemplazar con las variables reales)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variables de entorno de Supabase no configuradas')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function validateUniqueProducts() {
    try {
        console.log('🔍 Iniciando validación de productos únicos...')
        
        // Obtener todos los productos con paginación
        const allProducts = []
        let from = 0
        const batchSize = 1000
        let hasMore = true
        
        console.log('📦 Obteniendo productos por lotes...')
        
        while (hasMore) {
            const { data: batch, error } = await supabase
                .from('boletas_detalles')
                .select('nombre, boleta_folio')
                .range(from, from + batchSize - 1)
            
            if (error) {
                console.error('❌ Error en consulta:', error)
                throw error
            }
            
            if (batch && batch.length > 0) {
                allProducts.push(...batch)
                from += batchSize
                hasMore = batch.length === batchSize
                console.log(`   Lote ${Math.floor(from / batchSize)}: +${batch.length} productos, total: ${allProducts.length}`)
            } else {
                hasMore = false
            }
            
            // Pausa pequeña para no saturar
            await new Promise(resolve => setTimeout(resolve, 100))
        }
        
        console.log('\n📊 ANÁLISIS DE PRODUCTOS:')
        console.log('📦 Total registros de detalles:', allProducts.length)
        
        // Filtrar nombres válidos
        const validNames = allProducts
            .map(p => p.nombre?.trim())
            .filter(name => name && name.length > 0)
            
        console.log('📝 Registros con nombres válidos:', validNames.length)
        console.log('⚠️  Registros con nombres vacíos/inválidos:', allProducts.length - validNames.length)
        
        // Contar productos únicos
        const uniqueProducts = new Set(validNames.map(name => name.toLowerCase()))
        console.log('✨ Productos únicos (case-insensitive):', uniqueProducts.size)
        
        // Mostrar muestra de productos únicos
        const sampleProducts = Array.from(uniqueProducts).slice(0, 15)
        console.log('\n📋 Muestra de productos únicos (primeros 15):')
        sampleProducts.forEach((product, index) => {
            console.log(`   ${index + 1}. ${product}`)
        })
        
        // Análisis de duplicados más comunes
        const productCounts = {}
        validNames.forEach(name => {
            const key = name.toLowerCase()
            productCounts[key] = (productCounts[key] || 0) + 1
        })
        
        const topProducts = Object.entries(productCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            
        console.log('\n🔥 Top 10 productos más vendidos:')
        topProducts.forEach(([name, count], index) => {
            console.log(`   ${index + 1}. ${name}: ${count} ventas`)
        })
        
        console.log('\n✅ Validación completada')
        console.log(`📊 RESULTADO FINAL: ${uniqueProducts.size} productos únicos`)
        
    } catch (error) {
        console.error('❌ Error durante la validación:', error)
    }
}

// Ejecutar la validación
validateUniqueProducts()