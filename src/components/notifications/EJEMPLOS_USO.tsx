/**
 * 🔔 EJEMPLO DE USO - Sistema de Notificaciones para Proveedores
 *
 * Este archivo muestra diferentes formas de usar el sistema de notificaciones.
 */

// ============================================================================
// EJEMPLO 1: Uso básico en el Header (YA IMPLEMENTADO)
// ============================================================================
import NotificationBell from "@/components/notifications/NotificationBell";

function HeaderEjemplo() {
  return (
    <header className="flex items-center gap-4">
      <div>Logo</div>
      <div>Menu</div>

      {/* Campana con configuración por defecto (actualiza cada 5 minutos) */}
      <NotificationBell />

      <div>User Menu</div>
    </header>
  );
}

// ============================================================================
// EJEMPLO 2: Configuración personalizada
// ============================================================================
function HeaderConActualizacionRapida() {
  return (
    <header>
      {/* Actualizar cada 1 minuto (útil en desarrollo) */}
      <NotificationBell refreshInterval={60 * 1000} />
    </header>
  );
}

function HeaderSinAutoRefresh() {
  return (
    <header>
      {/* Solo actualiza manualmente (refreshInterval = 0) */}
      <NotificationBell refreshInterval={0} />
    </header>
  );
}

// ============================================================================
// EJEMPLO 3: Usar el hook directamente en un componente personalizado
// ============================================================================
import { useOutdatedProviders } from "@/hooks/useOutdatedProviders";

function MiComponentePersonalizado() {
  const { providers, count, loading, error, refresh } = useOutdatedProviders();

  if (loading) return <div>Cargando...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">
          Proveedores Desactualizados ({count})
        </h2>
        <button
          onClick={refresh}
          className="px-3 py-1 bg-blue-500 text-white rounded"
        >
          Actualizar
        </button>
      </div>

      {count === 0 ? (
        <p className="text-gray-500">¡Todo al día! 🎉</p>
      ) : (
        <ul className="space-y-2">
          {providers.map((provider) => (
            <li key={provider.id} className="p-3 bg-gray-50 rounded">
              <div className="font-semibold">{provider.name}</div>
              <div className="text-sm text-gray-600">
                Hace {provider.daysOld} días
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================================
// EJEMPLO 4: Widget para el Dashboard
// ============================================================================
function ProveedoresDesactualizadosWidget() {
  const { count, loading } = useOutdatedProviders();

  return (
    <div className="p-6 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl text-white">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-white/20 rounded-lg">🔔</div>
        <h3 className="text-lg font-semibold">Alertas</h3>
      </div>

      {loading ? (
        <div className="text-2xl font-bold">...</div>
      ) : (
        <>
          <div className="text-4xl font-bold mb-1">{count}</div>
          <p className="text-sm opacity-90">
            {count === 1
              ? "Proveedor necesita actualización"
              : "Proveedores necesitan actualización"}
          </p>
        </>
      )}
    </div>
  );
}

// ============================================================================
// EJEMPLO 5: Badge simple para sidebar
// ============================================================================
function SidebarConBadge() {
  const { count } = useOutdatedProviders();

  return (
    <nav className="w-64 bg-gray-800 text-white p-4">
      <ul className="space-y-2">
        <li>
          <a href="/dashboard" className="block p-2 rounded hover:bg-gray-700">
            Dashboard
          </a>
        </li>
        <li>
          <a
            href="/dashboard/suppliers"
            className="flex items-center justify-between p-2 rounded hover:bg-gray-700"
          >
            <span>Proveedores</span>
            {count > 0 && (
              <span className="px-2 py-1 bg-red-500 text-xs rounded-full">
                {count}
              </span>
            )}
          </a>
        </li>
        <li>
          <a
            href="/dashboard/products"
            className="block p-2 rounded hover:bg-gray-700"
          >
            Productos
          </a>
        </li>
      </ul>
    </nav>
  );
}

// ============================================================================
// EJEMPLO 6: Notificación Toast cuando hay nuevos proveedores
// ============================================================================
import { useEffect, useState } from "react";

function NotificacionToast() {
  const { count } = useOutdatedProviders();
  const [previousCount, setPreviousCount] = useState(count);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    // Si el contador aumentó, mostrar notificación
    if (count > previousCount && previousCount > 0) {
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
    }
    setPreviousCount(count);
  }, [count, previousCount]);

  if (!showToast) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-orange-500 text-white px-6 py-4 rounded-lg shadow-xl animate-slide-up">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🔔</span>
        <div>
          <div className="font-bold">Nuevo proveedor desactualizado</div>
          <div className="text-sm opacity-90">
            Revisa los catálogos para actualizar precios
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EJEMPLO 7: Lista completa en página dedicada
// ============================================================================
function PaginaProveedoresDesactualizados() {
  const { providers, loading, error, refresh } = useOutdatedProviders();

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            Proveedores Desactualizados
          </h1>
          <p className="text-gray-600">
            Proveedores con más de 7 días que podrían tener catálogos
            actualizados
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg mb-6">
          Error: {error}
        </div>
      )}

      {loading && providers.length === 0 ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Cargando proveedores...</p>
        </div>
      ) : providers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold mb-2">¡Todo al día!</h2>
          <p className="text-gray-600">
            No hay proveedores con catálogos desactualizados
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2">{provider.name}</h3>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>
                      📅 Registrado:{" "}
                      {new Date(provider.created_at).toLocaleDateString(
                        "es-CL"
                      )}
                    </span>
                    <span className="font-semibold text-orange-600">
                      ⏰ Hace {provider.daysOld} días
                    </span>
                  </div>
                </div>
                <button
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  onClick={() => {
                    // Abrir modal de importación o navegar
                    console.log("Actualizar catálogo de", provider.name);
                  }}
                >
                  Actualizar Catálogo
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// EJEMPLO 8: Integración con sistema de tareas/recordatorios
// ============================================================================
function SistemaRecordatorios() {
  const { providers, count } = useOutdatedProviders();

  // Crear recordatorios automáticos
  const recordatorios = providers.map((provider) => ({
    id: provider.id,
    tipo: "actualizar_catalogo",
    prioridad:
      provider.daysOld > 30 ? "alta" : provider.daysOld > 14 ? "media" : "baja",
    mensaje: `Actualizar catálogo de ${provider.name}`,
    diasPendiente: provider.daysOld,
  }));

  return (
    <div className="space-y-2">
      <h3 className="font-bold">Recordatorios ({count})</h3>
      {recordatorios.map((recordatorio) => (
        <div
          key={recordatorio.id}
          className={`p-3 rounded border-l-4 ${
            recordatorio.prioridad === "alta"
              ? "border-red-500 bg-red-50"
              : recordatorio.prioridad === "media"
              ? "border-yellow-500 bg-yellow-50"
              : "border-blue-500 bg-blue-50"
          }`}
        >
          <div className="font-semibold">{recordatorio.mensaje}</div>
          <div className="text-sm text-gray-600">
            Pendiente hace {recordatorio.diasPendiente} días • Prioridad:{" "}
            {recordatorio.prioridad}
          </div>
        </div>
      ))}
    </div>
  );
}

export {
  HeaderEjemplo,
  HeaderConActualizacionRapida,
  HeaderSinAutoRefresh,
  MiComponentePersonalizado,
  ProveedoresDesactualizadosWidget,
  SidebarConBadge,
  NotificacionToast,
  PaginaProveedoresDesactualizados,
  SistemaRecordatorios,
};
