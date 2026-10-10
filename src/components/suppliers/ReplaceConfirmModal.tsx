"use client";

import { AlertTriangle, X, RefreshCw } from "lucide-react";
import { useEffect } from "react";

interface ReplaceConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  providerName: string;
  productsCount: number;
  isProcessing: boolean;
}

/**
 * Modal moderno de confirmación para reemplazo de catálogo
 * Diseño profesional con animaciones suaves
 */
export default function ReplaceConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  providerName,
  productsCount,
  isProcessing,
}: ReplaceConfirmModalProps) {
  // Cerrar con tecla ESC
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isProcessing) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, isProcessing, onClose]);

  // Prevenir scroll del body cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentDate = new Date().toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop con blur */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={!isProcessing ? onClose : undefined}
      />

      {/* Modal */}
      <div
        className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl 
                   max-w-lg w-full transform transition-all animate-in zoom-in-95 duration-200"
      >
        {/* Header con icono de advertencia */}
        <div className="flex items-start gap-4 p-6 pb-4">
          <div
            className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 
                       flex items-center justify-center animate-pulse"
          >
            <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
          </div>

          <div className="flex-1 pt-1">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              ⚠️ Confirmar Reemplazo de Datos
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Esta acción reemplazará el catálogo existente
            </p>
          </div>

          {/* Botón cerrar */}
          {!isProcessing && (
            <button
              onClick={onClose}
              className="flex-shrink-0 p-2 rounded-lg text-gray-400 hover:text-gray-600 
                       hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Contenido */}
        <div className="px-6 pb-6">
          {/* Info del proveedor */}
          <div
            className="bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 
                       border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-4"
          >
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
              El proveedor <strong>{providerName}</strong> ya existe en el
              sistema.
            </p>
            <div
              className="flex items-center gap-2 text-base font-bold text-orange-900 dark:text-orange-100 
                         bg-white/50 dark:bg-gray-800/50 rounded-lg px-3 py-2 mb-3"
            >
              <RefreshCw className="w-5 h-5" />
              <span>
                Se actualizarán{" "}
                <span className="text-orange-600 dark:text-orange-400">
                  {productsCount.toLocaleString("es-ES")}
                </span>{" "}
                productos
              </span>
            </div>

            {/* Lista de acciones */}
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-sm text-orange-700 dark:text-orange-300">
                <span className="text-lg leading-none flex-shrink-0">🗑️</span>
                <span>
                  Se <strong>ELIMINARÁN</strong> todos los precios anteriores de
                  este proveedor
                </span>
              </div>
              <div className="flex items-start gap-2 text-sm text-orange-700 dark:text-orange-300">
                <span className="text-lg leading-none flex-shrink-0">📥</span>
                <span>
                  Se <strong>INSERTARÁN</strong> los{" "}
                  {productsCount.toLocaleString("es-ES")} nuevos productos
                </span>
              </div>
              <div className="flex items-start gap-2 text-sm text-orange-700 dark:text-orange-300">
                <span className="text-lg leading-none flex-shrink-0">📅</span>
                <span>
                  La fecha de actualización se establecerá a{" "}
                  <strong>{currentDate}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Advertencia final */}
          <div
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 
                       rounded-lg p-3 mb-4"
          >
            <p className="text-sm text-red-700 dark:text-red-300 font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Esta acción NO se puede deshacer</span>
            </p>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 px-4 py-3 rounded-lg font-medium text-gray-700 dark:text-gray-300
                       bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={isProcessing}
              className="flex-1 px-4 py-3 rounded-lg font-medium text-white
                       bg-gradient-to-r from-orange-600 to-red-600 
                       hover:from-orange-700 hover:to-red-700 
                       active:from-orange-800 active:to-red-800
                       transition-all disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2 shadow-lg"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  Procesando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Sí, Reemplazar Catálogo
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
