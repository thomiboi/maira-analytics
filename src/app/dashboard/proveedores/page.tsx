"use client";

import { useState, useMemo, useCallback } from "react";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useRouter } from "next/navigation";
import ProductStats from "@/components/suppliers/SupplierStats";
import ProductFilters from "@/components/suppliers/SupplierFilters";
import PriceComparison from "@/components/suppliers/PriceComparison";
import ProvidersManagement from "@/components/suppliers/ProvidersManagement";
import AIAnalysis from "@/components/suppliers/AIAnalysis";
import { formatPrice } from "@/lib/utils";
import {
  Product,
  ProductFilters as IProductFilters,
  StockStatus,
} from "@/types/supplier";
import React, { useEffect } from "react";

// Componente interno con toda la lógica
function ProveedoresContent() {
  // Estado para las pestañas
  const [activeTab, setActiveTab] = useState<"products" | "providers" | "ai-analysis">(
    "products"
  );

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<IProductFilters>({
    search: "",
    category: "",
    stockStatus: "",
    dataSource: "",
    minPrice: 0,
    maxPrice: Infinity,
    hasMultipleSuppliers: false,
    selectedSupplier: "", // Nuevo filtro
  });

  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const PRODUCTS_PER_PAGE = 20;

  // Transformar datos de la API al formato del componente
  const transformApiData = useCallback(
    (apiResponse: {
      productsData: Array<{
        productId: string;
        productName: string;
        ean: string | null;
        prices: Record<string, number>;
      }>;
      providerNames: string[];
    }): Product[] => {
      return apiResponse.productsData.map((apiProduct) => {
        const priceEntries = Object.entries(apiProduct.prices);
        const priceValues = priceEntries.map(([, price]) => price);

        const pricesArray = priceEntries.map(([supplierName, price]) => ({
          supplierId: supplierName,
          supplierName: supplierName,
          price: price,
          stock: 100,
          stockStatus: "high" as StockStatus,
          currency: "$",
          lastChecked: new Date().toISOString(),
          dataSource: "api" as const,
          isAvailable: true,
          deliveryTime: "Consultar con proveedor",
        }));

        return {
          id: apiProduct.productId,
          name: apiProduct.productName,
          description: `Producto farmacéutico`,
          category: "Medicamentos",
          sku: `SKU-${apiProduct.productId.slice(0, 8)}`,
          barcode: apiProduct.ean || "Sin EAN",
          lastUpdated: new Date().toISOString(),
          prices: pricesArray,
          lowestPrice: priceValues.length > 0 ? Math.min(...priceValues) : 0,
          highestPrice: priceValues.length > 0 ? Math.max(...priceValues) : 0,
          averagePrice:
            priceValues.length > 0
              ? priceValues.reduce((a, b) => a + b, 0) / priceValues.length
              : 0,
        };
      });
    },
    []
  );

  // Función para cargar datos desde la API
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      console.log("🔍 Cargando datos de /api/compare-prices...");

      const response = await fetch("/api/compare-prices");
      if (!response.ok) {
        throw new Error(
          `Error ${response.status}: No se pudieron cargar los datos`
        );
      }

      const apiData = await response.json();
      console.log("✅ Datos recibidos:", apiData);
      console.log(
        `📊 ${apiData.productsData?.length || 0} productos encontrados`
      );

      if (!apiData.productsData || apiData.productsData.length === 0) {
        console.warn("⚠️ No hay productos en la respuesta");
        setAllProducts([]);
        setError("No hay productos disponibles. Carga catálogos primero.");
        return;
      }

      const transformedProducts = transformApiData(apiData);
      console.log("✅ Productos transformados:", transformedProducts.length);
      setAllProducts(transformedProducts);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error desconocido";
      setError(errorMessage);
      console.error("❌ Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }, [transformApiData]);

  // Cargar datos al montar el componente
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Función para manejar cambios en proveedores
  const handleProvidersChange = useCallback(() => {
    console.log("🔄 Cambios detectados en proveedores, recargando datos...");
    fetchData();
  }, [fetchData]);

  // Filtrar productos
  const filteredProducts = useMemo(() => {
    return allProducts.filter((product) => {
      // Filtro de búsqueda
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          product.name.toLowerCase().includes(searchLower) ||
          (product.barcode &&
            product.barcode.toLowerCase().includes(searchLower)) ||
          (product.sku && product.sku.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }

      // Filtro de categoría
      if (filters.category && product.category !== filters.category) {
        return false;
      }

      // Filtro de rango de precios
      if (product.lowestPrice !== undefined) {
        if (
          product.lowestPrice < filters.minPrice ||
          product.lowestPrice > filters.maxPrice
        ) {
          return false;
        }
      }

      // Filtro de stock
      if (filters.stockStatus) {
        const hasStatus = product.prices.some(
          (p) => p.stockStatus === filters.stockStatus
        );
        if (!hasStatus) return false;
      }

      // Filtro de proveedores múltiples
      if (filters.hasMultipleSuppliers && product.prices.length <= 1) {
        return false;
      }

      // Filtro de proveedor específico
      if (filters.selectedSupplier) {
        const hasSupplier = product.prices.some(
          (p) => p.supplierName === filters.selectedSupplier
        );
        if (!hasSupplier) return false;
      }

      return true;
    });
  }, [allProducts, filters]);

  // Paginación: calcular productos a mostrar
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
    const endIndex = startIndex + PRODUCTS_PER_PAGE;
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, currentPage, PRODUCTS_PER_PAGE]);

  // Calcular total de páginas
  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);

  // Resetear a página 1 cuando cambien los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Calcular estadísticas
  const stats = useMemo(() => {
    const productsWithMultiple = allProducts.filter(
      (p) => p.prices.length > 1
    ).length;
    const allPrices = allProducts.flatMap((p) => p.prices);
    const lowStockCount = allPrices.filter(
      (p) => p.stockStatus === "low"
    ).length;
    const outOfStockCount = allPrices.filter(
      (p) => p.stockStatus === "out"
    ).length;

    // Calcular diferencia promedio de precios
    let totalDifference = 0;
    let productsWithMultiplePrices = 0;
    allProducts.forEach((product) => {
      if (
        product.prices.length > 1 &&
        product.highestPrice !== undefined &&
        product.lowestPrice !== undefined
      ) {
        totalDifference += product.highestPrice - product.lowestPrice;
        productsWithMultiplePrices++;
      }
    });

    const averagePriceDifference =
      productsWithMultiplePrices > 0
        ? totalDifference / productsWithMultiplePrices
        : 0;

    // Obtener proveedores únicos
    const uniqueSuppliers = new Set<string>();
    const excelSuppliersSet = new Set<string>();
    const webScrapingSuppliersSet = new Set<string>();

    allProducts.forEach((product) => {
      product.prices.forEach((price) => {
        uniqueSuppliers.add(price.supplierName);
        if (price.dataSource === "excel") {
          excelSuppliersSet.add(price.supplierName);
        } else if (price.dataSource === "web-scraping") {
          webScrapingSuppliersSet.add(price.supplierName);
        }
      });
    });

    return {
      totalProducts: allProducts.length,
      productsWithMultipleSuppliers: productsWithMultiple,
      lowStockAlerts: lowStockCount,
      outOfStockCount: outOfStockCount,
      averagePriceDifference: averagePriceDifference,
      totalSuppliers: uniqueSuppliers.size,
      excelSuppliers: excelSuppliersSet.size,
      webScrapingSuppliers: webScrapingSuppliersSet.size,
    };
  }, [allProducts]);

  // Obtener lista de proveedores únicos para el filtro
  const availableSuppliers = useMemo(() => {
    const suppliers = new Set<string>();
    allProducts.forEach((product) => {
      product.prices.forEach((price) => {
        suppliers.add(price.supplierName);
      });
    });
    return Array.from(suppliers).sort();
  }, [allProducts]);

  // Renderizar componente de carga si está cargando (solo afecta pestaña de productos)
  const LoadingView = () => (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">
          Cargando comparación de precios...
        </p>
      </div>
    </div>
  );

  // Renderizar componente de error (solo afecta pestaña de productos)
  const ErrorView = () => (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
      <div className="text-4xl mb-4">⚠️</div>
      <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">
        Error al Cargar Datos
      </h3>
      <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
      >
        Reintentar
      </button>
    </div>
  );

  // Renderizar componente de sin productos (solo afecta pestaña de productos)
  const NoProductsView = () => (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
      <div className="text-4xl mb-4">📦</div>
      <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
        No Hay Productos Disponibles
      </h3>
      <p className="text-yellow-600 dark:text-yellow-400 mb-4">
        Aún no se han cargado catálogos de proveedores. Ve a la pestaña
        &quot;Gestión de Proveedores&quot; para agregar proveedores o sube
        archivos Excel para comenzar.
      </p>
      <div className="flex gap-3 justify-center mt-4">
        <button
          onClick={() => setActiveTab("providers")}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          🏢 Ir a Gestión de Proveedores
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      {/* Pestañas de navegación */}
      <div className="mb-6">
        <div className="border-b border-[var(--border)]">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("products")}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${
                  activeTab === "products"
                    ? "border-red-500 text-red-600 dark:text-red-400"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--foreground)] hover:border-[var(--border)]"
                }
              `}
            >
              📊 Comparación de Precios
            </button>
            <button
              onClick={() => setActiveTab("providers")}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${
                  activeTab === "providers"
                    ? "border-red-500 text-red-600 dark:text-red-400"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--foreground)] hover:border-[var(--border)]"
                }
              `}
            >
              🏢 Gestión de Proveedores
            </button>
            <button
              onClick={() => setActiveTab("ai-analysis")}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${
                  activeTab === "ai-analysis"
                    ? "border-red-500 text-red-600 dark:text-red-400"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--foreground)] hover:border-[var(--border)]"
                }
              `}
            >
              ✨ Análisis con IA
            </button>
          </nav>
        </div>
      </div>

      {/* Contenido según la pestaña activa */}
      {activeTab === "providers" ? (
        <ProvidersManagement onProvidersChange={handleProvidersChange} />
      ) : activeTab === "ai-analysis" ? (
        <AIAnalysis />
      ) : (
        <>
          {/* Mostrar estados de carga/error/sin productos solo en pestaña de comparación */}
          {loading ? (
            <LoadingView />
          ) : error ? (
            <ErrorView />
          ) : allProducts.length === 0 ? (
            <NoProductsView />
          ) : (
            <>
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Comparación de Precios de Proveedores
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                      Compara precios de {stats.totalSuppliers} proveedores en{" "}
                      {allProducts.length} productos
                    </p>
                  </div>
                </div>
              </div>

              <ProductStats stats={stats} />
              <ProductFilters
                filters={filters}
                onFilterChange={setFilters}
                availableSuppliers={availableSuppliers}
              />

              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Mostrando{" "}
                  <span className="font-semibold">
                    {filteredProducts.length > 0
                      ? (currentPage - 1) * PRODUCTS_PER_PAGE + 1
                      : 0}
                  </span>{" "}
                  -{" "}
                  <span className="font-semibold">
                    {Math.min(
                      currentPage * PRODUCTS_PER_PAGE,
                      filteredProducts.length
                    )}
                  </span>{" "}
                  de{" "}
                  <span className="font-semibold">
                    {filteredProducts.length}
                  </span>{" "}
                  productos
                  {filteredProducts.length !== allProducts.length &&
                    ` (filtrados de ${allProducts.length} totales)`}
                </div>
              </div>

              <div className="space-y-4">
                {paginatedProducts.map((product) => (
                  <div
                    key={product.id}
                    className="bg-[var(--surface)] rounded-lg border border-[var(--border)] p-6"
                  >
                    <div className="mb-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1">
                            {product.name}
                          </h3>
                          {product.description && (
                            <p className="text-sm text-[var(--text-muted)]">
                              {product.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-[var(--text-muted)]">
                        {product.barcode && product.barcode !== "Sin EAN" && (
                          <div className="flex items-center gap-1">
                            <span className="font-mono">{product.barcode}</span>
                          </div>
                        )}
                        {product.sku && (
                          <div className="flex items-center gap-1">
                            <span>SKU: {product.sku}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <span>
                            {product.prices.length} proveedor
                            {product.prices.length !== 1 ? "es" : ""}
                          </span>
                        </div>
                      </div>
                    </div>

                    <PriceComparison prices={product.prices} />

                    {product.prices.length > 1 && (
                      <div className="mt-4 pt-4 border-t border-[var(--border)]">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-[var(--text-muted)]">
                              Precio más bajo:
                            </span>
                            <div className="text-lg font-bold text-green-600 dark:text-green-400">
                              {formatPrice(product.lowestPrice || 0)}
                            </div>
                          </div>
                          <div>
                            <span className="text-[var(--text-muted)]">
                              Precio promedio:
                            </span>
                            <div className="text-lg font-semibold text-[var(--foreground)]">
                              {formatPrice(product.averagePrice || 0)}
                            </div>
                          </div>
                          <div>
                            <span className="text-[var(--text-muted)]">
                              Ahorro potencial:
                            </span>
                            <div className="text-lg font-bold text-red-600 dark:text-red-400">
                              {formatPrice(
                                (product.highestPrice || 0) -
                                  (product.lowestPrice || 0)
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Controles de paginación */}
              {filteredProducts.length > PRODUCTS_PER_PAGE && (
                <div className="mt-6 flex items-center justify-between border-t border-[var(--border)] pt-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm rounded border border-[var(--border)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--surface-muted)]"
                    >
                      Primera
                    </button>
                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(1, prev - 1))
                      }
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm rounded border border-[var(--border)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--surface-muted)]"
                    >
                      Anterior
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--text-muted)]">
                      Página {currentPage} de {totalPages}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-500">
                      ({(currentPage - 1) * PRODUCTS_PER_PAGE + 1}-
                      {Math.min(
                        currentPage * PRODUCTS_PER_PAGE,
                        filteredProducts.length
                      )}{" "}
                      de {filteredProducts.length})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm rounded border border-[var(--border)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--surface-muted)]"
                    >
                      Siguiente
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm rounded border border-[var(--border)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--surface-muted)]"
                    >
                      Última
                    </button>
                  </div>
                </div>
              )}

              {filteredProducts.length === 0 && (
                <div className="text-center py-12 text-[var(--text-muted)]">
                  No se encontraron productos que coincidan con los filtros
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function ProveedoresPage() {
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const router = useRouter();

  const canReadProveedores = hasPermission("proveedores", "read");

  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Verificando permisos...
          </p>
        </div>
      </div>
    );
  }

  if (!canReadProveedores) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Acceso Restringido
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            No tienes permisos para acceder a la gestión de proveedores.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <ProveedoresContent />;
}
