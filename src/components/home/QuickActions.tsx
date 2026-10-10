'use client';

import Link from 'next/link';
import { BarChart3, DollarSign, Users, Settings, Star, MessageCircle, TrendingUp } from 'lucide-react';

interface QuickAction {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color: string;
  bgColor: string;
}

const quickActions: QuickAction[] = [
  {
    title: 'Dashboard',
    description: 'Análisis y métricas',
    icon: BarChart3,
    href: '/dashboard',
    color: 'text-gray-900',
    bgColor: 'bg-white hover:bg-gray-50 border-gray-300'
  },
  {
    title: 'Ranking',
    description: 'Productos más vendidos',
    icon: Star,
    href: '/dashboard/ranking',
    color: 'text-gray-900',
    bgColor: 'bg-white hover:bg-gray-50 border-gray-300'
  },
  {
    title: 'Proveedores',
    description: 'Comparar precios',
    icon: DollarSign,
    href: '/dashboard/proveedores',
    color: 'text-gray-900',
    bgColor: 'bg-white hover:bg-gray-50 border-gray-300'
  },
  {
    title: 'Analytics',
    description: 'Análisis avanzado',
    icon: TrendingUp,
    href: '/dashboard/analytics',
    color: 'text-gray-900',
    bgColor: 'bg-white hover:bg-gray-50 border-gray-300'
  },
  {
    title: 'Mensajes',
    description: 'Comunicación interna',
    icon: MessageCircle,
    href: '/dashboard/mensajes',
    color: 'text-gray-900',
    bgColor: 'bg-white hover:bg-gray-50 border-gray-300'
  },
  {
    title: 'Usuarios',
    description: 'Administrar permisos',
    icon: Users,
    href: '/dashboard/usuarios',
    color: 'text-gray-900',
    bgColor: 'bg-white hover:bg-gray-50 border-gray-300'
  },
  {
    title: 'Configuración',
    description: 'Ajustes del sistema',
    icon: Settings,
    href: '/dashboard/configuracion',
    color: 'text-gray-900',
    bgColor: 'bg-white hover:bg-gray-50 border-gray-300'
  }
];

export default function QuickActions() {
  return (
    <div className="bg-[var(--surface)] rounded-lg shadow-md p-6 border border-[var(--border)]">
      <h2 className="text-xl font-bold text-[var(--foreground)] mb-4">
        Accesos Rápidos
      </h2>
      <div className="space-y-4">
        {/* Primera fila - 4 botones principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.slice(0, 4).map((action) => {
            const IconComponent = action.icon;
            return (
            <Link
              key={action.href}
              href={action.href}
              className={`${action.bgColor} border-2 rounded-lg p-4 transition-all hover:shadow-md hover:scale-105`}
            >
              <div className="text-center">
                <div className="flex justify-center mb-2">
                  <IconComponent className="w-10 h-10 text-gray-700" />
                </div>
                <h3 className={`font-semibold ${action.color} mb-1`}>
                  {action.title}
                </h3>
                <p className="text-sm text-gray-600">
                  {action.description}
                </p>
              </div>
            </Link>
          );})}
        </div>
        
        {/* Segunda fila - 3 botones centrados */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {quickActions.slice(4).map((action) => {
            const IconComponent = action.icon;
            return (
            <Link
              key={action.href}
              href={action.href}
              className={`${action.bgColor} border-2 rounded-lg p-4 transition-all hover:shadow-md hover:scale-105`}
            >
              <div className="text-center">
                <div className="flex justify-center mb-2">
                  <IconComponent className="w-10 h-10 text-gray-700" />
                </div>
                <h3 className={`font-semibold ${action.color} mb-1`}>
                  {action.title}
                </h3>
                <p className="text-sm text-gray-600">
                  {action.description}
                </p>
              </div>
            </Link>
          );})}
        </div>
      </div>
    </div>
  );
}
