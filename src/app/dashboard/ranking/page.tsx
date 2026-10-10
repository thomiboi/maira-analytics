'use client';

import { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import RankingStats from '@/components/ranking/RankingStats';
import RankingTable from '@/components/ranking/RankingTable';
import ExportModal from '@/components/ranking/ExportModal';
import InsightsPanel from '@/components/ranking/InsightsPanel';
import { Calendar, RefreshCw, Download, Sparkles } from 'lucide-react';

interface ProductRanking {
  ranking: number;
  codigo: string;
  nombre: string;
  unidades: number;
  ingresos: number;
  costo: number;
  margen: number;
  margenDinero: number;
  frecuencia: number;
  crecimiento: number;
}

interface RankingStats {
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
}

interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface RankingData {
  productos: ProductRanking[];
  stats: RankingStats;
  periodo: {
    dias: number;
    fechaInicio: string;
    fechaFin: string;
  };
  pagination: PaginationInfo;
}

// Componente interno con la lógica de la página
function RankingContent() {
  const [sucursal, setSucursal] = useState('todas');
  const [fechaInicio, setFechaInicio] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // Últimos 30 días por defecto
    return date.toISOString().split('T')[0];
  });
  const [fechaFin, setFechaFin] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [viewMode, setViewMode] = useState('mas-vendidos');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [data, setData] = useState<RankingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // Función para establecer períodos rápidos
  const setQuickPeriod = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    
    setFechaInicio(start.toISOString().split('T')[0]);
    setFechaFin(end.toISOString().split('T')[0]);
  };

  // Handler para búsqueda
  const handleSearch = () => {
    setSearchQuery(searchInput);
    setCurrentPage(1); // Resetear a página 1 al buscar
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const fetchRankingData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        sucursal,
        fechaInicio,
        fechaFin,
        viewMode,
        search: searchQuery,
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      });

      console.log('🔍 [RANKING PAGE] Parámetros enviados:', {
        sucursal,
        fechaInicio,
        fechaFin,
        viewMode,
        searchQuery,
        page: currentPage,
        pageSize
      });

      const url = `/api/ranking/productos?${params}`;
      console.log('🌐 [RANKING PAGE] URL completa:', url);

      const response = await fetch(url);
      
      console.log('📡 [RANKING PAGE] Response status:', response.status);

      if (!response.ok) {
        throw new Error('Error al cargar datos de ranking');
      }

      const result = await response.json();
      
      console.log('📊 [RANKING PAGE] Resultado recibido:', {
        success: result.success,
        productosCount: result.data?.productos?.length || 0,
        totalItems: result.data?.pagination?.totalItems || 0
      });

      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(result.error || 'Error desconocido');
      }
    } catch (err) {
      console.error('❌ [RANKING PAGE] Error fetching ranking:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRankingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucursal, fechaInicio, fechaFin, viewMode, searchQuery, currentPage, pageSize]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[var(--surface)] rounded-lg shadow p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
              Ranking de Productos
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Análisis de productos más vendidos y rentables
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Selector de Sucursal */}
            <select
              value={sucursal}
              onChange={(e) => setSucursal(e.target.value)}
              className="px-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="todas">Todas las sucursales</option>
              <option value="null">Casa Matriz</option>
              <option value="2191">FM Villa independencia</option>
            </select>

            {/* Selector de Fecha Inicio */}
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[var(--text-muted)]" />
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                min="2023-01-01"
                max={fechaFin}
                className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Selector de Fecha Fin */}
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)]">hasta</span>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                min="2023-01-01"
                max={new Date().toISOString().split('T')[0]}
                className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Botones de período rápido */}
            <div className="flex gap-1 border-l border-[var(--border)] pl-3">
              <button
                onClick={() => setQuickPeriod(7)}
                className="px-2 py-1 text-xs bg-[var(--surface-muted)] text-[var(--foreground)] rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                7d
              </button>
              <button
                onClick={() => setQuickPeriod(30)}
                className="px-2 py-1 text-xs bg-[var(--surface-muted)] text-[var(--foreground)] rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                30d
              </button>
              <button
                onClick={() => setQuickPeriod(90)}
                className="px-2 py-1 text-xs bg-[var(--surface-muted)] text-[var(--foreground)] rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                90d
              </button>
            </div>

            {/* Botón Actualizar */}
            <button
              onClick={fetchRankingData}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Buscar
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
        </div>
      )}

      {/* KPI Stats */}
      <RankingStats stats={data?.stats || null} loading={loading} />

      {/* View Mode Selector */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setViewMode('mas-vendidos')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'mas-vendidos'
              ? 'bg-red-600 text-white'
              : 'bg-[var(--surface)] text-[var(--foreground)] hover:bg-red-50 dark:hover:bg-red-900/20 border border-[var(--border)]'
          }`}
        >
          Más Vendidos
        </button>
        <button
          onClick={() => setViewMode('mayor-margen')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'mayor-margen'
              ? 'bg-red-600 text-white'
              : 'bg-[var(--surface)] text-[var(--foreground)] hover:bg-red-50 dark:hover:bg-red-900/20 border border-[var(--border)]'
          }`}
        >
          Mayor Margen
        </button>
        <button
          onClick={() => setViewMode('frecuencia')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'frecuencia'
              ? 'bg-red-600 text-white'
              : 'bg-[var(--surface)] text-[var(--foreground)] hover:bg-red-50 dark:hover:bg-red-900/20 border border-[var(--border)]'
          }`}
        >
          Más Frecuencia
        </button>
        <button
          onClick={() => setViewMode('crecimiento')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'crecimiento'
              ? 'bg-red-600 text-white'
              : 'bg-[var(--surface)] text-[var(--foreground)] hover:bg-red-50 dark:hover:bg-red-900/20 border border-[var(--border)]'
          }`}
        >
          Mayor Crecimiento
        </button>

        {/* Separador */}
        <div className="border-l border-[var(--border)] mx-2"></div>

        {/* Botón Insights IA */}
        <button
          onClick={() => setViewMode('insights-ia')}
          className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
            viewMode === 'insights-ia'
              ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
              : 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 shadow-md hover:shadow-lg'
          }`}
        >
          <Sparkles className="h-5 w-5" />
          Insights IA
        </button>
      </div>

      {/* Barra de Búsqueda */}
      <div className="bg-[var(--surface)] rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Buscar producto por nombre o código..."
                className="w-full px-4 py-2 pl-10 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[var(--text-muted)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Buscar
            </button>
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="px-4 py-2 bg-[var(--surface-muted)] text-[var(--foreground)] rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
        {searchQuery && (
          <div className="mt-3 text-sm text-[var(--text-muted)]">
            Mostrando resultados para: <span className="font-semibold text-[var(--foreground)]">&quot;{searchQuery}&quot;</span>
            {data?.pagination && (
              <span className="ml-2">({data.pagination.totalItems} producto{data.pagination.totalItems !== 1 ? 's' : ''} encontrado{data.pagination.totalItems !== 1 ? 's' : ''})</span>
            )}
          </div>
        )}
        
        {/* Botón de Exportación */}
        {data?.productos && data.productos.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[var(--border)]">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-muted)]">
                {data.productos.length} producto{data.productos.length !== 1 ? 's' : ''} disponible{data.productos.length !== 1 ? 's' : ''} para exportar
              </span>
              <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm shadow-sm"
              >
                <Download className="h-4 w-4" />
                Exportar Datos
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Contenido Principal - Tabla o Insights IA */}
      {viewMode === 'insights-ia' ? (
        <InsightsPanel
          fechaInicio={fechaInicio}
          fechaFin={fechaFin}
          sucursal={sucursal}
        />
      ) : (
        <>
          {/* Products Table */}
          <RankingTable 
            productos={data?.productos || []} 
            viewMode={viewMode}
            loading={loading}
          />

          {/* Paginación */}
          {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="bg-[var(--surface)] rounded-lg shadow p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Información de paginación y selector de cantidad */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="text-sm text-[var(--text-muted)]">
                Mostrando{' '}
                <span className="font-semibold text-[var(--foreground)]">
                  {((data.pagination.currentPage - 1) * data.pagination.pageSize) + 1}
                </span>
                {' '}-{' '}
                <span className="font-semibold text-[var(--foreground)]">
                  {Math.min(data.pagination.currentPage * data.pagination.pageSize, data.pagination.totalItems)}
                </span>
                {' '}de{' '}
                <span className="font-semibold text-[var(--foreground)]">
                  {data.pagination.totalItems}
                </span>
                {' '}productos
              </div>

              {/* Selector de cantidad por página */}
              <div className="flex items-center gap-2">
                <label htmlFor="pageSize" className="text-sm text-[var(--text-muted)] whitespace-nowrap">
                  Mostrar:
                </label>
                <select
                  id="pageSize"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1); // Resetear a la primera página
                  }}
                  className="px-3 py-1.5 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  {data.pagination.totalItems > 100 && (
                    <option value={data.pagination.totalItems}>
                      Todos ({data.pagination.totalItems})
                    </option>
                  )}
                </select>
              </div>
            </div>

            {/* Controles de paginación */}
            <div className="flex items-center gap-2">
              {/* Botón Primera Página */}
              <button
                onClick={() => setCurrentPage(1)}
                disabled={!data.pagination.hasPreviousPage || loading}
                className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Primera página"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>

              {/* Botón Página Anterior */}
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={!data.pagination.hasPreviousPage || loading}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Página anterior"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Números de página */}
              <div className="flex gap-1">
                {Array.from({ length: Math.min(5, data.pagination.totalPages) }, (_, i) => {
                  let pageNumber;
                  if (data.pagination.totalPages <= 5) {
                    pageNumber = i + 1;
                  } else if (data.pagination.currentPage <= 3) {
                    pageNumber = i + 1;
                  } else if (data.pagination.currentPage >= data.pagination.totalPages - 2) {
                    pageNumber = data.pagination.totalPages - 4 + i;
                  } else {
                    pageNumber = data.pagination.currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(pageNumber)}
                      disabled={loading}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        pageNumber === data.pagination.currentPage
                          ? 'bg-red-600 text-white'
                          : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-red-50 dark:hover:bg-red-900/20'
                      } disabled:cursor-not-allowed`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
              </div>

              {/* Botón Página Siguiente */}
              <button
                onClick={() => setCurrentPage(prev => Math.min(data.pagination.totalPages, prev + 1))}
                disabled={!data.pagination.hasNextPage || loading}
                className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Página siguiente"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Botón Última Página */}
              <button
                onClick={() => setCurrentPage(data.pagination.totalPages)}
                disabled={!data.pagination.hasNextPage || loading}
                className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Última página"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* Modal de Exportación */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        currentFechaInicio={fechaInicio}
        currentFechaFin={fechaFin}
        sucursal={sucursal}
        viewMode={viewMode}
        productos={data?.productos || []}
      />
    </div>
  );
}

// Wrapper component que maneja permisos
export default function RankingPage() {
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const router = useRouter();

  // Verificar permisos de lectura
  const canReadRanking = hasPermission('ranking', 'read');

  // Mostrar loading mientras se cargan permisos
  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  // Verificar si tiene permisos de lectura
  if (!canReadRanking) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Acceso Restringido
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            No tienes permisos para acceder al ranking de productos.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Si tiene permisos, mostrar el contenido
  return <RankingContent />;
}
