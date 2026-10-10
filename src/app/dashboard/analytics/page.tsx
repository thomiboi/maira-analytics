'use client';

import { useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import { 
  TrendingUp, 
  Calendar as CalendarIcon, 
  ShoppingCart, 
  AlertTriangle, 
  DollarSign, 
  FileText,
  Sparkles,
  Loader2,
  CalendarDays
} from 'lucide-react';

type InsightType = 
  | 'tendencias-ventas'
  | 'estacionalidad'
  | 'oportunidades-compra'
  | 'productos-riesgo'
  | 'analisis-margen'
  | 'resumen-general';

interface InsightMetadata {
  fechaInicio: string;
  fechaFin: string;
  totalProductos: number;
  generadoEn: string;
}

interface InsightData {
  metadata: InsightMetadata;
  insights: {
    resumen?: string;
    [key: string]: unknown;
  };
}

interface InsightButton {
  type: InsightType;
  title: string;
  description: string;
  icon: typeof TrendingUp;
  color: string;
}

const INSIGHT_BUTTONS: InsightButton[] = [
  {
    type: 'resumen-general',
    title: 'Resumen General',
    description: 'Overview completo con top insights y recomendaciones',
    icon: FileText,
    color: 'bg-gradient-to-br from-gray-500 to-gray-700',
  },
  {
    type: 'tendencias-ventas',
    title: 'Tendencias de Ventas',
    description: 'Productos con crecimiento sostenido y proyecciones',
    icon: TrendingUp,
    color: 'bg-gradient-to-br from-blue-500 to-blue-700',
  },
  {
    type: 'estacionalidad',
    title: 'Análisis Estacional',
    description: 'Patrones de temporada y predicciones futuras',
    icon: CalendarIcon,
    color: 'bg-gradient-to-br from-purple-500 to-purple-700',
  },
  {
    type: 'oportunidades-compra',
    title: 'Oportunidades de Compra',
    description: 'Maximiza ganancias con decisiones de compra inteligentes',
    icon: ShoppingCart,
    color: 'bg-gradient-to-br from-green-500 to-green-700',
  },
  {
    type: 'productos-riesgo',
    title: 'Productos en Riesgo',
    description: 'Detecta caídas de ventas y toma acción a tiempo',
    icon: AlertTriangle,
    color: 'bg-gradient-to-br from-red-500 to-red-700',
  },
  {
    type: 'analisis-margen',
    title: 'Optimización de Márgenes',
    description: 'Mejora rentabilidad ajustando precios y costos',
    icon: DollarSign,
    color: 'bg-gradient-to-br from-yellow-500 to-yellow-700',
  },
];

// Componente interno con la lógica
function AnalyticsContent() {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<InsightType | null>(null);
  
  // Estados para selector de fechas
  const [fechaInicio, setFechaInicio] = useState(() => {
    const fecha = new Date();
    fecha.setMonth(fecha.getMonth() - 3); // 3 meses atrás por defecto
    return fecha.toISOString().split('T')[0];
  });
  const [fechaFin, setFechaFin] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const handleGenerateInsight = async (tipo: InsightType) => {
    setLoading(true);
    setError(null);
    setSelectedType(tipo);
    setInsights(null);

    try {
      const response = await fetch('/api/insights/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insightType: tipo,
          fechaInicio,
          fechaFin,
          sucursal: 'todas',
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al generar insights');
      }

      setInsights(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      console.error('Error al generar insights:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-pink-600 rounded-lg shadow-lg p-8 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="h-8 w-8" />
          <h1 className="text-3xl font-bold">Analytics con IA</h1>
        </div>
        <p className="text-red-50">
          Descubre patrones ocultos en tus datos y obtén recomendaciones accionables 
          impulsadas por inteligencia artificial
        </p>
        <p className="text-red-100 text-sm mt-2">
          📍 Farmacias Maira - Viña del Mar, Chile 🇨🇱
        </p>
      </div>

      {/* Selector de Período */}
      <div className="bg-[var(--surface)] rounded-lg shadow-md p-6 border border-[var(--border)]">
        <div className="flex items-center gap-3 mb-4">
          <CalendarDays className="h-5 w-5 text-red-600" />
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Período de Análisis
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="fecha-inicio" className="block text-sm font-medium text-[var(--text-muted)] mb-2">
              Fecha Inicio
            </label>
            <input
              id="fecha-inicio"
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              max={fechaFin}
              className="w-full px-4 py-2 border border-[var(--border)] rounded-lg 
                         bg-[var(--surface)] text-[var(--foreground)]
                         focus:ring-2 focus:ring-red-500 focus:border-red-500
                         transition-colors"
            />
          </div>
          
          <div>
            <label htmlFor="fecha-fin" className="block text-sm font-medium text-[var(--text-muted)] mb-2">
              Fecha Fin
            </label>
            <input
              id="fecha-fin"
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              min={fechaInicio}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2 border border-[var(--border)] rounded-lg 
                         bg-[var(--surface)] text-[var(--foreground)]
                         focus:ring-2 focus:ring-red-500 focus:border-red-500
                         transition-colors"
            />
          </div>
        </div>

        {/* Botones de período rápido */}
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={() => {
              const fin = new Date();
              const inicio = new Date();
              inicio.setMonth(inicio.getMonth() - 1);
              setFechaInicio(inicio.toISOString().split('T')[0]);
              setFechaFin(fin.toISOString().split('T')[0]);
            }}
            className="px-3 py-1 text-sm bg-[var(--surface-muted)] hover:bg-gray-200 dark:hover:bg-gray-600 
                       text-[var(--text-muted)] rounded-md transition-colors"
          >
            Último mes
          </button>
          <button
            onClick={() => {
              const fin = new Date();
              const inicio = new Date();
              inicio.setMonth(inicio.getMonth() - 3);
              setFechaInicio(inicio.toISOString().split('T')[0]);
              setFechaFin(fin.toISOString().split('T')[0]);
            }}
            className="px-3 py-1 text-sm bg-red-100 hover:bg-red-200
                       text-red-700 rounded-md transition-colors"
          >
            Últimos 3 meses
          </button>
          <button
            onClick={() => {
              const fin = new Date();
              const inicio = new Date();
              inicio.setMonth(inicio.getMonth() - 6);
              setFechaInicio(inicio.toISOString().split('T')[0]);
              setFechaFin(fin.toISOString().split('T')[0]);
            }}
            className="px-3 py-1 text-sm bg-[var(--surface-muted)] hover:bg-gray-200
                       text-[var(--text-muted)] rounded-md transition-colors"
          >
            Últimos 6 meses
          </button>
          <button
            onClick={() => {
              const fin = new Date();
              const inicio = new Date();
              inicio.setFullYear(inicio.getFullYear() - 1);
              setFechaInicio(inicio.toISOString().split('T')[0]);
              setFechaFin(fin.toISOString().split('T')[0]);
            }}
            className="px-3 py-1 text-sm bg-[var(--surface-muted)] hover:bg-gray-200 dark:hover:bg-gray-600 
                       text-[var(--text-muted)] rounded-md transition-colors"
          >
            Último año
          </button>
        </div>

        {/* Info del período */}
        <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm text-red-800">
            <span className="font-semibold">Período seleccionado:</span> {' '}
            {new Date(fechaInicio).toLocaleDateString('es-CL', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })} - {' '}
            {new Date(fechaFin).toLocaleDateString('es-CL', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
            {' '}
            ({Math.ceil((new Date(fechaFin).getTime() - new Date(fechaInicio).getTime()) / (1000 * 60 * 60 * 24))} días)
          </p>
        </div>
      </div>

      {/* Aviso de configuración */}
      {error?.includes('API key') && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-900 mb-1">
                Configuración requerida
              </h3>
              <p className="text-sm text-yellow-800 mb-2">
                Para usar esta funcionalidad, necesitas configurar una API key de Groq (gratis) o OpenAI.
              </p>
              <ol className="text-sm text-yellow-800 list-decimal list-inside space-y-1">
                <li>Crea una cuenta en <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">console.groq.com</a> (gratis)</li>
                <li>Genera una API key</li>
                <li>Agrégala a tu archivo .env.local como: <code className="bg-yellow-100 px-1 rounded">GROQ_API_KEY=tu_key</code></li>
                <li>Reinicia el servidor de desarrollo</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Grid de botones de insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {INSIGHT_BUTTONS.map((button) => {
          const Icon = button.icon;
          const isActive = selectedType === button.type;
          
          return (
            <button
              key={button.type}
              onClick={() => handleGenerateInsight(button.type)}
              disabled={loading}
              className={`
                ${button.color} 
                ${isActive ? 'ring-4 ring-red-400 ring-offset-2' : ''}
                text-white rounded-lg p-6 
                hover:shadow-xl hover:scale-105 
                transition-all duration-200 
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                text-left relative overflow-hidden group
              `}
            >
              {/* Efecto de brillo */}
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
              
              <div className="relative z-10">
                <Icon className="h-8 w-8 mb-3" />
                <h3 className="font-bold text-lg mb-2">{button.title}</h3>
                <p className="text-sm text-white/90">{button.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-[var(--surface)] rounded-lg shadow-lg p-12 border border-[var(--border)]">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="relative">
              <Loader2 className="h-16 w-16 text-red-600 animate-spin" />
              <Sparkles className="h-8 w-8 text-pink-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
              </h3>
              <p className="text-[var(--text-subtle)]">
                La IA está procesando miles de transacciones para encontrar insights valiosos
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !error.includes('API key') && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex gap-3">
            <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">
                Error al generar insights
              </h3>
              <p className="text-sm text-red-800">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Resultados */}
      {insights && !loading && (
        <div className="bg-[var(--surface)] rounded-lg shadow-lg overflow-hidden border border-[var(--border)]">
          {/* Header de resultados */}
          <div className="bg-gradient-to-r from-red-500 to-pink-500 p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-2">
                  Resultados del Análisis
                </h2>
                <p className="text-red-50">
                  {INSIGHT_BUTTONS.find(b => b.type === selectedType)?.title}
                </p>
              </div>
              <Sparkles className="h-12 w-12 opacity-50" />
            </div>
          </div>

          {/* Metadata */}
          <div className="bg-[var(--surface-muted)] px-6 py-4 border-b border-[var(--border)]">
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <span className="text-[var(--text-subtle)]">Período:</span>
                <span className="ml-2 font-semibold text-[var(--foreground)]">
                  {new Date(insights.metadata.fechaInicio).toLocaleDateString('es-CL')} - 
                  {new Date(insights.metadata.fechaFin).toLocaleDateString('es-CL')}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-subtle)]">Productos analizados:</span>
                <span className="ml-2 font-semibold text-[var(--foreground)]">
                  {insights.metadata.totalProductos}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-subtle)]">Generado:</span>
                <span className="ml-2 font-semibold text-[var(--foreground)]">
                  {new Date(insights.metadata.generadoEn).toLocaleString('es-CL')}
                </span>
              </div>
            </div>
          </div>

          {/* Insights Content */}
          <div className="p-6">
            {/* Resumen ejecutivo */}
            {insights.insights.resumen && (
              <div className="mb-6 p-4 bg-red-50 rounded-lg border-l-4 border-red-500">
                <h3 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Resumen Ejecutivo
                </h3>
                <p className="text-red-800">
                  {insights.insights.resumen}
                </p>
              </div>
            )}

            {/* Mostrar datos en formato estructurado */}
            <div className="space-y-6">
              {Object.entries(insights.insights).map(([key, value]) => {
                if (key === 'resumen') return null; // Ya lo mostramos arriba
                
                // Renderizar valor basado en su tipo
                const renderValue = () => {
                  if (Array.isArray(value)) {
                    return (
                      <div className="space-y-3">
                        {value.map((item: unknown, index: number) => (
                          <div 
                            key={`${key}-${index}`}
                            className="bg-[var(--surface-muted)] rounded-lg p-4 hover:shadow-md transition-shadow border border-[var(--border)]"
                          >
                            {typeof item === 'object' && item !== null ? (
                              <div className="space-y-2">
                                {Object.entries(item as Record<string, unknown>).map(([itemKey, itemValue]) => {
                                  let displayValue = '';
                                  
                                  if (itemValue === null || itemValue === undefined) {
                                    displayValue = '';
                                  } else if (typeof itemValue === 'object') {
                                    displayValue = JSON.stringify(itemValue);
                                  } else {
                                    displayValue = String(itemValue);
                                  }
                                  
                                  return (
                                    <div key={itemKey} className="flex flex-col sm:flex-row sm:gap-2">
                                      <span className="font-medium text-gray-700 min-w-[150px]">
                                        {itemKey.replaceAll('_', ' ')}:
                                      </span>
                                      <span className="text-gray-900">
                                        {displayValue}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-gray-900">
                                {item !== null && item !== undefined ? String(item) : ''}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  }
                  
                  if (typeof value === 'object' && value !== null) {
                    return (
                      <pre className="bg-[var(--surface-muted)] rounded p-4 overflow-auto text-sm border border-[var(--border)]">
                        {JSON.stringify(value, null, 2)}
                      </pre>
                    );
                  }
                  
                  const displayValue = value !== null && value !== undefined ? String(value) : '';
                  return <p className="text-[var(--foreground)]">{displayValue}</p>;
                };
                
                return (
                  <div key={key} className="border-l-4 border-red-300 dark:border-red-600 pl-4">
                    <h3 className="font-semibold text-lg text-[var(--foreground)] mb-3 capitalize">
                      {key.replaceAll('_', ' ')}
                    </h3>
                    {renderValue()}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer con botón para nuevo análisis */}
          <div className="bg-[var(--surface-muted)] px-6 py-4 border-t border-[var(--border)]">
            <button
              onClick={() => {
                setInsights(null);
                setSelectedType(null);
              }}
              className="text-red-600 hover:text-red-700 font-medium text-sm"
            >
              ← Generar otro análisis
            </button>
          </div>
        </div>
      )}

      {/* Estado inicial (sin insights) */}
      {!loading && !insights && !error && (
        <div className="bg-[var(--surface)] rounded-lg shadow-lg p-12 text-center border border-[var(--border)]">
          <Sparkles className="h-16 w-16 text-[var(--text-subtle)] mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
            Selecciona un tipo de análisis
          </h3>
          <p className="text-[var(--text-subtle)] max-w-md mx-auto">
            Haz clic en cualquiera de las opciones arriba para obtener insights 
            personalizados sobre tus datos de ventas
          </p>
        </div>
      )}
    </div>
  );
}

// Wrapper con verificación de permisos
export default function AnalyticsPage() {
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const router = useRouter();

  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-red-600 mx-auto mb-4" />
          <p className="text-[var(--text-subtle)]">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  // Verificar permisos
  const canViewAnalytics = hasPermission('analytics', 'read');

  if (!canViewAnalytics) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
            Acceso Restringido
          </h2>
          <p className="text-[var(--text-subtle)] mb-6">
            No tienes permisos para acceder a Analytics con IA.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <AnalyticsContent />;
}
