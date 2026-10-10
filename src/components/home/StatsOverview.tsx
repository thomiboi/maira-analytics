'use client';

import { useState, useEffect } from 'react';
import { FileText, DollarSign, Package, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { dashboardFetchManager } from '@/lib/dashboard-fetch-manager';

interface StatCard {
  title: string;
  value: string | number;
  change: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  trending: 'up' | 'down' | 'neutral';
}

export default function StatsOverview() {
  const [stats, setStats] = useState<StatCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Obtener datos del dashboard para los últimos 30 días
        const dashboardData = await dashboardFetchManager.fetchDashboardData('30', false, '0');
        
        const { stats: salesStats } = dashboardData;
        
        // Calcular variaciones (simplificado por ahora)
        const documentsVariation = 0; // Se puede implementar comparando con período anterior
        const revenueVariation = 0;
        const productVariation = 0;
        const ticketVariation = 0;

        const formatCurrency = (value: number) => `$${value.toLocaleString("es-CL")}`;
        const formatPercentageChange = (change: number) => {
          if (!Number.isFinite(change) || Math.abs(change) < 0.05) {
            return { label: "0%", positive: true } as const;
          }
          const positive = change >= 0;
          const label = `${positive ? "+" : ""}${change.toFixed(1)}%`;
          return { label, positive } as const;
        };

        const documentsChange = formatPercentageChange(documentsVariation);
        const revenueChange = formatPercentageChange(revenueVariation);
        const productChange = formatPercentageChange(productVariation);
        const ticketChange = formatPercentageChange(ticketVariation);

        const newStats: StatCard[] = [
          {
            title: 'Documentos Emitidos',
            value: salesStats.totalSales.toLocaleString("es-CL"),
            change: documentsChange.label,
            icon: FileText,
            color: 'bg-blue-500',
            trending: documentsChange.positive ? 'up' : 'down'
          },
          {
            title: 'Ingresos Totales',
            value: formatCurrency(salesStats.totalRevenue),
            change: revenueChange.label,
            icon: DollarSign,
            color: 'bg-green-500',
            trending: revenueChange.positive ? 'up' : 'down'
          },
          {
            title: 'Productos Únicos',
            value: salesStats.totalProducts.toLocaleString("es-CL"),
            change: productChange.label,
            icon: Package,
            color: 'bg-purple-500',
            trending: productChange.positive ? 'up' : 'down'
          },
          {
            title: 'Ticket Promedio',
            value: formatCurrency(salesStats.averageTicket),
            change: ticketChange.label,
            icon: TrendingUp,
            color: 'bg-orange-500',
            trending: ticketChange.positive ? 'up' : 'down'
          }
        ];

        setStats(newStats);
      } catch (err) {
        console.error('Error fetching stats:', err);
        setError('Error al cargar estadísticas');
        
        // Fallback con datos vacíos
        setStats([
          {
            title: 'Documentos Emitidos',
            value: '0',
            change: 'Sin datos',
            icon: FileText,
            color: 'bg-blue-500',
            trending: 'neutral'
          },
          {
            title: 'Ingresos Totales',
            value: '$0',
            change: 'Sin datos',
            icon: DollarSign,
            color: 'bg-green-500',
            trending: 'neutral'
          },
          {
            title: 'Productos Únicos',
            value: '0',
            change: 'Sin datos',
            icon: Package,
            color: 'bg-purple-500',
            trending: 'neutral'
          },
          {
            title: 'Ticket Promedio',
            value: '$0',
            change: 'Sin datos',
            icon: TrendingUp,
            color: 'bg-orange-500',
            trending: 'neutral'
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const getTrendIcon = (trending: StatCard['trending']) => {
    switch (trending) {
      case 'up': return <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />;
      case 'down': return <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />;
      case 'neutral': return <Minus className="w-5 h-5 text-gray-600 dark:text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 animate-pulse"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-lg bg-gray-300 dark:bg-gray-600"></div>
              <div className="w-5 h-5 bg-gray-300 dark:bg-gray-600 rounded"></div>
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
              <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
              <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/3"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const IconComponent = stat.icon;
        return (
          <div
            key={stat.title}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`${stat.color} w-12 h-12 rounded-lg flex items-center justify-center text-white`}>
                <IconComponent className="w-6 h-6" />
              </div>
              {getTrendIcon(stat.trending)}
            </div>
            <h3 className="text-gray-600 dark:text-gray-400 text-sm mb-1">
              {stat.title}
            </h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {stat.value}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {stat.change}
            </p>
          </div>
        );
      })}
    </div>
  );
}
