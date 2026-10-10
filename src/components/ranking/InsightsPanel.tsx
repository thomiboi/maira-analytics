'use client';

import { useState } from 'react';
import { Sparkles, Loader2, TrendingUp, ShoppingCart, AlertCircle } from 'lucide-react';

interface InsightsPanelProps {
  fechaInicio: string;
  fechaFin: string;
  sucursal: string;
}

type InsightType = 'canibalización' | 'cross-sell';

export default function InsightsPanel({
  fechaInicio,
  fechaFin,
  sucursal,
}: Readonly<InsightsPanelProps>) {
  const [activeTab, setActiveTab] = useState<InsightType>('cross-sell');
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [insights, setInsights] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const generateInsight = async (type: InsightType) => {
    setLoading(true);
    setError(null);
    setActiveTab(type);
    setInsights(null);

    try {
      const response = await fetch('/api/ranking/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insightType: type,
          fechaInicio,
          fechaFin,
          sucursal,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al generar insights');
      }

      console.log('📊 Insights recibidos:', data.data.insights);
      setInsights(data.data.insights);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[var(--surface)] rounded-lg shadow-lg overflow-hidden border border-[var(--border)]">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
        <div className="flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-white" />
          <div>
            <h2 className="text-2xl font-bold text-white">Insights Avanzados con IA</h2>
            <p className="text-blue-50 text-sm">
              Análisis profundo de tus datos de ventas
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-6">
          <button
            onClick={() => generateInsight('cross-sell')}
            disabled={loading}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'cross-sell'
                ? 'bg-white text-blue-600 shadow-lg'
                : 'bg-white/10 text-white hover:bg-white/20'
            } disabled:opacity-50`}
          >
            <ShoppingCart className="h-5 w-5 mx-auto mb-1" />
            <span className="text-sm">Venta Cruzada</span>
          </button>
          <button
            onClick={() => generateInsight('canibalización')}
            disabled={loading}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'canibalización'
                ? 'bg-white text-blue-600 shadow-lg'
                : 'bg-white/10 text-white hover:bg-white/20'
            } disabled:opacity-50`}
          >
            <TrendingUp className="h-5 w-5 mx-auto mb-1" />
            <span className="text-sm">Canibalización</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 min-h-[400px] bg-[var(--surface)]">
            {/* Loading State */}
            {loading && (
              <div className="flex flex-col items-center justify-center h-full">
                <Loader2 className="h-16 w-16 text-blue-600 animate-spin mb-4" />
                <p className="text-[var(--foreground)] font-medium">
                  La IA está analizando miles de transacciones...
                </p>
                <p className="text-sm text-[var(--text-muted)] mt-2">
                  Esto puede tardar 10-30 segundos
                </p>
              </div>
            )}

            {/* Error State */}
            {error && !loading && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                <div className="flex gap-3">
                  <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">
                      Error al generar insights
                    </h3>
                    <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Initial State */}
            {!loading && !insights && !error && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Sparkles className="h-16 w-16 text-[var(--text-muted)] mb-4" />
                <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
                  Selecciona un tipo de análisis
                </h3>
                <p className="text-[var(--text-muted)] max-w-md">
                  Haz clic en una de las pestañas arriba para obtener insights
                  personalizados sobre tus datos de ventas
                </p>
              </div>
            )}

            {/* Insights Content */}
            {insights && !loading && (
              <div className="space-y-6">
                {/* Resumen */}
                {insights.resumen && (
                  <div className="bg-[var(--surface-muted)] border-l-4 border-blue-500 p-4 rounded-r-lg">
                    <h3 className="font-semibold text-[var(--foreground)] mb-2 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-blue-600" />
                      Resumen Ejecutivo
                    </h3>
                    <p className="text-[var(--foreground)]">{insights.resumen}</p>
                  </div>
                )}

                {/* CROSS-SELL Content */}
                {activeTab === 'cross-sell' && insights.patrones_detectados && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Patrones Detectados
                      </h3>
                      {insights.impacto_total_mensual && (
                        <div className="bg-[var(--surface-muted)] px-4 py-2 rounded-lg border border-green-500">
                          <span className="text-sm text-green-700 dark:text-green-400 font-medium">
                            Impacto Total: ${insights.impacto_total_mensual.toLocaleString('es-CL')} CLP/mes
                          </span>
                        </div>
                      )}
                    </div>

                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {insights.patrones_detectados.map((patron: any, idx: number) => (
                      <div key={`patron-${idx}-${patron.nombre_patron}`} className="bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h4 className="text-lg font-bold text-[var(--foreground)] mb-1">
                              {patron.nombre_patron}
                            </h4>
                            <div className="flex flex-wrap gap-3 text-sm text-[var(--text-muted)]">
                              <span>🎯 Confianza: {patron.confianza.toFixed(1)}%</span>
                              <span>📦 Comprados juntos: {patron.soporte} veces</span>
                            </div>
                          </div>
                          {patron.impacto_total && (
                            <div className="text-right">
                              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                +${patron.impacto_total.toLocaleString('es-CL')}
                              </div>
                              <div className="text-xs text-[var(--text-muted)]">CLP/mes</div>
                            </div>
                          )}
                        </div>

                        {/* Productos */}
                        <div className="mb-4 p-3 bg-[var(--surface-muted)] rounded-lg border border-[var(--border)]">
                          <h5 className="text-sm font-semibold text-[var(--foreground)] mb-2">
                            Productos:
                          </h5>
                          <div className="space-y-1">
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {patron.productos.map((prod: any, pidx: number) => (
                              <div key={`prod-${idx}-${pidx}-${prod.nombre}`} className="text-sm">
                                <span className="font-medium text-[var(--foreground)]">
                                  {prod.nombre}
                                </span>
                                <span className="text-[var(--text-muted)] ml-2">
                                  ({prod.rol})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Métricas */}
                        {patron.metricas && (
                          <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-[var(--surface-muted)] rounded-lg border-2 border-[var(--border)]">
                            <div>
                              <div className="text-xs font-medium text-[var(--text-muted)] mb-1">Ticket Actual</div>
                              <div className="text-xl font-bold text-[var(--foreground)]">
                                ${patron.metricas.ticket_promedio_actual?.toLocaleString('es-CL') || '0'}
                              </div>
                              <div className="text-xs text-[var(--text-muted)] mt-1">Promedio</div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-[var(--text-muted)] mb-1">Ticket con Combo</div>
                              <div className="text-xl font-bold text-green-600 dark:text-green-400">
                                ${patron.metricas.ticket_con_combo?.toLocaleString('es-CL') || '0'}
                              </div>
                              <div className="text-xs text-[var(--text-muted)] mt-1">Proyectado</div>
                            </div>
                            <div className="flex flex-col justify-center">
                              <div className="text-xs font-medium text-[var(--text-muted)] mb-1">Incremento</div>
                              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                                {patron.metricas.incremento_ticket 
                                  ? `+${patron.metricas.incremento_ticket.toFixed(1)}%` 
                                  : '+0%'}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Estrategias */}
                        {patron.estrategias && patron.estrategias.length > 0 && (
                          <div className="space-y-3">
                            <h5 className="text-sm font-semibold text-[var(--foreground)]">
                              Estrategias Recomendadas:
                            </h5>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {patron.estrategias.map((estrategia: any, eidx: number) => (
                              <div key={`estrategia-${idx}-${eidx}-${estrategia.tipo}`} className="border-l-4 border-purple-500 pl-4 py-2">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 text-xs font-medium rounded">
                                    {estrategia.tipo}
                                  </span>
                                  {estrategia.facilidad_implementacion && (() => {
                                    let facilidadClass = 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
                                    if (estrategia.facilidad_implementacion === 'fácil') {
                                      facilidadClass = 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
                                    } else if (estrategia.facilidad_implementacion === 'media') {
                                      facilidadClass = 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
                                    }
                                    return (
                                      <span className={`px-2 py-1 text-xs font-medium rounded ${facilidadClass}`}>
                                        {estrategia.facilidad_implementacion}
                                      </span>
                                    );
                                  })()}
                                </div>
                                <p className="text-sm text-[var(--foreground)] mb-2">
                                  {estrategia.descripcion}
                                </p>
                                {estrategia.ejemplo_frase && (
                                  <div className="bg-[var(--surface-muted)] p-2 rounded italic text-sm text-[var(--text-muted)]">
                                    💬 &quot;{estrategia.ejemplo_frase}&quot;
                                  </div>
                                )}
                                {estrategia.ganancia_mensual_proyectada && (
                                  <div className="mt-2 text-sm font-semibold text-green-600 dark:text-green-400">
                                    💰 Ganancia proyectada: +${estrategia.ganancia_mensual_proyectada.toLocaleString('es-CL')}/mes
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Top Estrategias */}
                    {insights.top_estrategias && insights.top_estrategias.length > 0 && (
                      <div className="bg-[var(--surface-muted)] border-2 border-green-500 rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
                          🏆 Top Estrategias por Impacto
                        </h3>
                        <div className="space-y-3">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {insights.top_estrategias.map((estrategia: any, idx: number) => (
                            <div key={`top-estrategia-${idx}-${estrategia.patron}`} className="flex items-center justify-between bg-[var(--surface)] p-3 rounded-lg">
                              <div className="flex-1">
                                <div className="font-semibold text-[var(--foreground)]">
                                  {idx + 1}. {estrategia.patron}
                                </div>
                                <div className="text-sm text-[var(--text-muted)]">
                                  {estrategia.estrategia}
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                                  +${estrategia.impacto.toLocaleString('es-CL')}
                                </div>
                                {(() => {
                                  let prioridadClass = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200';
                                  if (estrategia.prioridad === 'alta') {
                                    prioridadClass = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200';
                                  } else if (estrategia.prioridad === 'media') {
                                    prioridadClass = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200';
                                  }
                                  return (
                                    <span className={`text-xs px-2 py-1 rounded ${prioridadClass}`}>
                                      Prioridad {estrategia.prioridad}
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Render other insight types similarly... */}
                {/* For brevity, I'll add simplified versions */}
                
                {activeTab === 'canibalización' && insights.casos_detectados && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-[var(--foreground)]">
                      Casos de Canibalización Detectados
                    </h3>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {insights.casos_detectados.map((caso: any, idx: number) => (
                      <div key={`caso-${idx}-${caso.producto_a?.nombre}-${caso.producto_b?.nombre}`} className="bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg p-6 shadow-sm">
                        {/* Render canibalización details */}
                        <div className="mb-4">
                          <h4 className="font-bold text-lg text-[var(--foreground)] mb-4">
                            Comparación de Productos
                          </h4>
                          <div className="grid grid-cols-2 gap-6">
                            <div className="p-4 bg-[var(--surface-muted)] rounded-lg border-2 border-blue-500">
                              <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2">Producto A</div>
                              <div className="text-sm font-semibold text-[var(--foreground)] mb-3">{caso.producto_a.nombre}</div>
                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-sm text-[var(--text-muted)]">Ventas:</span>
                                  <span className="text-sm font-bold text-[var(--foreground)]">{caso.producto_a.ventas} unidades</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-[var(--text-muted)]">Margen:</span>
                                  <span className="text-sm font-bold text-green-600 dark:text-green-400">{caso.producto_a.margen.toFixed(1)}%</span>
                                </div>
                              </div>
                            </div>
                            <div className="p-4 bg-[var(--surface-muted)] rounded-lg border-2 border-purple-500">
                              <div className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-2">Producto B</div>
                              <div className="text-sm font-semibold text-[var(--foreground)] mb-3">{caso.producto_b.nombre}</div>
                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-sm text-[var(--text-muted)]">Ventas:</span>
                                  <span className="text-sm font-bold text-[var(--foreground)]">{caso.producto_b.ventas} unidades</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-[var(--text-muted)]">Margen:</span>
                                  <span className="text-sm font-bold text-green-600 dark:text-green-400">{caso.producto_b.margen.toFixed(1)}%</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        {caso.recomendacion && (
                          <div className="bg-[var(--surface-muted)] border-l-4 border-blue-500 p-4 rounded-r-lg">
                            <h5 className="font-semibold text-[var(--foreground)] mb-2 flex items-center gap-2">
                              <span className="text-blue-600 dark:text-blue-400">💡</span>
                              Recomendación:
                            </h5>
                            <p className="text-sm text-[var(--foreground)]">{caso.recomendacion.accion}</p>
                            {caso.recomendacion.ganancia_proyectada && (
                              <div className="mt-3 text-base font-bold text-green-600 dark:text-green-400">
                                💰 Ganancia proyectada: +${caso.recomendacion.ganancia_proyectada.toLocaleString('es-CL')}/mes
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
      </div>
    </div>
  );
}
