'use client';

import { useState, useEffect } from 'react';
import { Bell, AlertTriangle, Info, CheckCircle, AlertCircle, Loader2, Package } from 'lucide-react';
import { MessagesService } from '@/services/MessagesService';
import { useOutdatedProviders } from '@/hooks/useOutdatedProviders';

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'alert';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

export default function NotificationWidget() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Hook para obtener proveedores desactualizados
  const { providers: outdatedProviders, count: outdatedCount, loading: outdatedLoading } = useOutdatedProviders();

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Obtener mensajes no leídos de los últimos 7 días
        const { items: recentMessages } = await MessagesService.fetchInbox({ 
          unread: true, 
          last7: true 
        });
        
        // Obtener conteo total de no leídos
        const totalUnread = await MessagesService.unreadCount();
        setUnreadCount(totalUnread);
        
        // Convertir mensajes a notificaciones
        const messageNotifications: Notification[] = recentMessages.slice(0, 3).map((msg) => ({
          id: `msg-${msg.id}`,
          type: 'info' as const,
          title: msg.asunto,
          message: `Mensaje de ${msg.remitente_nombre || msg.remitente_email || 'Sistema'}`,
          time: formatTimeAgo(msg.created_at),
          read: msg.leido
        }));
        
        // Convertir proveedores desactualizados a notificaciones
        const outdatedNotifications: Notification[] = outdatedProviders.slice(0, 2).map((provider) => ({
          id: `outdated-${provider.id}`,
          type: 'warning' as const,
          title: 'Catálogo Desactualizado',
          message: `${provider.name} - ${provider.daysOld} días sin actualizar`,
          time: formatTimeAgo(provider.created_at),
          read: false
        }));
        
        // Combinar todas las notificaciones
        const allNotifications = [...messageNotifications, ...outdatedNotifications];
        setNotifications(allNotifications);
      } catch (err) {
        console.error('Error fetching notifications:', err);
        setError('Error al cargar notificaciones');
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [outdatedProviders]);

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Ahora mismo';
    if (diffInMinutes < 60) return `Hace ${diffInMinutes} min`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `Hace ${diffInHours}h`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `Hace ${diffInDays}d`;
  };

  const getTypeConfig = (type: Notification['type']) => {
    switch (type) {
      case 'warning':
        return { Icon: Package, bg: 'bg-white', border: 'border-gray-300', text: 'text-gray-900', iconColor: 'text-yellow-600' };
      case 'info':
        return { Icon: Bell, bg: 'bg-white', border: 'border-gray-300', text: 'text-gray-900', iconColor: 'text-blue-600' };
      case 'success':
        return { Icon: CheckCircle, bg: 'bg-white', border: 'border-gray-300', text: 'text-gray-900', iconColor: 'text-green-600' };
      case 'alert':
        return { Icon: AlertCircle, bg: 'bg-white', border: 'border-gray-300', text: 'text-gray-900', iconColor: 'text-red-600' };
    }
  };

  const markAsRead = async (id: string) => {
    try {
      // Solo marcar como leído si es un mensaje (no catálogos desactualizados)
      if (id.startsWith('msg-')) {
        const messageId = id.replace('msg-', '');
        await MessagesService.markRead(parseInt(messageId));
        setNotifications(notifications.map(n => 
          n.id === id ? { ...n, read: true } : n
        ));
        setUnreadCount(Math.max(0, unreadCount - 1));
      }
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  if (loading) {
    return (
      <div className="bg-[var(--surface)] rounded-lg shadow-md p-6 border border-[var(--border)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Bell className="w-5 h-5" />
            <span>Notificaciones</span>
          </h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-3 rounded-lg border bg-[var(--surface-muted)] animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface)] rounded-lg shadow-md p-6 border border-[var(--border)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
          <Bell className="w-5 h-5" />
          <span>Notificaciones</span>
          {(unreadCount > 0 || outdatedCount > 0) && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              {unreadCount + outdatedCount}
            </span>
          )}
        </h2>
        <div className="flex gap-2">
          <a 
            href="/dashboard/mensajes" 
            className="text-sm text-red-600 hover:text-red-800 dark:text-red-400"
          >
            Mensajes
          </a>
          {outdatedCount > 0 && (
            <a 
              href="/dashboard/proveedores" 
              className="text-sm text-yellow-600 hover:text-yellow-800 dark:text-yellow-400"
            >
              Catálogos
            </a>
          )}
        </div>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {error ? (
          <div className="text-center py-4">
            <p className="text-[var(--text-subtle)]">
              Error al cargar notificaciones
            </p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-[var(--text-subtle)]">
              No hay notificaciones recientes
            </p>
          </div>
        ) : (
          notifications.map((notification) => {
            const config = getTypeConfig(notification.type);
            return (
              <div
                key={notification.id}
                className={`p-3 rounded-lg border ${config.bg} ${config.border} ${!notification.read ? 'border-l-4' : ''} transition-all`}
              >
                <div className="flex items-start gap-3">
                  <config.Icon className={`w-6 h-6 ${config.iconColor}`} />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <h3 className={`font-semibold ${config.text}`}>
                        {notification.title}
                      </h3>
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="text-xs text-[var(--text-subtle)] hover:text-[var(--foreground)]"
                        >
                          ✓
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-muted)] mt-1">
                      {notification.message}
                    </p>
                    <p className="text-xs text-[var(--text-subtle)] mt-1">
                      {notification.time}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
