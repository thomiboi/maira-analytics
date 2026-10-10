import { useState, useEffect, useCallback } from 'react';

interface OutdatedProvider {
    id: string;
    name: string;
    created_at: string;
    daysOld: number;
}

interface UseOutdatedProvidersResult {
    providers: OutdatedProvider[];
    loading: boolean;
    error: string | null;
    count: number;
    refresh: () => Promise<void>;
}

/**
 * Hook personalizado para obtener proveedores con catálogos desactualizados
 * @param refreshInterval - Intervalo de actualización automática en milisegundos (default: 5 minutos)
 * @returns Estado y funciones para manejar proveedores desactualizados
 */
export function useOutdatedProviders(
    refreshInterval: number = 5 * 60 * 1000
): UseOutdatedProvidersResult {
    const [providers, setProviders] = useState<OutdatedProvider[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Obtiene la lista de proveedores desactualizados desde la API
     */
    const fetchProviders = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/providers/outdated');

            if (!response.ok) {
                throw new Error('Error al cargar proveedores desactualizados');
            }

            const data = await response.json();

            if (data.success) {
                setProviders(data.providers || []);
            } else {
                throw new Error(data.error || 'Error desconocido');
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
            setError(errorMessage);
            console.error('❌ Error en useOutdatedProviders:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Cargar datos al montar el componente
    useEffect(() => {
        fetchProviders();
    }, [fetchProviders]);

    // Configurar actualización automática
    useEffect(() => {
        if (refreshInterval > 0) {
            const interval = setInterval(fetchProviders, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [refreshInterval, fetchProviders]);

    return {
        providers,
        loading,
        error,
        count: providers.length,
        refresh: fetchProviders,
    };
}
