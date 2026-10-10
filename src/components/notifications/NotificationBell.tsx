"use client";

import { useState, useEffect, useRef } from "react";
import {
  Bell,
  Calendar,
  Package,
  RefreshCw,
  MessageCircle,
  AlertTriangle,
} from "lucide-react";
import { useOutdatedProviders } from "@/hooks/useOutdatedProviders";
import { useStockAlerts } from "@/hooks/useStockAlerts";
import { MessagesService } from "@/services/MessagesService";

interface NotificationBellProps {
  /** Frecuencia de actualización en milisegundos (default: 5 minutos) */
  refreshInterval?: number;
}

/**
 * Componente de campana de notificaciones para proveedores desactualizados
 * Muestra un badge con el número de proveedores que necesitan actualización
 */
export default function NotificationBell({
  refreshInterval = 5 * 60 * 1000, // 5 minutos por defecto
}: NotificationBellProps) {
  const { providers, loading, error, count, refresh } =
    useOutdatedProviders(refreshInterval);
  const {
    alerts: stockAlerts,
    count: stockCount,
    refresh: refreshStock,
  } = useStockAlerts(refreshInterval);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Estados para mensajes
  const [messages, setMessages] = useState<
    Array<{
      id: number;
      asunto: string;
      remitente_nombre?: string;
      remitente_email?: string;
      leido: boolean;
      created_at: string;
    }>
  >([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messagesLoaded, setMessagesLoaded] = useState(false); // ✅ Control de carga inicial

  // Cargar mensajes cuando se abre el dropdown
  useEffect(() => {
    const fetchMessages = async () => {
      if (!isOpen || messagesLoaded) return; // Solo cargar si está abierto y no se ha cargado

      try {
        setMessagesLoading(true);
        const { items: recentMessages } = await MessagesService.fetchInbox({
          unread: true,
          last7: true,
        });
        const totalUnread = await MessagesService.unreadCount();
        setMessages(recentMessages.slice(0, 3));
        setUnreadCount(totalUnread);
        setMessagesLoaded(true); // ✅ Marcar como cargado
      } catch (err) {
        console.error("Error fetching messages:", err);
      } finally {
        setMessagesLoading(false);
      }
    };

    fetchMessages();
  }, [isOpen, messagesLoaded]); // ✅ Dependencias correctas

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasNotifications = count > 0 || unreadCount > 0 || stockCount > 0;
  const totalNotifications = count + unreadCount + stockCount;

  // Función para refrescar todas las notificaciones
  const handleRefresh = async () => {
    setMessagesLoaded(false); // Resetear para permitir recarga
    await Promise.all([refresh(), refreshStock()]); // Refrescar proveedores y stock
  };

  // Helper to get bodega name
  const getBodegaName = (bodegaId: number) => {
    const names: Record<number, string> = {
      2723: "Casa Matriz",
      4012: "FM Villa Independencia",
    };
    return names[bodegaId] || `Bodega ${bodegaId}`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón de campana */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 
                   transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
        title={
          hasNotifications
            ? `${totalNotifications} notificación${
                totalNotifications > 1 ? "es" : ""
              } pendiente${totalNotifications > 1 ? "s" : ""}`
            : "Sin notificaciones"
        }
      >
        <Bell
          className={`w-6 h-6 transition-colors ${
            hasNotifications ? "text-orange-500" : "text-gray-600"
          }`}
        />

        {/* Badge con número de notificaciones */}
        {hasNotifications && (
          <span
            className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold 
                       rounded-full w-5 h-5 flex items-center justify-center 
                       animate-pulse"
          >
            {totalNotifications > 9 ? "9+" : totalNotifications}
          </span>
        )}
      </button>

      {/* Dropdown de notificaciones */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-96 bg-white 
                     rounded-lg shadow-xl border border-gray-200 
                     overflow-hidden z-50"
        >
          {/* Header del dropdown */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                Notificaciones
              </h3>
              <button
                onClick={handleRefresh}
                disabled={loading || messagesLoading}
                className="p-1 rounded hover:bg-gray-200 
                         transition-colors disabled:opacity-50"
                title="Actualizar"
              >
                <RefreshCw
                  className={`w-4 h-4 text-gray-600 ${
                    loading || messagesLoading ? "animate-spin" : ""
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Mensajes y catálogos desactualizados
            </p>
          </div>

          {/* Lista de notificaciones */}
          <div className="max-h-96 overflow-y-auto">
            {(loading || messagesLoading) &&
            providers.length === 0 &&
            messages.length === 0 ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
                <p className="text-sm text-gray-600 mt-3">Cargando...</p>
              </div>
            ) : error ? (
              <div className="p-4 text-center">
                <p className="text-sm text-red-600">{error}</p>
                <button
                  onClick={handleRefresh}
                  className="mt-2 text-xs text-red-600 hover:underline"
                >
                  Reintentar
                </button>
              </div>
            ) : !hasNotifications ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-900">Todo al día</p>
                <p className="text-xs text-gray-600 mt-1">
                  No hay notificaciones pendientes
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {/* Mensajes */}
                {messages.map((message) => (
                  <div
                    key={`msg-${message.id}`}
                    className="p-4 hover:bg-gray-50 
                             transition-colors cursor-pointer"
                    onClick={() => {
                      window.location.href = "/dashboard/mensajes";
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icono de mensaje */}
                      <div
                        className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 
                                  flex items-center justify-center"
                      >
                        <MessageCircle className="w-4 h-4 text-red-600" />
                      </div>

                      {/* Contenido */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {message.asunto}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          De{" "}
                          {message.remitente_nombre ||
                            message.remitente_email ||
                            "Sistema"}
                        </p>
                      </div>

                      {/* Badge de no leído */}
                      {!message.leido && (
                        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-red-500" />
                      )}
                    </div>
                  </div>
                ))}

                {/* Alertas de Stock */}
                {stockAlerts.map((alert) => (
                  <div
                    key={`${alert.productId}-${alert.bodegaId}`}
                    className="p-4 hover:bg-gray-50 
                             transition-colors cursor-pointer"
                    onClick={() => {
                      window.location.href = `/dashboard/stock-alerts?search=${encodeURIComponent(
                        alert.productName
                      )}`;
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icono de alerta */}
                      <div
                        className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 
                                  flex items-center justify-center"
                      >
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                      </div>

                      {/* Contenido */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {alert.productName}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Stock bajo en {getBodegaName(alert.bodegaId)}
                        </p>

                        {/* Detalles */}
                        <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                          <Package className="w-3 h-3" />
                          <span>
                            Actual:{" "}
                            <span className="font-semibold text-red-600">
                              {alert.currentStock}
                            </span>
                            {" / "}Mínimo:{" "}
                            <span className="font-semibold">
                              {alert.minStock}
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Badge con nivel de stock */}
                      <div
                        className="flex-shrink-0 px-2 py-1 rounded-full text-xs font-semibold
                                  bg-red-100 
                                  text-red-700"
                      >
                        {alert.currentStock}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Catálogos desactualizados */}
                {providers.map((provider) => (
                  <div
                    key={provider.id}
                    className="p-4 hover:bg-gray-50 
                             transition-colors cursor-pointer"
                    onClick={() => {
                      window.location.href = "/dashboard/proveedores";
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icono de advertencia */}
                      <div
                        className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 
                                  flex items-center justify-center"
                      >
                        <Package className="w-4 h-4 text-orange-600" />
                      </div>

                      {/* Contenido */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {provider.name}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Podría tener precios actualizados disponibles
                        </p>

                        {/* Fecha */}
                        <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                          <Calendar className="w-3 h-3" />
                          <span>
                            Registrado hace{" "}
                            <span className="font-semibold">
                              {provider.daysOld} días
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Badge de días */}
                      <div
                        className="flex-shrink-0 px-2 py-1 rounded-full text-xs font-semibold
                                  bg-orange-100 
                                  text-orange-700"
                      >
                        {provider.daysOld}d
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer con acciones */}
          {hasNotifications && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={() => {
                      window.location.href = "/dashboard/mensajes";
                    }}
                    className="flex-1 px-4 py-2 text-sm font-medium text-red-600 
                             hover:bg-red-50 
                             rounded-lg transition-colors"
                  >
                    Ver mensajes
                  </button>
                )}
                {stockCount > 0 && (
                  <button
                    onClick={() => {
                      window.location.href = "/dashboard/stock-alerts";
                    }}
                    className="flex-1 px-4 py-2 text-sm font-medium text-red-600 
                             hover:bg-red-50 
                             rounded-lg transition-colors"
                  >
                    Ver stock
                  </button>
                )}
                {count > 0 && (
                  <button
                    onClick={() => {
                      window.location.href = "/dashboard/proveedores";
                    }}
                    className="flex-1 px-4 py-2 text-sm font-medium text-orange-600 
                             hover:bg-orange-50 
                             rounded-lg transition-colors"
                  >
                    Ver proveedores
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
