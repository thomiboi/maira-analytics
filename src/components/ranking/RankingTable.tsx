'use client';

import { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown } from 'lucide-react';

interface ProductRanking {
  ranking: number;
  codigo: string;
  nombre: string;
  unidades: number;
  ingresos: number;
  costo: number;
  margen: number;
  margenDinero: number;  // Beneficio bruto en $
  frecuencia: number;
  crecimiento: number;
}

interface RankingTableProps {
  productos: ProductRanking[];
  viewMode: string;
  loading?: boolean;
}

type SortColumn = 'ranking' | 'nombre' | 'unidades' | 'ingresos' | 'costo' | 'margen' | 'margenDinero' | 'frecuencia' | 'crecimiento';
type SortDirection = 'asc' | 'desc';

export default function RankingTable({ productos, viewMode, loading = false }: Readonly<RankingTableProps>) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('ranking');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedProductos = [...productos].sort((a, b) => {
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    
    if (sortColumn === 'nombre') {
      return multiplier * a.nombre.localeCompare(b.nombre);
    }
    
    return multiplier * (a[sortColumn] - b[sortColumn]);
  });

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

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-2 h-4 w-4 text-gray-400" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="ml-2 h-4 w-4 text-blue-600" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4 text-blue-600" />
    );
  };

  const getViewModeTitle = () => {
    switch (viewMode) {
      case 'mas-vendidos':
        return 'Más Vendidos';
      case 'mayor-margen':
        return 'Mayor Margen';
      case 'frecuencia':
        return 'Mayor Frecuencia';
      case 'crecimiento':
        return 'Mayor Crecimiento';
      default:
        return 'Ranking de Productos';
    }
  };

  if (loading) {
    return (
      <div className="bg-[var(--surface)] rounded-lg shadow border border-[var(--border)]">
        <div className="p-6">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4 animate-pulse"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-100 dark:bg-gray-700 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (productos.length === 0) {
    return (
      <div className="bg-[var(--surface)] rounded-lg shadow p-8 text-center border border-[var(--border)]">
        <p className="text-[var(--text-subtle)]">
          No se encontraron productos para el período seleccionado
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface)] rounded-lg shadow border border-[var(--border)]">
      <div className="p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">
            {getViewModeTitle()}
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Vista detallada de productos según el criterio seleccionado
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--border)]">
            <thead className="bg-[var(--surface-muted)]">
              <tr>
                <th scope="col" className="px-6 py-3 text-left">
                  <button
                    onClick={() => handleSort('ranking')}
                    className="flex items-center text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider hover:text-[var(--foreground)]"
                  >
                    Ranking
                    <SortIcon column="ranking" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-3 text-left">
                  <button
                    onClick={() => handleSort('nombre')}
                    className="flex items-center text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider hover:text-[var(--foreground)]"
                  >
                    Producto
                    <SortIcon column="nombre" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-3 text-right">
                  <button
                    onClick={() => handleSort('unidades')}
                    className="flex items-center justify-end w-full text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider hover:text-[var(--foreground)]"
                  >
                    Unidades
                    <SortIcon column="unidades" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-3 text-right">
                  <button
                    onClick={() => handleSort('costo')}
                    className="flex items-center justify-end w-full text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider hover:text-[var(--foreground)]"
                  >
                    Costo Total
                    <SortIcon column="costo" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-3 text-right">
                  <button
                    onClick={() => handleSort('ingresos')}
                    className="flex items-center justify-end w-full text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider hover:text-[var(--foreground)]"
                  >
                    Ingresos
                    <SortIcon column="ingresos" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-3 text-right">
                  <button
                    onClick={() => handleSort('margen')}
                    className="flex items-center justify-end w-full text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider hover:text-[var(--foreground)]"
                  >
                    Margen %
                    <SortIcon column="margen" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-3 text-right">
                  <button
                    onClick={() => handleSort('margenDinero')}
                    className="flex items-center justify-end w-full text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider hover:text-[var(--foreground)]"
                  >
                    Margen $
                    <SortIcon column="margenDinero" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-3 text-right">
                  <button
                    onClick={() => handleSort('frecuencia')}
                    className="flex items-center justify-end w-full text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider hover:text-[var(--foreground)]"
                    title="Cantidad de boletas en las que apareció este producto"
                  >
                    Frecuencia
                    <SortIcon column="frecuencia" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-3 text-right">
                  <button
                    onClick={() => handleSort('crecimiento')}
                    className="flex items-center justify-end w-full text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider hover:text-[var(--foreground)]"
                  >
                    Crecimiento
                    <SortIcon column="crecimiento" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="bg-[var(--surface)] divide-y divide-[var(--border)]">
              {sortedProductos.map((producto) => (
                <tr 
                  key={producto.codigo} 
                  className="hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                        producto.ranking <= 3 
                          ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' 
                          : 'bg-[var(--surface-muted)] text-[var(--text-muted)]'
                      }`}>
                        <span className="text-sm font-bold">{producto.ranking}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-[var(--foreground)]">
                      {producto.nombre}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {producto.codigo}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm text-[var(--foreground)] font-medium">
                      {formatNumber(producto.unidades)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm text-[var(--foreground)] font-medium">
                      {formatCurrency(producto.costo)}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      inversión
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm text-[var(--foreground)] font-medium">
                      {formatCurrency(producto.ingresos)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      producto.margen > 50
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : producto.margen > 30
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        : 'bg-[var(--surface-muted)] text-[var(--text-muted)]'
                    }`}>
                      {producto.margen.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm text-[var(--foreground)] font-medium">
                      {formatCurrency(producto.margenDinero)}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      beneficio
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm text-[var(--foreground)]">
                      {formatNumber(producto.frecuencia)}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      apariciones
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end">
                      {producto.crecimiento >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                      )}
                      <span className={`text-sm font-medium ${
                        producto.crecimiento >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {producto.crecimiento.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
