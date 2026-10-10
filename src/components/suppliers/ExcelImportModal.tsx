// components/ExcelImportModal.tsx
"use client";

import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import ExcelDropzone from "./ExcelDropzone"; // ⬅️ Componente con detección automática de columnas

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: () => void; // ⬅️ Callback para recargar datos
}

export default function ExcelImportModal({
  isOpen,
  onClose,
  onUploadComplete,
}: ExcelImportModalProps) {
  return (
    // Transition maneja las animaciones de entrada y salida del modal
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        {/* El fondo oscuro (overlay) - Opacidad muy reducida */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/80" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-900 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 dark:text-white"
                >
                  📤 Importar Catálogo de Proveedor
                </Dialog.Title>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Sube uno o varios archivos Excel. El sistema detectará
                  automáticamente las columnas.
                </p>

                <div className="mt-4">
                  {/* ✨ Componente con detección automática por aliases */}
                  <ExcelDropzone
                    onUploadComplete={() => {
                      // Llamar al callback si existe
                      if (onUploadComplete) {
                        onUploadComplete();
                      }
                      // Cerrar el modal después de una subida exitosa
                      setTimeout(() => {
                        onClose();
                      }, 2000);
                    }}
                  />
                </div>

                <div className="mt-6">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent 
                             bg-gray-100 dark:bg-gray-800 px-4 py-2 text-sm font-medium 
                             text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
                             transition-colors"
                    onClick={onClose}
                  >
                    Cerrar
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
