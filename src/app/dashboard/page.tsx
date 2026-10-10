"use client";

import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { dashboardFetchManager } from "@/lib/dashboard-fetch-manager";
import {
  FileText,
  DollarSign,
  Package,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SalesStats {
  totalSales: number;
  totalRevenue: number;
  averageTicket: number;
  totalProducts: number;
  topCategories: Array<{
    name: string;
    sales: number;
  }>;
}

interface TopProduct {
  id: number;
  name: string;
  category: string;
  sales: number;
  revenue: number;
  change: number;
}

interface SalesTrend {
  date: string;
  sales: number;
  revenue: number;
}

interface RecentSale {
  id: string;
  customer: string;
  products: number;
  total: number;
  date: string;
  type: "regular" | "insurance" | "prescription";
}

interface TimePeriod {
  label: string;
  value: string;
  days: number;
}

interface PharmacyDashboardData {
  stats: SalesStats;
  topProducts: TopProduct[];
  salesTrends: SalesTrend[];
  recentSales: RecentSale[];
}

interface StatsCardConfig {
  title: string;
  value: string;
  subtitle: string;
  changeLabel: string;
  positive: boolean;
  Icon: LucideIcon;
}

const formatCurrency = (value: number) => `$${value.toLocaleString("es-CL")}`;

const formatPercentageChange = (change: number) => {
  if (!Number.isFinite(change) || Math.abs(change) < 0.05) {
    return { label: "0%", positive: true } as const;
  }

  const positive = change >= 0;
  const label = `${positive ? "+" : ""}${change.toFixed(1)}%`;

  return { label, positive } as const;
};

// Función para agrupar tendencias por semana - FIX: manejo seguro de fechas
const groupTrendsByWeek = (trends: SalesTrend[]): SalesTrend[] => {
  const weeklyMap = new Map<
    string,
    { sales: number; revenue: number; startDate: string; endDate: string }
  >();

  trends.forEach((trend) => {
    // Usar parsing manual para evitar problemas de timezone
    const [year, month, day] = trend.date.split("-").map(Number);
    const date = new Date(year, month - 1, day); // Crear fecha en timezone local

    // Obtener el lunes de esa semana
    const dayOfWeek = date.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Domingo = 0, ajustar a lunes
    const monday = new Date(year, month - 1, day + daysToMonday);

    const weekKey = `${monday.getFullYear()}-${String(
      monday.getMonth() + 1
    ).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;

    if (weeklyMap.has(weekKey)) {
      const existing = weeklyMap.get(weekKey)!;
      existing.sales += trend.sales;
      existing.revenue += trend.revenue;
      existing.endDate = trend.date;
    } else {
      weeklyMap.set(weekKey, {
        sales: trend.sales,
        revenue: trend.revenue,
        startDate: trend.date,
        endDate: trend.date,
      });
    }
  });

  return Array.from(weeklyMap.entries())
    .map(([weekStart, data]) => ({
      date: weekStart,
      sales: data.sales,
      revenue: data.revenue,
    }))
    .sort((a, b) => a.date.localeCompare(b.date)); // Comparación de strings en lugar de Date
};

// Función para agrupar tendencias por mes - FIX: manejo seguro de fechas
const groupTrendsByMonth = (trends: SalesTrend[]): SalesTrend[] => {
  const monthlyMap = new Map<string, { sales: number; revenue: number }>();

  trends.forEach((trend) => {
    // Usar parsing manual para evitar problemas de timezone
    const [year, month] = trend.date.split("-").map(Number);
    const monthKey = `${year}-${String(month).padStart(2, "0")}-01`;

    if (monthlyMap.has(monthKey)) {
      const existing = monthlyMap.get(monthKey)!;
      existing.sales += trend.sales;
      existing.revenue += trend.revenue;
    } else {
      monthlyMap.set(monthKey, {
        sales: trend.sales,
        revenue: trend.revenue,
      });
    }
  });

  return Array.from(monthlyMap.entries())
    .map(([monthStart, data]) => ({
      date: monthStart,
      sales: data.sales,
      revenue: data.revenue,
    }))
    .sort((a, b) => a.date.localeCompare(b.date)); // Comparación de strings en lugar de Date
};

// Función para formatear fechas de manera segura sin problemas de timezone
const formatDateSafe = (dateString: string): string => {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day); // Crear en timezone local

  return date.toLocaleDateString("es-ES", {
    month: "short",
    day: "numeric",
  });
};

export default function Dashboard() {
  console.log("🏗️ Dashboard component mounting/re-mounting");

  const { user, loading } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const router = useRouter();
  const [dashboardData, setDashboardData] =
    useState<PharmacyDashboardData | null>(null);
  const [evolutionData, setEvolutionData] = useState<SalesTrend[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingEvolution, setLoadingEvolution] = useState(true);
  // ✅ ESTADOS APLICADOS (usados para las consultas reales)
  const [appliedPeriod, setAppliedPeriod] = useState("30");
  const [appliedCategory, setAppliedCategory] = useState("all");
  const [appliedBranch, setAppliedBranch] = useState<"0" | "null" | string>(
    "0" // ✨ NUEVO: "0" = todas las sucursales
  );

  // ✅ ESTADOS TEMPORALES (para los dropdowns, no hacen fetch automáticamente)
  const [selectedPeriod, setSelectedPeriod] = useState("30");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedBranch, setSelectedBranch] = useState<"0" | "null" | string>(
    "0" // ✨ NUEVO: "0" = todas las sucursales
  );

  // Estado independiente para el filtro del gráfico de evolución
  const [evolutionPeriod, setEvolutionPeriod] = useState("30");

  // ✨ NUEVO: Estados para gráfico de ventas por producto
  const [selectedProduct, setSelectedProduct] = useState<{
    codigo: string;
    nombre: string;
  } | null>(null);
  const [productSalesData, setProductSalesData] = useState<
    Array<{ date: string; quantity: number; revenue: number }>
  >([]);
  const [loadingProductSales, setLoadingProductSales] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [productSearchResults, setProductSearchResults] = useState<
    Array<{ codigo: string; nombre: string; unidades: number }>
  >([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  
  // ✨ NUEVO: Estados para filtros del componente de búsqueda de productos
  const [productSearchPeriod, setProductSearchPeriod] = useState("30"); // Para top products Y gráfico
  const [productSearchBranch, setProductSearchBranch] = useState<string>("0"); // Sucursal para top products

  // ✅ Estado para saber si hay cambios pendientes
  const [hasPendingChanges, setHasPendingChanges] = useState(false);

  // ✅ Detectar cambios pendientes
  useEffect(() => {
    const hasChanges =
      selectedPeriod !== appliedPeriod ||
      selectedCategory !== appliedCategory ||
      selectedBranch !== appliedBranch;

    setHasPendingChanges(hasChanges);

    if (hasChanges) {
      console.log("🔄 Cambios pendientes detectados:", {
        período: `${appliedPeriod} → ${selectedPeriod}`,
        categoría: `${appliedCategory} → ${selectedCategory}`,
        sucursal: `${appliedBranch} → ${selectedBranch}`,
      });
    }
  }, [
    selectedPeriod,
    selectedCategory,
    selectedBranch,
    appliedPeriod,
    appliedCategory,
    appliedBranch,
  ]);

  // 🔍 DEBUG: Monitorear cambios en estados aplicados
  useEffect(() => {
    console.log("🔧 Estados aplicados cambiaron:", {
      appliedPeriod,
      appliedCategory,
      appliedBranch,
    });
  }, [appliedPeriod, appliedCategory, appliedBranch]);

  // Estado para rastrear si ya se hizo la carga inicial
  const [hasInitialData, setHasInitialData] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const initializationDone = useRef<boolean>(false);

  // Verificar permisos
  const canReadDashboard = hasPermission("dashboard", "read");

  const timePeriods: TimePeriod[] = [
    // Períodos cortos - para análisis operacional diario
    { label: "Últimos 7 días", value: "7", days: 7 },
    { label: "Últimas 2 semanas", value: "14", days: 14 },
    { label: "Último mes", value: "30", days: 30 },

    // Períodos medios - para análisis de tendencias
    { label: "Últimos 2 meses", value: "60", days: 60 },
    { label: "Últimos 3 meses", value: "90", days: 90 },
    { label: "Últimos 6 meses", value: "180", days: 180 },

    // Períodos largos - para análisis estratégico
    { label: "Último año", value: "365", days: 365 },
    { label: "Últimos 2 años", value: "730", days: 730 },

    // Datos completos - para análisis histórico total
    { label: "📊 Todos los datos históricos", value: "all", days: -1 },
  ];

  // Opciones específicas para el gráfico de evolución de ingresos
  const evolutionPeriods: TimePeriod[] = [
    { label: "Últimos 7 días", value: "7", days: 7 },
    { label: "Últimos 30 días", value: "30", days: 30 },
    { label: "Últimos 3 meses", value: "90", days: 90 },
    { label: "Últimos 6 meses", value: "180", days: 180 },
    { label: "Último año", value: "365", days: 365 },
    { label: "Últimos 2 años", value: "730", days: 730 },
  ];

  // Opciones para filtrar por sucursal
  // ✨ NUEVO MAPEO: 0 = todas, null = casa matriz, 2191 = segunda sucursal
  const branchOptions = [
    { label: "Todas las Sucursales", value: "0" }, // ✅ Envía 0 al SQL
    { label: "Casa Matriz", value: "null" }, // ✅ Envía null al SQL
    { label: "FM Villa independencia", value: "2191" }, // ✅ Envía 2191 al SQL
  ];

  const fetchPharmacyData = useCallback(
    async (
      periodDays: string = "30",
      forceRefresh: boolean = false,
      branchId?: string
    ) => {
      if (!user) return;

      // No hacer fetch si la página no está visible (a menos que sea forzado)
      if (!forceRefresh && !isPageVisible) {
        console.log("👁️‍🗨️ Página no visible, omitiendo fetch");
        return;
      }

      try {
        setLoadingData(true);

        // ✅ Usar branchId pasado como parámetro, o appliedBranch como fallback
        const targetBranch = branchId !== undefined ? branchId : appliedBranch;
        console.log("🎯 fetchPharmacyData usando sucursal:", targetBranch);

        const data = await dashboardFetchManager.fetchDashboardData(
          periodDays,
          forceRefresh,
          targetBranch
        );

        setDashboardData(data);
        // Dashboard actualizado exitosamente
      } catch (error) {
        console.error("❌ Error fetching pharmacy data:", error);
      } finally {
        setLoadingData(false);
      }
    },
    [user, isPageVisible, appliedBranch]
  );

  // ✅ Handlers que SOLO cambian valores temporales (sin fetch)
  const handlePeriodChange = (period: string) => {
    if (period !== selectedPeriod) {
      console.log("🔄 Usuario cambió período temporal a:", period);
      setSelectedPeriod(period);
    }
  };

  const handleBranchChange = (branchId: string) => {
    if (branchId !== selectedBranch) {
      const branchLabel =
        branchOptions.find((b) => b.value === branchId)?.label || "Desconocida";
      console.log(
        "🏢 Usuario cambió sucursal temporal a:",
        branchLabel,
        "- Valor:",
        branchId
      );
      // Estado antes del cambio
      setSelectedBranch(branchId);
    }
  };

  // ✅ Función para aplicar los filtros (hace el fetch real)
  const handleApplyFilters = async () => {
    console.log("🚀 Aplicando filtros:", {
      período: `${appliedPeriod} → ${selectedPeriod}`,
      categoría: `${appliedCategory} → ${selectedCategory}`,
      sucursal: `${appliedBranch} → ${selectedBranch}`,
    });

    console.log("📊 Estado antes de aplicar:", {
      selectedBranch,
      appliedBranch,
      hasPendingChanges,
      hasInitialData,
    });

    // Actualizar estados aplicados (estos se usan para las consultas)
    setAppliedPeriod(selectedPeriod);
    setAppliedCategory(selectedCategory);
    setAppliedBranch(selectedBranch);

    console.log("📊 Nuevos valores aplicados:", {
      newAppliedPeriod: selectedPeriod,
      newAppliedCategory: selectedCategory,
      newAppliedBranch: selectedBranch,
    });

    // Hacer fetch con los nuevos valores
    if (hasInitialData) {
      // 🚀 CLAVE: Limpiar caché antes de hacer fetch (igual que handleSyncData)
      const { dashboardFetchManager } = await import(
        "@/lib/dashboard-fetch-manager"
      );
      dashboardFetchManager.clearCache();
      console.log("🧹 Cache limpiado antes de aplicar filtros");

      // ✅ Pasar parámetros directamente a fetchPharmacyData (evita timing issues)
      setTimeout(() => {
        fetchPharmacyData(selectedPeriod, true, selectedBranch).catch(
          console.error
        );
        fetchEvolutionData(evolutionPeriod).catch(console.error);
      }, 0);
    }

    // Filtros aplicados y sincronizados
  };

  // ✅ Función para resetear filtros temporales
  const handleResetFilters = () => {
    console.log("🔄 Reseteando filtros temporales");
    setSelectedPeriod(appliedPeriod);
    setSelectedCategory(appliedCategory);
    setSelectedBranch(appliedBranch);
  };

  // Función para obtener solo datos de evolución de ingresos
  const fetchEvolutionData = useCallback(
    async (period: string = "30") => {
      if (!user) return;

      try {
        setLoadingEvolution(true);

        // Construir URL con parámetros de sucursal
        const params = new URLSearchParams({
          use_real_data: "true",
          period_days: period,
        });

        // ✨ NUEVO: Siempre agregar branch_id (0, null, o 2191)
        params.append("branch_id", appliedBranch);

        const response = await fetch(
          `/api/pharmacy/dashboard?${params.toString()}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const trends = data.salesTrends || [];

        setEvolutionData(trends);
      } catch (error) {
        console.error("Error fetching evolution data:", error);
        setEvolutionData([]);
      } finally {
        setLoadingEvolution(false);
      }
    },
    [user, appliedBranch]
  );

  // ✨ NUEVO: Función para cargar productos más vendidos
  const fetchTopProducts = useCallback(async () => {
    console.log("🔥 Cargando productos más vendidos...", { 
      productSearchBranch, 
      productSearchPeriod 
    });
    try {
      setLoadingProductSales(true);

      const endDate = new Date();
      const startDate = new Date();
      const days = Number.parseInt(productSearchPeriod);
      startDate.setDate(startDate.getDate() - days);

      // Convertir productSearchBranch: "0" -> "todas" para la API de ranking
      const sucursalParam = productSearchBranch === '0' ? 'todas' : productSearchBranch;

      const params = new URLSearchParams({
        fechaInicio: startDate.toISOString().split('T')[0],
        fechaFin: endDate.toISOString().split('T')[0],
        pageSize: '10',
        sucursal: sucursalParam,
      });

      console.log("📡 Fetch URL:", `/api/ranking/productos?${params.toString()}`);
      const response = await fetch(`/api/ranking/productos?${params.toString()}`);

      if (!response.ok) {
        console.error("❌ Response not OK:", response.status, response.statusText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("📦 Data completa recibida:", data);
      
      // La estructura es: data.data.productos
      const productos = data.data?.productos || data.productos || [];
      console.log("✅ Productos más vendidos recibidos:", productos.length);
      
      if (productos.length > 0) {
        console.log("🎯 Primer producto:", productos[0]);
      }
      
      setProductSearchResults(productos);
    } catch (error) {
      console.error("❌ Error cargando productos más vendidos:", error);
      setProductSearchResults([]);
    } finally {
      setLoadingProductSales(false);
    }
  }, [productSearchBranch, productSearchPeriod]);

  // ✨ NUEVO: Función para buscar productos usando productos_pos
  const searchProducts = useCallback(async (query: string) => {
    if (query.length < 2) {
      setProductSearchResults([]);
      return;
    }

    try {
      setLoadingProductSales(true);
      
      // Buscar directamente en productos_pos (no depende de ventas)
      const response = await fetch(`/api/productos/buscar?q=${encodeURIComponent(query)}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const productos = await response.json();
      setProductSearchResults(productos);
    } catch (error) {
      console.error("Error buscando productos:", error);
      setProductSearchResults([]);
    } finally {
      setLoadingProductSales(false);
    }
  }, []);

  // ✨ NUEVO: Effect para buscar productos con debounce
  useEffect(() => {
    // No buscar si hay un producto seleccionado
    if (selectedProduct) {
      return;
    }
    
    const timer = setTimeout(() => {
      searchProducts(productSearchQuery).catch(console.error);
    }, 300);

    return () => clearTimeout(timer);
  }, [productSearchQuery, searchProducts, selectedProduct]);

  // ✨ NUEVO: Effect para cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Cerrar si el clic no está dentro del contenedor de búsqueda
      if (!target.closest('.product-search-container')) {
        setShowProductDropdown(false);
      }
    };

    if (showProductDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProductDropdown]);

  // ✨ NUEVO: Función para cargar ventas diarias del producto seleccionado
  const fetchProductSales = useCallback(
    async (codigo: string, period: string = "30") => {
      try {
        setLoadingProductSales(true);

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - Number.parseInt(period));

        const params = new URLSearchParams({
          codigo,
          sucursal: productSearchBranch,
          fechaInicio: startDate.toISOString().split('T')[0],
          fechaFin: endDate.toISOString().split('T')[0],
        });

        const response = await fetch(`/api/ranking/productos/ventas-diarias?${params.toString()}`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setProductSalesData(data);
      } catch (error) {
        console.error("Error cargando ventas del producto:", error);
        setProductSalesData([]);
      } finally {
        setLoadingProductSales(false);
      }
    },
    [productSearchBranch]
  );

  // ✨ NUEVO: Effect para cargar ventas cuando cambia el producto o período
  useEffect(() => {
    if (selectedProduct) {
      fetchProductSales(selectedProduct.codigo, productSearchPeriod).catch(
        console.error
      );
    }
  }, [selectedProduct, productSearchPeriod, fetchProductSales]);

  // Solo para redirection
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Logging de mount/unmount
  useEffect(() => {
    console.log("🏗️ Dashboard useEffect: Component mounted");
    return () => {
      console.log("🏗️ Dashboard useEffect: Component will unmount");
    };
  }, []);

  // Solo para carga inicial - SIN dependencias reactivas
  useEffect(() => {
    if (user && !initializationDone.current) {
      initializationDone.current = true;
      // Carga inicial del dashboard

      fetchPharmacyData("30")
        .then(() => {
          setHasInitialData(true);
        })
        .catch(console.error);
    }
  }, [user, fetchPharmacyData]); // selectedBranch incluido via fetchPharmacyData dependencies

  // Detectar visibilidad de la página para evitar fetches innecesarios
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsPageVisible(visible);

      if (visible) {
        console.log("👀 Página visible de nuevo");
        // Opcional: refrescar datos si han pasado más de 10 minutos
        // Refrescar después de larga ausencia
        console.log("🔄 Actualizando datos después de larga ausencia");
        if (user) {
          fetchPharmacyData(appliedPeriod, true).catch(console.error);
        }
      } else {
        console.log("👁️‍🗨️ Página oculta, pausando actualizaciones");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user, appliedPeriod, fetchPharmacyData]);

  const categories = useMemo(() => {
    const list = dashboardData?.stats.topCategories ?? [];
    const unique = Array.from(new Set(list.map((category) => category.name)));
    return ["all", ...unique];
  }, [dashboardData]);

  useEffect(() => {
    if (!categories.includes(selectedCategory)) {
      setSelectedCategory("all");
    }
  }, [categories, selectedCategory]);

  // useEffect independiente para datos de evolución
  useEffect(() => {
    if (user && canReadDashboard) {
      fetchEvolutionData(evolutionPeriod);
    }
  }, [
    user,
    evolutionPeriod,
    fetchEvolutionData,
    canReadDashboard,
    appliedBranch,
  ]);

  const getCurrentPeriodLabel = () => {
    const period = timePeriods.find((p) => p.value === appliedPeriod);
    if (!period) return "período seleccionado";

    if (period.value === "all") {
      return "todos los datos históricos";
    }

    return period.label.toLowerCase();
  };

  const getCurrentPeriodDescription = () => {
    const period = timePeriods.find((p) => p.value === appliedPeriod);
    if (!period) return "Período no definido";

    if (period.value === "all") {
      return "Análisis completo de todo el historial disponible en la base de datos";
    }

    const endDate = new Date();
    const startDate = new Date(
      endDate.getTime() - period.days * 24 * 60 * 60 * 1000
    );

    return `Datos desde ${startDate.toLocaleDateString(
      "es-ES"
    )} hasta ${endDate.toLocaleDateString("es-ES")}`;
  };

  const currentPeriodLabel = getCurrentPeriodLabel();
  const currentPeriodDescription = getCurrentPeriodDescription();
  const normalizedPeriodLabel = `${currentPeriodLabel
    .charAt(0)
    .toUpperCase()}${currentPeriodLabel.slice(1)}`;

  const salesTrends = useMemo(() => {
    // Usar datos independientes de evolución
    const rawTrends = evolutionData;

    if (rawTrends.length === 0) return [];

    // El período de evolución es independiente del período general
    const daysDiff = parseInt(evolutionPeriod);

    console.log(`Período de evolución seleccionado: ${daysDiff} días`);
    console.log(`Datos de evolución originales: ${rawTrends.length} puntos`);

    // Aplicar agrupación inteligente según el período de evolución
    if (daysDiff <= 30) {
      // Mostrar datos diarios para períodos cortos
      return rawTrends;
    } else if (daysDiff <= 90) {
      // Agrupar por semana para períodos medianos
      return groupTrendsByWeek(rawTrends);
    } else {
      // Agrupar por mes para períodos largos
      return groupTrendsByMonth(rawTrends);
    }
  }, [evolutionData, evolutionPeriod]);
  const totalRevenue = dashboardData?.stats.totalRevenue ?? 0;
  const totalSales = dashboardData?.stats.totalSales ?? 0;
  const totalProducts = dashboardData?.stats.totalProducts ?? 0;
  const averageTicket = dashboardData?.stats.averageTicket ?? 0;

  const documentsVariation = useMemo(() => {
    const trends = dashboardData?.salesTrends ?? [];
    if (trends.length < 2) return 0;

    const first = trends[0].sales;
    const last = trends[trends.length - 1].sales;

    if (first === 0) return 0;
    return ((last - first) / first) * 100;
  }, [dashboardData]);

  const revenueVariation = useMemo(() => {
    const trends = dashboardData?.salesTrends ?? [];
    if (trends.length < 2) return 0;

    const first = trends[0].revenue;
    const last = trends[trends.length - 1].revenue;

    if (first === 0) return 0;
    return ((last - first) / first) * 100;
  }, [dashboardData]);

  const productVariation = useMemo(() => {
    const products = dashboardData?.topProducts ?? [];
    if (products.length === 0) return 0;

    const totalChange = products.reduce(
      (sum, product) => sum + product.change,
      0
    );
    return totalChange / products.length;
  }, [dashboardData]);

  const ticketVariation = revenueVariation - documentsVariation;

  const statsCards: StatsCardConfig[] = useMemo(() => {
    const documentsChange = formatPercentageChange(documentsVariation);
    const revenueChange = formatPercentageChange(revenueVariation);
    const productChange = formatPercentageChange(productVariation);
    const ticketChange = formatPercentageChange(ticketVariation);

    return [
      {
        title: "Documentos emitidos",
        value: totalSales.toLocaleString("es-CL"),
        subtitle: normalizedPeriodLabel,
        changeLabel: documentsChange.label,
        positive: documentsChange.positive,
        Icon: FileText,
      },
      {
        title: "Ingresos totales",
        value: formatCurrency(totalRevenue),
        subtitle: normalizedPeriodLabel,
        changeLabel: revenueChange.label,
        positive: revenueChange.positive,
        Icon: DollarSign,
      },
      {
        title: "Productos únicos",
        value: totalProducts.toLocaleString("es-CL"),
        subtitle: "Catálogo activo",
        changeLabel: productChange.label,
        positive: productChange.positive,
        Icon: Package,
      },
      {
        title: "Ticket promedio",
        value: formatCurrency(averageTicket),
        subtitle: "Promedio por documento",
        changeLabel: ticketChange.label,
        positive: ticketChange.positive,
        Icon: TrendingUp,
      },
    ];
  }, [
    documentsVariation,
    revenueVariation,
    productVariation,
    ticketVariation,
    totalSales,
    totalRevenue,
    totalProducts,
    averageTicket,
    normalizedPeriodLabel,
  ]);

  const filteredProducts = useMemo(() => {
    const products = [...(dashboardData?.topProducts ?? [])]
      .sort((a, b) => b.revenue - a.revenue) // ✅ Ordenar por INGRESOS (revenue)
      .slice(0, 10);

    if (appliedCategory === "all") {
      return products;
    }

    return products.filter((product) => product.category === appliedCategory);
  }, [dashboardData, appliedCategory]);

  const totalTrendRevenue = useMemo(() => {
    return salesTrends.reduce((sum, trend) => sum + trend.revenue, 0);
  }, [salesTrends]);

  const averageTrendRevenue =
    salesTrends.length > 0 ? totalTrendRevenue / salesTrends.length : 0;
  const maxRevenue = salesTrends.reduce(
    (max, trend) => Math.max(max, trend.revenue),
    0
  );

  // Variables de período eliminadas - ahora se calculan dinámicamente en getCurrentPeriodDescription()

  if (!user) {
    return null;
  }

  // Mostrar loading mientras se cargan permisos
  if (loading || permissionsLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-red-300 border-t-red-600" />
          <p className="text-sm text-gray-500">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  // Verificar permisos de lectura
  if (!canReadDashboard) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Acceso Restringido
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            No tienes permisos para acceder al dashboard principal.
          </p>
          <button
            onClick={() => router.push("/dashboard/configuracion")}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Ir a Configuración
          </button>
        </div>
      </div>
    );
  }

  if (loadingData) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-red-300 border-t-red-600" />
          <p className="text-sm text-gray-500">
            Preparando tu panel personalizado…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Panel comercial de farmacia
            </h2>
            <p className="text-sm text-gray-500">
              Analizando {currentPeriodLabel} — {currentPeriodDescription}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <span>
                📊 Período (métricas y productos){" "}
                {hasPendingChanges && selectedPeriod !== appliedPeriod && "📝"}
              </span>
              <select
                value={selectedPeriod}
                onChange={(event) => handlePeriodChange(event.target.value)}
                className={`rounded-lg border px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-red-500 ${
                  hasPendingChanges && selectedPeriod !== appliedPeriod
                    ? "border-orange-300 bg-orange-50"
                    : "border-gray-300 bg-white"
                }`}
              >
                {timePeriods.map((period) => (
                  <option key={period.value} value={period.value}>
                    {period.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <span>
                Sucursal{" "}
                {hasPendingChanges && selectedBranch !== appliedBranch && "📝"}
              </span>
              <select
                value={selectedBranch}
                onChange={(event) => handleBranchChange(event.target.value)}
                className={`rounded-lg border px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-red-500 ${
                  hasPendingChanges && selectedBranch !== appliedBranch
                    ? "border-orange-300 bg-orange-50"
                    : "border-gray-300 bg-white"
                }`}
              >
                {branchOptions.map((branch) => (
                  <option key={branch.value} value={branch.value}>
                    {branch.label}
                  </option>
                ))}
              </select>
            </label>

            {/* ✅ Botones de control de filtros */}
            <div className="flex items-center gap-2 ml-4">
              {hasPendingChanges && (
                <>
                  <button
                    onClick={handleApplyFilters}
                    className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
                    title={`Aplicar cambios: ${
                      [
                        selectedPeriod !== appliedPeriod &&
                          `Período: ${appliedPeriod} → ${selectedPeriod}`,
                        selectedCategory !== appliedCategory &&
                          `Categoría: ${appliedCategory} → ${selectedCategory}`,
                        selectedBranch !== appliedBranch &&
                          `Sucursal: ${appliedBranch} → ${selectedBranch}`,
                      ]
                        .filter(Boolean)
                        .join(", ") || "Sin cambios"
                    }`}
                  >
                    <span>✅</span>
                    Aplicar Filtros
                  </button>
                  <button
                    onClick={handleResetFilters}
                    className="flex items-center gap-2 rounded-lg bg-gray-500 px-3 py-2 text-sm font-medium text-white hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                  >
                    <span>🔄</span>
                    Reset
                  </button>
                </>
              )}
            </div>

            {categories.length > 1 && (
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <span>
                  Categoría{" "}
                  {hasPendingChanges &&
                    selectedCategory !== appliedCategory &&
                    "📝"}
                </span>
                <select
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  className={`rounded-lg border px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-red-500 ${
                    hasPendingChanges && selectedCategory !== appliedCategory
                      ? "border-orange-300 bg-orange-50"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category === "all" ? "Todas" : category}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statsCards.map(
            ({ Icon, title, value, subtitle, changeLabel, positive }) => (
              <article
                key={title}
                className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="rounded-xl bg-red-50 p-3 text-red-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      positive ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {changeLabel}
                  </span>
                </div>
                <div className="mt-6 space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    {title}
                  </p>
                  <p className="text-3xl font-semibold text-gray-900">
                    {value}
                  </p>
                  <p className="text-xs text-gray-500">{subtitle}</p>
                </div>
              </article>
            )
          )}
        </div>
      </section>
      {/* Productos destacados - ancho completo */}
      <section>
        <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-red-50 p-3 text-red-600">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Productos destacados
                </h3>
                <p className="text-sm text-gray-500">
                  {selectedCategory === "all"
                    ? `Top 10 por ingresos - ${normalizedPeriodLabel}`
                    : `Filtrados por ${appliedCategory} - ${normalizedPeriodLabel}`}
                </p>
              </div>
            </div>
            <span className="text-xs font-medium text-gray-500">
              Actualizado {new Date().toLocaleDateString("es-ES")}
            </span>
          </div>

          <div className="mt-6">
            {filteredProducts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                No hay productos para mostrar con el filtro seleccionado.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {filteredProducts.map((product, index) => {
                  const variationPositive = product.change >= 0;

                  return (
                    <div
                      key={product.id}
                      className="flex flex-col gap-3 rounded-xl border border-gray-100 p-4 hover:border-gray-200 hover:shadow-sm transition-all duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-xs font-semibold text-red-600">
                          #{index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">
                            {product.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {product.category}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">Ventas:</span>
                          <span className="font-semibold text-gray-900 text-sm">
                            {Math.round(product.sales || 0).toLocaleString(
                              "es-CL"
                            )}{" "}
                            uds
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            Ingresos:
                          </span>
                          <span className="text-xs text-gray-700">
                            {formatCurrency(product.revenue)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">Cambio:</span>
                          <span
                            className={`text-xs font-semibold ${
                              variationPositive
                                ? "text-emerald-600"
                                : "text-red-600"
                            }`}
                          >
                            {variationPositive ? "+" : ""}
                            {product.change.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </article>
      </section>

      {/* Gráfico de evolución de ingresos - ancho completo */}
      <section className="mb-6">
        <article className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-gray-200 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-red-50 p-3 text-red-600">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Evolución de ingresos
                </h3>
                <p className="text-sm text-gray-500">
                  {loadingEvolution
                    ? "Cargando..."
                    : `Datos para ${
                        evolutionPeriods
                          .find((p) => p.value === evolutionPeriod)
                          ?.label.toLowerCase() || "período seleccionado"
                      }`}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              {/* Selector independiente para evolución */}
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <span>📈 Período del gráfico:</span>
                <select
                  value={evolutionPeriod}
                  onChange={(event) => setEvolutionPeriod(event.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-red-500"
                  disabled={loadingEvolution}
                >
                  {evolutionPeriods.map((period) => (
                    <option key={period.value} value={period.value}>
                      {period.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="text-right">
                <p className="text-2xl font-semibold text-gray-900">
                  {loadingEvolution ? "..." : formatCurrency(totalTrendRevenue)}
                </p>
                <p className="text-xs text-gray-500">
                  {loadingEvolution
                    ? "Calculando..."
                    : `Promedio ${formatCurrency(averageTrendRevenue)}`}
                </p>
              </div>
            </div>
          </div>
          <div className="p-6">
            {loadingEvolution ? (
              <div className="flex h-48 items-center justify-center gap-3 text-sm text-gray-500">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-300 border-t-red-600" />
                Cargando evolución de ingresos...
              </div>
            ) : salesTrends.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-gray-500">
                No hay datos suficientes para este período.
              </div>
            ) : (
              <div className="flex h-64 items-end justify-center gap-1">
                {salesTrends.map((trend) => {
                  const height =
                    maxRevenue === 0 ? 0 : (trend.revenue / maxRevenue) * 100;

                  return (
                    <div
                      key={trend.date}
                      className="group flex flex-1 flex-col items-center gap-2"
                    >
                      <div className="relative flex h-56 w-full items-end justify-center">
                        <div
                          className="w-full min-h-[6px] rounded-t-md bg-gradient-to-t from-red-600 to-red-400 transition-colors duration-200 group-hover:from-red-700 group-hover:to-red-500"
                          style={{
                            height: `${Math.max(height, 2)}%`,
                            minHeight: "4px",
                          }}
                        >
                          <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 whitespace-nowrap">
                            {formatCurrency(trend.revenue)}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-medium uppercase text-gray-500">
                        {formatDateSafe(trend.date)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </article>
      </section>

      {/* ✨ NUEVO: Gráfico de ventas por producto */}
      <section className="mx-auto w-full">
        <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-gray-100 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-red-50 p-3 text-red-600">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Ventas por producto
                </h3>
                <p className="text-sm text-gray-500">
                  {selectedProduct
                    ? `${selectedProduct.nombre} (${selectedProduct.codigo})`
                    : "Selecciona un producto para ver sus ventas"}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              {/* Filtro de sucursal */}
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <span>🏢 Sucursal:</span>
                <select
                  value={productSearchBranch}
                  onChange={(event) => {
                    setProductSearchBranch(event.target.value);
                    // Recargar top products con nueva sucursal
                    if (!selectedProduct && showProductDropdown) {
                      fetchTopProducts().catch(console.error);
                    }
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  {branchOptions.map((branch) => (
                    <option key={branch.value} value={branch.value}>
                      {branch.label}
                    </option>
                  ))}
                </select>
              </label>

              {/* Filtro de período (controla tanto top products como el gráfico) */}
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <span>📅 Período:</span>
                <select
                  value={productSearchPeriod}
                  onChange={(event) => {
                    setProductSearchPeriod(event.target.value);
                    // Recargar top products con nuevo período
                    if (!selectedProduct && showProductDropdown) {
                      fetchTopProducts().catch(console.error);
                    }
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-red-500"
                  disabled={loadingProductSales}
                >
                  <option value="7">Últimos 7 días</option>
                  <option value="30">Últimos 30 días</option>
                  <option value="60">Últimos 60 días</option>
                  <option value="90">Últimos 90 días</option>
                  <option value="180">Últimos 6 meses</option>
                  <option value="365">Último año</option>
                </select>
              </label>
            </div>
          </div>

          <div className="p-6">
            {/* Buscador de productos */}
            <div className="mb-6 relative product-search-container">
              <div className="relative">
                <input
                  type="text"
                  value={productSearchQuery}
                  onChange={(event) => {
                    const newValue = event.target.value;
                    setProductSearchQuery(newValue);
                    setShowProductDropdown(true);
                    
                    // Si hay un producto seleccionado y el usuario empieza a escribir, deseleccionarlo
                    if (selectedProduct) {
                      setSelectedProduct(null);
                      setProductSalesData([]);
                    }
                  }}
                  onFocus={() => {
                    console.log("🎯 onFocus disparado", { 
                      productSearchQuery, 
                      queryLength: productSearchQuery.length,
                      selectedProduct: !!selectedProduct 
                    });
                    setShowProductDropdown(true);
                    // Cargar productos más vendidos si:
                    // 1. No hay búsqueda activa (menos de 2 caracteres) O
                    // 2. Hay un producto seleccionado (para permitir cambiar de producto)
                    if ((!productSearchQuery || productSearchQuery.length < 2) || selectedProduct) {
                      console.log("➡️ Llamando a fetchTopProducts");
                      fetchTopProducts().catch(console.error);
                    }
                  }}
                  placeholder="Buscar producto por nombre o código..."
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 pr-10 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                {selectedProduct && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProduct(null);
                      setProductSearchQuery("");
                      setProductSalesData([]);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Dropdown de resultados */}
              {showProductDropdown && (
                  <div className="absolute z-10 mt-2 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
                    {/* Título si no hay búsqueda activa */}
                    {(!productSearchQuery || productSearchQuery.length < 2) && productSearchResults.length > 0 && (
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                        <span className="text-xs font-semibold text-gray-600">
                          🔥 Productos más vendidos
                        </span>
                      </div>
                    )}
                    
                    {loadingProductSales ? (
                      <div className="flex items-center justify-center gap-2 p-4 text-sm text-gray-500">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-300 border-t-red-600" />
                        {productSearchQuery && productSearchQuery.length >= 2 ? 'Buscando...' : 'Cargando productos más vendidos...'}
                      </div>
                    ) : productSearchResults.length === 0 ? (
                      <div className="p-4 text-sm text-gray-500">
                        {productSearchQuery && productSearchQuery.length >= 2 
                          ? 'No se encontraron productos' 
                          : 'No hay productos disponibles'}
                      </div>
                    ) : (
                      productSearchResults.map((product) => (
                        <button
                          type="button"
                          key={product.codigo}
                          onClick={() => {
                            setSelectedProduct({
                              codigo: product.codigo,
                              nombre: product.nombre,
                            });
                            setProductSearchQuery(
                              `${product.nombre} (${product.codigo})`
                            );
                            setShowProductDropdown(false);
                          }}
                          className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">
                            {product.nombre}
                          </div>
                          <div className="text-xs text-gray-500">
                            Código: {product.codigo || "N/A"}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
            </div>

            {/* Gráfico */}
            {!selectedProduct ? (
              <div className="flex h-48 items-center justify-center text-sm text-gray-500">
                👆 Busca y selecciona un producto para ver sus ventas
              </div>
            ) : loadingProductSales ? (
              <div className="flex h-48 items-center justify-center gap-3 text-sm text-gray-500">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-300 border-t-red-600" />
                Cargando ventas del producto...
              </div>
            ) : productSalesData.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-gray-500">
                No hay datos de ventas para este producto en el período seleccionado
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-2xl font-semibold text-gray-900">
                      {productSalesData.reduce(
                        (sum, item) => sum + item.quantity,
                        0
                      )}{" "}
                      unidades
                    </p>
                    <p className="text-xs text-gray-500">
                      Promedio:{" "}
                      {(
                        productSalesData.reduce(
                          (sum, item) => sum + item.quantity,
                          0
                        ) / productSalesData.length
                      ).toFixed(1)}{" "}
                      unidades/día
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-gray-900">
                      {formatCurrency(
                        productSalesData.reduce(
                          (sum, item) => sum + item.revenue,
                          0
                        )
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      Ingreso total (sin IVA)
                    </p>
                  </div>
                </div>
                {/* Contenedor con scroll horizontal para el gráfico */}
                <div className="overflow-x-auto overflow-y-visible pb-8">
                  <div 
                    className="flex h-72 items-end justify-center gap-1 pt-12"
                    style={{
                      // Ancho mínimo dinámico: al menos 20px por barra para que las fechas rotadas no se sobrepongan
                      minWidth: `${Math.max(productSalesData.length * 20, 100)}px`
                    }}
                  >
                    {productSalesData.map((item) => {
                      const maxQuantity = Math.max(
                        ...productSalesData.map((d) => d.quantity)
                      );
                      const height =
                        maxQuantity === 0 ? 0 : (item.quantity / maxQuantity) * 100;

                      return (
                        <div
                          key={item.date}
                          className="group relative flex flex-1 flex-col items-center gap-2"
                          style={{
                            // Ancho mínimo de cada barra
                            minWidth: '20px'
                          }}
                        >
                          {/* Tooltip - ahora en el contenedor con position relative */}
                          <div className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 rounded bg-gray-900 px-3 py-2 text-xs text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 whitespace-nowrap z-10 shadow-lg">
                            <div className="font-semibold">{item.quantity} unidades</div>
                            <div className="text-gray-300">{formatCurrency(item.revenue)}</div>
                          </div>

                          <div className="flex h-56 w-full items-end justify-center">
                            <div
                              className="w-full min-h-[6px] rounded-t-md bg-gradient-to-t from-red-600 to-red-400 transition-colors duration-200 group-hover:from-red-700 group-hover:to-red-500"
                              style={{
                                height: `${Math.max(height, 2)}%`,
                                minHeight: "4px",
                              }}
                            />
                          </div>
                          
                          {/* Fecha rotada para evitar sobreposición */}
                          <span 
                            className="text-[10px] font-medium uppercase text-gray-500 whitespace-nowrap origin-top-left"
                            style={{
                              transform: 'rotate(-45deg) translateX(-8px)',
                              marginTop: '8px'
                            }}
                          >
                            {formatDateSafe(item.date)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
