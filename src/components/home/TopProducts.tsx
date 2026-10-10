'use client';

import { useState, useEffect } from 'react';
import { Package, TrendingUp, Loader2 } from 'lucide-react';
import { dashboardFetchManager } from '@/lib/dashboard-fetch-manager';

interface TopProduct {
  id: number;
  name: string;
  category: string;
  sales: number;
  revenue: number;
  change: number;
}

export default function TopProducts() {
  const [products, setProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTopProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Obtener datos del dashboard para los últimos 30 días
        const dashboardData = await dashboardFetchManager.fetchDashboardData('30', false, '0');
        
        const { topProducts } = dashboardData;
        
        // Tomar solo los primeros 5 productos
        const top5Products = topProducts.slice(0, 5);
        
        setProducts(top5Products);
      } catch (err) {
        console.error('Error fetching top products:', err);
        setError('Error al cargar productos destacados');
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTopProducts();
  }, []);

  const formatCurrency = (value: number) => `$${value.toLocaleString("es-CL")}`;

  if (loading) {
    return (
      <div className="bg-[var(--surface)] rounded-lg shadow-md p-6 border border-[var(--border)]">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3 text-red-600 dark:text-red-400">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              Productos Destacados
            </h3>
            <p className="text-sm text-[var(--text-subtle)]">
              Cargando productos más vendidos...
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-muted)] animate-pulse">
              <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-1"></div>
                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
              </div>
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-16"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[var(--surface)] rounded-lg shadow-md p-6 border border-[var(--border)]">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3 text-red-600 dark:text-red-400">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              Productos Destacados
            </h3>
            <p className="text-sm text-[var(--text-subtle)]">
              Error al cargar datos
            </p>
          </div>
        </div>
        <div className="text-center py-8">
          <p className="text-[var(--text-subtle)]">
            No se pudieron cargar los productos destacados
          </p>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="bg-[var(--surface)] rounded-lg shadow-md p-6 border border-[var(--border)]">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3 text-red-600 dark:text-red-400">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              Productos Destacados
            </h3>
            <p className="text-sm text-[var(--text-subtle)]">
              Últimos 30 días
            </p>
          </div>
        </div>
        <div className="text-center py-8">
          <p className="text-[var(--text-subtle)]">
            No hay productos para mostrar en este período
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface)] rounded-lg shadow-md p-6 border border-[var(--border)]">
      <div className="flex items-center gap-3 mb-4">
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3 text-red-600 dark:text-red-400">
          <Package className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">
            Productos Destacados
          </h3>
          <p className="text-sm text-[var(--text-subtle)]">
            Top 5 más vendidos - Últimos 30 días
          </p>
        </div>
      </div>
      
      <div className="space-y-3">
        {products.map((product, index) => (
          <div key={product.id} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-muted)] hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border border-[var(--border)]">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/30 text-xs font-semibold text-red-600 dark:text-red-400">
              #{index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[var(--foreground)] text-sm truncate">
                {product.name}
              </p>
              <p className="text-xs text-[var(--text-subtle)]">
                {product.category}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {product.sales.toLocaleString("es-CL")} uds
              </p>
              <p className="text-xs text-[var(--text-subtle)]">
                {formatCurrency(product.revenue)}
              </p>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-4 border-t border-[var(--border)]">
        <a 
          href="/dashboard/ranking" 
          className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 font-medium"
        >
          Ver ranking completo →
        </a>
      </div>
    </div>
  );
}
