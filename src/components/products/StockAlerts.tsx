"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Save, AlertTriangle, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import Toast, { ToastType } from "@/components/ui/Toast";

// Interfaces
interface StockInfo {
  bodega_id: number;
  cantidad: number;
  ubicacion: string;
  reservas: boolean;
  maximo: number | null;
  critico: number | null;
}

interface StockMinimo {
  producto_id: string;
  bodega_id: string;
  stock_minimo: string; // Decimal comes as string from API
}

interface Product {
  id: string;
  nombre: string;
  codigo: string;
  stocks: StockInfo[];
  stock_minimo: StockMinimo[];
}

interface ApiResponse {
  success: boolean;
  products: Product[];
  total: number;
  error?: string;
}

export default function StockAlerts() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") || "";
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Local state for edits before saving
  const [edits, setEdits] = useState<Record<string, number>>({});

  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
    subtitle?: string;
  } | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);

      const response = await fetch(`/api/stock-alerts?${params.toString()}`);
      const data: ApiResponse = await response.json();

      if (data.success) {
        setProducts(data.products);
        checkStockLevels(data.products);
      } else {
        console.error("Error fetching products:", data.error);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, fetchProducts]);

  // Helper to get bodega name
  const getBodegaName = (bodegaId: number) => {
    const names: Record<number, string> = {
      2723: "Casa Matriz",
      4012: "FM Villa Independencia",
    };
    return names[bodegaId] || `Bodega ${bodegaId}`;
  };

  // Check stock levels and notify
  const checkStockLevels = (productsToCheck: Product[]) => {
    let lowStockCount = 0;

    productsToCheck.forEach((product) => {
      if (!product.stocks || !Array.isArray(product.stocks)) return;

      product.stocks.forEach((stock) => {
        const minStockEntry = product.stock_minimo.find(
          (sm) => sm.bodega_id === stock.bodega_id.toString()
        );

        const minStock = minStockEntry
          ? parseFloat(minStockEntry.stock_minimo)
          : 0;

        if (minStock > 0 && stock.cantidad <= minStock) {
          lowStockCount++;
        }
      });
    });

    if (lowStockCount > 0) {
      setToast({
        message: "Alerta de Stock Bajo",
        type: "error",
        subtitle: `${lowStockCount} productos están por debajo del stock mínimo`,
      });
    }
  };

  const handleMinStockChange = (
    productId: string,
    bodegaId: number,
    value: string
  ) => {
    const key = `${productId}-${bodegaId}`;
    setEdits((prev) => ({
      ...prev,
      [key]: parseFloat(value) || 0,
    }));
  };

  const saveMinStock = async (productId: string, bodegaId: number) => {
    const key = `${productId}-${bodegaId}`;
    const newValue = edits[key];

    if (newValue === undefined) return;

    try {
      setSavingId(key);

      const response = await fetch("/api/stock-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producto_id: productId,
          bodega_id: bodegaId,
          stock_minimo: newValue,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update local state
        setProducts((prev) =>
          prev.map((p) => {
            if (p.id === productId) {
              const existingMinIdx = p.stock_minimo.findIndex(
                (sm) => sm.bodega_id === bodegaId.toString()
              );
              const newMinStock = {
                producto_id: productId,
                bodega_id: bodegaId.toString(),
                stock_minimo: newValue.toString(),
              };

              const newStockMinimo = [...p.stock_minimo];
              if (existingMinIdx >= 0) {
                newStockMinimo[existingMinIdx] = newMinStock;
              } else {
                newStockMinimo.push(newMinStock);
              }

              return { ...p, stock_minimo: newStockMinimo };
            }
            return p;
          })
        );

        // Check if this specific update caused a low stock alert
        const product = products.find((p) => p.id === productId);
        const stock = product?.stocks.find((s) => s.bodega_id === bodegaId);

        if (stock && stock.cantidad <= newValue) {
          setToast({
            message: "Stock Crítico Detectado",
            type: "error",
            subtitle: `El stock actual (${stock.cantidad}) es menor o igual al mínimo (${newValue})`,
          });
        } else {
          setToast({
            message: "Configuración Guardada",
            type: "success",
            subtitle: "El stock mínimo se ha actualizado correctamente",
          });
        }

        // Clear edit
        const newEdits = { ...edits };
        delete newEdits[key];
        setEdits(newEdits);
      }
    } catch (error) {
      console.error("Error saving:", error);
      setToast({
        message: "Error al guardar",
        type: "error",
        subtitle: "No se pudo actualizar el stock mínimo",
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-[var(--surface)] p-4 rounded-lg border border-[var(--border)]">
        <h2 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-orange-500" />
          Alertas de Stock
        </h2>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar producto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="grid gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-[var(--surface)] rounded-lg border border-[var(--border)] overflow-hidden"
            >
              <div className="p-4 bg-[var(--surface-muted)] border-b border-[var(--border)]">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg text-[var(--foreground)]">
                      {product.nombre}
                    </h3>
                    <p className="text-sm text-[var(--text-muted)]">
                      Código: {product.codigo}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {product.stocks && Array.isArray(product.stocks) ? (
                    product.stocks.map((stock) => {
                      const minStockEntry = product.stock_minimo.find(
                        (sm) => sm.bodega_id === stock.bodega_id.toString()
                      );
                      const currentMin = minStockEntry
                        ? parseFloat(minStockEntry.stock_minimo)
                        : 0;
                      const editKey = `${product.id}-${stock.bodega_id}`;
                      const editValue = edits[editKey];
                      const displayMin =
                        editValue !== undefined ? editValue : currentMin;
                      const isLowStock =
                        stock.cantidad <= displayMin && displayMin > 0;
                      const isSaving = savingId === editKey;
                      const hasChanged =
                        editValue !== undefined && editValue !== currentMin;

                      return (
                        <div
                          key={stock.bodega_id}
                          className={`p-4 rounded-lg border ${
                            isLowStock
                              ? "border-red-300 bg-red-50"
                              : "border-[var(--border)] bg-[var(--surface)]"
                          }`}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <span className="text-sm font-medium text-[var(--text-muted)]">
                              {getBodegaName(stock.bodega_id)}
                            </span>
                            {isLowStock && (
                              <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full">
                                <AlertTriangle className="w-3 h-3" />
                                Stock Bajo
                              </span>
                            )}
                          </div>

                          <div className="flex justify-between items-end">
                            <div>
                              <p className="text-2xl font-bold text-[var(--foreground)]">
                                {stock.cantidad}
                              </p>
                              <p className="text-xs text-gray-500">
                                Disponible
                              </p>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              <label className="text-xs font-medium text-[var(--text-muted)]">
                                Stock Mínimo
                              </label>
                              <div className="flex items-center gap-2">
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={displayMin === 0 ? "" : displayMin}
                                    onChange={(e) =>
                                      handleMinStockChange(
                                        product.id,
                                        stock.bodega_id,
                                        e.target.value
                                      )
                                    }
                                    className="w-24 px-3 py-1.5 text-sm border border-[var(--border)] rounded-md 
                                             bg-[var(--surface)] focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                                             outline-none transition-all text-right"
                                  />
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                                    Min:
                                  </span>
                                </div>
                                {hasChanged && (
                                  <button
                                    onClick={() =>
                                      saveMinStock(product.id, stock.bodega_id)
                                    }
                                    disabled={isSaving}
                                    className="p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 
                                             transition-colors disabled:opacity-50 shadow-sm"
                                    title="Guardar configuración"
                                  >
                                    {isSaving ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Save className="w-4 h-4" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-gray-500 italic col-span-full">
                      Sin información de stock
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {products.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-500">
              No se encontraron productos
            </div>
          )}
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          subtitle={toast.subtitle}
          onClose={() => setToast(null)}
          position="bottom-right"
        />
      )}
    </div>
  );
}
