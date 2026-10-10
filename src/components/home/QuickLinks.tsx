'use client';

import { FileSpreadsheet, RefreshCw, FileText, Bell, Target } from 'lucide-react';

interface QuickLink {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  action: string;
}

const quickLinks: QuickLink[] = [
  {
    title: 'Importar Catálogo',
    description: 'Sube archivo Excel con productos',
    icon: FileSpreadsheet,
    action: 'Importar'
  },
  {
    title: 'Sincronizar Precios',
    description: 'Actualiza desde web scraping',
    icon: RefreshCw,
    action: 'Sincronizar'
  },
  {
    title: 'Generar Reporte',
    description: 'Exportar comparativa de precios',
    icon: FileText,
    action: 'Generar'
  },
  {
    title: 'Configurar Alertas',
    description: 'Define umbrales de stock',
    icon: Bell,
    action: 'Configurar'
  }
];

export default function QuickLinks() {
  const handleAction = (title: string) => {
    alert(`Función "${title}" en desarrollo`);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Target className="w-5 h-5" />
        <span>Acciones Rápidas</span>
      </h2>

      <div className="space-y-3">
        {quickLinks.map((link) => (
          <button
            key={link.title}
            onClick={() => handleAction(link.title)}
            className="w-full flex items-center gap-4 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
          >
            <link.icon className="w-8 h-8 text-gray-600 dark:text-gray-400" />
            <div className="flex-1 text-left">
              <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {link.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {link.description}
              </p>
            </div>
            <div className="px-4 py-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-md text-sm font-medium group-hover:bg-blue-600 group-hover:text-white transition-colors">
              {link.action}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
