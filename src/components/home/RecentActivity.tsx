'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, Edit, User, Clock, Loader2, MessageCircle } from 'lucide-react';
import { MessagesService } from '@/services/MessagesService';

interface Activity {
  id: string;
  type: 'update' | 'sync' | 'alert' | 'user' | 'message';
  title: string;
  description: string;
  time: string;
  user?: string;
}

export default function RecentActivity() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecentActivity = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Obtener mensajes recientes de los últimos 7 días
        const { items: recentMessages } = await MessagesService.fetchInbox({ 
          last7: true 
        });
        
        // Convertir mensajes a actividades
        const convertedActivities: Activity[] = recentMessages.slice(0, 6).map((msg) => ({
          id: msg.id.toString(),
          type: 'message' as const,
          title: msg.asunto,
          description: `Mensaje de ${msg.remitente_nombre || msg.remitente_email || 'Sistema'}`,
          time: formatTimeAgo(msg.created_at),
          user: msg.remitente_nombre || 'Sistema'
        }));
        
        // Agregar algunas actividades del sistema (simuladas por ahora)
        const systemActivities: Activity[] = [
          {
            id: 'system-1',
            type: 'sync',
            title: 'Sincronización de Datos',
            description: 'Actualización automática de datos del sistema completada',
            time: 'Hace 2 horas',
            user: 'Sistema'
          },
          {
            id: 'system-2',
            type: 'update',
            title: 'Dashboard Actualizado',
            description: 'Métricas y estadísticas actualizadas',
            time: 'Hace 4 horas',
            user: 'Sistema'
          }
        ];
        
        // Combinar actividades y ordenar por tiempo
        const allActivities = [...convertedActivities, ...systemActivities]
          .sort((a, b) => {
            // Ordenar por tiempo (más recientes primero)
            const timeA = parseTimeToMinutes(a.time);
            const timeB = parseTimeToMinutes(b.time);
            return timeA - timeB;
          })
          .slice(0, 6);
        
        setActivities(allActivities);
      } catch (err) {
        console.error('Error fetching recent activity:', err);
        setError('Error al cargar actividad reciente');
        setActivities([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentActivity();
  }, []);

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

  const parseTimeToMinutes = (timeStr: string): number => {
    if (timeStr.includes('min')) {
      return parseInt(timeStr.match(/\d+/)?.[0] || '0');
    }
    if (timeStr.includes('h')) {
      return parseInt(timeStr.match(/\d+/)?.[0] || '0') * 60;
    }
    if (timeStr.includes('d')) {
      return parseInt(timeStr.match(/\d+/)?.[0] || '0') * 24 * 60;
    }
    return 0;
  };

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'sync': return RefreshCw;
      case 'alert': return AlertTriangle;
      case 'update': return Edit;
      case 'user': return User;
      case 'message': return MessageCircle;
    }
  };

  const getActivityColor = (type: Activity['type']) => {
    switch (type) {
      case 'sync': return 'text-blue-600 dark:text-blue-400';
      case 'alert': return 'text-red-600 dark:text-red-400';
      case 'update': return 'text-green-600 dark:text-green-400';
      case 'user': return 'text-purple-600 dark:text-purple-400';
      case 'message': return 'text-indigo-600 dark:text-indigo-400';
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          <span>Actividad Reciente</span>
        </h2>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5" />
        <span>Actividad Reciente</span>
      </h2>

      <div className="space-y-4 max-h-96 overflow-y-auto">
        {error ? (
          <div className="text-center py-4">
            <p className="text-gray-500 dark:text-gray-400">
              Error al cargar actividad reciente
            </p>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-gray-500 dark:text-gray-400">
              No hay actividad reciente
            </p>
          </div>
        ) : (
          activities.map((activity, index) => (
            <div key={activity.id} className="relative">
              {/* Timeline line */}
              {index !== activities.length - 1 && (
                <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
              )}
              
              <div className="flex gap-3">
                {/* Icon */}
                <div className={`flex-shrink-0 w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center relative z-10`}>
                  {(() => {
                    const IconComponent = getActivityIcon(activity.type);
                    return <IconComponent className="w-5 h-5 text-gray-600 dark:text-gray-300" />;
                  })()}
                </div>
                
                {/* Content */}
                <div className="flex-1 pb-4">
                  <div className="flex items-start justify-between">
                    <h3 className={`font-semibold ${getActivityColor(activity.type)}`}>
                      {activity.title}
                    </h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {activity.time}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {activity.description}
                  </p>
                  {activity.user && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Por: {activity.user}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <a 
          href="/dashboard/mensajes" 
          className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium"
        >
          Ver historial completo →
        </a>
      </div>
    </div>
  );
}
