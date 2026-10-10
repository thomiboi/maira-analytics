"use client";

import { useState, useEffect } from "react";
import {
  Trash2,
  AlertTriangle,
  Package,
  TrendingUp,
  Upload,
} from "lucide-react";
import ExcelImportModal from "@/components/suppliers/ExcelImportModal";
import DeleteConfirmModal from "@/components/suppliers/DeleteConfirmModal";
import Toast, { ToastType } from "@/components/ui/Toast";

// Tipos para los proveedores
interface Provider {
  id: string;
  name: string;
  created_at: string;
  stats?: {
    productsCount: number;
    averagePrice: number;
    minPrice: number;
    maxPrice: number;
  };
}

interface ProviderResponse {
  success: boolean;
  providers: Provider[];
  total: number;
  error?: string;
}

/**
 * Calcula la diferencia en días entre la fecha actual y una fecha dada
 */
const calculateDaysAgo = (dateString: string): number => {
  const createdDate = new Date(dateString);
  const currentDate = new Date();
  const diffTime = Math.abs(currentDate.getTime() - createdDate.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

/**
 * Determina el estado del indicador de antigüedad basado en los días
 * - Verde: 0-3 días (nuevo)
 * - Amarillo: 4-6 días (próximo a vencer)
 * - Rojo: 7+ días (vencido - aparece en notificaciones)
 */
const getAgeIndicatorStatus = (
  daysAgo: number
): "verde" | "amarillo" | "rojo" => {
  if (daysAgo <= 3) return "verde";
  if (daysAgo <= 6) return "amarillo";
  return "rojo"; // 7+ días = rojo (vencido)
};

interface ProvidersManagementProps {
  /** Callback que se ejecuta cuando se realizan cambios en los proveedores */
  onProvidersChange?: () => void;
}

/**
 * Componente para gestionar proveedores
 * Permite listar, crear y eliminar proveedores
 */
export default function ProvidersManagement({
  onProvidersChange,
}: ProvidersManagementProps) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Estado para el modal de importación de Excel
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Estado para el modal de confirmación de eliminación
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Estado para el toast de notificaciones
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
    subtitle?: string;
  } | null>(null);

  /**
   * Carga la lista de proveedores desde la API
   */
  const fetchProviders = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/providers");

      if (!response.ok) {
        throw new Error(
          `Error ${response.status}: No se pudieron cargar los proveedores`
        );
      }

      const data: ProviderResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al cargar proveedores");
      }

      setProviders(data.providers);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error desconocido";
      setError(errorMessage);
      console.error("❌ Error cargando proveedores:", err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Elimina un proveedor después de confirmar
   */
  const handleDelete = async (providerId: string, providerName: string) => {
    // Abrir modal de confirmación
    setProviderToDelete({ id: providerId, name: providerName });
    setDeleteModalOpen(true);
  };

  /**
   * Confirma y ejecuta la eliminación del proveedor
   */
  const confirmDelete = async () => {
    if (!providerToDelete) return;

    try {
      setDeletingId(providerToDelete.id);
      setError(null);

      const response = await fetch(`/api/providers/${providerToDelete.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Error al eliminar el proveedor");
      }

      // ✅ Actualizar el estado local sin recargar la página
      setProviders((prevProviders) =>
        prevProviders.filter((provider) => provider.id !== providerToDelete.id)
      );

      console.log(`✅ Proveedor eliminado: ${providerToDelete.name}`);

      // Notificar al componente padre que hubo cambios
      if (onProvidersChange) {
        onProvidersChange();
      }

      // Cerrar modal
      setDeleteModalOpen(false);
      setProviderToDelete(null);

      // Mostrar toast de éxito
      setToast({
        message: "Proveedor eliminado exitosamente",
        type: "success",
        subtitle: `${providerToDelete.name} - ${
          data.stats?.pricesDeleted || 0
        } precios eliminados`,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error desconocido";
      setError(errorMessage);
      console.error("❌ Error eliminando proveedor:", err);

      // Mostrar toast de error
      setToast({
        message: "Error al eliminar el proveedor",
        type: "error",
        subtitle: errorMessage,
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Cargar proveedores al montar el componente
  useEffect(() => {
    fetchProviders();
  }, []);

  // Estado de carga
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            Cargando proveedores...
          </p>
        </div>
      </div>
    );
  }

  // Estado de error
  if (error && providers.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <h3 className="text-lg font-semibold text-red-800">
              Error al Cargar Proveedores
            </h3>
          </div>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchProviders}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con formulario de creación */}
      <div className="bg-white rounded-lg border border-gray-300 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Gestión de Proveedores
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {providers.length} proveedor{providers.length !== 1 ? "es" : ""}{" "}
              registrado{providers.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Botón para importar catálogo Excel */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg 
                     hover:bg-green-700 transition-colors font-medium"
          >
            <Upload className="w-5 h-5" />
            Importar Catálogo Excel
          </button>
        </div>

        {/* Formulario para crear nuevo proveedor */}
        {/* <form onSubmit={handleCreate} className="flex gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={newProviderName}
              onChange={(e) => setNewProviderName(e.target.value)}
              placeholder="Nombre del nuevo proveedor..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg 
                       bg-white text-gray-900
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isCreating}
            />
            {createError && (
              <p className="mt-1 text-sm text-red-600">
                {createError}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={isCreating || !newProviderName.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg 
                     hover:bg-blue-700 transition-colors disabled:opacity-50 
                     disabled:cursor-not-allowed font-medium"
          >
            {isCreating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Creando...
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                Agregar Proveedor
              </>
            )}
          </button>
        </form> */}
      </div>

      {/* Error general */}
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">{error}</p>
        </div>
      )}

      {/* Lista de proveedores */}
      {providers.length === 0 ? (
        <div className="bg-gray-50 border border-gray-300 rounded-lg p-12 text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No hay proveedores registrados
          </h3>
          <p className="text-gray-600">
            Agrega tu primer proveedor usando el formulario de arriba
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className="bg-white rounded-lg border border-gray-300 p-6 
                       hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {/* Indicador de antigüedad tipo semáforo */}
                    {(() => {
                      const daysAgo = calculateDaysAgo(provider.created_at);
                      const status = getAgeIndicatorStatus(daysAgo);
                      const statusColors = {
                        verde: "bg-green-500",
                        amarillo: "bg-yellow-500",
                        rojo: "bg-red-500",
                      };
                      const statusText = {
                        verde: "Nuevo (0-3 días)",
                        amarillo: "Próximo a actualizar (4-6 días)",
                        rojo: `Requiere actualización (${daysAgo} días)`,
                      };

                      return (
                        <div
                          className="flex items-center gap-2"
                          title={statusText[status]}
                        >
                          <span
                            className={`w-3 h-3 rounded-full ${
                              statusColors[status]
                            } 
                                          ring-2 ring-offset-2 ring-offset-white 
                                          ${
                                            status === "verde"
                                              ? "ring-green-300"
                                              : status === "amarillo"
                                              ? "ring-yellow-300"
                                              : "ring-red-300"
                                          }`}
                          ></span>
                        </div>
                      );
                    })()}

                    <h3 className="text-lg font-semibold text-gray-900">
                      {provider.name}
                    </h3>
                  </div>

                  <div className="text-sm text-gray-600 mb-3">
                    Registrado:{" "}
                    {new Date(provider.created_at).toLocaleDateString("es-ES", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                    {" · "}
                    <span className="font-medium">
                      Hace {calculateDaysAgo(provider.created_at)} día
                      {calculateDaysAgo(provider.created_at) !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Estadísticas del proveedor */}
                  {provider.stats && provider.stats.productsCount > 0 && (
                    <div className="flex items-center gap-6 mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-blue-600" />
                        <span className="text-sm text-gray-700">
                          <span className="font-semibold">
                            {provider.stats.productsCount}
                          </span>{" "}
                          productos
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-gray-700">
                          Promedio:{" "}
                          <span className="font-semibold">
                            ${provider.stats.averagePrice}
                          </span>
                        </span>
                      </div>
                      {provider.stats.minPrice > 0 && (
                        <div className="text-sm text-gray-600">
                          Rango: ${provider.stats.minPrice} - $
                          {provider.stats.maxPrice}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Botón de eliminar */}
                <button
                  onClick={() => handleDelete(provider.id, provider.name)}
                  disabled={deletingId === provider.id}
                  className="flex items-center gap-2 px-4 py-2 text-red-600
                           hover:bg-red-50 rounded-lg transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  title={`Eliminar ${provider.name}`}
                >
                  {deletingId === provider.id ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Eliminar
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de importación de Excel */}
      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          // Recargar proveedores después de importar (puede que se hayan usado nuevos proveedores)
          fetchProviders();
          // Notificar al componente padre que hubo cambios
          if (onProvidersChange) {
            onProvidersChange();
          }
        }}
      />

      {/* Modal de confirmación de eliminación */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setProviderToDelete(null);
        }}
        onConfirm={confirmDelete}
        providerName={providerToDelete?.name || ""}
        isDeleting={deletingId === providerToDelete?.id}
      />

      {/* Toast de notificaciones */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          subtitle={toast.subtitle}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
