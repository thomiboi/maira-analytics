import { useState, useEffect, useCallback } from 'react';

interface StockInfo {
    bodega_id: number;
    cantidad: number;
    ubicacion: string;
    reservas: boolean;
    maximo: number | null;
    critico: number | null;
}

interface StockMinimo {
    producto_id: string;
    bodega_id: string;
    stock_minimo: string;
}

interface Product {
    id: string;
    nombre: string;
    codigo: string;
    stocks: StockInfo[];
    stock_minimo: StockMinimo[];
}

export interface StockAlert {
    productId: string;
    productName: string;
    bodegaId: number;
    currentStock: number;
    minStock: number;
}

interface UseStockAlertsResult {
    alerts: StockAlert[];
    loading: boolean;
    error: string | null;
    count: number;
    refresh: () => Promise<void>;
}

export function useStockAlerts(
    refreshInterval: number = 5 * 60 * 1000
): UseStockAlertsResult {
    const [alerts, setAlerts] = useState<StockAlert[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchAlerts = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch products that have stock alerts configured
            // We use a higher limit to ensure we get all configured products
            const response = await fetch('/api/stock-alerts?limit=2000&alerts_only=true');

            if (!response.ok) {
                throw new Error('Error al cargar alertas de stock');
            }

            const data = await response.json();

            if (data.success) {
                const products: Product[] = data.products;
                const newAlerts: StockAlert[] = [];

                products.forEach(product => {
                    if (!product.stocks || !Array.isArray(product.stocks)) return;

                    product.stocks.forEach(stock => {
                        const minStockEntry = product.stock_minimo.find(
                            sm => sm.bodega_id === stock.bodega_id.toString()
                        );

                        const minStock = minStockEntry ? parseFloat(minStockEntry.stock_minimo) : 0;

                        if (minStock > 0 && stock.cantidad <= minStock) {
                            newAlerts.push({
                                productId: product.id,
                                productName: product.nombre,
                                bodegaId: stock.bodega_id,
                                currentStock: stock.cantidad,
                                minStock: minStock
                            });
                        }
                    });
                });

                setAlerts(newAlerts);
            } else {
                throw new Error(data.error || 'Error desconocido');
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
            setError(errorMessage);
            console.error('❌ Error en useStockAlerts:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAlerts();
    }, [fetchAlerts]);

    useEffect(() => {
        if (refreshInterval > 0) {
            const interval = setInterval(fetchAlerts, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [refreshInterval, fetchAlerts]);

    return {
        alerts,
        loading,
        error,
        count: alerts.length,
        refresh: fetchAlerts,
    };
}
