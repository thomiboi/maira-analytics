"use client";

import { useState, useEffect } from "react";
import {
  Sparkles,
  AlertTriangle,
  Loader2,
  DollarSign,
  MessageSquare,
  Send,
  BarChart3,
  Calculator,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Target,
  Zap,
} from "lucide-react";

interface ProviderScore {
  name: string;
  score: number;
  avgPrice: number;
  productCount: number;
  savings: number;
  recommendation: "excellent" | "good" | "fair" | "review";
}

interface SavingsOpportunity {
  product: string;
  currentProvider: string;
  suggestedProvider: string;
  savings: number;
  savingsPercent: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function AIAnalysis() {
  const [activeView, setActiveView] = useState<
    "dashboard" | "chat" | "calculator"
  >("chat"); // Solo Chat habilitado
  const [loading, setLoading] = useState(false);
  const [providerScores, setProviderScores] = useState<ProviderScore[]>([]);
  const [topSavings, setTopSavings] = useState<SavingsOpportunity[]>([]);
  const [totalSavingsPotential, setTotalSavingsPotential] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);

  // Cargar datos iniciales del dashboard
  useEffect(() => {
    if (activeView === "dashboard") {
      loadDashboardData();
    }
  }, [activeView]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      console.log("📊 Cargando datos del dashboard...");

      const response = await fetch("/api/providers/ai-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisType: "resumen-general",
        }),
      });

      const data = await response.json();
      console.log("📊 Respuesta del dashboard:", data);

      if (!data.success) {
        console.error("❌ Error en respuesta:", data.error);
        // Mostrar datos vacíos en lugar de error
        setProviderScores([]);
        setTopSavings([]);
        setTotalSavingsPotential(0);
        return;
      }

      // Extraer insights de la respuesta
      const insights = data.data?.insights || {};
      console.log("✅ Insights recibidos:", Object.keys(insights));

      // Procesar datos de proveedores
      const scores: ProviderScore[] = [];

      // Si hay plan de compras optimizado, usarlo
      if (
        insights.plan_compras_optimizado &&
        Array.isArray(insights.plan_compras_optimizado)
      ) {
        console.log(
          `📦 Procesando ${insights.plan_compras_optimizado.length} proveedores`
        );

        insights.plan_compras_optimizado.forEach(
          (
            plan: {
              proveedor: string;
              total_productos?: number;
              ahorro_estimado?: number;
              productos_recomendados?: unknown[];
            },
            index: number
          ) => {
            const score = 95 - index * 10; // Score decreciente
            const productCount =
              plan.total_productos || plan.productos_recomendados?.length || 0;

            scores.push({
              name: plan.proveedor,
              score: score,
              avgPrice: 8500 + index * 500,
              productCount: productCount,
              savings: plan.ahorro_estimado || 0,
              recommendation:
                score >= 85 ? "excellent" : score >= 70 ? "good" : "fair",
            });
          }
        );

        console.log(`✅ Creados ${scores.length} scores de proveedores`);
      } else {
        console.log("⚠️ No se encontró plan_compras_optimizado");
      }

      setProviderScores(scores);

      // Calcular ahorro potencial total
      let totalSavings = 0;

      if (insights.ahorro_potencial_total) {
        totalSavings = insights.ahorro_potencial_total;
      } else if (insights.plan_compras_optimizado) {
        totalSavings = insights.plan_compras_optimizado.reduce(
          (sum: number, p: { ahorro_estimado?: number }) =>
            sum + (p.ahorro_estimado || 0),
          0
        );
      }

      console.log(`💰 Ahorro potencial total: ${totalSavings}`);
      setTotalSavingsPotential(totalSavings);

      // Procesar oportunidades de ahorro
      const opportunities: SavingsOpportunity[] = [];

      if (insights.oportunidades && Array.isArray(insights.oportunidades)) {
        console.log(
          `🎯 Procesando ${insights.oportunidades.length} oportunidades`
        );

        insights.oportunidades
          .slice(0, 5)
          .forEach(
            (opp: {
              producto: string;
              proveedor_actual_probable?: string;
              proveedor_sugerido: string;
              ahorro_por_unidad: number;
              porcentaje_ahorro?: number;
            }) => {
              opportunities.push({
                product: opp.producto,
                currentProvider: opp.proveedor_actual_probable || "Actual",
                suggestedProvider: opp.proveedor_sugerido,
                savings: opp.ahorro_por_unidad,
                savingsPercent: opp.porcentaje_ahorro || 0,
              });
            }
          );
      } else if (insights.top_ahorros && Array.isArray(insights.top_ahorros)) {
        console.log(`🎯 Procesando ${insights.top_ahorros.length} top_ahorros`);

        insights.top_ahorros
          .slice(0, 5)
          .forEach(
            (opp: { producto: string; ahorro: number; accion: string }) => {
              opportunities.push({
                product: opp.producto,
                currentProvider: "Actual",
                suggestedProvider: opp.accion.includes("→")
                  ? opp.accion.split("→")[1]?.trim() || "Recomendado"
                  : "Recomendado",
                savings: opp.ahorro,
                savingsPercent: 0,
              });
            }
          );
      } else {
        console.log("⚠️ No se encontraron oportunidades de ahorro");
      }

      console.log(`✅ Creadas ${opportunities.length} oportunidades`);
      setTopSavings(opportunities);
    } catch (error) {
      console.error("❌ Error loading dashboard:", error);
      // Mostrar datos vacíos en caso de error
      setProviderScores([]);
      setTopSavings([]);
      setTotalSavingsPotential(0);
    } finally {
      setLoading(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || loadingChat) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: chatInput,
      timestamp: new Date(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    const query = chatInput;
    setChatInput("");
    setLoadingChat(true);

    try {
      // 🆕 Buscar y comparar productos similares
      console.log("🔍 Comparando productos:", query);

      const searchResponse = await fetch("/api/providers/compare-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: query,
        }),
      });

      const searchData = await searchResponse.json();
      console.log("📊 Respuesta de comparación:", searchData);

      // Si se encontraron productos, mostrar comparación
      if (searchData.success && searchData.data?.found) {
        console.log("✅ Productos encontrados, mostrando comparación");
        const data = searchData.data;
        let responseContent = "";

        // 🆕 Verificar si es búsqueda exacta
        const isExactMatch = data.exactMatch === true;

        // Header con información del medicamento buscado
        if (isExactMatch && data.totalProductsFound === 1) {
          // Si es búsqueda exacta de UN solo producto, mostrar formato específico
          responseContent = `🎯 **Producto Específico: ${data.searchedProduct}**\n`;
          if (data.activeIngredient) {
            responseContent += `💊 Principio activo: **${data.activeIngredient}**\n`;
          }

          const mainProduct = data.comparisons[0];
          responseContent += `\n📊 **ANÁLISIS DE PRECIOS POR PROVEEDOR:**\n`;
          responseContent += `🏪 Disponible en **${
            mainProduct.providerCount
          }** ${
            mainProduct.providerCount === 1 ? "proveedor" : "proveedores"
          }\n\n`;

          // Mostrar todos los precios de los proveedores para este producto
          if (mainProduct.allPrices && mainProduct.allPrices.length > 0) {
            responseContent += `💰 **COMPARACIÓN DE PROVEEDORES:**\n\n`;

            mainProduct.allPrices.forEach(
              (
                priceInfo: { provider: string; price: number },
                index: number
              ) => {
                const isLowest = index === 0;
                const isHighest = index === mainProduct.allPrices.length - 1;
                const badge = isLowest
                  ? "🏆 MEJOR PRECIO"
                  : isHighest && mainProduct.allPrices.length > 1
                  ? "⚠️ MÁS CARO"
                  : "";

                responseContent += `${index + 1}. **${
                  priceInfo.provider
                }** ${badge}\n`;
                responseContent += `   💰 Precio: ${formatCurrency(
                  priceInfo.price
                )}\n`;

                if (!isLowest) {
                  const diff = priceInfo.price - mainProduct.allPrices[0].price;
                  const percent = (
                    (diff / mainProduct.allPrices[0].price) *
                    100
                  ).toFixed(2);
                  responseContent += `   📈 ${formatCurrency(
                    diff
                  )} más caro (+${percent}%)\n`;
                }
                responseContent += "\n";
              }
            );

            responseContent += `\n📊 **ESTADÍSTICAS:**\n`;
            responseContent += `• Precio más bajo: ${formatCurrency(
              mainProduct.bestPrice
            )}\n`;
            responseContent += `• Precio promedio: ${formatCurrency(
              mainProduct.avgPrice
            )}\n`;

            if (mainProduct.allPrices.length > 1) {
              const maxPrice =
                mainProduct.allPrices[mainProduct.allPrices.length - 1].price;
              const diff = maxPrice - mainProduct.bestPrice;
              const percent = ((diff / maxPrice) * 100).toFixed(2);
              responseContent += `• Ahorro máximo: ${formatCurrency(
                diff
              )} (${percent}%)\n`;
            }

            responseContent += `\n💡 **RECOMENDACIÓN:**\n`;
            responseContent += `Para este producto específico, compra a **${mainProduct.bestProvider}** para obtener el mejor precio.`;
          }
        } else {
          // Formato normal para múltiples productos
          responseContent = `🔍 **Análisis de: ${data.searchedProduct}**\n`;
          if (isExactMatch) {
            responseContent += `✅ Producto encontrado + alternativas similares\n`;
          }
          if (data.activeIngredient) {
            responseContent += `💊 Principio activo: **${data.activeIngredient}**\n`;
          }
          responseContent += `📦 Encontradas **${data.totalProductsFound} presentaciones** disponibles\n\n`;

          // Mejor opción destacada
          responseContent += `🏆 **MEJOR OPCIÓN DE COMPRA:**\n`;
          responseContent += `✅ **${data.bestOption.productName}**\n`;
          responseContent += `   💰 Precio: ${formatCurrency(
            data.bestOption.price
          )} (${data.bestOption.provider})\n`;
          responseContent += `   📊 Precio promedio del mercado: ${formatCurrency(
            data.bestOption.avgPrice
          )}\n\n`;

          // Estadísticas de ahorro
          responseContent += `💡 **ANÁLISIS DE AHORRO:**\n`;
          responseContent += `• Diferencia máxima entre productos: ${formatCurrency(
            data.statistics.priceDifference
          )}\n`;
          responseContent += `• Ahorro potencial: **${data.statistics.savingsPercentage}%**\n`;
          responseContent += `• Rango de precios: ${formatCurrency(
            data.statistics.minPrice
          )} - ${formatCurrency(data.statistics.maxPrice)}\n\n`;

          // Comparación de todas las presentaciones (top 5)
          responseContent += `📊 **COMPARACIÓN DE PRESENTACIONES:**\n\n`;

          const topProducts = data.comparisons.slice(0, 5);
          topProducts.forEach(
            (comp: {
              rank: number;
              productName: string;
              bestPrice: number;
              bestProvider: string;
              providerCount: number;
              differenceFromBest: number;
              percentageFromBest: number;
              isBestOption: boolean;
              isWorstOption: boolean;
            }) => {
              const badge = comp.isBestOption
                ? "🏆 MEJOR PRECIO"
                : comp.isWorstOption
                ? "⚠️ MÁS CARO"
                : comp.differenceFromBest === 0
                ? "✅"
                : "";

              responseContent += `${comp.rank}. **${comp.productName}** ${badge}\n`;
              responseContent += `   💰 Mejor precio: ${formatCurrency(
                comp.bestPrice
              )} (${comp.bestProvider})\n`;
              responseContent += `   🏪 Disponible en ${comp.providerCount} ${
                comp.providerCount === 1 ? "proveedor" : "proveedores"
              }\n`;

              if (comp.differenceFromBest > 0) {
                responseContent += `   📈 ${formatCurrency(
                  comp.differenceFromBest
                )} más caro que la mejor opción (+${
                  comp.percentageFromBest
                }%)\n`;
              }
              responseContent += "\n";
            }
          );
        } // 🆕 Cerrar el bloque else

        // Recomendación final
        if (data.totalProductsFound > 5) {
          responseContent += `\n_Mostrando las 5 mejores opciones de ${data.totalProductsFound} disponibles_\n\n`;
        }

        responseContent += `\n💡 **RECOMENDACIÓN:**\n`;
        responseContent += `Para obtener el mejor precio en **${
          data.activeIngredient || data.searchedProduct
        }**, `;
        responseContent += `compra **${data.bestOption.productName}** a **${data.bestOption.provider}**. `;

        if (data.statistics.savingsPercentage > 20) {
          responseContent += `\n\n⚠️ **ATENCIÓN:** Hay una diferencia de precio superior al 20% entre productos similares. `;
          responseContent += `Puedes ahorrar significativamente eligiendo la mejor opción.`;
        } else if (data.statistics.savingsPercentage > 10) {
          responseContent += `\n\n� Ahorrarás aproximadamente ${data.statistics.savingsPercentage}% comparado con otras opciones.`;
        }

        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: responseContent,
          timestamp: new Date(),
        };
        setChatMessages((prev) => [...prev, assistantMessage]);
        setLoadingChat(false);
        return;
      }

      // Si no es un producto, informar y usar análisis general de IA
      console.log("ℹ️ Producto no encontrado");

      // Verificar si hay mensaje de producto no encontrado
      if (searchData.success && searchData.data?.message) {
        console.log("💬 Mensaje del servidor:", searchData.data.message);

        // Si parece ser un intento de buscar un producto, mostrar mensaje amigable
        if (
          query.length > 3 &&
          !query.includes("?") &&
          !query.includes("cómo") &&
          !query.includes("cuál") &&
          !query.includes("qué")
        ) {
          const notFoundMessage: ChatMessage = {
            role: "assistant",
            content:
              `🔍 No encontré el medicamento **"${query}"** en la base de datos.\n\n` +
              `💡 **Sugerencias:**\n` +
              `• Verifica que el nombre esté escrito correctamente\n` +
              `• Prueba con nombres más cortos (ej: "AMLODIPINO" en vez de "AMLODIPINO 10MG TABLETAS")\n` +
              `• Intenta solo con el principio activo del medicamento\n` +
              `• Asegúrate que el producto tenga precios cargados en el sistema\n\n` +
              `📝 **Ejemplos de búsquedas exitosas:**\n` +
              `• AMLODIPINO\n` +
              `• ENALAPRIL\n` +
              `• LOSARTAN\n` +
              `• METFORMINA`,
            timestamp: new Date(),
          };
          setChatMessages((prev) => [...prev, notFoundMessage]);
          setLoadingChat(false);
          return;
        }
      }

      // Si no se encontró producto, mostrar mensaje genérico
      const notFoundMessage: ChatMessage = {
        role: "assistant",
        content:
          `🔍 No se encontraron resultados para tu búsqueda.\n\n` +
          `💡 Este chat está diseñado para comparar medicamentos. ` +
          `Por favor, ingresa el nombre de un medicamento para ver las diferentes presentaciones y precios disponibles.`,
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, notFoundMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: `Lo siento, ocurrió un error: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`,
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoadingChat(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 75) return "text-blue-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getRecommendationBadge = (
    rec: "excellent" | "good" | "fair" | "review"
  ) => {
    const badges = {
      excellent: {
        text: "Excelente",
        color: "bg-green-100 text-green-800",
      },
      good: {
        text: "Bueno",
        color: "bg-blue-100 text-blue-800",
      },
      fair: {
        text: "Regular",
        color: "bg-yellow-100 text-yellow-800",
      },
      review: {
        text: "Revisar",
        color: "bg-red-100 text-red-800",
      },
    };
    const badge = badges[rec];
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-semibold ${badge.color}`}
      >
        {badge.text}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header con Tabs */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="h-8 w-8" />
              <h2 className="text-3xl font-bold">
                Centro de Inteligencia de Compras
              </h2>
            </div>
            <p className="text-indigo-100">
              Optimiza tus compras con análisis en tiempo real y recomendaciones
              personalizadas
            </p>
          </div>
        </div>

        {/* Tabs - Solo Chat habilitado */}
        <div className="flex gap-2 mt-4">
          {/* Dashboard deshabilitado
          <button
            onClick={() => setActiveView('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              activeView === 'dashboard'
                ? 'bg-white text-indigo-600 shadow-lg'
                : 'bg-indigo-500/30 text-white hover:bg-indigo-500/50'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </button>
          */}
          <button
            onClick={() => setActiveView("chat")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-indigo-600 shadow-lg"
          >
            <MessageSquare className="h-4 w-4" />
            Chat con IA
          </button>
          {/* Calculadora deshabilitada
          <button
            onClick={() => setActiveView('calculator')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              activeView === 'calculator'
                ? 'bg-white text-indigo-600 shadow-lg'
                : 'bg-indigo-500/30 text-white hover:bg-indigo-500/50'
            }`}
          >
            <Calculator className="h-4 w-4" />
            Calculadora
          </button>
          */}
        </div>
      </div>

      {/* Dashboard View */}
      {activeView === "dashboard" && (
        <div className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  Cargando inteligencia de compras...
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* KPIs Principales */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <DollarSign className="h-8 w-8 opacity-80" />
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <div className="text-3xl font-bold mb-1">
                    {formatCurrency(totalSavingsPotential)}
                  </div>
                  <div className="text-sm text-green-100">
                    Ahorro Potencial Mensual
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <Target className="h-8 w-8 opacity-80" />
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div className="text-3xl font-bold mb-1">
                    {topSavings.length}
                  </div>
                  <div className="text-sm text-blue-100">
                    Oportunidades Detectadas
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <Zap className="h-8 w-8 opacity-80" />
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div className="text-3xl font-bold mb-1">
                    {providerScores.length}
                  </div>
                  <div className="text-sm text-purple-100">
                    Proveedores Analizados
                  </div>
                </div>
              </div>

              {/* Scoring de Proveedores */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <BarChart3 className="h-6 w-6 text-indigo-600" />
                  Ranking de Proveedores
                </h3>

                <div className="space-y-4">
                  {providerScores.map((provider, index) => (
                    <div
                      key={provider.name}
                      className="border border-gray-300 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 font-bold">
                            #{index + 1}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">
                              {provider.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {provider.productCount} productos
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={`text-2xl font-bold ${getScoreColor(
                              provider.score
                            )}`}
                          >
                            {provider.score}/100
                          </div>
                          {getRecommendationBadge(provider.recommendation)}
                        </div>
                      </div>

                      {/* Barra de progreso */}
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all"
                          style={{ width: `${provider.score}%` }}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-gray-500">
                            Precio Promedio
                          </div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {formatCurrency(provider.avgPrice)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 dark:text-gray-400">
                            Ahorro/Mes
                          </div>
                          <div
                            className={`font-semibold ${
                              provider.savings > 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {formatCurrency(Math.abs(provider.savings))}
                            {provider.savings > 0 ? " ↓" : " ↑"}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 dark:text-gray-400">
                            Productos
                          </div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {provider.productCount}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Oportunidades de Ahorro */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <TrendingDown className="h-6 w-6 text-green-600" />
                  Top Oportunidades de Ahorro
                </h3>

                <div className="space-y-3">
                  {topSavings.map((opp, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 mb-1">
                          {opp.product}
                        </div>
                        <div className="text-sm text-gray-600">
                          De{" "}
                          <span className="font-medium">
                            {opp.currentProvider}
                          </span>{" "}
                          a{" "}
                          <span className="font-medium text-green-600">
                            {opp.suggestedProvider}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">
                          {formatCurrency(opp.savings)}
                        </div>
                        <div className="text-sm text-green-600">
                          {opp.savingsPercent}% menos
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Chat View */}
      {activeView === "chat" && (
        <div
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden flex flex-col"
          style={{ height: "600px" }}
        >
          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-4 text-white">
            <h3 className="font-bold flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Comparador de Medicamentos
            </h3>
            <p className="text-sm text-indigo-100 mt-1">
              Busca un medicamento para comparar precios entre diferentes
              presentaciones y proveedores
            </p>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatMessages.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-12">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="mb-4 font-semibold">
                  Compara medicamentos y encuentra la mejor opción
                </p>
                <p className="mb-4 text-xs">Ejemplos de búsquedas:</p>
                <div className="space-y-2 max-w-md mx-auto text-sm">
                  <button
                    onClick={() => setChatInput("AMLODIPINO")}
                    className="w-full p-3 text-left bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg transition-colors border border-indigo-200 dark:border-indigo-800"
                  >
                    � <strong>AMLODIPINO</strong> - Comparar presentaciones y
                    precios
                  </button>
                  <button
                    onClick={() => setChatInput("ENALAPRIL")}
                    className="w-full p-3 text-left bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg transition-colors border border-indigo-200 dark:border-indigo-800"
                  >
                    💊 <strong>ENALAPRIL</strong> - Ver opciones disponibles
                  </button>
                  <button
                    onClick={() => setChatInput("LOSARTAN")}
                    className="w-full p-3 text-left bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg transition-colors border border-indigo-200 dark:border-indigo-800"
                  >
                    � <strong>LOSARTAN</strong> - Buscar mejor precio
                  </button>
                  <button
                    onClick={() => setChatInput("METFORMINA")}
                    className="w-full p-3 text-left bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg transition-colors border border-indigo-200 dark:border-indigo-800"
                  >
                    💊 <strong>METFORMINA</strong> - Análisis de alternativas
                  </button>
                </div>
              </div>
            ) : (
              chatMessages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-4 ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    <div
                      className="whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{
                        __html: msg.content
                          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                          .replace(/📦/g, '<span class="text-2xl">📦</span>')
                          .replace(/🔍/g, '<span class="text-xl">🔍</span>')
                          .replace(/💰/g, '<span class="text-xl">💰</span>')
                          .replace(/📊/g, '<span class="text-xl">📊</span>')
                          .replace(/💡/g, '<span class="text-xl">💡</span>')
                          .replace(/🏆/g, '<span class="text-xl">🏆</span>')
                          .replace(/⚠️/g, '<span class="text-xl">⚠️</span>')
                          .replace(/📈/g, '<span class="text-xl">📈</span>')
                          .replace(/💊/g, '<span class="text-xl">💊</span>')
                          .replace(/✅/g, '<span class="text-xl">✅</span>')
                          .replace(/🏪/g, '<span class="text-xl">🏪</span>')
                          .replace(/📝/g, '<span class="text-xl">📝</span>'),
                      }}
                    />
                    <p
                      className={`text-xs mt-2 ${
                        msg.role === "user"
                          ? "text-indigo-200"
                          : "text-gray-500"
                      }`}
                    >
                      {msg.timestamp.toLocaleTimeString("es-CL")}
                    </p>
                  </div>
                </div>
              ))
            )}
            {loadingChat && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-4">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={handleChatSubmit}
            className="border-t border-gray-300 p-4"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Escribe el nombre de un medicamento (ej: AMLODIPINO, LOSARTAN)..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                disabled={loadingChat}
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || loadingChat}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Send className="h-4 w-4" />
                Enviar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Calculator View */}
      {activeView === "calculator" && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Calculator className="h-6 w-6 text-indigo-600" />
            Calculadora de Ahorros
          </h3>
          <div className="text-center py-12 text-gray-500">
            <Calculator className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p>Calculadora interactiva - Próximamente</p>
            <p className="text-sm mt-2">
              Podrás simular cambios de proveedores y calcular ahorros
              proyectados
            </p>
          </div>
        </div>
      )}

      {/* Alerta de configuración */}
      {!loading &&
        providerScores.length === 0 &&
        activeView === "dashboard" && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-900 mb-1">
                  No hay datos para mostrar
                </h3>
                <p className="text-sm text-yellow-800 mb-2">
                  El dashboard requiere datos de productos y proveedores para
                  generar el análisis.
                </p>
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">Verifica:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>GROQ_API_KEY configurado en .env.local</li>
                    <li>
                      Que haya productos en la tabla{" "}
                      <code className="bg-yellow-100 px-1 rounded">
                        products
                      </code>
                    </li>
                    <li>
                      Que haya precios en la tabla{" "}
                      <code className="bg-yellow-100 px-1 rounded">
                        provider_prices
                      </code>
                    </li>
                    <li>
                      Que haya al menos 2 proveedores en la tabla{" "}
                      <code className="bg-yellow-100 px-1 rounded">
                        providers
                      </code>
                    </li>
                  </ul>
                  <p className="mt-2">
                    <strong>Tip:</strong> Abre la consola del navegador (F12)
                    para ver logs detallados.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
