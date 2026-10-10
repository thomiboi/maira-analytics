'use client';

import { StockStatus } from '@/types/supplier';

interface StockBadgeProps {
  readonly stock: number;
  readonly status: StockStatus;
  readonly showNumber?: boolean;
}

export default function StockBadge({ stock, status, showNumber = true }: Readonly<StockBadgeProps>) {
  const getStockConfig = (status: StockStatus) => {
    switch (status) {
      case 'high':
        return {
          bg: 'bg-green-100 dark:bg-green-900',
          text: 'text-green-800 dark:text-green-200',
          icon: '✓',
          label: 'Stock Alto',
          border: 'border-green-300 dark:border-green-700'
        };
      case 'medium':
        return {
          bg: 'bg-yellow-100 dark:bg-yellow-900',
          text: 'text-yellow-800 dark:text-yellow-200',
          icon: '⚠',
          label: 'Stock Medio',
          border: 'border-yellow-300 dark:border-yellow-700'
        };
      case 'low':
        return {
          bg: 'bg-red-100 dark:bg-red-900',
          text: 'text-red-800 dark:text-red-200',
          icon: '⚠',
          label: 'Stock Bajo',
          border: 'border-red-300 dark:border-red-700'
        };
      case 'out':
        return {
          bg: 'bg-gray-100 dark:bg-gray-700',
          text: 'text-gray-800 dark:text-gray-300',
          icon: '✕',
          label: 'Sin Stock',
          border: 'border-gray-300 dark:border-gray-600'
        };
    }
  };

  const config = getStockConfig(status);

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${config.bg} ${config.text} ${config.border}`}>
      <span className="text-sm font-semibold">{config.icon}</span>
      {showNumber && (
        <span className="text-sm font-medium">
          {stock > 0 ? `${stock} unidades` : 'Agotado'}
        </span>
      )}
    </div>
  );
}

interface StockAlertProps {
  readonly stock: number;
  readonly status: StockStatus;
}

export function StockAlert({ stock, status }: Readonly<StockAlertProps>) {
  if (status === 'high') return null;

  const getAlertConfig = () => {
    switch (status) {
      case 'low':
        return {
          bg: 'bg-red-50 dark:bg-red-900/20',
          border: 'border-red-200 dark:border-red-800',
          text: 'text-red-900 dark:text-red-200',
          icon: '🚨',
          title: 'Stock Bajo',
          message: `Solo quedan ${stock} unidades disponibles`
        };
      case 'medium':
        return {
          bg: 'bg-yellow-50 dark:bg-yellow-900/20',
          border: 'border-yellow-200 dark:border-yellow-800',
          text: 'text-yellow-900 dark:text-yellow-200',
          icon: '⚠️',
          title: 'Stock Limitado',
          message: `Quedan ${stock} unidades disponibles`
        };
      case 'out':
        return {
          bg: 'bg-gray-50 dark:bg-gray-800',
          border: 'border-gray-200 dark:border-gray-700',
          text: 'text-gray-900 dark:text-gray-300',
          icon: '❌',
          title: 'Sin Stock',
          message: 'Producto agotado actualmente'
        };
    }
  };

  const config = getAlertConfig();

  return (
    <div className={`rounded-lg border p-3 ${config.bg} ${config.border}`}>
      <div className="flex items-start gap-2">
        <span className="text-lg">{config.icon}</span>
        <div className="flex-1">
          <p className={`text-sm font-semibold ${config.text}`}>
            {config.title}
          </p>
          <p className={`text-xs mt-0.5 ${config.text}`}>
            {config.message}
          </p>
        </div>
      </div>
    </div>
  );
}
