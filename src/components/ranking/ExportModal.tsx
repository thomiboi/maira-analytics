'use client';

import { useState } from 'react';
import { X, Calendar, FileSpreadsheet, FileText, Download } from 'lucide-react';
import { exportToExcel, exportToPDF } from '@/lib/export-utils';

interface ProductRanking {
  ranking: number;
  codigo: string;
  nombre: string;
  unidades: number;
  ingresos: number;
  costo: number;
  margen: number;
  margenDinero: number;
  frecuencia: number;
  crecimiento: number;
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFechaInicio: string;
  currentFechaFin: string;
  sucursal: string;
  viewMode: string;
  productos: ProductRanking[];
}

export default function ExportModal({
  isOpen,
  onClose,
  currentFechaInicio,
  currentFechaFin,
  sucursal,
  viewMode,
  productos
}: ExportModalProps) {
  const [usarFechasActuales, setUsarFechasActuales] = useState(true);
  const [fechaInicio, setFechaInicio] = useState(currentFechaInicio);
  const [fechaFin, setFechaFin] = useState(currentFechaFin);
  const [exportando, setExportando] = useState(false);

  if (!isOpen) return null;

  const handleExport = async (tipo: 'excel' | 'pdf') => {
    setExportando(true);
    
    const fechasExport = usarFechasActuales 
      ? { fechaInicio: currentFechaInicio, fechaFin: currentFechaFin }
      : { fechaInicio, fechaFin };

    try {
      // Obtener TODOS los productos (sin paginación) para exportar
      const params = new URLSearchParams({
        sucursal,
        fechaInicio: fechasExport.fechaInicio,
        fechaFin: fechasExport.fechaFin,
        viewMode,
        page: '1',
        pageSize: '999999', // Sin límite para obtener todos los productos
      });

      const response = await fetch(`/api/ranking/productos?${params}`);
      
      if (!response.ok) {
        throw new Error('Error al obtener productos para exportar');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Error al obtener datos');
      }

      const todosLosProductos = result.data.productos;

      // Exportar con todos los productos
      if (tipo === 'excel') {
        exportToExcel({
          productos: todosLosProductos,
          fechaInicio: fechasExport.fechaInicio,
          fechaFin: fechasExport.fechaFin,
          sucursal,
          viewMode
        });
      } else {
        exportToPDF({
          productos: todosLosProductos,
          fechaInicio: fechasExport.fechaInicio,
          fechaFin: fechasExport.fechaFin,
          sucursal,
          viewMode
        });
      }
      
      // Cerrar modal después de exportar
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      console.error('Error al exportar:', error);
      alert('Error al exportar datos. Por favor, inténtalo de nuevo.');
    } finally {
      setExportando(false);
    }
  };

  const diasEntreFechas = () => {
    const inicio = new Date(usarFechasActuales ? currentFechaInicio : fechaInicio);
    const fin = new Date(usarFechasActuales ? currentFechaFin : fechaFin);
    const diff = Math.ceil((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
    return diff + 1;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        role="button"
        tabIndex={0}
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        aria-label="Cerrar modal"
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-[var(--surface)] rounded-lg shadow-xl max-w-md w-full p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Download className="h-6 w-6 text-red-600 dark:text-red-400" />
              <h3 className="text-xl font-semibold text-[var(--foreground)]">
                Exportar Ranking
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Información actual */}
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-900 dark:text-red-100 mb-2">
              <span className="font-semibold">Productos a exportar:</span> {productos.length}
            </p>
            <p className="text-sm text-red-900 dark:text-red-100">
              <span className="font-semibold">Período actual:</span> {diasEntreFechas()} días
            </p>
          </div>

          {/* Opciones de fecha */}
          <div className="space-y-4 mb-6">
            {/* Opción: Usar fechas actuales */}
            <div className="flex items-start gap-3">
              <input
                id="usar-fechas-actuales"
                type="radio"
                checked={usarFechasActuales}
                onChange={() => setUsarFechasActuales(true)}
                className="mt-1 h-4 w-4 text-red-600 focus:ring-red-500 cursor-pointer"
              />
              <label htmlFor="usar-fechas-actuales" className="flex-1 cursor-pointer">
                <div className="font-medium text-[var(--foreground)]">
                  Usar fechas de filtros actuales
                </div>
                <div className="text-sm text-[var(--text-muted)] mt-1">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  {new Date(currentFechaInicio).toLocaleDateString('es-CL')} - {new Date(currentFechaFin).toLocaleDateString('es-CL')}
                </div>
              </label>
            </div>

            {/* Opción: Personalizar fechas */}
            <div className="flex items-start gap-3">
              <input
                id="personalizar-fechas"
                type="radio"
                checked={!usarFechasActuales}
                onChange={() => setUsarFechasActuales(false)}
                className="mt-1 h-4 w-4 text-red-600 focus:ring-red-500 cursor-pointer"
              />
              <label htmlFor="personalizar-fechas" className="flex-1 cursor-pointer">
                <div className="font-medium text-[var(--foreground)] mb-3">
                  Personalizar rango de fechas
                </div>
                
                {/* Campos de fecha */}
                {!usarFechasActuales && (
                  <div className="space-y-3 pl-1">
                    <div>
                      <label htmlFor="fecha-inicio" className="block text-sm font-medium text-[var(--foreground)] mb-1">
                        Desde
                      </label>
                      <input
                        id="fecha-inicio"
                        type="date"
                        value={fechaInicio}
                        onChange={(e) => setFechaInicio(e.target.value)}
                        max={fechaFin}
                        className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label htmlFor="fecha-fin" className="block text-sm font-medium text-[var(--foreground)] mb-1">
                        Hasta
                      </label>
                      <input
                        id="fecha-fin"
                        type="date"
                        value={fechaFin}
                        onChange={(e) => setFechaFin(e.target.value)}
                        min={fechaInicio}
                        className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Botones de exportación */}
          <div className="flex gap-3">
            <button
              onClick={() => handleExport('excel')}
              disabled={exportando}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="h-5 w-5" />
              {exportando ? 'Exportando...' : 'Excel'}
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled={exportando}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="h-5 w-5" />
              {exportando ? 'Exportando...' : 'PDF'}
            </button>
          </div>

          {/* Nota informativa */}
          <p className="mt-4 text-xs text-[var(--text-muted)] text-center">
            💡 Se exportarán <strong>todos los productos</strong> que coincidan con los filtros y fechas seleccionadas (no solo los {productos.length} mostrados en la página actual)
          </p>
        </div>
      </div>
    </div>
  );
}
