"use client";

import { AlertTriangle, X } from "lucide-react";
import { useEffect } from "react";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  providerName: string;
  isDeleting: boolean;
}

/**
 * Modal moderno de confirmación para eliminar proveedores
 * Con diseño profesional y animaciones suaves
 */
export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  providerName,
  isDeleting,
}: DeleteConfirmModalProps) {
  // Cerrar con tecla ESC
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isDeleting) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, isDeleting, onClose]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop con blur */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={!isDeleting ? onClose : undefined}
      />

      {/* Modal */}
      <div
        className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl 
                   max-w-md w-full transform transition-all animate-in zoom-in-95 duration-200"
      >
        {/* Header con icono de advertencia */}
        <div className="flex items-start gap-4 p-6 pb-4">
          <div
            className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 
                       flex items-center justify-center"
          >
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>

          <div className="flex-1 pt-1">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              ¿Eliminar Proveedor?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Esta acción no se puede deshacer
            </p>
          </div>

          {/* Botón cerrar */}
          {!isDeleting && (
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
          <div
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 
                       rounded-lg p-4 mb-4"
          >
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
              Estás a punto de eliminar el proveedor:
            </p>
            <p className="text-base font-bold text-gray-900 dark:text-white mb-3">
              {providerName}
            </p>
            <div className="space-y-2">
              <p className="text-sm text-red-600 dark:text-red-400 font-medium flex items-start gap-2">
                <span className="text-lg leading-none">⚠️</span>
                <span>
                  Se eliminarán <strong>todos los precios</strong> asociados a
                  este proveedor
                </span>
              </p>
              <p className="text-sm text-red-600 dark:text-red-400 font-medium flex items-start gap-2">
                <span className="text-lg leading-none">🗑️</span>
                <span>Los productos comparativos se verán afectados</span>
              </p>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 px-4 py-3 rounded-lg font-medium text-gray-700 dark:text-gray-300
                       bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 px-4 py-3 rounded-lg font-medium text-white
                       bg-red-600 hover:bg-red-700 active:bg-red-800
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  Eliminando...
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5" />
                  Sí, Eliminar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
