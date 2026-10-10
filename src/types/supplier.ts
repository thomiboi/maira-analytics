// Tipos para el módulo de productos y proveedores

export interface Product {
  id: string;
  name: string;
  description?: string;
  category: ProductCategory;
  sku?: string;
  barcode?: string;
  lastUpdated: string;
  prices: ProductPrice[];
  lowestPrice?: number;
  highestPrice?: number;
  averagePrice?: number;
}

export interface ProductPrice {
  supplierId: string;
  supplierName: string;
  price: number;
  stock: number;
  stockStatus: StockStatus;
  currency: string;
  lastChecked: string;
  url?: string;
  dataSource: DataSource;
  isAvailable: boolean;
  deliveryTime?: string;
  minOrderQuantity?: number;
}

export interface Supplier {
  id: string;
  name: string;
  dataSource: DataSource;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  status: SupplierStatus;
  lastSync: string;
  totalProducts: number;
  isActive: boolean;
}

export type DataSource =
  | 'excel'
  | 'web-scraping'
  | 'api'
  | 'manual';

export type StockStatus =
  | 'high'      // Stock alto (verde)
  | 'medium'    // Stock medio (amarillo)
  | 'low'       // Stock bajo (rojo)
  | 'out';      // Sin stock (gris)

export type ProductCategory =
  | 'Medicamentos'
  | 'Equipamiento Médico'
  | 'Productos de Limpieza'
  | 'Material de Oficina'
  | 'Tecnología'
  | 'Consumibles'
  | 'Otros';

export type SupplierStatus =
  | 'Activo'
  | 'Inactivo'
  | 'En Sincronización'
  | 'Error';

export interface ProductStats {
  totalProducts: number;
  productsWithMultipleSuppliers: number;
  lowStockAlerts: number;
  outOfStockCount: number;
  averagePriceDifference: number;
  totalSuppliers: number;
  excelSuppliers: number;
  webScrapingSuppliers: number;
}

export interface ProductFilters {
  search: string;
  category: string;
  stockStatus: string;
  dataSource: string;
  minPrice: number;
  maxPrice: number;
  hasMultipleSuppliers: boolean;
  selectedSupplier: string; // Nuevo: filtrar por proveedor específico (vacío = todos)
}
