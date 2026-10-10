export interface SalesStats {
    totalSales: number
    totalRevenue: number
    averageTicket: number
    totalProducts: number
    topCategories: Array<{
        name: string
        sales: number
    }>
}

export interface TopProduct {
    id: number
    name: string
    category: string
    sales: number
    revenue: number
    change: number
    code?: string  // Código único del producto para evitar duplicados
}

export interface SalesTrend {
    date: string
    sales: number
    revenue: number
}

export interface RecentSale {
    id: string
    customer: string
    products: number
    total: number
    date: string
    type: 'regular' | 'insurance' | 'prescription'
}

export interface PaymentMethod {
    method: string
    transactions: number
    totalAmount: number
    averageAmount: number
    usagePercentage: number
}

export interface BranchFilter {
    id: string | null | 'all'  // 'all' = todas, null = Casa Matriz, '2191' = Segunda Sucursal
    name: string
    label: string
}

export interface PharmacyDashboardData {
    stats: SalesStats
    topProducts: TopProduct[]
    salesTrends: SalesTrend[]
    recentSales: RecentSale[]
    paymentMethods: PaymentMethod[]
}
