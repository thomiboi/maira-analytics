"use client";

import { ProductFilters as IProductFilters } from "@/types/supplier";

interface ProductFiltersProps {
  readonly filters: IProductFilters;
  readonly onFilterChange: (filters: IProductFilters) => void;
  readonly availableSuppliers?: string[]; // Lista de proveedores disponibles
}

export default function ProductFilters({
  filters,
  onFilterChange,
  availableSuppliers = [],
}: Readonly<ProductFiltersProps>) {
  return (
    <div className="bg-[var(--surface)] rounded-lg shadow-md p-4 mb-6 border border-[var(--border)]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Búsqueda */}
        <div>
          <label
            htmlFor="search"
            className="block text-sm font-medium text-[var(--foreground)] mb-2"
          >
            Buscar Producto
          </label>
          <input
            id="search"
            type="text"
            placeholder="Nombre del producto, SKU, código de barras..."
            value={filters.search}
            onChange={(e) =>
              onFilterChange({ ...filters, search: e.target.value })
            }
            className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 bg-[var(--surface)] text-[var(--foreground)] placeholder:text-[var(--text-subtle)]"
          />
        </div>

        {/* Filtro de Proveedor */}
        <div>
          <label
            htmlFor="supplier"
            className="block text-sm font-medium text-[var(--foreground)] mb-2"
          >
            Filtrar por Proveedor
          </label>
          <select
            id="supplier"
            value={filters.selectedSupplier}
            onChange={(e) =>
              onFilterChange({ ...filters, selectedSupplier: e.target.value })
            }
            className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 bg-[var(--surface)] text-[var(--foreground)]"
          >
            <option value="">Todos los proveedores</option>
            {availableSuppliers.map((supplier) => (
              <option key={supplier} value={supplier}>
                {supplier}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        {/* Checkbox para múltiples proveedores */}
        <div className="flex items-center">
          <input
            id="hasMultipleSuppliers"
            type="checkbox"
            checked={filters.hasMultipleSuppliers}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                hasMultipleSuppliers: e.target.checked,
              })
            }
            className="h-4 w-4 text-red-600 focus:ring-red-500 border-[var(--border)] rounded"
          />
          <label
            htmlFor="hasMultipleSuppliers"
            className="ml-2 text-sm text-[var(--foreground)]"
          >
            Mostrar solo productos con múltiples proveedores
          </label>
        </div>
      </div>
    </div>
  );
}
