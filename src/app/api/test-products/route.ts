import { NextRequest, NextResponse } from 'next/server'
import { ProductsService } from '@/lib/products-service'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const days = parseInt(searchParams.get('days') || '30')
        
        // Calcular fechas
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(endDate.getDate() - days)
        
        const params = {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
        }
        
        console.log('🧪 Test API - Obteniendo productos para:', params)
        
        const products = await ProductsService.getTopProducts(params)
        
        return NextResponse.json({
            success: true,
            period: `${days} días`,
            dateRange: params,
            products: products,
            message: `Se obtuvieron ${products.length} productos para el período de ${days} días`
        })
        
    } catch (error) {
        console.error('❌ Error en test API:', error)
        return NextResponse.json({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Error desconocido' 
        }, { status: 500 })
    }
}