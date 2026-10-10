import type { PharmacyDashboardData } from '@/types/pharmacy'

// Estado global usando globalThis para compatibilidad cliente/servidor
interface DashboardGlobalState {
  isFetching: boolean;
  lastFetchTime: number;
  cache: Map<string, { data: PharmacyDashboardData; timestamp: number }>;
  activePromises: Map<string, Promise<PharmacyDashboardData>>;
}

declare global {
  var __DASHBOARD_GLOBAL_STATE__: DashboardGlobalState | undefined;
}

const getGlobalState = (): DashboardGlobalState => {
  // Usar globalThis que funciona tanto en Node.js como en navegadores
  if (!globalThis.__DASHBOARD_GLOBAL_STATE__) {
    console.log('🌍 Inicializando estado global del dashboard');
    globalThis.__DASHBOARD_GLOBAL_STATE__ = {
      isFetching: false,
      lastFetchTime: 0,
      cache: new Map(),
      activePromises: new Map()
    };
  }
  return globalThis.__DASHBOARD_GLOBAL_STATE__;
};

// Singleton global para controlar fetching
class DashboardFetchManager {
  private static instance: DashboardFetchManager;
  private lastPeriod: string | null = null;

  private constructor() { }

  static getInstance(): DashboardFetchManager {
    if (!DashboardFetchManager.instance) {
      console.log('🏗️ Creando NUEVA instancia de DashboardFetchManager');
      DashboardFetchManager.instance = new DashboardFetchManager();
    } else {
      console.log('♻️ Reutilizando instancia existente de DashboardFetchManager');
    }
    return DashboardFetchManager.instance;
  }

  async fetchDashboardData(
    periodDays: string = "30",
    forceRefresh = false,
    branchId: string | null = "all"
  ): Promise<PharmacyDashboardData> {
    // Convertir string "null" a null real
    const actualBranchId = branchId === "null" ? null : branchId;
    console.log(`🎯 SINGLETON: Llamada a fetchDashboardData - Período: ${periodDays}, Branch: ${actualBranchId}, ForceRefresh: ${forceRefresh}`);
    const cacheKey = `dashboard_${periodDays}_${actualBranchId}`;
    const currentTime = Date.now();
    // 🧹 Detectar cambio de período y limpiar cache automáticamente
    if (this.lastPeriod && this.lastPeriod !== periodDays) {
      console.log('🔄 Período cambió de', this.lastPeriod, 'a', periodDays, '- Limpiando cache automáticamente');
      this.clearCache();
      forceRefresh = true;
    }
    this.lastPeriod = periodDays;

    // ⚡ Caché más agresivo: duraciones más cortas para mejor responsividad
    let CACHE_DURATION: number;
    if (periodDays === 'all') {
      CACHE_DURATION = 15 * 60 * 1000; // 15 minutos para datos históricos
    } else if (parseInt(periodDays) >= 365) {
      CACHE_DURATION = 10 * 60 * 1000; // 10 minutos para períodos largos
    } else if (parseInt(periodDays) >= 30) {
      CACHE_DURATION = 5 * 60 * 1000;  // 5 minutos para períodos medios
    } else {
      CACHE_DURATION = 2 * 60 * 1000;  // 2 minutos para períodos cortos (más responsivo)
    }

    // Verificar si ya hay una promesa activa para esta clave
    const globalState = getGlobalState();
    const activePromise = globalState.activePromises.get(cacheKey);
    if (activePromise && !forceRefresh) {
      console.log('🔄 Reutilizando promesa activa para:', cacheKey);
      return activePromise;
    }

    // Verificar caché
    const cachedData = globalState.cache.get(cacheKey);
    if (!forceRefresh && cachedData && (currentTime - cachedData.timestamp < CACHE_DURATION)) {
      console.log('🚀 Usando datos del caché global para período:', periodDays);
      return cachedData.data;
    }

    // Crear nueva promesa y almacenarla
    const fetchPromise = this.performFetch(cacheKey, periodDays, actualBranchId, currentTime);
    globalState.activePromises.set(cacheKey, fetchPromise);

    try {
      const result = await fetchPromise;
      return result;
    } finally {
      // Limpiar promesa activa cuando termine
      globalState.activePromises.delete(cacheKey);
    }
  }

  private async performFetch(
    cacheKey: string,
    periodDays: string,
    branchId: string | null,
    currentTime: number
  ): Promise<PharmacyDashboardData> {
    console.log('🔄 Ejecutando fetch único para período:', periodDays, 'y sucursal:', branchId);

    const params = new URLSearchParams();
    params.append("use_real_data", "true");
    params.append("period_days", periodDays);
    // ✨ NUEVO MAPEO: "0" = todas, "null" = casa matriz, "2191" = segunda sucursal
    if (branchId !== null) {
      params.append("branch_id", branchId);
    }

    // Enviando parámetros al API

    const response = await fetch(`/api/pharmacy/dashboard?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    // Guardar en caché global
    const globalState = getGlobalState();
    globalState.cache.set(cacheKey, { data, timestamp: currentTime });

    // Datos obtenidos y guardados en caché
    return data;
  }

  clearCache() {
    const globalState = getGlobalState();
    globalState.cache.clear();
    globalState.activePromises.clear();
    globalState.lastFetchTime = 0;
    console.log('🧹 Cache global limpiado');
  }

  // Método para limpiar caché automáticamente y forzar refresh
  forceRefresh() {
    this.clearCache();
    console.log('🔄 Forzando refresh completo del dashboard');
  }
}

export const dashboardFetchManager = DashboardFetchManager.getInstance();