"use client";

import { ProductPrice } from "@/types/supplier";
import { formatPrice } from "@/lib/utils";

interface PriceComparisonProps {
  readonly prices: ProductPrice[];
}

export default function PriceComparison({
  prices,
}: Readonly<PriceComparisonProps>) {
  const sortedPrices = [...prices].sort((a, b) => a.price - b.price);
  const lowestPrice = sortedPrices[0];
  const hasMultipleSuppliers = prices.length > 1;

  const calculateSavings = (price: number) => {
    if (!lowestPrice || price === lowestPrice.price) return null;
    const savings = price - lowestPrice.price;
    // Calcular qué porcentaje más caro es respecto al precio más bajo
    const percentage = ((savings / lowestPrice.price) * 100).toFixed(1);
    return { amount: savings, percentage };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b-2 border-[var(--border)]">
        <h3 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
          <span className="text-2xl">💰</span>
          <span>Comparación de Precios</span>
        </h3>
        {hasMultipleSuppliers && (
          <div className="flex items-center gap-2 bg-[var(--surface-muted)] px-3 py-1.5 rounded-full">
            <svg
              className="w-4 h-4 text-[var(--text-muted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <span className="text-sm font-semibold text-[var(--foreground)]">
              {prices.length} proveedor{prices.length !== 1 ? "es" : ""}{" "}
              disponible{prices.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Price Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedPrices.map((priceInfo, index) => {
          const isLowest = priceInfo.price === lowestPrice.price;
          const savings = calculateSavings(priceInfo.price);

          return (
            <div
              key={`${priceInfo.supplierId}-${index}`}
              className={`relative rounded-xl p-6 transition-all duration-300 hover:shadow-xl ${
                isLowest
                  ? "border-2 border-green-600 bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/60 dark:to-emerald-900/50 shadow-lg"
                  : "border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--text-muted)]"
              }`}
            >
              {/* Best Price Badge */}
              {isLowest && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                  <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                    <span className="text-sm">🏆</span>
                    <span>Mejor Precio</span>
                  </div>
                </div>
              )}

              {/* Supplier Name */}
              <div className="mb-4 pt-1">
                <h4 className={`text-lg font-bold truncate ${
                  isLowest 
                    ? "text-green-900 dark:text-green-100" 
                    : "text-[var(--foreground)]"
                }`}>
                  {priceInfo.supplierName}
                </h4>
                {isLowest && (
                  <p className="text-xs text-green-800 dark:text-green-200 font-medium mt-1">
                    La opción más económica
                  </p>
                )}
              </div>

              {/* Price - Large and prominent */}
              <div className="mb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-xs uppercase tracking-wide font-semibold mb-1 ${
                      isLowest 
                        ? "text-green-700 dark:text-green-300" 
                        : "text-[var(--text-muted)]"
                    }`}>
                      Precio
                    </p>
                    <div
                      className={`text-4xl font-extrabold tracking-tight ${
                        isLowest
                          ? "text-green-700 dark:text-green-300"
                          : "text-[var(--foreground)]"
                      }`}
                    >
                      {formatPrice(priceInfo.price)}
                    </div>
                  </div>
                  {savings && (
                    <div className="text-right">
                      <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-semibold mb-1">
                        Diferencia
                      </p>
                      <div className="text-lg font-bold text-red-600 dark:text-red-400">
                        +{formatPrice(savings.amount)}
                      </div>
                      <div className="text-xs text-red-500 dark:text-red-400 font-medium">
                        +{savings.percentage}%
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Info */}
              {priceInfo.minOrderQuantity && priceInfo.minOrderQuantity > 1 && (
                <div className="mb-4 p-2 bg-[var(--surface-muted)] rounded-lg">
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <span className="text-base">📦</span>
                    <span className="font-medium">
                      Pedido mínimo: {priceInfo.minOrderQuantity} unidades
                    </span>
                  </div>
                </div>
              )}

              {/* Action Button */}
              {priceInfo.url && (
                <a
                  href={priceInfo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    isLowest
                      ? "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-md hover:shadow-lg"
                      : "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-md hover:shadow-lg"
                  }`}
                >
                  <span>Ver en Proveedor</span>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </a>
              )}

              {!priceInfo.isAvailable && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-center text-sm font-semibold text-red-700 dark:text-red-400 flex items-center justify-center gap-2">
                    <span>⚠️</span>
                    <span>No disponible actualmente</span>
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {hasMultipleSuppliers && (
        <div className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950/50 dark:to-pink-950/40 border-2 border-red-300 dark:border-red-700 rounded-xl p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-red-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">💡</span>
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-red-950 dark:text-red-50 mb-2 text-lg">
                Análisis de Ahorro
              </h4>
              <p className="text-sm text-red-900 dark:text-red-100 leading-relaxed">
                Comprando en{" "}
                <span className="font-bold bg-red-200 dark:bg-red-800 px-2 py-0.5 rounded text-red-950 dark:text-red-50">
                  {lowestPrice.supplierName}
                </span>{" "}
                ahorras hasta{" "}
                <span className="font-bold text-lg bg-green-200 dark:bg-green-800 px-2 py-0.5 rounded text-green-950 dark:text-green-50">
                  {formatPrice(
                    sortedPrices[sortedPrices.length - 1].price -
                      lowestPrice.price
                  )}
                </span>{" "}
                por unidad comparado con el proveedor más caro.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
