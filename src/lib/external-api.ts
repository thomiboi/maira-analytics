import { SalesStats, TopProduct, SalesTrend, RecentSale } from '@/types/pharmacy'

// Estructura de datos de la API chilena (SII)
interface ChileanInvoiceData {
    id: number
    tipodoc: string
    folio: number
    fecha: string
    rut: string
    rs: string // Razón social
    montoneto: number
    montoexento: number
    montoiva: number
    montototal: number
    detalles: Array<{
        // Estructura típica de detalles de factura
        descripcion?: string
        cantidad?: number
        precio?: number
        total?: number
        codigo?: string
        // Campos adicionales variables
        [key: string]: string | number | boolean | undefined
    }>
    pagos: Array<{
        // Estructura de pagos
        metodo?: string
        monto?: number
        [key: string]: string | number | boolean | undefined
    }>
    referencias: Array<{
        // Referencias a otros documentos
        [key: string]: string | number | boolean | undefined
    }>
    pdf?: string // Base64
    xml?: string // Base64
    errors?: Array<string>
}

interface ApiResponse<T> {
    data: T
    status: 'success' | 'error'
    message?: string
}

class ExternalApiService {
    private baseUrl: string
    private token: string
    private timeout: number

    constructor() {
        this.baseUrl = process.env.EXTERNAL_SALES_API_URL || ''
        this.token = process.env.EXTERNAL_API_TOKEN || ''
        this.timeout = parseInt(process.env.EXTERNAL_API_TIMEOUT || '30000')
    }

    private async fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<Response> {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.timeout)

        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                signal: controller.signal
            })

            clearTimeout(timeoutId)
            return response
        } catch (error) {
            clearTimeout(timeoutId)
            throw error
        }
    }

    // Obtener documentos tributarios del periodo
    async getSalesData(startDate: string, endDate: string): Promise<ChileanInvoiceData[]> {
        try {
            const response = await this.fetchWithAuth(
                `/documentos?fecha_desde=${startDate}&fecha_hasta=${endDate}`
            )

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} - ${response.statusText}`)
            }

            const apiResponse: ApiResponse<ChileanInvoiceData[]> = await response.json()

            if (apiResponse.status === 'error') {
                throw new Error(apiResponse.message || 'Error en la API externa')
            }

            return apiResponse.data
        } catch (error) {
            console.error('Error fetching sales data:', error)
            throw error
        }
    }

    // Transformar datos de documentos tributarios chilenos al formato interno
    transformToPharmacyData(invoiceData: ChileanInvoiceData[]) {
        const totalSales = invoiceData.length
        const totalRevenue = invoiceData.reduce((sum, invoice) => sum + invoice.montototal, 0)

        // Calcular productos más vendidos basado en los detalles
        const productSales = new Map<string, {
            name: string
            category: string
            totalQuantity: number
            totalRevenue: number
            sales: number
        }>()

        invoiceData.forEach(invoice => {
            // Procesar detalles de cada documento
            invoice.detalles?.forEach(detalle => {
                const productName = detalle.descripcion || `Producto ${detalle.codigo || 'Sin código'}`
                const quantity = detalle.cantidad || 1
                const revenue = detalle.total || detalle.precio || 0
                const category = this.categorizeProduct(productName)

                const key = `${detalle.codigo || productName}-${productName}`
                const existing = productSales.get(key)

                if (existing) {
                    existing.totalQuantity += quantity
                    existing.totalRevenue += revenue
                    existing.sales += 1
                } else {
                    productSales.set(key, {
                        name: productName,
                        category,
                        totalQuantity: quantity,
                        totalRevenue: revenue,
                        sales: 1
                    })
                }
            })
        })

        // Top 10 productos más vendidos
        const topProducts: TopProduct[] = Array.from(productSales.entries())
            .sort((a, b) => b[1].totalQuantity - a[1].totalQuantity)
            .slice(0, 10)
            .map(([, data], index) => ({
                id: index + 1,
                name: data.name,
                category: data.category,
                sales: data.sales,
                revenue: data.totalRevenue,
                change: Math.random() * 20 - 10 // Placeholder - necesitaríamos datos históricos
            }))

        // Calcular estadísticas por categoría
        const categorySales = new Map<string, number>()
        invoiceData.forEach(invoice => {
            invoice.detalles?.forEach(detalle => {
                const productName = detalle.descripcion || 'Producto sin nombre'
                const category = this.categorizeProduct(productName)
                const quantity = detalle.cantidad || 1
                const current = categorySales.get(category) || 0
                categorySales.set(category, current + quantity)
            })
        })

        // Tendencias de ventas (últimos 7 días)
        const salesTrends: SalesTrend[] = this.calculateDailyTrends(invoiceData)

        // Ventas recientes (últimas 5)
        const recentSales: RecentSale[] = invoiceData
            .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
            .slice(0, 5)
            .map(invoice => ({
                id: `${invoice.tipodoc}-${invoice.folio}`,
                customer: invoice.rs || `RUT: ${invoice.rut}`,
                products: invoice.detalles?.length || 0,
                total: invoice.montototal,
                date: invoice.fecha,
                type: this.getCustomerType(invoice.tipodoc)
            }))

        const stats: SalesStats = {
            totalSales,
            totalRevenue,
            averageTicket: totalRevenue / totalSales || 0,
            totalProducts: productSales.size,
            topCategories: Array.from(categorySales.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, sales]) => ({ name, sales }))
        }

        return {
            stats,
            topProducts,
            salesTrends,
            recentSales
        }
    }

    private calculateDailyTrends(invoiceData: ChileanInvoiceData[]): SalesTrend[] {
        const dailySales = new Map<string, { sales: number; revenue: number }>()

        invoiceData.forEach(invoice => {
            const date = new Date(invoice.fecha).toISOString().split('T')[0]
            const existing = dailySales.get(date) || { sales: 0, revenue: 0 }

            dailySales.set(date, {
                sales: existing.sales + 1,
                revenue: existing.revenue + invoice.montototal
            })
        })

        return Array.from(dailySales.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, data]) => ({
                date,
                sales: data.sales,
                revenue: data.revenue
            }))
    }

    // Categorizar productos basado en descripción para farmacia
    private categorizeProduct(productName: string): string {
        const name = productName.toLowerCase()

        // Analgésicos
        if (name.includes('paracetamol') || name.includes('ibuprofeno') ||
            name.includes('aspirina') || name.includes('analgesic')) {
            return 'Analgésicos'
        }

        // Antibióticos
        if (name.includes('amoxicilina') || name.includes('antibiotico') ||
            name.includes('penicilina') || name.includes('azitromicina')) {
            return 'Antibióticos'
        }

        // Antiinflamatorios
        if (name.includes('diclofenaco') || name.includes('naproxeno') ||
            name.includes('antiinflamatorio')) {
            return 'Antiinflamatorios'
        }

        // Vitaminas
        if (name.includes('vitamin') || name.includes('complejo') ||
            name.includes('calcio') || name.includes('hierro')) {
            return 'Vitaminas'
        }

        // Digestivos
        if (name.includes('omeprazol') || name.includes('ranitidina') ||
            name.includes('digestivo') || name.includes('antiacido')) {
            return 'Digestivos'
        }

        // Antihistamínicos
        if (name.includes('loratadina') || name.includes('cetirizina') ||
            name.includes('antialergico')) {
            return 'Antihistamínicos'
        }

        // Dermatológicos
        if (name.includes('crema') || name.includes('pomada') ||
            name.includes('gel') || name.includes('dermato')) {
            return 'Dermatológicos'
        }

        return 'Otros'
    }

    // Determinar tipo de cliente basado en tipo de documento SII
    private getCustomerType(tipodoc: string): 'regular' | 'insurance' | 'prescription' {
        // Basado en códigos comunes del SII chileno
        switch (tipodoc) {
            case '33': // Factura Electrónica
            case '34': // Factura No Afecta o Exenta Electrónica
                return 'regular'
            case '39': // Boleta Electrónica
            case '41': // Boleta Exenta Electrónica  
                return 'regular'
            case '43': // Liquidación Factura Electrónica
                return 'insurance'
            case '52': // Guía de Despacho Electrónica
                return 'prescription'
            default:
                return 'regular'
        }
    }

    // Método para validar la conexión con la API
    async testConnection(): Promise<boolean> {
        try {
            const response = await this.fetchWithAuth('/health')
            return response.ok
        } catch (error) {
            console.error('API connection test failed:', error)
            return false
        }
    }
}

export const externalApiService = new ExternalApiService()
