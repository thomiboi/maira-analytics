'use client';

import { Package, TrendingUp, BarChart3, DollarSign, ArrowUp, ArrowDown } from 'lucide-react';

interface RankingStatsProps {
  stats: {
    productoMasVendido: {
      codigo: string;
      nombre: string;
      unidades: number;
      crecimiento: number;
    } | null;
    mayorMargen: {
      codigo: string;
      nombre: string;
      margen: number;
      crecimiento: number;
    } | null;
    totalProductos: number;
    ventasTotales: number;
  } | null;
  loading?: boolean;
}

export default function RankingStats({ stats, loading = false }: RankingStatsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[var(--surface)] rounded-lg shadow p-6 animate-pulse border border-[var(--border)]">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
          </div>
        ))}
      </div>
    );
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-CL').format(num);
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(num);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
      {/* Producto Más Vendido */}
      <div className="bg-[var(--surface)] rounded-lg shadow hover:shadow-lg transition-shadow border border-[var(--border)]">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[var(--text-muted)]">
              Producto Más Vendido
            </h3>
            <Package className="h-5 w-5 text-red-500 dark:text-red-400" />
          </div>
          
          <div className="space-y-2">
            <div className="space-y-1">
              <p className="text-lg font-bold text-[var(--foreground)] leading-tight">
                {stats?.productoMasVendido?.nombre || 'N/A'}
              </p>
              {stats?.productoMasVendido?.codigo && (
                <p className="text-xs text-[var(--text-subtle)] font-mono">
                  {stats.productoMasVendido.codigo}
                </p>
              )}
            </div>
            <p className="text-sm text-[var(--text-subtle)]">
              {formatNumber(stats?.productoMasVendido?.unidades || 0)} unidades vendidas
            </p>
            
            {stats?.productoMasVendido && (
              <div className="flex items-center pt-2">
                {stats.productoMasVendido.crecimiento >= 0 ? (
                  <ArrowUp className="h-4 w-4 text-green-500 mr-1" />
                ) : (
                  <ArrowDown className="h-4 w-4 text-red-500 mr-1" />
                )}
                <span className={`text-sm font-medium ${
                  stats.productoMasVendido.crecimiento >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stats.productoMasVendido.crecimiento.toFixed(1)}%
                </span>
                <span className="text-xs text-gray-500 ml-1">vs período anterior</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mayor Margen */}
      <div className="bg-[var(--surface)] rounded-lg shadow hover:shadow-lg transition-shadow border border-[var(--border)]">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[var(--text-muted)]">
              Mayor Margen
            </h3>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          
          <div className="space-y-2">
            <div className="space-y-1">
              <p className="text-lg font-bold text-[var(--foreground)] leading-tight">
                {stats?.mayorMargen?.nombre || 'N/A'}
              </p>
              {stats?.mayorMargen?.codigo && (
                <p className="text-xs text-[var(--text-subtle)] font-mono">
                  {stats.mayorMargen.codigo}
                </p>
              )}
            </div>
            <p className="text-sm text-[var(--text-subtle)]">
              {stats?.mayorMargen?.margen.toFixed(1) || '0'}% de margen
            </p>
            
            {stats?.mayorMargen && (
              <div className="flex items-center pt-2">
                {stats.mayorMargen.crecimiento >= 0 ? (
                  <ArrowUp className="h-4 w-4 text-green-500 mr-1" />
                ) : (
                  <ArrowDown className="h-4 w-4 text-red-500 mr-1" />
                )}
                <span className={`text-sm font-medium ${
                  stats.mayorMargen.crecimiento >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stats.mayorMargen.crecimiento.toFixed(1)}%
                </span>
                <span className="text-xs text-[var(--text-subtle)] ml-1">vs período anterior</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Total Productos */}
      <div className="bg-[var(--surface)] rounded-lg shadow hover:shadow-lg transition-shadow border border-[var(--border)]">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[var(--text-muted)]">
              Total Productos
            </h3>
            <BarChart3 className="h-5 w-5 text-purple-500" />
          </div>
          
          <div className="space-y-2">
            <p className="text-2xl font-bold text-[var(--foreground)]">
              {formatNumber(stats?.totalProductos || 0)}
            </p>
            <p className="text-sm text-[var(--text-subtle)]">
              productos diferentes vendidos
            </p>
          </div>
        </div>
      </div>

      {/* Ventas Totales */}
      <div className="bg-[var(--surface)] rounded-lg shadow hover:shadow-lg transition-shadow border border-[var(--border)]">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[var(--text-muted)]">
              Ventas Totales
            </h3>
            <DollarSign className="h-5 w-5 text-yellow-500" />
          </div>
          
          <div className="space-y-2">
            <p className="text-2xl font-bold text-[var(--foreground)]">
              {formatCurrency(stats?.ventasTotales || 0)}
            </p>
            <p className="text-sm text-[var(--text-subtle)]">
              en el período seleccionado
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
